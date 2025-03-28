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
            .then(data => {
                graphData = data;
                
                // Update last updated date if available
                if (data.metadata && data.metadata.lastUpdated) {
                    const lastUpdated = new Date(data.metadata.lastUpdated);
                    lastUpdatedSpan.textContent = lastUpdated.toLocaleDateString() + ' ' + lastUpdated.toLocaleTimeString();
                } else {
                    lastUpdatedSpan.textContent = 'Unknown';
                }
                
                // Initialize graph visualization
                initializeVisualization(data);
                
                // Create dynamic legend
                createLegend(data);
                
                showLoading(false);
            })
            .catch(error => {
                console.error('Error loading data:', error);
                showLoading(false);
                alert('Failed to load data. Please try again later.');
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
    
    // Create HTML for media details
    function createMediaDetailsHTML(node) {
        const category = node.category || 'unknown';
        
        let html = `
            <div class="media-details">
                <div class="media-title">${node.name}</div>
                <div class="media-type ${category}">${capitalizeFirstLetter(category)}</div>
                <div class="media-metadata">
        `;
        
        // Add year if available
        if (node.year) {
            html += `
                <div class="meta-item">
                    <div class="meta-label">Year:</div>
                    <div>${node.year}</div>
                </div>
            `;
        }
        
        // Add rating if available
        if (node.rating) {
            html += `
                <div class="meta-item">
                    <div class="meta-label">Rating:</div>
                    <div>${node.rating}/10</div>
                </div>
            `;
        }
        
        // Add date logged if available
        if (node.date_logged) {
            const dateLogged = new Date(node.date_logged);
            html += `
                <div class="meta-item">
                    <div class="meta-label">Logged:</div>
                    <div>${dateLogged.toLocaleDateString()}</div>
                </div>
            `;
        }
        
        // Add media-specific info
        if (category === 'book' && node.pages) {
            html += `
                <div class="meta-item">
                    <div class="meta-label">Pages:</div>
                    <div>${node.pages}</div>
                </div>
            `;
        } else if ((category === 'movie' || category === 'tvseries') && node.duration) {
            html += `
                <div class="meta-item">
                    <div class="meta-label">Duration:</div>
                    <div>${node.duration}</div>
                </div>
            `;
        }
        
        html += `
                </div>
        `;
        
        // Add action buttons
        if (node.url) {
            html += `
                <div class="media-actions">
                    <button class="action-btn">View on NeoDB</button>
                </div>
            `;
        }
        
        html += `</div>`;
        
        return html;
    }
    
    // Create HTML for creator details
    function createCreatorDetailsHTML(node) {
        const category = node.category || 'creator';
        
        let html = `
            <div class="media-details">
                <div class="media-title">${node.name}</div>
                <div class="media-type">${capitalizeFirstLetter(category)}</div>
                <div class="media-metadata">
        `;
        
        // Add number of works if available
        if (node.media_count) {
            html += `
                <div class="meta-item">
                    <div class="meta-label">Works:</div>
                    <div>${node.media_count}</div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    // Create HTML for genre details
    function createGenreDetailsHTML(node) {
        let html = `
            <div class="media-details">
                <div class="media-title">${node.name}</div>
                <div class="media-type">Genre</div>
                <div class="media-metadata">
        `;
        
        // Add number of works if available
        if (node.media_count) {
            html += `
                <div class="meta-item">
                    <div class="meta-label">Media:</div>
                    <div>${node.media_count}</div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    // Create HTML for tag details
    function createTagDetailsHTML(node) {
        let html = `
            <div class="media-details">
                <div class="media-title">${node.name}</div>
                <div class="media-type">Tag</div>
                <div class="media-metadata">
        `;
        
        // Add number of works if available
        if (node.media_count) {
            html += `
                <div class="meta-item">
                    <div class="meta-label">Media:</div>
                    <div>${node.media_count}</div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
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
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Helper function to get color for media type
    function getColorForMediaType(type) {
        const colorMap = {
            movie: 'var(--movie-color)',
            book: 'var(--book-color)',
            tvseries: 'var(--tvseries-color)',
            music: 'var(--music-color)',
            podcast: 'var(--podcast-color)'
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
