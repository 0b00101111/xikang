// Graph visualization using D3.js
// This file implements the graph visualization

const graphVisualization = (function() {
    // Private variables
    let svg, g, width, height, data;
    let simulation, link, node, nodeLabels;
    let zoom;
    let nodes = [], links = [];
    let selectedNode = null;
    let nodeTypes = {}; // Keep track of node type visibility

    // Configuration options
    let config = {
        onNodeClick: null,
        onNodeHover: null
    };

    // Color scales
    const mediaColors = d3.scaleOrdinal()
        .range(['var(--movie-color)', 'var(--book-color)', 'var(--tvseries-color)', 
                'var(--music-color)', 'var(--podcast-color)']);

    const creatorColors = d3.scaleOrdinal()
        .range(['var(--director-color)', 'var(--author-color)', 'var(--actor-color)',
                'var(--musician-color)']);

    // Get node color based on type and category
    function getNodeColor(d) {
        if (d.type === 'media' && d.category) {
            return mediaColors(d.category);
        } else if (d.type === 'creator' && d.category) {
            return creatorColors(d.category);
        } else if (d.type === 'genre') {
            return 'var(--genre-color)';
        } else if (d.type === 'tag') {
            return 'var(--tag-color)';
        }
        
        // Default colors
        return d.type === 'media' ? 'var(--movie-color)' : 
               d.type === 'creator' ? 'var(--director-color)' :
               d.type === 'genre' ? 'var(--genre-color)' :
               'var(--tag-color)';
    }

    // Get node size based on type and data
    function getNodeSize(d) {
        if (d.type === 'media') {
            // Media nodes are larger, boosted by rating if available
            return 12 + (d.rating ? d.rating / 2 : 0);
        } else if (d.type === 'creator') {
            // Creator size based on media count
            return 8 + (d.media_count ? Math.min(d.media_count, 5) : 0);
        } else if (d.type === 'genre') {
            // Genre size based on media count
            return 6 + (d.media_count ? Math.min(d.media_count / 2, 4) : 0);
        } else {
            // Tags and other nodes
            return 5 + (d.media_count ? Math.min(d.media_count / 3, 3) : 0);
        }
    }

    // Initialize the visualization
    function init(containerId, graphData, options = {}) {
        // Store options
        config = {...config, ...options};
        
        // Set dimensions
        width = options.width || 800;
        height = options.height || 600;
        
        // Store the data
        data = graphData;
        nodes = graphData.nodes.slice();
        links = graphData.links.slice();
        
        // Initialize node types visibility
        initNodeTypes();
        
        // Create SVG
        svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('class', 'graph-svg');
        
        // Create zoom behavior
        zoom = d3.zoom()
            .scaleExtent([0.1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        // Create main group that will be transformed
        g = svg.append('g');
        
        // Create a tooltip
        const tooltip = d3.select(`#${containerId}`)
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);
        
        // Create links
        link = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('stroke-width', d => Math.sqrt(d.value || 1));
        
        // Create nodes
        node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', getNodeSize)
            .attr('fill', getNodeColor)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Create node labels
        nodeLabels = g.append('g')
            .attr('class', 'node-labels')
            .selectAll('text')
            .data(nodes)
            .enter().append('text')
            .attr('class', 'node-label')
            .attr('dx', 12)
            .attr('dy', '.35em')
            .text(d => d.name)
            .style('font-size', d => {
                if (d.type === 'media') return '10px';
                return '8px';
            })
            .style('opacity', d => {
                if (d.type === 'media') return 1;
                return 0.7;
            });
        
        // Create force simulation
        simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => getNodeSize(d) + 5));
        
        // Add tooltip behavior
        node.on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            
            let tooltipContent = `<strong>${d.name}</strong><br>`;
            tooltipContent += `Type: ${d.type}`;
            
            if (d.type === 'media' && d.category) {
                tooltipContent += `<br>Category: ${d.category}`;
            }
            
            if (d.rating) {
                tooltipContent += `<br>Rating: ${d.rating}/10`;
            }
            
            tooltip.html(tooltipContent)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            
            // Call hover callback if provided
            if (config.onNodeHover) {
                config.onNodeHover(d);
            }
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        });
        
        // Add click behavior
        node.on('click', function(event, d) {
            event.stopPropagation();
            
            // Clear previous selection
            if (selectedNode) {
                d3.select(this.parentNode)
                    .selectAll('.node-selected')
                    .classed('node-selected', false);
            }
            
            // Set new selection
            selectedNode = d;
            d3.select(this).classed('node-selected', true);
            
            // Call click callback if provided
            if (config.onNodeClick) {
                config.onNodeClick(d);
            }
        });
        
        // Clear selection when clicking on background
        svg.on('click', function(event) {
            if (event.target === this) {
                if (selectedNode) {
                    d3.select(g)
                        .selectAll('.node-selected')
                        .classed('node-selected', false);
                    
                    selectedNode = null;
                    
                    // Call click callback with null
                    if (config.onNodeClick) {
                        config.onNodeClick(null);
                    }
                }
            }
        });
        
        // Update positions on simulation tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('cx', d => d.x = Math.max(getNodeSize(d), Math.min(width - getNodeSize(d), d.x)))
                .attr('cy', d => d.y = Math.max(getNodeSize(d), Math.min(height - getNodeSize(d), d.y)));
            
            nodeLabels
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });
    }

    // Initialize node types for filtering
    function initNodeTypes() {
        // Media types
        if (data.metadata && data.metadata.mediaTypes) {
            data.metadata.mediaTypes.forEach(type => {
                nodeTypes[`media-${type}`] = true;
            });
        }
        
        // Creator types
        if (data.metadata && data.metadata.creatorTypes) {
            data.metadata.creatorTypes.forEach(type => {
                nodeTypes[`creator-${type}`] = true;
            });
        }
        
        // Other node types
        nodeTypes['genre'] = true;
        nodeTypes['tag'] = true;
    }

    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Filter nodes by category
    function filterByCategory(category) {
        if (!simulation) return;
        
        if (category === 'all') {
            // Show all nodes and links
            node.style('opacity', 1);
            link.style('opacity', 0.6);
            nodeLabels.style('opacity', d => d.type === 'media' ? 1 : 0.7);
        } else {
            // Filter nodes by category
            node.style('opacity', d => {
                if (d.type === 'media') {
                    return d.category === category ? 1 : 0.1;
                } else if (d.type === 'creator' || d.type === 'genre' || d.type === 'tag') {
                    // Check if this entity is connected to any media of the selected category
                    const isConnected = links.some(link => {
                        const source = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
                        const target = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
                        
                        // If media node matches category and is connected to this entity
                        return (source.type === 'media' && source.category === category && target.id === d.id) ||
                               (target.type === 'media' && target.category === category && source.id === d.id);
                    });
                    
                    return isConnected ? 0.7 : 0.1;
                }
                
                return 0.1;
            });
            
            // Filter links
            link.style('opacity', d => {
                const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
                const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
                
                // If source or target is a media node with the selected category
                if ((source.type === 'media' && source.category === category) ||
                    (target.type === 'media' && target.category === category)) {
                    return 0.6;
                }
                
                return 0.1;
            });
            
            // Filter labels
            nodeLabels.style('opacity', d => {
                if (d.type === 'media') {
                    return d.category === category ? 1 : 0.1;
                }
                
                return node.filter(n => n.id === d.id).style('opacity') > 0.1 ? 0.7 : 0.1;
            });
        }
    }

    // Toggle visibility of node type
    function toggleNodeType(typeFilter) {
        if (!simulation) return;
        
        // Parse the filter (e.g., 'media-movie', 'creator-director', 'genre')
        let [type, category] = typeFilter.split('-');
        
        // Toggle the visibility state
        nodeTypes[typeFilter] = !nodeTypes[typeFilter];
        const isVisible = nodeTypes[typeFilter];
        
        // Update node visibility
        node.style('opacity', d => {
            if (type === 'media' && d.type === 'media') {
                return (d.category === category) ? (isVisible ? 1 : 0.1) : node.filter(n => n.id === d.id).style('opacity');
            } else if (type === 'creator' && d.type === 'creator') {
                return (d.category === category) ? (isVisible ? 1 : 0.1) : node.filter(n => n.id === d.id).style('opacity');
            } else if (type === d.type && !category) {
                return isVisible ? 1 : 0.1;
            }
            
            return node.filter(n => n.id === d.id).style('opacity');
        });
        
        // Update link visibility
        link.style('opacity', d => {
            const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
            const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
            
            let sourceMatch = false;
            let targetMatch = false;
            
            if (type === 'media') {
                sourceMatch = source.type === 'media' && source.category === category;
                targetMatch = target.type === 'media' && target.category === category;
            } else if (type === 'creator') {
                sourceMatch = source.type === 'creator' && source.category === category;
                targetMatch = target.type === 'creator' && target.category === category;
            } else {
                sourceMatch = source.type === type;
                targetMatch = target.type === type;
            }
            
            if (sourceMatch || targetMatch) {
                return isVisible ? 0.6 : 0.1;
            }
            
            return link.filter(l => l === d).style('opacity');
        });
        
        // Update label visibility
        nodeLabels.style('opacity', d => {
            if (node.filter(n => n.id === d.id).style('opacity') > 0.1) {
                return d.type === 'media' ? 1 : 0.7;
            }
            return 0.1;
        });
    }

    // Search for nodes by name
    function searchNodes(query) {
        if (!simulation || !query) {
            // If no query, reset view
            if (!query) {
                node.style('opacity', 1);
                link.style('opacity', 0.6);
                nodeLabels.style('opacity', d => d.type === 'media' ? 1 : 0.7);
                return;
            }
        }
        
        // Find matching nodes
        const matchingNodes = nodes.filter(n => 
            n.name.toLowerCase().includes(query.toLowerCase())
        );
        
        if (matchingNodes.length === 0) {
            // No matches found
            alert('No matching items found');
            return;
        }
        
        // Highlight matching nodes
        node.style('opacity', d => 
            matchingNodes.some(n => n.id === d.id) ? 1 : 0.1
        );
        
        // Highlight connected links
        link.style('opacity', d => {
            const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
            const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
            
            return matchingNodes.some(n => n.id === source.id || n.id === target.id) ? 0.6 : 0.1;
        });
        
        // Highlight matching labels
        nodeLabels.style('opacity', d => 
            matchingNodes.some(n => n.id === d.id) ? 1 : 0.1
        );
        
        // If there's exactly one match, center on it
        if (matchingNodes.length === 1) {
            centerOnNode(matchingNodes[0]);
        }
    }

    // Center view on a specific node
    function centerOnNode(node) {
        if (!simulation || !node) return;
        
        // Stop any ongoing simulation
        simulation.alpha(0);
        
        // Calculate the transform to center on the node
        const scale = 1.5;
        const x = width / 2 - node.x * scale;
        const y = height / 2 - node.y * scale;
        
        // Animate to the new position
        svg.transition()
            .duration(750)
            .call(
                zoom.transform,
                d3.zoomIdentity
                    .translate(x, y)
                    .scale(scale)
            );
    }

    // Zoom controls
    function zoomIn() {
        svg.transition()
            .duration(300)
            .call(zoom.scaleBy, 1.5);
    }

    function zoomOut() {
        svg.transition()
            .duration(300)
            .call(zoom.scaleBy, 0.67);
    }

    function resetView() {
        svg.transition()
            .duration(750)
            .call(
                zoom.transform,
                d3.zoomIdentity
            );
    }

    // Resize the visualization
    function resize(newWidth, newHeight) {
        if (!svg) return;
        
        width = newWidth || width;
        height = newHeight || height;
        
        svg.attr('width', width)
            .attr('height', height);
        
        // Update center force
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.3).restart();
    }

    // Public API
    return {
        init: init,
        filterByCategory: filterByCategory,
        toggleNodeType: toggleNodeType,
        searchNodes: searchNodes,
        zoomIn: zoomIn,
        zoomOut: zoomOut,
        resetView: resetView,
        resize: resize
    };
})();
