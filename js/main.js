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
            
            // Detailed data inspection
            console.log("=== DETAILED DATA INSPECTION ===");
            console.log("Raw data structure:", {
                hasGraphData: !!rawData.graph_data,
                totalRawNodes: rawData.graph_data?.nodes?.length || 0,
                totalRawLinks: rawData.graph_data?.links?.length || 0
            });
            
            if (!processedData) {
                throw new Error('Data processing failed - no data returned');
            }
            
            console.log("\nProcessed data structure:");
            console.log("Total nodes:", processedData.nodes.length);
            console.log("Node breakdown:", processedData.nodes.reduce((acc, node) => {
                acc[node.type] = acc[node.type] || { total: 0, examples: [] };
                acc[node.type].total++;
                if (acc[node.type].examples.length < 3) {
                    acc[node.type].examples.push({
                        id: node.id,
                        name: node.name,
                        type: node.type,
                        role: node.role
                    });
                }
                return acc;
            }, {}));
            
            console.log("\nTotal links:", processedData.links.length);
            console.log("Link breakdown:", processedData.links.reduce((acc, link) => {
                acc[link.type] = acc[link.type] || { total: 0, examples: [] };
                acc[link.type].total++;
                if (acc[link.type].examples.length < 3) {
                    acc[link.type].examples.push({
                        source: link.source,
                        target: link.target,
                        type: link.type
                    });
                }
                return acc;
            }, {}));
            
            // Verify data integrity
            const nodeIds = new Set(processedData.nodes.map(n => n.id));
            const invalidLinks = processedData.links.filter(link => 
                !nodeIds.has(typeof link.source === 'object' ? link.source.id : link.source) ||
                !nodeIds.has(typeof link.target === 'object' ? link.target.id : link.target)
            );
            
            if (invalidLinks.length > 0) {
                console.error("Found invalid links:", invalidLinks);
            }
            
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
