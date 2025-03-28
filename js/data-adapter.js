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

        // Track actor appearances for limiting
        const actorAppearances = new Map(); // Track how many times each actor appears

        // First pass: Count actor appearances
        movieNodes.forEach(node => {
            const actorLinks = rawData.graph_data.links.filter(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                const actorNode = nodeMap.get(sourceId === node.id ? targetId : sourceId);
                return (sourceId === node.id || targetId === node.id) && 
                       actorNode?.type === 'person' && 
                       link.type === 'acted_in';
            });

            actorLinks.forEach(link => {
                const actorId = typeof link.source === 'object' ? 
                    (link.source.id === node.id ? link.target.id : link.source.id) :
                    (link.source === node.id ? link.target : link.source);
                actorAppearances.set(actorId, (actorAppearances.get(actorId) || 0) + 1);
            });
        });

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
            const creatorLinks = rawData.graph_data.links
                .filter(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    return (sourceId === nodeId || targetId === nodeId) && 
                           !sourceId?.startsWith('shelf_') && 
                           !targetId?.startsWith('shelf_');
                });

            // Process directors and playwrights first
            creatorLinks.forEach(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                const otherId = sourceId === nodeId ? targetId : sourceId;
                
                const creatorNode = nodeMap.get(otherId);
                if (creatorNode && (creatorNode.type === 'person' || creatorNode.type === 'creator')) {
                    if (link.type === 'directed' || link.type === 'wrote') {
                        // Add creator node if not exists
                        if (!creatorIds.has(otherId)) {
                            processedData.nodes.push({
                                id: otherId,
                                name: creatorNode.name,
                                type: 'creator',
                                role: link.type === 'directed' ? 'director' : 'playwright'
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
                }
            });

            // Process actors (limited to top 5 most frequent)
            const actorLinks = creatorLinks
                .filter(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    const actorNode = nodeMap.get(sourceId === nodeId ? targetId : sourceId);
                    return actorNode?.type === 'person' && link.type === 'acted_in';
                })
                .sort((a, b) => {
                    const actorIdA = typeof a.source === 'object' ? 
                        (a.source.id === nodeId ? a.target.id : a.source.id) :
                        (a.source === nodeId ? a.target : a.source);
                    const actorIdB = typeof b.source === 'object' ? 
                        (b.source.id === nodeId ? b.target.id : b.source.id) :
                        (b.source === nodeId ? b.target : b.source);
                    return (actorAppearances.get(actorIdB) || 0) - (actorAppearances.get(actorIdA) || 0);
                })
                .slice(0, 5); // Limit to top 5 actors

            actorLinks.forEach(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                const actorId = sourceId === nodeId ? targetId : sourceId;
                const actorNode = nodeMap.get(actorId);

                if (!creatorIds.has(actorId)) {
                    processedData.nodes.push({
                        id: actorId,
                        name: actorNode.name,
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
        });

        // Log statistics
        const movieCount = processedData.nodes.filter(n => n.type === 'movie').length;
        const creatorCount = processedData.nodes.filter(n => n.type === 'creator').length;
        const actorCount = processedData.nodes.filter(n => n.type === 'creator' && n.role === 'actor').length;
        const directorCount = processedData.nodes.filter(n => n.type === 'creator' && n.role === 'director').length;
        const playwrightCount = processedData.nodes.filter(n => n.type === 'creator' && n.role === 'playwright').length;

        console.log(`\nProcessed data statistics:`, {
            totalNodes: processedData.nodes.length,
            totalLinks: processedData.links.length,
            movies: movieCount,
            creators: {
                total: creatorCount,
                actors: actorCount,
                directors: directorCount,
                playwrights: playwrightCount
            },
            averageActorsPerMovie: actorCount / movieCount
        });

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

function processGraphData(rawData) {
    console.log('Processing raw data:', {
        totalNodes: rawData.nodes.length,
        totalLinks: rawData.links.length
    });

    const processedData = {
        nodes: [],
        links: []
    };

    // Create a map for quick node lookup
    const nodeMap = new Map();
    
    // Process movie nodes first
    rawData.nodes.forEach(nodeData => {
        if (nodeData.type === 'movie') {
            const movieNode = {
                id: nodeData.id,
                name: nodeData.name,
                type: 'movie',
                shelf: nodeData.shelf || 'unknown',
                rating: nodeData.rating,
                url: nodeData.url
            };
            
            processedData.nodes.push(movieNode);
            nodeMap.set(movieNode.id, movieNode);

            // Process directors
            if (nodeData.directors && nodeData.directors.length > 0) {
                nodeData.directors.forEach(director => {
                    const directorId = `director_${director.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    if (!nodeMap.has(directorId)) {
                        const directorNode = {
                            id: directorId,
                            name: director,
                            type: 'creator',
                            role: 'director'
                        };
                        processedData.nodes.push(directorNode);
                        nodeMap.set(directorId, directorNode);
                    }
                    processedData.links.push({
                        source: directorId,
                        target: movieNode.id,
                        type: 'directed'
                    });
                });
            }

            // Process only top 5 actors
            if (nodeData.actors && nodeData.actors.length > 0) {
                const topActors = nodeData.actors.slice(0, 5); // Limit to top 5 actors
                topActors.forEach(actor => {
                    const actorId = `actor_${actor.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    if (!nodeMap.has(actorId)) {
                        const actorNode = {
                            id: actorId,
                            name: actor,
                            type: 'creator',
                            role: 'actor'
                        };
                        processedData.nodes.push(actorNode);
                        nodeMap.set(actorId, actorNode);
                    }
                    processedData.links.push({
                        source: actorId,
                        target: movieNode.id,
                        type: 'acted_in'
                    });
                });
            }

            // Process playwrights
            if (nodeData.playwrights && nodeData.playwrights.length > 0) {
                nodeData.playwrights.forEach(playwright => {
                    const playwrightId = `playwright_${playwright.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    if (!nodeMap.has(playwrightId)) {
                        const playwrightNode = {
                            id: playwrightId,
                            name: playwright,
                            type: 'creator',
                            role: 'playwright'
                        };
                        processedData.nodes.push(playwrightNode);
                        nodeMap.set(playwrightId, playwrightNode);
                    }
                    processedData.links.push({
                        source: playwrightId,
                        target: movieNode.id,
                        type: 'wrote'
                    });
                });
            }
        }
    });

    // Log statistics
    const movieCount = processedData.nodes.filter(n => n.type === 'movie').length;
    const directorCount = processedData.nodes.filter(n => n.type === 'creator' && n.role === 'director').length;
    const actorCount = processedData.nodes.filter(n => n.type === 'creator' && n.role === 'actor').length;
    const playwrightCount = processedData.nodes.filter(n => n.type === 'creator' && n.role === 'playwright').length;

    console.log('Processed data statistics:', {
        totalNodes: processedData.nodes.length,
        totalLinks: processedData.links.length,
        movies: movieCount,
        directors: directorCount,
        actors: actorCount,
        playwrights: playwrightCount,
        averageActorsPerMovie: actorCount / movieCount
    });

    return processedData;
}
