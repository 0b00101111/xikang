// Main application code for NeoDB visualization

document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    let graphData = null;
    let currentCategory = 'all';
    let searchTerm = '';
    
    // DOM elements
    const loadingElement = document.getElementById('loading');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const zoomInButton = document.getElementById('zoom-in');
    const zoomOutButton = document.getElementById('zoom-out');
    const resetViewButton = document.getElementById('reset-view');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-btn');
    const lastUpdatedSpan = document.getElementById('last-updated');
    const infoContent = document.getElementById('info-content');
    
    // Load the data
    loadData();
    
    // Event listeners
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active state for buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Set current category and update graph
            currentCategory = this.dataset.category;
            if (graphVisualization) {
                graphVisualization.filterByCategory(currentCategory);
            }
        });
    });
    
    zoomInButton.addEventListener('click', function() {
        if (graphVisualization) {
            graphVisualization.zoomIn();
        }
    });
    
    zoomOutButton.addEventListener('click', function() {
        if (graphVisualization) {
            graphVisualization.zoomOut();
        }
    });
    
    resetViewButton.addEventListener('click', function() {
        if (graphVisualization) {
            graphVisualization.resetView();
        }
    });
    
    searchInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
    
    searchButton.addEventListener('click', performSearch);
    
    // Function to load data from JSON file
    function loadData() {
        showLoading(true);
        
        fetch('data/neodb-data.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(rawData => {
                console.log("Raw data loaded:", rawData);
                
                // Process the data using the adapter
                try {
                    graphData = processNeoDBAData(rawData);
                    
                    if (!graphData) {
                        throw new Error('Data processing failed');
                    }
                    
                    console.log("Processed data:", graphData);
                    
                    // Update last updated date if available
                    if (graphData.metadata && graphData.metadata.lastUpdated) {
                        const lastUpdated = new Date(graphData.metadata.lastUpdated);
                        lastUpdatedSpan.textContent = lastUpdated.toLocaleDateString() + ' ' + lastUpdated.toLocaleTimeString();
                    } else {
                        lastUpdatedSpan.textContent = 'Unknown';
                    }
                    
                    // Initialize graph visualization
                    initializeVisualization(graphData);
                    
                    // Create dynamic legend
                    createLegend(graphData);
                    
                    showLoading(false);
                } catch (processingError) {
                    console.error('Error processing data:', processingError);
                    showLoading(false);
                    alert('Failed to process data: ' + processingError.message);
                }
            })
            .catch(error => {
                console.error('Error loading data:', error);
                showLoading(false);
                alert('Failed to load data: ' + error.message);
            });
    }
    
    // Initialize the graph visualization
    function initializeVisualization(data) {
        // Create and initialize the graph visualization
        // This function is defined in graph.js
        graphVisualization.init('graph-container', data, {
            onNodeClick: showNodeDetails,
            onNodeHover: null, // Optional hover callback
            width: document.getElementById('graph-container').clientWidth,
            height: document.getElementById('graph-container').clientHeight
        });
    }
    
    // Create dynamic legend based on data
    function createLegend(data) {
        const legendContainer = document.getElementById('dynamic-legend');
        const mediaTypes = data.metadata?.mediaTypes || [];
        const creatorTypes = data.metadata?.creatorTypes || [];
        
        // Clear existing legend
        legendContainer.innerHTML = '';
        
        // Create legend items for media types
        mediaTypes.forEach(type => {
            const item = createLegendItem(type, `media-${type}`, getColorForMediaType(type));
            legendContainer.appendChild(item);
        });
        
        // Create legend items for creator types
        creatorTypes.forEach(type => {
            const item = createLegendItem(type, `creator-${type}`, getColorForCreatorType(type));
            legendContainer.appendChild(item);
        });
        
        // Add genre and tag legend items
        const genreItem = createLegendItem('Genre', 'genre', 'var(--genre-color)');
        const tagItem = createLegendItem('Tag', 'tag', 'var(--tag-color)');
        
        legendContainer.appendChild(genreItem);
        legendContainer.appendChild(tagItem);
    }
    
    // Create a legend item element
    function createLegendItem(label, filterType, color) {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.dataset.filter = filterType;
        
        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = color;
        
        const text = document.createElement('span');
        text.textContent = capitalizeFirstLetter(label);
        
        item.appendChild(colorBox);
        item.appendChild(text);
        
        // Add click event to toggle visibility
        item.addEventListener('click', function() {
            if (graphVisualization) {
                graphVisualization.toggleNodeType(filterType);
                
                // Toggle visual selected state
                this.classList.toggle('legend-selected');
            }
        });
        
        return item;
    }
    
    // Show node details in the info panel
    function showNodeDetails(node) {
        if (!node) {
            infoContent.innerHTML = '<p class="info-placeholder">Click on a node to view details</p>';
            return;
        }
        
        let html = '';
        
        if (node.type === 'media') {
            html = createMediaDetailsHTML(node);
        } else if (node.type === 'creator') {
            html = createCreatorDetailsHTML(node);
        } else if (node.type === 'genre') {
            html = createGenreDetailsHTML(node);
        } else if (node.type === 'tag') {
            html = createTagDetailsHTML(node);
        } else if (node.type === 'user') {
            html = createUserDetailsHTML(node);
        }
        
        infoContent.innerHTML = html;
        
        // Add event listeners to action buttons if needed
        const viewButton = infoContent.querySelector('.action-btn');
        if (viewButton && node.url) {
            viewButton.addEventListener('click', function() {
                window.open(node.url, '_blank');
            });
        }
    }
    
    // Create HTML for media (movie) details
    function createMediaDetailsHTML(node) {
        let html = `
            <div class="media-details">
                <h3>${node.name}</h3>
                <div class="details-section">
                    <p><strong>Status:</strong> ${capitalizeFirstLetter(node.shelf || 'Unknown')}</p>
                    ${node.rating ? `<p><strong>Rating:</strong> ${node.rating}/10</p>` : ''}
                    ${node.url ? `<p><strong>URL:</strong> <a href="${node.url}" target="_blank">View on NeoDB</a></p>` : ''}
                </div>
                
                <div class="details-section">
                    <h4>Connected Creators</h4>
                    <div class="connected-creators">
                        ${getConnectedCreatorsHTML(node)}
                    </div>
                </div>
            </div>
        `;
        return html;
    }
    
    // Create HTML for creator (director/actor) details
    function createCreatorDetailsHTML(node) {
        let html = `
            <div class="creator-details">
                <h3>${node.name}</h3>
                <div class="details-section">
                    <p><strong>Role:</strong> ${capitalizeFirstLetter(node.role || 'Creator')}</p>
                </div>
                
                <div class="details-section">
                    <h4>Connected Movies</h4>
                    <div class="connected-movies">
                        ${getConnectedMoviesHTML(node)}
                    </div>
                </div>
            </div>
        `;
        return html;
    }
    
    // Create HTML for genre details
    function createGenreDetailsHTML(node) {
        let html = `
            <div class="genre-details">
                <h3>${node.name}</h3>
                <div class="details-section">
                    <h4>Movies in this Genre</h4>
                    <div class="genre-movies">
                        ${getConnectedMoviesHTML(node)}
                    </div>
                </div>
            </div>
        `;
        return html;
    }
    
    // Create HTML for tag details
    function createTagDetailsHTML(node) {
        let html = `
            <div class="tag-details">
                <h3>${node.name}</h3>
                <div class="details-section">
                    <h4>Tagged Items</h4>
                    <div class="tagged-items">
                        ${getConnectedMoviesHTML(node)}
                    </div>
                </div>
            </div>
        `;
        return html;
    }
    
    // Create HTML for user details
    function createUserDetailsHTML(node) {
        let html = `
            <div class="user-details">
                <h3>${node.name}</h3>
                <div class="details-section">
                    <h4>Collection Statistics</h4>
                    <p><strong>Total Items:</strong> ${node.totalItems || 0}</p>
                    <p><strong>Movies:</strong> ${node.movieCount || 0}</p>
                    <p><strong>In Progress:</strong> ${node.inProgressCount || 0}</p>
                    <p><strong>Completed:</strong> ${node.completedCount || 0}</p>
                </div>
            </div>
        `;
        return html;
    }
    
    // Helper function to get HTML for connected creators
    function getConnectedCreatorsHTML(node) {
        const connectedCreators = graphData.links
            .filter(link => 
                (typeof link.target === 'object' ? link.target.id === node.id : link.target === node.id) &&
                graphData.nodes.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source) && n.type === 'creator')
            )
            .map(link => graphData.nodes.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source)))
            .filter(Boolean);

        return connectedCreators.map(creator => `
            <div class="connected-item">
                <span class="creator-role">${capitalizeFirstLetter(creator.role)}:</span>
                <span class="creator-name">${creator.name}</span>
            </div>
        `).join('');
    }
    
    // Helper function to get HTML for connected movies
    function getConnectedMoviesHTML(node) {
        const connectedMovies = graphData.links
            .filter(link => 
                (typeof link.source === 'object' ? link.source.id === node.id : link.source === node.id) &&
                graphData.nodes.find(n => n.id === (typeof link.target === 'object' ? link.target.id : link.target) && n.type === 'movie')
            )
            .map(link => graphData.nodes.find(n => n.id === (typeof link.target === 'object' ? link.target.id : link.target)))
            .filter(Boolean);

        return connectedMovies.map(movie => `
            <div class="connected-item">
                <span class="movie-name">${movie.name}</span>
                ${movie.rating ? `<span class="movie-rating">(${movie.rating}/10)</span>` : ''}
            </div>
        `).join('');
    }
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Function to perform search
    function performSearch() {
        searchTerm = searchInput.value.trim().toLowerCase();
        if (graphVisualization) {
            graphVisualization.searchNodes(searchTerm);
        }
    }
    
    // Helper function to show/hide loading indicator
    function showLoading(show) {
        loadingElement.style.display = show ? 'flex' : 'none';
    }
    
    // Helper function to get color for media type
    function getColorForMediaType(type) {
        const colorMap = {
            movie: 'var(--movie-color)',
            book: 'var(--book-color)',
            tvseries: 'var(--tvseries-color)',
            music: 'var(--music-color)',
            podcast: 'var(--podcast-color)',
            game: 'var(--game-color)' // Added game color
        };
        
        return colorMap[type] || 'var(--primary-color)';
    }
    
    // Helper function to get color for creator type
    function getColorForCreatorType(type) {
        const colorMap = {
            director: 'var(--director-color)',
            author: 'var(--author-color)',
            actor: 'var(--actor-color)',
            musician: 'var(--musician-color)'
        };
        
        return colorMap[type] || 'var(--secondary-color)';
    }
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (graphVisualization) {
            graphVisualization.resize(
                document.getElementById('graph-container').clientWidth,
                document.getElementById('graph-container').clientHeight
            );
        }
    });
});
