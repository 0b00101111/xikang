// Simplified NeoDB Data Adapter
// Converts NeoDB API data to a format suitable for network visualization

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
        
        processedData.nodes.push(processedNode);
        nodeIds.add(node.id);
    });
    
    // Add links, excluding those to the user node
    rawData.graph_data.links.forEach(link => {
        // Skip links to/from user node - we'll handle those differently
        if (link.source === 'user' || link.target === 'user') return;
        
        processedData.links.push({
            source: link.source,
            target: link.target,
            type: link.type || "linked"
        });
    });
    
    // Create central organizational nodes instead of user node
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
            if (node.type === 'book' || node.category === 'book') {
                categoryId = "books";
            } else if (node.type === 'movie' || node.category === 'movie') {
                categoryId = "movies";
            } else if (node.type === 'tv' || node.category === 'tv' || node.category === 'tvseries') {
                categoryId = "tv";
            } else if (node.type === 'music' || node.category === 'music') {
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
}
