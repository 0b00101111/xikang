// Main application code for NeoDB visualization

document.addEventListener('DOMContentLoaded', () => {
    const loadingElement = document.getElementById('loading');
    
    // Function to show error message
    function showError(message) {
        loadingElement.innerHTML = `
            <div class="error-message" style="color: #ff0000; text-align: center; padding: 20px;">
                ${message}
            </div>
        `;
    }
    
    // Load data from the JSON file
    fetch('data/neodb-data.json')
        .then(response => response.json())
        .then(rawData => {
            // Process the data
            const processedData = processNeoDBAData(rawData);
            
            // Debug: Log the processed data structure
            console.log("=== PROCESSED DATA ===");
            console.log("Total nodes:", processedData.nodes.length);
            console.log("Node types:", processedData.nodes.reduce((acc, node) => {
                acc[node.type] = (acc[node.type] || 0) + 1;
                return acc;
            }, {}));
            console.log("Total links:", processedData.links.length);
            console.log("Link types:", processedData.links.reduce((acc, link) => {
                acc[link.type] = (acc[link.type] || 0) + 1;
                return acc;
            }, {}));
            
            // Initialize the visualization
            graphVisualization.init('graph-container', processedData);
            
            // Add event listeners for zoom controls
            document.getElementById('zoom-in').addEventListener('click', graphVisualization.zoomIn);
            document.getElementById('zoom-out').addEventListener('click', graphVisualization.zoomOut);
            document.getElementById('reset-view').addEventListener('click', graphVisualization.resetView);
            
            // Add window resize handler
            window.addEventListener('resize', graphVisualization.resize);
            
            // Hide loading indicator
            loadingElement.style.display = 'none';
        })
        .catch(error => {
            console.error('Error loading or processing data:', error);
            document.getElementById('graph-container').innerHTML = 
                '<div class="error-message">Error loading visualization data</div>';
            showError('Failed to load data: ' + error.message);
        });
});
