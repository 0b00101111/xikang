// Process shelf data
    if (rawData.shelf_items) {
        Object.entries(rawData.shelf_items).forEach(([key, shelfData]) => {
            if (!shelfData || !shelfData.data || !Array.isArray(shelfData.data)) {
                return;
            }
            
            // Extract shelf type from the key
            let shelfType = 'unknown';
            if (key.includes('wishlist')) {
                shelfType = 'wishlist';
            } else if (key.includes('progress')) {
                shelfType = 'progress';
            } else if (key.includes('complete')) {
                shelfType = 'complete';
            } else if (key.includes('dropped')) {
                shelfType = 'dropped';
            }
            
            const shelfId = `shelf_${shelfType}`;
            
            // Process each item in the shelf
            shelfData.data.forEach(shelfItem => {
                // Extract the media item from the shelf item
                const mediaItem = shelfItem.item;
                if (!mediaItem) return;
                
                const itemId = processMediaItem(mediaItem, processedData);
                
                if (itemId) {
                    // Link item to shelf
                    processedData.links.push({
                        source: shelfId,
                        target: itemId,
                        type: shelfType,
                        value: 2
                    });
                }
            });
        });
    }
    
    // Process and create media items from the function
    function processMediaItem(mediaItem, processedData) {
        if (!mediaItem || !mediaItem.uuid) return null;
        
        const itemId = `media_${mediaItem.uuid}`;
        
        // Skip if we already processed this item
        if (nodeIds.has(itemId)) {
            return itemId;
        }
        
        // Determine media type/category
        let category = mediaItem.category || mediaItem.type;
        if (!category) {
            if (mediaItem.api_url) {
                if (mediaItem.api_url.includes('/book/')) {
                    category = 'book';
                } else if (mediaItem.api_url.includes('/movie/')) {
                    category = 'movie';
                } else if (mediaItem.api_url.includes('/tv/')) {
                    category = 'tv';
                } else if (mediaItem.api_url.includes('/music/') || mediaItem.api_url.includes('/album/')) {
                    category = 'music';
                } else if (mediaItem.api_url.includes('/podcast/')) {
                    category = 'podcast';
                } else if (mediaItem.api_url.includes('/game/')) {
                    category = 'game';
                }
            }
        }
        
        // Default to 'unknown' if we couldn't determine the category
        category = category || 'unknown';
        
        // Track media type for metadata
        mediaTypes.add(category);
        
        // Create the media node
        const mediaNode = {
            id: itemId,
            name: mediaItem.title || mediaItem.display_title || 'Untitled',
            type: 'media',
            category: category,
            uuid: mediaItem.uuid
        };
        
        // Add additional properties if available
        if (mediaItem.rating) {
            mediaNode.rating = typeof mediaItem.rating === 'number' ? 
                mediaItem.rating : parseFloat(mediaItem.rating);
        }
        
        if (mediaItem.url) {
            mediaNode.url = mediaItem.url;
        }
        
        if (mediaItem.cover_image_url) {
            mediaNode.image = mediaItem.cover_image_url;
        }
        
        // Add the node to our processed data
        processedData.nodes.push(mediaNode);
        nodeIds.add(itemId);
        
        return itemId;
    }
    
    // Finalize metadata
    processedData.metadata.mediaTypes = Array.from(mediaTypes);
    
    // For now, we don't have creator types in the API data, so we'll leave it empty
    processedData.metadata.creatorTypes = [];

    return processedData;// Enhanced NeoDB Data Adapter
// This script converts the data from NeoDB API to the format expected by the visualization
// It also reorganizes the graph to improve layout and add relationship information

function processNeoDBAData(rawData) {
    // Check if data is in the expected format
    if (!rawData || !rawData.graph_data) {
        console.error("Invalid data format: Missing graph_data structure");
        return null;
    }

    // Start with our processed data structure
    const processedData = {
        nodes: [],
        links: [],
        metadata: {
            username: rawData.metadata?.username || "Unknown",
            handle: rawData.metadata?.handle || "Unknown",
            lastUpdated: rawData.metadata?.fetch_time || new Date().toISOString(),
            mediaTypes: [],
            creatorTypes: []
        }
    };
    
    // Track node IDs to avoid duplicates
    const nodeIds = new Set();

    // Set of unique media types to build metadata.mediaTypes
    const mediaTypes = new Set();
    
    // Create the user node as the central point
    const username = rawData.user?.display_name || rawData.metadata?.username || "User";
    const userNode = {
        id: 'user',
        name: username,
        type: 'user',
        size: 30
    };
    processedData.nodes.push(userNode);
    nodeIds.add('user');
    
    // Create nodes for shelves (one per shelf type)
    const shelfTypes = {
        'wishlist': 'Wishlist',
        'progress': 'In Progress',
        'complete': 'Completed',
        'dropped': 'Dropped'
    };
    
    Object.entries(shelfTypes).forEach(([id, name]) => {
        const shelfId = `shelf_${id}`;
        processedData.nodes.push({
            id: shelfId,
            name: name,
            type: 'shelf',
            size: 15
        });
        nodeIds.add(shelfId);
        
        // Link shelf to user
        processedData.links.push({
            source: 'user',
            target: shelfId,
            type: 'has_shelf',
            value: 3
        });
    });
    
    // Create tag nodes
    if (rawData.tags && rawData.tags.data) {
        rawData.tags.data.forEach(tag => {
            const tagName = tag.name || 'Unnamed Tag';
            const tagId = `tag_${tag.uuid}`;
            
            // Add tag node if it doesn't exist yet
            if (!nodeIds.has(tagId)) {
                processedData.nodes.push({
                    id: tagId,
                    name: tagName,
                    type: 'tag',
                    size: 12,
                    uuid: tag.uuid
                });
                nodeIds.add(tagId);
                
                // Link tag to user
                processedData.links.push({
                    source: 'user',
                    target: tagId,
                    type: 'has_tag',
                    value: 2
                });
            }
            
            // Process tag items if available
            if (tag.items && Array.isArray(tag.items)) {
                tag.items.forEach(item => {
                    const itemId = processMediaItem(item, processedData);
                    
                    if (itemId) {
                        // Link item to tag
                        processedData.links.push({
                            source: tagId,
                            target: itemId,
                            type: 'tagged_with',
                            value: 1
                        });
                    }
                });
            }
