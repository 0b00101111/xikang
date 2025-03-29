// Main application code for NeoDB visualization

document.addEventListener('DOMContentLoaded', initializeApp);

// Error display function
function showError(message) {
    document.getElementById('loading').style.display = 'none';
    
    const errorElement = document.getElementById('error');
    errorElement.style.display = 'block';
    errorElement.innerHTML = `
        <div class="error-message">
            <h3>Error</h3>
            <p>${message}</p>
            <button id="load-sample-data">Load Sample Data</button>
        </div>
    `;
    
    document.getElementById('load-sample-data').addEventListener('click', loadSampleData);
}

// Sample data function
function loadSampleData() {
    console.log("Loading sample data...");
    document.getElementById('error').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
    
    // Simple sample dataset with 4 movies and 6 creators
    const sampleData = {
        graph_data: {
            nodes: [
                { id: 'movie1', name: 'Movie 1', type: 'movie', shelf: 'complete', rating: 5 },
                { id: 'movie2', name: 'Movie 2', type: 'movie', shelf: 'wishlist', rating: 0 },
                { id: 'movie3', name: 'Movie 3', type: 'movie', shelf: 'progress', rating: 4 },
                { id: 'movie4', name: 'Movie 4', type: 'movie', shelf: 'dropped', rating: 2 },
                { id: 'creator1', name: 'Director A', type: 'person', role: 'director' },
                { id: 'creator2', name: 'Actor B', type: 'person', role: 'actor' },
                { id: 'creator3', name: 'Playwright C', type: 'person', role: 'playwright' },
                { id: 'creator4', name: 'Actor D', type: 'person', role: 'actor' },
                { id: 'creator5', name: 'Director E', type: 'person', role: 'director' },
                { id: 'creator6', name: 'Actor F', type: 'person', role: 'actor' }
            ],
            links: [
                { source: 'creator1', target: 'movie1', type: 'directed' },
                { source: 'creator2', target: 'movie1', type: 'acted_in' },
                { source: 'creator3', target: 'movie2', type: 'wrote' },
                { source: 'creator4', target: 'movie2', type: 'acted_in' },
                { source: 'creator5', target: 'movie3', type: 'directed' },
                { source: 'creator5', target: 'movie4', type: 'directed' },
                { source: 'creator6', target: 'movie3', type: 'acted_in' },
                { source: 'creator2', target: 'movie4', type: 'acted_in' },
                { source: 'creator4', target: 'movie3', type: 'acted_in' }
            ]
        }
    };
    
    try {
        const processedData = window.processNeoDBAData(sampleData);
        initializeGraph(processedData);
    } catch (error) {
        console.error("Error processing sample data:", error);
        showError("Failed to load sample data: " + error.message);
    }
}

// Initialize the application
function initializeApp() {
    console.log("Initializing NeoDB visualization app");

    // Initialize loading spinner
    document.getElementById('loading').style.display = 'block';
    
    // Initialize event listeners for graph controls
    initializeControlListeners();
    
    // Load data from JSON file
    loadData();
}

// Load data from JSON file
function loadData() {
    console.log("Loading data from file...");
    
    fetch('./data/neodb-data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Data loaded, processing...");
            if (!data || typeof data !== 'object') {
                throw new Error("Invalid data format");
            }
            
            // Process the raw data
            try {
                const processedData = window.processNeoDBAData(data);
                
                // Check if processed data has nodes
                if (!processedData || !processedData.nodes || processedData.nodes.length === 0) {
                    throw new Error("No nodes found in processed data");
                }
                
                console.log(`Processed ${processedData.nodes.length} nodes and ${processedData.links.length} links`);
                initializeGraph(processedData);
                
                // Export data to CSV if needed
                if (window.exportToCSV) {
                    window.exportToCSV(processedData);
                }
            } catch (error) {
                console.error("Error processing data:", error);
                showError("Failed to load data: " + error.message);
            }
        })
        .catch(error => {
            console.error("Error loading data:", error);
            showError("Failed to load data: " + error.message);
        });
}

// Initialize the graph visualization
function initializeGraph(data) {
    console.log("Initializing graph with data:", {
        nodesCount: data.nodes.length,
        linksCount: data.links.length
    });
    
    // Hide loading spinner
    document.getElementById('loading').style.display = 'none';
    
    // Show graph
    document.getElementById('graph-container').style.display = 'block';
    
    // Initialize the graph using the existing graphVisualization
    try {
        window.graphVisualization.init('graph-container', data);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            window.graphVisualization.resize();
        });
    } catch (error) {
        console.error("Error initializing graph:", error);
        showError("Failed to initialize graph: " + error.message);
    }
}

// Initialize control listeners
function initializeControlListeners() {
    // Shelf filters
    document.querySelectorAll('.shelf-filter').forEach(button => {
        button.addEventListener('click', function() {
            const shelf = this.dataset.shelf;
            
            if (window.graphVisualization) {
                window.graphVisualization.filterByShelf(shelf);
                
                // Toggle active class
                document.querySelectorAll('.shelf-filter').forEach(btn => {
                    btn.classList.remove('active');
                });
                this.classList.add('active');
            }
        });
    });
    
    // Type filters
    document.querySelectorAll('.type-filter').forEach(button => {
        button.addEventListener('click', function() {
            const type = this.dataset.type;
            
            if (window.graphVisualization) {
                window.graphVisualization.filterByType(type);
                
                // Toggle active class
                document.querySelectorAll('.type-filter').forEach(btn => {
                    btn.classList.remove('active');
                });
                this.classList.add('active');
            }
        });
    });
    
    // Zoom controls
    document.getElementById('zoom-in')?.addEventListener('click', function() {
        if (window.graphVisualization) window.graphVisualization.zoomIn();
    });
    
    document.getElementById('zoom-out')?.addEventListener('click', function() {
        if (window.graphVisualization) window.graphVisualization.zoomOut();
    });
    
    document.getElementById('zoom-reset')?.addEventListener('click', function() {
        if (window.graphVisualization) window.graphVisualization.resetView();
    });
}
