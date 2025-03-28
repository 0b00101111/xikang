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
        return node.type === 'movie' || 
               node.category === 'movie' || 
               (node.type === 'media' && node.category === 'movie') ||
               (node.data && (node.data.type === 'movie' || node.data.category === 'movie'));
    });

    console.log(`Found ${movieNodes.length} movie nodes`);
    
    // Determine the shelf for each movie node
    const nodeShelfMap = new Map();
    
    if (rawData.graph_data && rawData.graph_data.links) {
        rawData.graph_data.links.forEach(link => {
            if (link.source === 'shelf_wishlist' || 
                link.source === 'shelf_progress' || 
                link.source === 'shelf_complete' || 
                link.source === 'shelf_dropped') {
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                const shelfType = link.source.replace('shelf_', '');
                nodeShelfMap.set(targetId, shelfType);
            }
            else if (link.target === 'shelf_wishlist' || 
                     link.target === 'shelf_progress' || 
                     link.target === 'shelf_complete' || 
                     link.target === 'shelf_dropped') {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const shelfType = link.target.replace('shelf_', '');
                nodeShelfMap.set(sourceId, shelfType);
            }
        });
    }

    // Process each movie node
    movieNodes.forEach(node => {
        const nodeId = node.id;
        const shelfStatus = nodeShelfMap.get(nodeId) || 'unknown';
        const nodeData = node.data || {};
        
        // Create movie node
        const processedNode = {
            id: nodeId,
            name: node.name || nodeData.name || "Unnamed Movie",
            type: 'movie',
            shelf: shelfStatus,
            data: {
                ...nodeData,
                rating: nodeData.rating || node.rating,
                url: nodeData.url || node.url
            }
        };
        
        // Add movie node
        if (!nodeIds.has(nodeId)) {
            processedData.nodes.push(processedNode);
            nodeIds.add(nodeId);
        }

        // Process creators
        const creators = {
            director: nodeData.director || [],
            actor: nodeData.actor || [],
            playwright: nodeData.playwright || []
        };

        // Log creator data for this movie
        console.log(`\nProcessing creators for movie: ${processedNode.name}`);
        console.log('Creator data:', creators);

        // Process each type of creator
        Object.entries(creators).forEach(([role, names]) => {
            if (!Array.isArray(names)) {
                names = [names];
            }

            names.filter(name => name).forEach(name => {
                const creatorId = `${role}_${createIdFromName(name)}`;
                console.log(`Processing ${role}: ${name} (ID: ${creatorId})`);

                // Add creator node if not exists
                if (!creatorIds.has(creatorId)) {
                    const creatorNode = {
                        id: creatorId,
                        name: name,
                        type: 'creator',
                        role: role
                    };
                    processedData.nodes.push(creatorNode);
                    creatorIds.add(creatorId);
                    console.log(`Added new creator node: ${name} (${role})`);
                }

                // Add link
                const linkType = role === 'director' ? 'directed' :
                               role === 'actor' ? 'acted_in' : 'wrote';
                
                processedData.links.push({
                    source: creatorId,
                    target: nodeId,
                    type: linkType
                });
                console.log(`Added link: ${creatorId} -[${linkType}]-> ${nodeId}`);
            });
        });
    });

    // Log final statistics
    console.log("\n=== FINAL STATISTICS ===");
    console.log("Total movies:", processedData.nodes.filter(n => n.type === 'movie').length);
    console.log("Total creators:", processedData.nodes.filter(n => n.type === 'creator').length);
    console.log("Total links:", processedData.links.length);
    console.log("\nCreator breakdown:", 
        processedData.nodes
            .filter(n => n.type === 'creator')
            .reduce((acc, n) => {
                acc[n.role] = (acc[n.role] || 0) + 1;
                return acc;
            }, {})
    );

    return processedData;
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
