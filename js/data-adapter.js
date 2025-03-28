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
        totalNodes: rawData.graph_data?.nodes?.length,
        totalLinks: rawData.graph_data?.links?.length,
        sampleNode: rawData.graph_data?.nodes?.[0]
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
        const isMovie = node.type === 'movie' || 
                       node.category === 'movie' || 
                       (node.type === 'media' && node.category === 'movie') ||
                       (node.data && (node.data.type === 'movie' || node.data.category === 'movie'));
        
        if (isMovie) {
            console.log('Found movie node:', {
                id: node.id,
                name: node.name,
                type: node.type,
                category: node.category,
                data: node.data
            });
        }
        return isMovie;
    });

    console.log(`Found ${movieNodes.length} movie nodes`);
    
    // Determine the shelf for each movie node
    const nodeShelfMap = new Map();
    
    if (rawData.graph_data.links) {
        rawData.graph_data.links.forEach(link => {
            const shelfTypes = ['shelf_wishlist', 'shelf_progress', 'shelf_complete', 'shelf_dropped'];
            shelfTypes.forEach(shelfType => {
                if (link.source === shelfType) {
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    nodeShelfMap.set(targetId, shelfType.replace('shelf_', ''));
                } else if (link.target === shelfType) {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    nodeShelfMap.set(sourceId, shelfType.replace('shelf_', ''));
                }
            });
        });
    }

    console.log('Shelf mappings:', Array.from(nodeShelfMap.entries()));

    // Process each movie node
    movieNodes.forEach(node => {
        const nodeId = node.id;
        const shelfStatus = nodeShelfMap.get(nodeId) || 'unknown';
        const nodeData = node.data || {};
        
        // Debug raw movie data structure
        console.log('=== Movie Raw Data ===', {
            id: node.id,
            name: node.name,
            fullData: node,
            creators: {
                fromNode: {
                    director: node.director,
                    actor: node.actor,
                    playwright: node.playwright
                },
                fromData: {
                    director: nodeData.director,
                    actor: nodeData.actor,
                    playwright: nodeData.playwright
                }
            }
        });
        
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
        
        // Add movie node if not already added
        if (!nodeIds.has(nodeId)) {
            processedData.nodes.push(processedNode);
            nodeIds.add(nodeId);
            console.log('Added movie node:', processedNode);
        }

        // Process creators - check both node and nodeData
        const creators = {
            director: [
                ...(Array.isArray(node.director) ? node.director : [node.director]),
                ...(Array.isArray(nodeData.director) ? nodeData.director : [nodeData.director])
            ].filter(Boolean),
            actor: [
                ...(Array.isArray(node.actor) ? node.actor : [node.actor]),
                ...(Array.isArray(nodeData.actor) ? nodeData.actor : [nodeData.actor])
            ].filter(Boolean),
            playwright: [
                ...(Array.isArray(node.playwright) ? node.playwright : [node.playwright]),
                ...(Array.isArray(nodeData.playwright) ? nodeData.playwright : [nodeData.playwright])
            ].filter(Boolean)
        };

        // Log creator data for this movie
        console.log(`Processing creators for movie: ${processedNode.name}`, creators);

        // Process each type of creator
        Object.entries(creators).forEach(([role, names]) => {
            names.filter(name => name && typeof name === 'string').forEach(name => {
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
                    console.log(`Added new creator node:`, creatorNode);
                }

                // Add link from creator to movie
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
    const movieCount = processedData.nodes.filter(n => n.type === 'movie').length;
    const creatorCount = processedData.nodes.filter(n => n.type === 'creator').length;
    console.log(`Total nodes: ${processedData.nodes.length} (${movieCount} movies, ${creatorCount} creators)`);
    console.log("Total links:", processedData.links.length);
    console.log("Creator breakdown:", 
        processedData.nodes
            .filter(n => n.type === 'creator')
            .reduce((acc, n) => {
                acc[n.role] = (acc[n.role] || 0) + 1;
                return acc;
            }, {})
    );

    // Verify data integrity
    const allNodeIds = new Set(processedData.nodes.map(n => n.id));
    const invalidLinks = processedData.links.filter(link => 
        !allNodeIds.has(typeof link.source === 'object' ? link.source.id : link.source) ||
        !allNodeIds.has(typeof link.target === 'object' ? link.target.id : link.target)
    );
    
    if (invalidLinks.length > 0) {
        console.error("Found invalid links:", invalidLinks);
    }

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
