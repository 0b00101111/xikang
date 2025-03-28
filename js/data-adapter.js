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
    let inspectedCount = 0;
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

    // Deep inspect the first few movie nodes
    movieNodes.slice(0, 3).forEach(node => {
        console.log('\n=== DETAILED MOVIE NODE INSPECTION ===');
        console.log('Movie ID:', node.id);
        console.log('Movie Name:', node.name);
        console.log('Basic Fields:', {
            type: node.type,
            category: node.category,
            hasData: !!node.data
        });

        if (node.data) {
            console.log('\nData Object Structure:');
            const dataFields = Object.entries(node.data).map(([key, value]) => ({
                field: key,
                type: typeof value,
                isArray: Array.isArray(value),
                sample: value && typeof value === 'object' ? 
                    (Array.isArray(value) ? value.slice(0, 3) : Object.keys(value)) : 
                    String(value).substring(0, 100)
            }));
            console.log(JSON.stringify(dataFields, null, 2));

            // Specifically look for creator-related fields
            const creatorFields = ['director', 'actor', 'playwright', 'cast', 'crew', 'creators'];
            creatorFields.forEach(field => {
                if (node.data[field]) {
                    console.log(`\nFound ${field}:`, node.data[field]);
                }
            });
        }

        // Look for creator information in the raw links
        const relatedLinks = rawData.graph_data.links.filter(link => 
            (typeof link.source === 'object' ? link.source.id === node.id : link.source === node.id) ||
            (typeof link.target === 'object' ? link.target.id === node.id : link.target === node.id)
        );
        
        if (relatedLinks.length > 0) {
            console.log('\nRelated Links:', relatedLinks.map(link => ({
                source: typeof link.source === 'object' ? link.source.id : link.source,
                target: typeof link.target === 'object' ? link.target.id : link.target,
                type: link.type
            })));
        }
    });

    console.log(`\nFound ${movieNodes.length} movie nodes`);
    
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
        }

        // Find creator relationships in links
        const movieLinks = rawData.graph_data.links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return (sourceId === nodeId || targetId === nodeId) && 
                   !['shelf_wishlist', 'shelf_progress', 'shelf_complete', 'shelf_dropped'].includes(sourceId) &&
                   !['shelf_wishlist', 'shelf_progress', 'shelf_complete', 'shelf_dropped'].includes(targetId);
        });

        // Log the first few movie's links for debugging
        if (processedData.nodes.length <= 3) {
            console.log('\n=== Movie Links ===');
            console.log('Movie:', node.name);
            console.log('Related links:', movieLinks);
        }

        // Process each link to find creators
        movieLinks.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const otherId = sourceId === nodeId ? targetId : sourceId;
            
            // Find the creator node in the raw data
            const creatorNode = rawData.graph_data.nodes.find(n => n.id === otherId);
            if (creatorNode && (creatorNode.type === 'person' || creatorNode.type === 'creator')) {
                const creatorId = creatorNode.id;
                const role = link.type === 'directed' ? 'director' :
                           link.type === 'acted_in' ? 'actor' :
                           link.type === 'wrote' ? 'playwright' : 'unknown';

                // Add creator node if not exists
                if (!creatorIds.has(creatorId)) {
                    const processedCreator = {
                        id: creatorId,
                        name: creatorNode.name,
                        type: 'creator',
                        role: role
                    };
                    processedData.nodes.push(processedCreator);
                    creatorIds.add(creatorId);
                    console.log(`Added creator node: ${creatorNode.name} (${role})`);
                }

                // Add the link
                processedData.links.push({
                    source: creatorId,
                    target: nodeId,
                    type: link.type
                });
                console.log(`Added link: ${creatorNode.name} -[${link.type}]-> ${node.name}`);
            }
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
