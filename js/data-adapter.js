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
    
    // Log raw data structure
    console.log("Raw data structure:", {
        totalNodes: rawData.graph_data.nodes.length,
        totalLinks: rawData.graph_data.links.length,
        sampleNode: rawData.graph_data.nodes[0]
    });
    
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
            
            // Extract creators for this movie
            extractCreators(node, processedData, nodeIds, creatorIds);
        }
    });

    console.log("Processed nodes:", processedData.nodes.length);
    console.log("Processed links:", processedData.links.length);
    
    // Export the processed data to CSV format
    exportToCSV(processedData);
    
    // Helper function to extract creators from a movie node
    function extractCreators(node, processedData, nodeIds, creatorIds) {
        const nodeData = node.data || {};
        
        // Extract creators for movies
        let creators = [];
        
        // Look for directors in various places
        const directors = [];
        if (nodeData.directors) {
            directors.push(...(Array.isArray(nodeData.directors) ? nodeData.directors : [nodeData.directors]));
        }
        if (nodeData.director) {
            directors.push(...(Array.isArray(nodeData.director) ? nodeData.director : [nodeData.director]));
        }
        if (nodeData.credits && nodeData.credits.director) {
            directors.push(...(Array.isArray(nodeData.credits.director) ? nodeData.credits.director : [nodeData.credits.director]));
        }
        
        directors.forEach(director => {
            const directorName = typeof director === 'string' ? director : (director.name || 'Unknown Director');
            const directorId = `director_${createIdFromName(directorName)}`;
            
            creators.push({
                id: directorId,
                name: directorName,
                type: 'creator',
                role: 'director'
            });
        });
        
        // Look for cast in various places (limit to main cast - first 5)
        const cast = [];
        if (nodeData.cast) {
            cast.push(...(Array.isArray(nodeData.cast) ? nodeData.cast : [nodeData.cast]));
        }
        if (nodeData.credits && nodeData.credits.cast) {
            cast.push(...(Array.isArray(nodeData.credits.cast) ? nodeData.credits.cast : [nodeData.credits.cast]));
        }
        
        cast.slice(0, 5).forEach(actor => {
            const actorName = typeof actor === 'string' ? actor : (actor.name || 'Unknown Actor');
            const actorId = `actor_${createIdFromName(actorName)}`;
            
            creators.push({
                id: actorId,
                name: actorName,
                type: 'creator',
                role: 'actor'
            });
        });
        
        // Add creator nodes and links
        creators.forEach(creator => {
            if (!creatorIds.has(creator.id)) {
                // Add creator node if it doesn't exist yet
                processedData.nodes.push(creator);
                nodeIds.add(creator.id);
                creatorIds.add(creator.id);
            }
            
            // Connect creator to movie item
            processedData.links.push({
                source: creator.id,
                target: node.id,
                type: creator.role
            });
        });
    }
    
    // Create links between directors and actors who have worked together
    const directorNodes = processedData.nodes.filter(node => node.role === 'director');
    const actorNodes = processedData.nodes.filter(node => node.role === 'actor');
    
    // For each director, find all their movies and connect them to the actors in those movies
    directorNodes.forEach(director => {
        // Find all movies this director worked on
        const directorMovies = processedData.links
            .filter(link => link.source === director.id)
            .map(link => link.target);
        
        // For each movie, find all actors
        directorMovies.forEach(movieId => {
            const movieActors = processedData.links
                .filter(link => link.target === movieId && 
                              processedData.nodes.find(n => n.id === link.source && n.role === 'actor'))
                .map(link => link.source);
            
            // Connect director to actors
            movieActors.forEach(actorId => {
                // Check if link already exists
                const linkExists = processedData.links.some(link => 
                    (link.source === director.id && link.target === actorId) || 
                    (link.source === actorId && link.target === director.id)
                );
                
                if (!linkExists) {
                    processedData.links.push({
                        source: director.id,
                        target: actorId,
                        type: 'worked_with'
                    });
                }
            });
        });
    });
    
    // Create links between actors who have appeared in the same movies
    const processedPairs = new Set();
    
    actorNodes.forEach(actor1 => {
        // Find all movies this actor appeared in
        const actor1Movies = processedData.links
            .filter(link => link.source === actor1.id)
            .map(link => link.target);
        
        // For each movie, find other actors in the same movie
        actor1Movies.forEach(movieId => {
            const coActors = processedData.links
                .filter(link => link.target === movieId && 
                              link.source !== actor1.id &&
                              processedData.nodes.find(n => n.id === link.source && n.role === 'actor'))
                .map(link => link.source);
            
            // Connect actor to co-actors (if not already connected)
            coActors.forEach(actor2Id => {
                // Create a unique pair ID (smaller ID first to avoid duplicates)
                const pairId = [actor1.id, actor2Id].sort().join('_');
                
                if (!processedPairs.has(pairId)) {
                    processedPairs.add(pairId);
                    
                    processedData.links.push({
                        source: actor1.id,
                        target: actor2Id,
                        type: 'co_actor'
                    });
                }
            });
        });
    });
    
    return processedData;
    
    // Helper function to create an ID from a name
    function createIdFromName(name) {
        if (!name) return Math.random().toString(36).substring(2, 10);
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
    }
}
