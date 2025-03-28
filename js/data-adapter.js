// Movie-only NeoDB Data Adapter
// This script converts the data from NeoDB API to show only movie items

function exportToCSV(processedData) {
    // Create CSV content for nodes
    let nodesCSV = 'id,name,type,shelf,rating,url\n';
    processedData.nodes.forEach(node => {
        nodesCSV += `${node.id},"${node.name}",${node.type},${node.shelf},${node.rating || ''},${node.url || ''}\n`;
    });
    
    // Create CSV content for links
    let linksCSV = 'source,target,type\n';
    processedData.links.forEach(link => {
        linksCSV += `${link.source},${link.target},${link.type}\n`;
    });
    
    // Log the CSVs for inspection
    console.log("=== NODES CSV ===");
    console.log(nodesCSV);
    console.log("\n=== LINKS CSV ===");
    console.log(linksCSV);
}

function processNeoDBAData(rawData) {
    try {
        console.log("=== RAW DATA INSPECTION ===");
        console.log("Raw data structure:", {
            totalNodes: rawData.graph_data?.nodes?.length,
            totalLinks: rawData.graph_data?.links?.length,
            sampleNode: rawData.graph_data?.nodes?.[0]
        });

        // Check if data is in the expected format
        if (!rawData?.graph_data?.nodes || !rawData?.graph_data?.links) {
            throw new Error("Invalid data format: Missing nodes or links");
        }

        // Start with an empty graph structure
        const processedData = {
            nodes: [],
            links: []
        };
        
        // Track node IDs to avoid duplicates
        const nodeIds = new Set();
        const creatorIds = new Set();
        
        // First pass: Create a map of all nodes for quick lookup
        const nodeMap = new Map();
        rawData.graph_data.nodes.forEach(node => {
            nodeMap.set(node.id, node);
        });
        
        // Filter movie nodes and create shelf mapping
        const shelfMap = new Map();
        rawData.graph_data.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (sourceId?.startsWith('shelf_')) {
                shelfMap.set(targetId, sourceId.replace('shelf_', ''));
            } else if (targetId?.startsWith('shelf_')) {
                shelfMap.set(sourceId, targetId.replace('shelf_', ''));
            }
        });

        // Process movie nodes
        const movieNodes = rawData.graph_data.nodes.filter(node => 
            node.type === 'movie' || 
            node.category === 'movie' || 
            (node.type === 'media' && node.category === 'movie')
        );

        console.log(`Found ${movieNodes.length} movie nodes`);

        // Process each movie node
        movieNodes.forEach(node => {
            const nodeId = node.id;
            const shelfStatus = shelfMap.get(nodeId) || 'unknown';
            
            // Add movie node
            if (!nodeIds.has(nodeId)) {
                processedData.nodes.push({
                    id: nodeId,
                    name: node.name,
                    type: 'movie',
                    shelf: shelfStatus,
                    data: node.data || {}
                });
                nodeIds.add(nodeId);
            }

            // Find and process creator links
            rawData.graph_data.links
                .filter(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    return (sourceId === nodeId || targetId === nodeId) && 
                           !sourceId?.startsWith('shelf_') && 
                           !targetId?.startsWith('shelf_');
                })
                .forEach(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    const otherId = sourceId === nodeId ? targetId : sourceId;
                    
                    const creatorNode = nodeMap.get(otherId);
                    if (creatorNode && (creatorNode.type === 'person' || creatorNode.type === 'creator')) {
                        // Add creator node if not exists
                        if (!creatorIds.has(otherId)) {
                            processedData.nodes.push({
                                id: otherId,
                                name: creatorNode.name,
                                type: 'creator',
                                role: link.type === 'directed' ? 'director' :
                                      link.type === 'acted_in' ? 'actor' :
                                      link.type === 'wrote' ? 'playwright' : 'unknown'
                            });
                            creatorIds.add(otherId);
                        }

                        // Add link
                        processedData.links.push({
                            source: otherId,
                            target: nodeId,
                            type: link.type
                        });
                    }
                });
        });

        // Log statistics
        const movieCount = processedData.nodes.filter(n => n.type === 'movie').length;
        const creatorCount = processedData.nodes.filter(n => n.type === 'creator').length;
        console.log(`\nProcessed ${movieCount} movies and ${creatorCount} creators`);
        console.log(`Created ${processedData.links.length} links`);

        return processedData;
    } catch (error) {
        console.error("Error processing data:", error);
        throw error;
    }
}

// Helper function to create a consistent ID from a name
function createIdFromName(name) {
    if (!name || typeof name !== 'string') return Math.random().toString(36).substring(2, 10);
    return name.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 20);
}
