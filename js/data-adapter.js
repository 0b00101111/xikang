// Enhanced NeoDB Data Adapter
// This script converts the data from NeoDB API to the format expected by the visualization
// It also reorganizes the graph to improve layout and add relationship information

function processNeoDBAData(rawData) {
    console.log("Processing NeoDB data");
    
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
    
    // Add nodes from the API data, excluding the user node
    rawData.graph_data.nodes.forEach(node => {
        // Skip user node - we'll create our own
        if (node.id === 'user') return;
        
        // Create a simplified node
        const processedNode = {
            id: node.id,
            name: node.name || "Unnamed",
            type: node.type,
            category: node.category || node.group
        };
        
        // Add rating if available
        if (node.data && node.data.rating) {
            processedNode.rating = typeof node.data.rating === 'number' ? 
                node.data.rating : parseFloat(node.data.rating);
        } else if (node.rating) {
            processedNode.rating = typeof node.rating === 'number' ? 
                node.rating : parseFloat(node.rating);
        }
        
        // Add URL if available
        if (node.data && node.data.url) {
            processedNode.url = node.data.url;
        } else if (node.url) {
            processedNode.url = node.url;
        }
        
        processedData.nodes.push(processedNode);
        nodeIds.add(node.id);
        
        // Extract creator information
        extractCreators(node, processedData, nodeIds, creatorIds);
    });
    
    // Add links, excluding those to the user node
    rawData.graph_data.links.forEach(link => {
        // Skip links to/from user node - we'll handle those differently
        if (link.source === 'user' || link.target === 'user') return;
        
        // Make sure both source and target exist
        const sourceExists = nodeIds.has(typeof link.source === 'string' ? link.source : link.source.id);
        const targetExists = nodeIds.has(typeof link.target === 'string' ? link.target : link.target.id);
        
        if (sourceExists && targetExists) {
            processedData.links.push({
                source: typeof link.source === 'string' ? link.source : link.source.id,
                target: typeof link.target === 'string' ? link.target : link.target.id,
                type: link.type || "linked"
            });
        }
    });
    
    // Create central organizational nodes
    const organizationalNodes = [
        { id: "books", name: "Books", type: "category" },
        { id: "movies", name: "Movies", type: "category" },
        { id: "tv", name: "TV Series", type: "category" },
        { id: "music", name: "Music", type: "category" },
        { id: "podcasts", name: "Podcasts", type: "category" }
    ];
    
    // Add organizational nodes
    organizationalNodes.forEach(node => {
        if (!nodeIds.has(node.id)) {
            processedData.nodes.push(node);
            nodeIds.add(node.id);
        }
    });
    
    // Connect media nodes to their category nodes
    processedData.nodes.forEach(node => {
        if (node.type === 'media' || node.type === 'book' || node.type === 'movie' || 
            node.type === 'tv' || node.type === 'music' || node.type === 'podcast') {
            
            let categoryId = null;
            
            // Determine which category this node belongs to
            if (node.type === 'book' || node.category === 'book' || node.category === 'Edition') {
                categoryId = "books";
            } else if (node.type === 'movie' || node.category === 'movie') {
                categoryId = "movies";
            } else if (node.type === 'tv' || node.category === 'tv' || node.category === 'tvseries') {
                categoryId = "tv";
            } else if (node.type === 'music' || node.category === 'music' || node.category === 'album') {
                categoryId = "music";
            } else if (node.type === 'podcast' || node.category === 'podcast') {
                categoryId = "podcasts";
            }
            
            // Add link to category if we found a match
            if (categoryId && nodeIds.has(categoryId)) {
                processedData.links.push({
                    source: categoryId,
                    target: node.id,
                    type: "contains"
                });
            }
        }
    });
    
    // Connect organizational nodes to each other to form a structure
    for (let i = 0; i < organizationalNodes.length - 1; i++) {
        processedData.links.push({
            source: organizationalNodes[i].id,
            target: organizationalNodes[i+1].id,
            type: "related"
        });
    }
    
    // Connect first and last to form a circular structure
    processedData.links.push({
        source: organizationalNodes[0].id,
        target: organizationalNodes[organizationalNodes.length-1].id,
        type: "related"
    });
    
    return processedData;
    
    // Helper function to extract creators from a node
    function extractCreators(node, processedData, nodeIds, creatorIds) {
        // Only process nodes that might have creator information
        if (node.type !== 'media' && 
            node.type !== 'book' && 
            node.type !== 'movie' && 
            node.type !== 'tv' &&
            node.type !== 'music' &&
            node.type !== 'podcast' &&
            node.type !== 'Edition') {
            return;
        }
        
        const nodeData = node.data || {};
        
        // Extract creators based on media type
        let creators = [];
        
        // For books, extract authors and translators
        if (node.type === 'book' || node.category === 'book' || node.type === 'Edition') {
            // Look for authors
            if (nodeData.authors) {
                let authors = Array.isArray(nodeData.authors) ? nodeData.authors : [nodeData.authors];
                authors.forEach(author => {
                    const authorName = typeof author === 'string' ? author : (author.name || 'Unknown Author');
                    const authorId = `author_${createIdFromName(authorName)}`;
                    
                    creators.push({
                        id: authorId,
                        name: authorName,
                        type: 'creator',
                        category: 'author',
                        role: 'author'
                    });
                });
            }
            
            // Look for translators
            if (nodeData.translators) {
                let translators = Array.isArray(nodeData.translators) ? nodeData.translators : [nodeData.translators];
                translators.forEach(translator => {
                    const translatorName = typeof translator === 'string' ? translator : (translator.name || 'Unknown Translator');
                    const translatorId = `translator_${createIdFromName(translatorName)}`;
                    
                    creators.push({
                        id: translatorId,
                        name: translatorName,
                        type: 'creator',
                        category: 'translator',
                        role: 'translator'
                    });
                });
            }
        }
        // For movies, extract directors and cast
        else if (node.type === 'movie' || node.category === 'movie') {
            // Look for directors
            if (nodeData.directors) {
                let directors = Array.isArray(nodeData.directors) ? nodeData.directors : [nodeData.directors];
                directors.forEach(director => {
                    const directorName = typeof director === 'string' ? director : (director.name || 'Unknown Director');
                    const directorId = `director_${createIdFromName(directorName)}`;
                    
                    creators.push({
                        id: directorId,
                        name: directorName,
                        type: 'creator',
                        category: 'director',
                        role: 'director'
                    });
                });
            }
            
            // Look for cast (limit to main cast - first 5)
            if (nodeData.cast) {
                let cast = Array.isArray(nodeData.cast) ? nodeData.cast : [nodeData.cast];
                cast.slice(0, 5).forEach(actor => {
                    const actorName = typeof actor === 'string' ? actor : (actor.name || 'Unknown Actor');
                    const actorId = `actor_${createIdFromName(actorName)}`;
                    
                    creators.push({
                        id: actorId,
                        name: actorName,
                        type: 'creator',
                        category: 'actor',
                        role: 'actor'
                    });
                });
            }
        }
        // For music, extract artists
        else if (node.type === 'music' || node.category === 'music' || node.type === 'album') {
            // Look for artists
            if (nodeData.artists) {
                let artists = Array.isArray(nodeData.artists) ? nodeData.artists : [nodeData.artists];
                artists.forEach(artist => {
                    const artistName = typeof artist === 'string' ? artist : (artist.name || 'Unknown Artist');
                    const artistId = `artist_${createIdFromName(artistName)}`;
                    
                    creators.push({
                        id: artistId,
                        name: artistName,
                        type: 'creator',
                        category: 'artist',
                        role: 'artist'
                    });
                });
            }
        }
        
        // Add creator nodes and links
        creators.forEach(creator => {
            if (!creatorIds.has(creator.id)) {
                // Add creator node if it doesn't exist yet
                processedData.nodes.push(creator);
                nodeIds.add(creator.id);
                creatorIds.add(creator.id);
            }
            
            // Connect creator to media item
            processedData.links.push({
                source: creator.id,
                target: node.id,
                type: creator.role
            });
        });
    }
    
    // Helper function to create an ID from a name
    function createIdFromName(name) {
        if (!name) return Math.random().toString(36).substring(2, 10);
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
    }
}
