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
    console.log("=== RAW DATA INSPECTION ===");
    console.log("Raw data structure:", {
        totalNodes: rawData.graph_data.nodes.length,
        totalLinks: rawData.graph_data.links.length
    });
    
    console.log("\nFirst 10 nodes:");
    rawData.graph_data.nodes.slice(0, 10).forEach(node => {
        console.log({
            id: node.id,
            name: node.name,
            type: node.type,
            category: node.category,
            data: node.data
        });
    });
    
    console.log("\nFirst 10 links:");
    rawData.graph_data.links.slice(0, 10).forEach(link => {
        console.log({
            source: link.source,
            target: link.target,
            type: link.type
        });
    });
    
    console.log("\n=== STARTING PROCESSING ===");
    console.log("Processing NeoDB data for movie visualization");
    
    // Check if data is in the expected format
    if (!rawData || !rawData.graph_data) {
        console.error("Invalid data format: Missing graph_data structure");
        return null;
    }

    // Start with an empty graph structure
    const processedData = {
        nodes: [],
        links: []
    };
    
    // Track node IDs to avoid duplicates
    const nodeIds = new Set();
    const creatorIds = new Set();
    
    // Filter movie nodes from the original data
    const movieNodes = rawData.graph_data.nodes.filter(node => {
        // Log each node for inspection
        console.log("Checking node:", {
            id: node.id,
            type: node.type,
            category: node.category,
            dataType: node.data?.type,
            dataCategory: node.data?.category
        });
        
        // Include only movie type nodes
        // Check both type and category fields, and also check the data object
        return node.type === 'movie' || 
               node.category === 'movie' || 
               (node.type === 'media' && node.category === 'movie') ||
               (node.data && (node.data.type === 'movie' || node.data.category === 'movie'));
    });

    console.log("Found movie nodes:", movieNodes.length);
    
    // Determine the shelf for each movie node
    const nodeShelfMap = new Map();
    
    if (rawData.graph_data && rawData.graph_data.links) {
        rawData.graph_data.links.forEach(link => {
            // Check if this is a link between a shelf and a movie
            if (link.source === 'shelf_wishlist' || 
                link.source === 'shelf_progress' || 
                link.source === 'shelf_complete' || 
                link.source === 'shelf_dropped') {
                
                // Store shelf type for this target node
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                const shelfType = link.source.replace('shelf_', '');
                nodeShelfMap.set(targetId, shelfType);
            }
            // Also check the reverse direction
            else if (link.target === 'shelf_wishlist' || 
                     link.target === 'shelf_progress' || 
                     link.target === 'shelf_complete' || 
                     link.target === 'shelf_dropped') {
                
                // Store shelf type for this source node
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const shelfType = link.target.replace('shelf_', '');
                nodeShelfMap.set(sourceId, shelfType);
            }
        });
    }
    
    // Add movie nodes with shelf status to processed data
    movieNodes.forEach(node => {
        const nodeId = node.id;
        const shelfStatus = nodeShelfMap.get(nodeId) || 'unknown';
        const nodeData = node.data || {};
        
        // Create a simplified node
        const processedNode = {
            id: nodeId,
            name: node.name || nodeData.name || "Unnamed Movie",
            type: 'movie',
            shelf: shelfStatus,
            data: nodeData
        };
        
        // Add rating if available
        if (nodeData.rating) {
            processedNode.rating = typeof nodeData.rating === 'number' ? 
                nodeData.rating : parseFloat(nodeData.rating);
        } else if (node.rating) {
            processedNode.rating = typeof node.rating === 'number' ? 
                node.rating : parseFloat(node.rating);
        }
        
        // Add URL if available
        if (nodeData.url) {
            processedNode.url = nodeData.url;
        } else if (node.url) {
            processedNode.url = node.url;
        }
        
        // Add to processed data if not already added
        if (!nodeIds.has(nodeId)) {
            processedData.nodes.push(processedNode);
            nodeIds.add(nodeId);
        }
        
        // Extract creators for this movie
        if (nodeData.director) {
            const directors = Array.isArray(nodeData.director) ? nodeData.director : [nodeData.director];
            directors.forEach(directorName => {
                const directorId = `director_${createIdFromName(directorName)}`;
                if (!creatorIds.has(directorId)) {
                    processedData.nodes.push({
                        id: directorId,
                        name: directorName,
                        type: 'creator',
                        role: 'director'
                    });
                    creatorIds.add(directorId);
                }
                processedData.links.push({
                    source: directorId,
                    target: nodeId,
                    type: 'directed'
                });
            });
        }
        
        if (nodeData.actor) {
            const actors = Array.isArray(nodeData.actor) ? nodeData.actor : [nodeData.actor];
            actors.forEach(actorName => {
                const actorId = `actor_${createIdFromName(actorName)}`;
                if (!creatorIds.has(actorId)) {
                    processedData.nodes.push({
                        id: actorId,
                        name: actorName,
                        type: 'creator',
                        role: 'actor'
                    });
                    creatorIds.add(actorId);
                }
                processedData.links.push({
                    source: actorId,
                    target: nodeId,
                    type: 'acted_in'
                });
            });
        }
        
        if (nodeData.playwright) {
            const playwrights = Array.isArray(nodeData.playwright) ? nodeData.playwright : [nodeData.playwright];
            playwrights.forEach(playwrightName => {
                const playwrightId = `playwright_${createIdFromName(playwrightName)}`;
                if (!creatorIds.has(playwrightId)) {
                    processedData.nodes.push({
                        id: playwrightId,
                        name: playwrightName,
                        type: 'creator',
                        role: 'playwright'
                    });
                    creatorIds.add(playwrightId);
                }
                processedData.links.push({
                    source: playwrightId,
                    target: nodeId,
                    type: 'wrote'
                });
            });
        }
    });

    console.log("Processed nodes:", processedData.nodes.length);
    console.log("Processed links:", processedData.links.length);
    
    // Export the processed data to CSV format
    exportToCSV(processedData);
    
    return processedData;
}

// Helper function to create a consistent ID from a name
function createIdFromName(name) {
    if (!name) return Math.random().toString(36).substring(2, 10);
    return name.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 20);
}
