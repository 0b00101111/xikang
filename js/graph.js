// Graph visualization using D3.js
// This file implements the graph visualization

const graphVisualization = (function() {
    // Private variables
    let svg, g, width, height, data;
    let simulation, link, node, nodeLabels, linkLabels;
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
    const nodeColors = {
        user: '#555',
        tag: '#06d6a0',
        shelf: '#ffbe0b',
        book: '#4361ee',
        movie: '#e5383b',
        tv: '#7209b7',
        tvseries: '#7209b7',
        music: '#f72585',
        podcast: '#4cc9f0',
        game: '#4f772d',
        Edition: '#4361ee',  // Same as book
        album: '#f72585'     // Same as music
    };

    // Get node color based on type
    function getNodeColor(d) {
        return nodeColors[d.type] || nodeColors[d.category] || '#555';
    }

    // Get node size based on type
    function getNodeSize(d) {
        if (d.type === 'user') {
            return 30; // User node is largest
        } else if (d.type === 'tag' || d.type === 'shelf') {
            return 12; // Tags and shelves are medium
        } else if (d.type === 'media') {
            return 8 + (d.rating ? d.rating / 5 : 0); // Media nodes sized by rating
        }
        return 8; // Default size
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
            .attr('class', 'graph-svg')
            .attr('viewBox', [-width/2, -height/2, width, height]);
        
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
            .attr('stroke-width', d => Math.sqrt(d.value || 1))
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6);
        
        // Create link labels
        linkLabels = g.append('g')
            .attr('class', 'link-labels')
            .selectAll('text')
            .data(links)
            .enter().append('text')
            .attr('class', 'link-label')
            .attr('dy', -3)
            .attr('text-anchor', 'middle')
            .text(d => d.type)
            .style('font-size', '7px')
            .style('opacity', 0);  // Hidden by default
        
        // Create nodes
        node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', getNodeSize)
            .attr('fill', getNodeColor)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
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
            .attr('dx', d => getNodeSize(d) + 2)
            .attr('dy', '.35em')
            .text(d => d.name)
            .style('font-size', d => {
                if (d.type === 'user') return '14px';
                if (d.type === 'tag' || d.type === 'shelf') return '10px';
                return '8px';
            })
            .style('opacity', d => {
                if (d.type === 'user') return 1;
                if (d.type === 'tag' || d.type === 'shelf') return 0.9;
                return 0.7;
            });
        
        // Create force simulation with more space
        simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
                // Adjust link distance based on node types
                const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
                const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
                
                if (source.type === 'user' || target.type === 'user') {
                    return 200; // Links to user are longer
                } else if (source.type === 'tag' || target.type === 'tag' ||
                           source.type === 'shelf' || target.type === 'shelf') {
                    return 150; // Links to tags and shelves are medium
                }
                return 80; // Default distance
            }))
            .force('charge', d3.forceManyBody().strength(d => {
                // Adjust repulsive force based on node type
                if (d.type === 'user') {
                    return -2000; // User node has strong repulsion
                } else if (d.type === 'tag' || d.type === 'shelf') {
                    return -500; // Tags and shelves have medium repulsion
                }
                return -200; // Default repulsion
            }))
            .force('center', d3.forceCenter(0, 0))
            .force('collision', d3.forceCollide().radius(d => getNodeSize(d) + 10))
            .force('x', d3.forceX().strength(0.01)) // Very weak force toward center
            .force('y', d3.forceY().strength(0.01)); // Very weak force toward center
        
        // Add tooltip behavior
        node.on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            
            let tooltipContent = `<strong>${d.name}</strong><br>`;
            tooltipContent += `Type: ${d.type === 'media' ? d.category : d.type}`;
            
            if (d.rating) {
                tooltipContent += `<br>Rating: ${d.rating}/10`;
            }
            
            tooltip.html(tooltipContent)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            
            // Highlight connected links and show their labels
            link.style('stroke', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? '#000' : '#999';
            })
            .style('stroke-opacity', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? 1 : 0.2;
            })
            .style('stroke-width', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? 2 : Math.sqrt(l.value || 1);
            });
            
            // Show labels for connected links
            linkLabels.style('opacity', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? 1 : 0;
            });
            
            // Highlight connected nodes
            node.style('stroke', n => {
                const isConnected = links.some(l => {
                    const source = typeof l.source === 'object' ? l.source : nodes.find(node => node.id === l.source);
                    const target = typeof l.target === 'object' ? l.target : nodes.find(node => node.id === l.target);
                    return (source.id === d.id && target.id === n.id) || (target.id === d.id && source.id === n.id);
                });
                return isConnected ? '#000' : '#fff';
            })
            .style('stroke-width', n => {
                const isConnected = links.some(l => {
                    const source = typeof l.source === 'object' ? l.source : nodes.find(node => node.id === l.source);
                    const target = typeof l.target === 'object' ? l.target : nodes.find(node => node.id === l.target);
                    return (source.id === d.id && target.id === n.id) || (target.id === d.id && source.id === n.id);
                });
                return isConnected ? 2.5 : 1.5;
            });
            
            // Call hover callback if provided
            if (config.onNodeHover) {
                config.onNodeHover(d);
            }
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            
            // Reset link styles
            link.style('stroke', '#999')
                .style('stroke-opacity', 0.6)
                .style('stroke-width', d => Math.sqrt(d.value || 1));
            
            // Hide link labels
            linkLabels.style('opacity', 0);
            
            // Reset node strokes
            node.style('stroke', '#fff')
                .style('stroke-width', 1.5);
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
            
            // Highlight connections and show relationship labels
            link.style('stroke', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? '#000' : '#999';
            })
            .style('stroke-opacity', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? 1 : 0.1;
            });
            
            // Show relationship labels
            linkLabels.style('opacity', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? 1 : 0;
            });
            
            // Call click callback if provided
            if (config.onNodeClick) {
                config.onNodeClick(d);
            }
        });
        
        // Clear selection when clicking on background
        svg.on('click', function(event) {
            if (event.target === this) {
                if (selectedNode) {
                    // Reset link styles
                    link.style('stroke', '#999')
                        .style('stroke-opacity', 0.6);
                    
                    // Hide link labels
                    linkLabels.style('opacity', 0);
                    
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
            
            // Position link labels at midpoint of links
            linkLabels
                .attr('x', d => (d.source.x + d.target.x) / 2)
                .attr('y', d => (d.source.y + d.target.y) / 2);
            
            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            nodeLabels
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });
        
        // Initial centering zoom
        svg.call(zoom.transform, d3.zoomIdentity.scale(0.8));
    }

    // Initialize node types for filtering
    function initNodeTypes() {
        // Get all unique node types
        const types = new Set();
        nodes.forEach(node => {
            if (node.type === 'media') {
                types.add(`media-${node.category}`);
            } else {
                types.add(node.type);
            }
        });
        
        // Initialize all to visible
        types.forEach(type => {
            nodeTypes[type] = true;
        });
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
        // Don't reset user node position
        if (d.type !== 'user') {
            d.fx = null;
            d.fy = null;
        }
    }

    // Filter nodes by category
    function filterByCategory(category) {
        if (!simulation) return;
        
        if (category === 'all') {
            // Show all nodes and links
            node.style('opacity', 1);
            link.style('opacity', 0.6);
            nodeLabels.style('opacity', d => {
                if (d.type === 'user') return 1;
                if (d.type === 'tag' || d.type === 'shelf') return 0.9;
                return 0.7;
            });
            linkLabels.style('opacity', 0);
        } else {
            // Filter nodes by category
            node.style('opacity', d => {
                if (d.type === 'user') {
                    return 1; // Always show user
                } else if (d.type === 'media') {
                    return d.category === category ? 1 : 0.1;
                } else if (d.type === 'tag' || d.type === 'shelf') {
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
                
                // Always show connections to user
                if (source.type === 'user' || target.type === 'user') {
                    return 0.6;
                }
                
                // If source or target is a media node with the selected category
                if ((source.type === 'media' && source.category === category) ||
                    (target.type === 'media' && target.category === category)) {
                    return 0.6;
                }
                
                return 0.1;
            });
            
            // Filter labels
            nodeLabels.style('opacity', d => {
                if (d.type === 'user') {
                    return 1; // Always show user label
                }
                
                if (node.filter(n => n.id === d.id).style('opacity') > 0.1) {
                    return d.type === 'media' ? 0.7 : 0.9;
                }
                
                return 0.1;
            });
            
            // Hide all link labels
            linkLabels.style('opacity', 0);
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
            if (d.type === 'user') {
                return 1; // Always show user
            }
            
            if (type === 'media' && d.type === 'media') {
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
            
            // Always show connections to user
            if (source.type === 'user' || target.type === 'user') {
                return 0.6;
            }
            
            let sourceMatch = false;
            let targetMatch = false;
            
            if (type === 'media') {
                sourceMatch = source.type === 'media' && source.category === category;
                targetMatch = target.type === 'media' && target.category === category;
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
            if (d.type === 'user') {
                return 1; // Always show user label
            }
            
            if (node.filter(n => n.id === d.id).style('opacity') > 0.1) {
                return d.type === 'media' ? 0.7 : 0.9;
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
                nodeLabels.style('opacity', d => {
                    if (d.type === 'user') return 1;
                    if (d.type === 'tag' || d.type === 'shelf') return 0.9;
                    return 0.7;
                });
                linkLabels.style('opacity', 0);
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
        node.style('opacity', d => {
            if (d.type === 'user') {
                return 1; // Always show user
            }
            
            return matchingNodes.some(n => n.id === d.id) ? 1 : 0.1;
        });
        
        // Highlight connected links
        link.style('opacity', d => {
            const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
            const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
            
            // Always show connections to user
            if (source.type === 'user' || target.type === 'user') {
                return 0.6;
            }
            
            return matchingNodes.some(n => n.id === source.id || n.id === target.id) ? 0.6 : 0.1;
        });
        
        // Highlight matching labels
        nodeLabels.style('opacity', d => {
            if (d.type === 'user') {
                return 1; // Always show user label
            }
            
            return matchingNodes.some(n => n.id === d.id) ? 1 : 0.1;
        });
        
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
        const x = -node.x * scale;
        const y = -node.y * scale;
        
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
                d3.zoomIdentity.scale(0.8)
            );
    }

    // Resize the visualization
    function resize(newWidth, newHeight) {
        if (!svg) return;
        
        width = newWidth || width;
        height = newHeight || height;
        
        svg.attr('width', width)
           .attr('height', height)
           .attr('viewBox', [-width/2, -height/2, width, height]);
        
        // No need to update center force as we're using a centered viewBox
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
