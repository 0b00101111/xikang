// NeoDB Data Adapter
// This script converts the data from NeoDB API to the format expected by the visualization

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

    // Set of unique media types to build metadata.mediaTypes
    const mediaTypes = new Set();
    
    // Process nodes
    rawData.graph_data.nodes.forEach(node => {
        // Transform node structure to match the expected format
        const processedNode = {
            id: node.id,
            name: node.name || "Unnamed",
            type: mapNodeType(node.type),
            category: mapCategory(node.type, node.group),
            size: node.size || 5,
        };

        // Add additional properties based on node type
        if (node.data) {
            // Copy relevant properties from the original data
            if (node.data.rating) {
                processedNode.rating = parseFloat(node.data.rating);
            }
            
            if (node.data.item && node.data.item.rating) {
                processedNode.rating = parseFloat(node.data.item.rating);
            }

            // Add URL if available
            if (node.data.url) {
                processedNode.url = node.data.url;
            } else if (node.data.item && node.data.item.url) {
                processedNode.url = node.data.item.url;
            }
        }

        // Track media types for metadata
        if (processedNode.type === 'media' && processedNode.category) {
            mediaTypes.add(processedNode.category);
        }

        processedData.nodes.push(processedNode);
    });

    // Process links
    rawData.graph_data.links.forEach(link => {
        processedData.links.push({
            source: link.source,
            target: link.target,
            type: link.type || "unknown",
            value: link.value || 1
        });
    });

    // Finalize metadata
    processedData.metadata.mediaTypes = Array.from(mediaTypes);
    
    // For now, we don't have creator types in the API data, so we'll leave it empty
    processedData.metadata.creatorTypes = [];

    return processedData;
}

// Helper function to map NeoDB node types to visualization types
function mapNodeType(nodeType) {
    // Map from NeoDB type to visualization type
    switch (nodeType) {
        case 'user':
            return 'user';
        case 'tag':
            return 'tag';
        case 'shelf':
            return 'genre'; // Using genre type for shelves
        case 'book':
        case 'movie':
        case 'tv':
        case 'music':
        case 'podcast':
        case 'game':
        case 'album':
        case 'Edition':
            return 'media';
        default:
            // If we can't determine the type, default to media
            return 'media';
    }
}

// Helper function to map NeoDB categories to visualization categories
function mapCategory(nodeType, nodeGroup) {
    // For media nodes, use the original type as category
    if (nodeType === 'book' || nodeType === 'Edition') {
        return 'book';
    } else if (nodeType === 'movie') {
        return 'movie';
    } else if (nodeType === 'tv') {
        return 'tvseries';
    } else if (nodeType === 'music' || nodeType === 'album') {
        return 'music';
    } else if (nodeType === 'podcast') {
        return 'podcast';
    } else if (nodeType === 'game') {
        return 'game';
    }
    
    // For other node types
    return nodeGroup;
}
