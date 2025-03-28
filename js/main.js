// Main application code for NeoDB visualization

document.addEventListener('DOMContentLoaded', function() {
    const loadingElement = document.getElementById('loading');
    
    // Function to show error message
    function showError(message) {
        loadingElement.innerHTML = `
            <div class="error-message" style="color: #ff0000; text-align: center; padding: 20px;">
                ${message}
            </div>
        `;
    }
    
    // Zoom control event listeners
    document.getElementById('zoom-in').addEventListener('click', function() {
        if (window.graphVisualization) {
            window.graphVisualization.zoomIn();
        }
    });
    
    document.getElementById('zoom-out').addEventListener('click', function() {
        if (window.graphVisualization) {
            window.graphVisualization.zoomOut();
        }
    });
    
    document.getElementById('reset-view').addEventListener('click', function() {
        if (window.graphVisualization) {
            window.graphVisualization.resetView();
        }
    });
    
    // Load data and initialize visualization
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
                const processedData = processNeoDBAData(rawData);
                    
                if (!processedData) {
                        throw new Error('Data processing failed');
                    }
                    
                console.log("Processed data:", processedData);
                    
                    // Initialize graph visualization
                window.graphVisualization.init('graph-container', processedData);
                
                // Hide loading indicator
                loadingElement.style.display = 'none';
                } catch (processingError) {
                    console.error('Error processing data:', processingError);
                showError('Failed to process data: ' + processingError.message);
                }
            })
            .catch(error => {
                console.error('Error loading data:', error);
            showError('Failed to load data: ' + error.message);
        });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.graphVisualization && window.graphVisualization.resize) {
            window.graphVisualization.resize();
        }
    });
});
