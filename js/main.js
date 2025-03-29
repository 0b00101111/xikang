// Main application code for NeoDB visualization

document.addEventListener('DOMContentLoaded', () => {
    const loadingElement = document.getElementById('loading');
    
    // Function to show error message
    function showError(message) {
        loadingElement.innerHTML = `
            <div class="error-message" style="color: #ff0000; text-align: center; padding: 20px;">
                ${message}
                <div style="margin-top: 15px;">
                    <button id="loadSampleData" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Load Sample Data
                    </button>
                </div>
            </div>
        `;
        
        // Add event listener for the sample data button
        document.getElementById('loadSampleData').addEventListener('click', loadSampleData);
    }
    
    // Function to load sample data if real data is unavailable
    function loadSampleData() {
        console.log('Loading sample data...');
        
        // Create a small sample dataset
        const sampleData = {
            nodes: [
                { id: 'movie1', name: 'The Shawshank Redemption', type: 'movie', shelf: 'complete' },
                { id: 'movie2', name: 'The Godfather', type: 'movie', shelf: 'complete' },
                { id: 'movie3', name: 'Pulp Fiction', type: 'movie', shelf: 'complete' },
                { id: 'movie4', name: 'Inception', type: 'movie', shelf: 'wishlist' },
                { id: 'creator1', name: 'Francis Ford Coppola', type: 'creator', role: 'director' },
                { id: 'creator2', name: 'Quentin Tarantino', type: 'creator', role: 'director' },
                { id: 'creator3', name: 'Christopher Nolan', type: 'creator', role: 'director' },
                { id: 'creator4', name: 'Al Pacino', type: 'creator', role: 'actor' },
                { id: 'creator5', name: 'Morgan Freeman', type: 'creator', role: 'actor' },
                { id: 'creator6', name: 'Leonardo DiCaprio', type: 'creator', role: 'actor' }
            ],
            links: [
                { source: 'creator1', target: 'movie2', type: 'directed' },
                { source: 'creator2', target: 'movie3', type: 'directed' },
                { source: 'creator3', target: 'movie4', type: 'directed' },
                { source: 'creator4', target: 'movie2', type: 'acted_in' },
                { source: 'creator5', target: 'movie1', type: 'acted_in' },
                { source: 'creator6', target: 'movie4', type: 'acted_in' }
            ]
        };
        
        // Initialize the visualization with sample data
        loadingElement.innerHTML = '<div class="spinner"></div>';
        setTimeout(() => {
            try {
                graphVisualization.init('graph-container', sampleData);
                
                // Add event listeners for zoom controls if they exist
                const zoomIn = document.getElementById('zoom-in');
                const zoomOut = document.getElementById('zoom-out');
                const resetView = document.getElementById('reset-view');
                
                if (zoomIn && typeof graphVisualization.zoomIn === 'function') {
                    zoomIn.addEventListener('click', graphVisualization.zoomIn);
                }
                if (zoomOut && typeof graphVisualization.zoomOut === 'function') {
                    zoomOut.addEventListener('click', graphVisualization.zoomOut);
                }
                if (resetView && typeof graphVisualization.resetView === 'function') {
                    resetView.addEventListener('click', graphVisualization.resetView);
                }
                
                // Hide loading indicator
                loadingElement.style.display = 'none';
            } catch (error) {
                console.error('Error initializing with sample data:', error);
                showError(`Failed to initialize visualization: ${error.message}`);
            }
        }, 500);
    }
    
    // Load and process the data
    fetch('data/neodb-data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(rawData => {
            console.log('=== Raw Data Loaded ===');
            
            // Validate data structure
            if (!rawData || !rawData.graph_data) {
                throw new Error("Invalid data structure: Missing graph_data");
            }
            
            console.log('Raw data structure:', {
                graphDataPresent: !!rawData.graph_data,
                nodesPresent: Array.isArray(rawData.graph_data?.nodes),
                nodeCount: rawData.graph_data?.nodes?.length || 0,
                linksPresent: Array.isArray(rawData.graph_data?.links),
                linkCount: rawData.graph_data?.links?.length || 0
            });

            // Check if data is empty or invalid
            if (!rawData.graph_data.nodes || rawData.graph_data.nodes.length === 0) {
                throw new Error("Empty or invalid dataset: No nodes found");
            }

            // Process the data
            const processedData = processNeoDBAData(rawData);
            
            // Additional validation
            if (!processedData || !Array.isArray(processedData.nodes) || processedData.nodes.length === 0) {
                throw new Error("Data processing failed: No nodes in processed data");
            }
            
            console.log('=== Processed Data ===');
            console.log('Total nodes:', processedData.nodes.length);
            console.log('Node types:', processedData.nodes.reduce((acc, n) => {
                acc[n.type] = (acc[n.type] || 0) + 1;
                return acc;
            }, {}));
            console.log('Sample nodes:', processedData.nodes.slice(0, 3));
            
            console.log('Total links:', processedData.links.length);
            console.log('Link types:', processedData.links.reduce((acc, l) => {
                acc[l.type] = (acc[l.type] || 0) + 1;
                return acc;
            }, {}));
            console.log('Sample links:', processedData.links.slice(0, 3));

            // Initialize the visualization
            try {
                graphVisualization.init('graph-container', processedData);

                // Add event listeners for zoom controls if they exist
                const zoomIn = document.getElementById('zoom-in');
                const zoomOut = document.getElementById('zoom-out');
                const resetView = document.getElementById('reset-view');
                
                if (zoomIn && typeof graphVisualization.zoomIn === 'function') {
                    zoomIn.addEventListener('click', graphVisualization.zoomIn);
                }
                if (zoomOut && typeof graphVisualization.zoomOut === 'function') {
                    zoomOut.addEventListener('click', graphVisualization.zoomOut);
                }
                if (resetView && typeof graphVisualization.resetView === 'function') {
                    resetView.addEventListener('click', graphVisualization.resetView);
                }
                
                // Add window resize handler
                window.addEventListener('resize', () => {
                    if (typeof graphVisualization.resize === 'function') {
                        graphVisualization.resize();
                    }
                });

                // Export data to CSV for debugging
                exportToCSV(processedData);
                
                // Hide loading indicator
                loadingElement.style.display = 'none';
            } catch (error) {
                console.error('Error initializing visualization:', error);
                showError(`Failed to initialize visualization: ${error.message}`);
            }
        })
        .catch(error => {
            console.error('Error loading or processing data:', error);
            document.getElementById('graph-container').innerHTML = 
                '<div class="error-message" style="text-align: center; padding: 20px; color: #ff0000;">Error loading visualization data</div>';
            showError('Failed to load data: ' + error.message);
        });
});
