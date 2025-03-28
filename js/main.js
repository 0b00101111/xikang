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
    
    // Load and process the data
    fetch('data/neodb-data.json')
        .then(response => response.json())
        .then(rawData => {
            console.log('=== Raw Data Loaded ===');
            console.log('Raw data structure:', rawData);

            // Process the data
            const processedData = processNeoDBAData(rawData);
            
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
            graphVisualization.init('graph-container', processedData);

            // Add event listeners for zoom controls
            document.getElementById('zoom-in').addEventListener('click', graphVisualization.zoomIn);
            document.getElementById('zoom-out').addEventListener('click', graphVisualization.zoomOut);
            document.getElementById('reset-view').addEventListener('click', graphVisualization.resetView);
            
            // Add window resize handler
            window.addEventListener('resize', () => {
                graphVisualization.resize();
            });

            // Export data to CSV for debugging
            exportToCSV(processedData);
            
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
