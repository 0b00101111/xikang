// Simple data adapter for NeoDB data

function exportToCSV(processedData) {
    // Create CSV content for nodes
    let nodesCSV = 'id,name,type,shelf,rating,url\n';
    processedData.nodes.forEach(node => {
        nodesCSV += `${node.id},"${node.name || ''}",${node.type || ''},${node.shelf || ''},${node.rating || ''},${node.url || ''}\n`;
    });
    
    // Create CSV content for links
    let linksCSV = 'source,target,type\n';
    processedData.links.forEach(link => {
        linksCSV += `${link.source || ''},${link.target || ''},${link.type || ''}\n`;
    });
    
    // Log the CSVs for inspection
    console.log("=== NODES CSV ===");
    console.log(nodesCSV.slice(0, 500) + '... (truncated)');
    console.log("\n=== LINKS CSV ===");
    console.log(linksCSV.slice(0, 500) + '... (truncated)');
}

window.exportToCSV = exportToCSV;

// Process data from NeoDB format to graph visualization format
function processNeoDBAData(rawData) {
    try {
        console.log("=== RAW DATA INSPECTION ===");
        
        // If raw data is not in expected format, handle gracefully
        if (!rawData || typeof rawData !== 'object') {
            console.error('Invalid raw data format - not an object');
            return { nodes: [], links: [] };
        }
        
        // Log data structure for debugging
        console.log("Raw data structure:", {
            hasGraphData: !!rawData.graph_data,
            hasNodes: !!rawData.graph_data?.nodes,
            hasLinks: !!rawData.graph_data?.links,
            nodeCount: rawData.graph_data?.nodes?.length || 0,
            linkCount: rawData.graph_data?.links?.length || 0
        });

        // Start with an empty graph structure
        const processedData = {
            nodes: [],
            links: []
        };
        
        // Check if data is in the expected format
        if (!rawData.graph_data || !rawData.graph_data.nodes || !rawData.graph_data.links) {
            console.warn('Raw data missing expected structure, using empty dataset');
            return processedData;
        }
        
        // Create a unique ID set to avoid duplicates
        const nodeIds = new Set();
        
        // Process movie nodes first
        rawData.graph_data.nodes.forEach(node => {
            // Skip invalid nodes
            if (!node || !node.id) return;
            
            // Simple processing - just keeping essential properties
            // Filter only movie nodes
            if (node.type === 'movie' || node.type === 'media') {
                // Don't add duplicates
                if (nodeIds.has(node.id)) return;
                
                // Add to processed data
                processedData.nodes.push({
                    id: node.id,
                    name: node.name || 'Unnamed Movie',
                    type: 'movie',
                    shelf: node.shelf || 'unknown',
                    rating: node.rating || 0,
                    url: node.url || '',
                    // Include these additional properties expected by the visualization
                    data: {
                        url: node.url || '',
                        rating: node.rating || 0
                    }
                });
                
                nodeIds.add(node.id);
            }
        });
        
        // Create a shelf mapping from links
        const shelfMap = new Map();
        rawData.graph_data.links.forEach(link => {
            if (!link || !link.source || !link.target) return;
            
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (!sourceId || !targetId) return;
            
            if (sourceId?.startsWith('shelf_')) {
                shelfMap.set(targetId, sourceId.replace('shelf_', ''));
            } else if (targetId?.startsWith('shelf_')) {
                shelfMap.set(sourceId, targetId.replace('shelf_', ''));
            }
        });
        
        // Update movie shelves based on the mapping
        processedData.nodes.forEach(node => {
            if (node.type === 'movie' && shelfMap.has(node.id)) {
                node.shelf = shelfMap.get(node.id);
            }
        });
        
        // Process creator nodes
        rawData.graph_data.nodes.forEach(node => {
            // Skip invalid nodes
            if (!node || !node.id) return;
            
            // Process creator nodes
            if (node.type === 'person' || node.type === 'creator') {
                // Don't add duplicates
                if (nodeIds.has(node.id)) return;
                
                // Add to processed data
                processedData.nodes.push({
                    id: node.id,
                    name: node.name || 'Unnamed Creator',
                    type: 'creator',
                    role: node.role || 'unknown'
                });
                
                nodeIds.add(node.id);
            }
        });
        
        // Process links between valid nodes
        const validNodeIds = new Set(processedData.nodes.map(n => n.id));
        
        rawData.graph_data.links.forEach(link => {
            if (!link || !link.source || !link.target) return;
            
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (!sourceId || !targetId) return;
            
            // Skip shelf links - we already processed them
            if (sourceId.startsWith('shelf_') || targetId.startsWith('shelf_')) {
                return;
            }
            
            // Only keep links between valid nodes
            if (validNodeIds.has(sourceId) && validNodeIds.has(targetId)) {
                processedData.links.push({
                    source: sourceId,
                    target: targetId,
                    type: link.type || 'default'
                });
            }
        });
        
        // Log summary statistics
        const movieCount = processedData.nodes.filter(n => n.type === 'movie').length;
        const creatorCount = processedData.nodes.filter(n => n.type === 'creator').length;
        
        console.log("=== PROCESSED DATA SUMMARY ===");
        console.log(`Total nodes: ${processedData.nodes.length} (${movieCount} movies, ${creatorCount} creators)`);
        console.log(`Total links: ${processedData.links.length}`);
        
        // Log sample nodes for debugging
        if (processedData.nodes.length > 0) {
            console.log("Sample node:", processedData.nodes[0]);
        }
        if (processedData.links.length > 0) {
            console.log("Sample link:", processedData.links[0]);
        }
        
        return processedData;
    } catch (error) {
        console.error("Error processing data:", error);
        return { nodes: [], links: [] };
    }
}

// Export the function globally
window.processNeoDBAData = processNeoDBAData;
