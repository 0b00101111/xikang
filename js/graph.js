// Movie-only graph visualization using D3.js
// This file implements a clean graph visualization just for movies

// Create the graphVisualization object in the global scope
const graphVisualization = (function() {
    // Private variables
    let svg, g, simulation, link, node, nodeLabels;
    let width, height, data;
    let nodes = [], links = [];
    let selectedNode = null;
    let zoom;

    // Color scheme for movies
    const movieColor = '#E07A5F';
    const directorColor = '#FB8500';
    const actorColor = '#FF006E';

    // Get node color based on type and shelf status
    function getNodeColor(d) {
        if (d.type === 'movie') {
            return colorUtils.calculateMovieColor(d, nodes, links);
        } else if (d.type === 'creator') {
            // Check if this creator has any completed movies
            const hasCompletedMovie = links.some(link => {
                const movieId = link.source === d.id ? link.target : link.source;
                const movie = nodes.find(n => n.id === movieId && n.type === 'movie');
                return movie && movie.shelf === 'complete';
            });
            return colorUtils.getCreatorColor(d.id, hasCompletedMovie);
        }
        return colorUtils.PALETTE.sumiInk3; // Default color
    }

    // Get node opacity based on shelf status
    function getNodeOpacity(d) {
        if (d.type === 'movie' && d.shelf === 'wishlist') {
            return 0.6; // Slightly transparent for wishlist items
        }
        return 1.0; // Full opacity for all other nodes
    }

    // Get node size based on type and importance
    function getNodeSize(d) {
        if (d.type === 'creator') {
            if (d.role === 'director') {
                return 5; // Directors slightly larger
            }
            return 4; // Actors
        }
        // Movies sized by rating if available
        if (d.type === 'movie' && d.rating) {
            return 3 + (d.rating / 10) * 3; // Size 3-6 based on rating
        }
        return 4; // Default size
    }

    // Drag behavior functions
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

    // Zoom control functions
    function zoomIn() {
        if (!svg || !zoom) return;
        svg.transition()
            .duration(750)
            .call(zoom.scaleBy, 1.3);
    }

    function zoomOut() {
        if (!svg || !zoom) return;
        svg.transition()
            .duration(750)
            .call(zoom.scaleBy, 0.7);
    }

    function resetView() {
        if (!svg || !zoom) return;
        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity);
    }

    // Filter nodes by category
    function filterByCategory(category) {
        if (!node || !nodeLabels || !link) return;

        // Update node visibility
        node.style('opacity', d => {
            if (category === 'all') return getNodeOpacity(d);
            if (d.type === 'movie') {
                return d.shelf === category ? getNodeOpacity(d) : 0.1;
            }
            return getNodeOpacity(d);
        });

        // Update label visibility
        nodeLabels.style('opacity', d => {
            if (category === 'all') {
                if (d.type === 'movie' && d.shelf === 'wishlist') return 0.6;
                if (d.type === 'movie' && d.shelf === 'dropped') return 0.6;
                if (d.role === 'director') return 0.9;
                return 0.7;
            }
            if (d.type === 'movie') {
                return d.shelf === category ? 0.9 : 0.1;
            }
            return 0.7;
        });

        // Update link visibility
        link.style('opacity', l => {
            if (category === 'all') return 0.5;
            const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
            const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
            
            if (source.type === 'movie' && source.shelf === category) return 0.5;
            if (target.type === 'movie' && target.shelf === category) return 0.5;
            return 0.1;
        });
    }

    // Toggle visibility of node types
    function toggleNodeType(type) {
        if (!node || !nodeLabels || !link) return;

        const isVisible = node.style('opacity') === '1';
        
        // Update node visibility
        node.style('opacity', d => {
            if (d.type === type) return isVisible ? 0.1 : getNodeOpacity(d);
            return getNodeOpacity(d);
        });

        // Update label visibility
        nodeLabels.style('opacity', d => {
            if (d.type === type) return isVisible ? 0.1 : 0.7;
            if (d.type === 'movie' && d.shelf === 'wishlist') return 0.6;
            if (d.type === 'movie' && d.shelf === 'dropped') return 0.6;
            if (d.role === 'director') return 0.9;
            return 0.7;
        });

        // Update link visibility
        link.style('opacity', l => {
            const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
            const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
            
            if (source.type === type || target.type === type) return isVisible ? 0.1 : 0.5;
            return 0.5;
        });
    }

    // Handle window resizing
    function resize() {
        if (!svg || !g || !simulation) return;

        // Get new dimensions
        const container = document.getElementById('graph-container');
        width = container.clientWidth;
        height = container.clientHeight;

        // Update SVG dimensions
        svg.attr('viewBox', [-width/2, -height/2, width, height]);

        // Update simulation
        simulation
            .force('x', d3.forceX().strength(0.01))
            .force('y', d3.forceY().strength(0.01))
            .restart();
    }

    // Initialize the visualization
    function init(containerId, graphData) {
        // Set dimensions based on container
        const container = document.getElementById(containerId);
        width = container.clientWidth;
        height = container.clientHeight;
        
        // Store data
        data = graphData;
        nodes = graphData.nodes || [];
        links = graphData.links || [];
        
        // Create SVG with centered viewBox
        svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', [-width/2, -height/2, width, height])
            .style('background', '#ffffff');
        
        // Create zoom behavior
        zoom = d3.zoom()
            .scaleExtent([0.1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        // Create main group for transformation
        g = svg.append('g');
        
        // Create tooltip
        const tooltip = d3.select(`#${containerId}`)
            .append('div')
            .attr('class', 'node-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background-color', 'white')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('padding', '6px 10px')
            .style('font-family', 'sans-serif')
            .style('font-size', '12px')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('max-width', '250px');
        
        // Create links with arrowheads for directional relationships
        const linkGroup = g.append('g');
        
        // Add directional marker definitions
        svg.append('defs').selectAll('marker')
            .data(['director', 'actor', 'worked_with', 'co_actor'])
            .enter().append('marker')
            .attr('id', d => `arrow-${d}`)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 15)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('fill', '#999')
            .attr('d', 'M0,-5L10,0L0,5');
        
        // Create links
        link = linkGroup.selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#e0e0e0')
            .attr('stroke-opacity', 0.5)
            .attr('stroke-width', d => {
                if (d.type === 'director' || d.type === 'actor') {
                    return 1.5;
                } else if (d.type === 'worked_with') {
                    return 1;
                } else if (d.type === 'co_actor') {
                    return 0.5;
                }
                return 1;
            });
        
        // Create nodes
        node = g.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('r', getNodeSize)
            .attr('fill', getNodeColor)
            .attr('opacity', getNodeOpacity)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Create labels for all nodes
        nodeLabels = g.append('g')
            .selectAll('text')
            .data(nodes)
            .enter().append('text')
            .attr('dx', 6)
            .attr('dy', 3)
            .text(d => d.name)
            .attr('font-family', 'sans-serif')
            .attr('font-size', d => {
                if (d.type === 'movie') return '8px';
                if (d.role === 'director') return '9px';
                return '8px';
            })
            .attr('fill', '#555')
            .style('pointer-events', 'none')
            .style('user-select', 'none')
            .style('opacity', d => {
                if (d.type === 'movie' && d.shelf === 'wishlist') return 0.6;
                if (d.type === 'movie' && d.shelf === 'dropped') return 0.6;
                if (d.role === 'director') return 0.9;
                return 0.7;
            });
        
        // Create force simulation with movie-specific forces
        simulation = d3.forceSimulation(nodes)
            // Links with variable distances
            .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
                const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
                const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
                
                if (!source || !target) return 200;
                
                if (d.type === 'director' || d.type === 'actor') {
                    return 300; // Much larger distance between movies and creators
                } else if (d.type === 'worked_with') {
                    return 400; // Much larger distance between collaborators
                } else if (d.type === 'co_actor') {
                    return 350; // Much larger distance between co-actors
                }
                return 200; // Larger default distance
            }))
            // Very strong repulsive force
            .force('charge', d3.forceManyBody()
                .strength(d => {
                    if (d.role === 'director') return -3000;
                    if (d.role === 'actor') return -2000;
                    return -1500; // Movies
                })
                .distanceMax(1000) // Increased maximum distance of repulsion
                .theta(0.5) // More accurate force calculations
            )
            // Remove center gravity forces
            //.force('x', d3.forceX().strength(0.05))
            //.force('y', d3.forceY().strength(0.05))
            // Add radial force to spread nodes out
            .force('radial', d3.forceRadial(
                d => {
                    if (d.role === 'director') return height/3;
                    if (d.role === 'actor') return height/2.5;
                    return height/4;
                },
                width/2,
                height/2
            ).strength(0.3))
            // Strong collision prevention
            .force('collision', d3.forceCollide().radius(d => getNodeSize(d) * 5).strength(1))
            // Add alpha settings for better stabilization
            .alpha(1)
            .alphaDecay(0.003) // Even slower cooling
            .alphaMin(0.001)
            .velocityDecay(0.4); // Add some "friction" to prevent too much bouncing

        // Update simulation on each tick
        simulation.on('tick', () => {
            // Bound nodes to the visible area with padding
            const padding = 50;
            nodes.forEach(d => {
                d.x = Math.max(-width/2 + padding, Math.min(width/2 - padding, d.x));
                d.y = Math.max(-height/2 + padding, Math.min(height/2 - padding, d.y));
            });

            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            nodeLabels
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        // Add hover and click behaviors
        setupNodeInteractions();
    }

    // Setup node interactions (hover and click)
    function setupNodeInteractions() {
        if (!node || !nodeLabels || !link) return;

        // Add hover behavior
        node.on('mouseover', handleNodeMouseOver)
           .on('mousemove', handleNodeMouseMove)
           .on('mouseout', handleNodeMouseOut)
           .on('click', handleNodeClick);

        // Clear selection when clicking on background
        svg.on('click', handleBackgroundClick);
    }

    // Handle node mouse over
    function handleNodeMouseOver(event, d) {
        // Show tooltip with node details
        const tooltip = d3.select('.node-tooltip');
        let tooltipContent = `<strong>${d.name}</strong><br>`;
        
        if (d.type === 'movie') {
            tooltipContent += `Type: Movie<br>Status: ${d.shelf || 'Unknown'}`;
            if (d.rating) {
                tooltipContent += `<br>Rating: ${d.rating}/10`;
            }
        } else if (d.type === 'creator') {
            tooltipContent += `Role: ${d.role || 'Creator'}`;
            
            // Find connected movies
            const connectedMovies = links
                .filter(link => 
                    (typeof link.source === 'object' ? link.source.id === d.id : link.source === d.id) && 
                    nodes.find(n => n.id === (typeof link.target === 'object' ? link.target.id : link.target) && n.type === 'movie')
                )
                .map(link => typeof link.target === 'object' ? link.target.id : link.target)
                .map(movieId => nodes.find(n => n.id === movieId))
                .filter(Boolean);
            
            if (connectedMovies.length > 0) {
                tooltipContent += `<br><br>Movies:`;
                connectedMovies.forEach(movie => {
                    tooltipContent += `<br>• ${movie.name}`;
                });
            }
        }
        
        tooltip.html(tooltipContent)
            .style('visibility', 'visible')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        
        highlightConnections(d);
    }

    // Handle node mouse move
    function handleNodeMouseMove(event) {
        const tooltip = d3.select('.node-tooltip');
        tooltip.style('left', (event.pageX + 10) + 'px')
               .style('top', (event.pageY - 10) + 'px');
    }

    // Handle node mouse out
    function handleNodeMouseOut() {
        const tooltip = d3.select('.node-tooltip');
        tooltip.style('visibility', 'hidden');
        
        if (!selectedNode) {
            resetHighlighting();
        }
    }

    // Handle node click
    function handleNodeClick(event, d) {
        event.stopPropagation();
        
        if (selectedNode === d) {
            selectedNode = null;
            resetHighlighting();
        } else {
            selectedNode = d;
            highlightConnections(d, true);
        }
    }

    // Handle background click
    function handleBackgroundClick(event) {
        if (event.target === this && selectedNode) {
            selectedNode = null;
            resetHighlighting();
        }
    }

    // Highlight connections for a node
    function highlightConnections(d, isClick = false) {
        // Highlight connected links
        link.style('stroke', l => {
            const source = typeof l.source === 'object' ? l.source.id : l.source;
            const target = typeof l.target === 'object' ? l.target.id : l.target;
            return (source === d.id || target === d.id) ? '#666' : '#e0e0e0';
        })
        .style('stroke-opacity', l => {
            const source = typeof l.source === 'object' ? l.source.id : l.source;
            const target = typeof l.target === 'object' ? l.target.id : l.target;
            return (source === d.id || target === d.id) ? 0.9 : 0.1;
        })
        .style('stroke-width', l => {
            const source = typeof l.source === 'object' ? l.source.id : l.source;
            const target = typeof l.target === 'object' ? l.target.id : l.target;
            if (source === d.id || target === d.id) {
                if (l.type === 'director' || l.type === 'actor') {
                    return 2;
                } else if (l.type === 'worked_with') {
                    return 1.5;
                } else if (l.type === 'co_actor') {
                    return 1;
                }
                return 1.5;
            }
            return 0.5;
        });
        
        // Highlight connected nodes
        node.style('opacity', n => {
            const isConnected = links.some(l => {
                const source = typeof l.source === 'object' ? l.source.id : l.source;
                const target = typeof l.target === 'object' ? l.target.id : l.target;
                return (source === d.id && target === n.id) || (target === d.id && source === n.id);
            });
            
            if (isClick && n.id === d.id) {
                d3.select(this).style('stroke', '#000').style('stroke-width', 2);
            }
            
            if (n.id === d.id) return 1;
            if (isConnected) {
                if (n.type === 'movie' && n.shelf === 'progress') return 0.7;
                return 1;
            }
            return 0.2;
        });
        
        // Highlight relevant labels
        nodeLabels.style('opacity', n => {
            const isConnected = links.some(l => {
                const source = typeof l.source === 'object' ? l.source.id : l.source;
                const target = typeof l.target === 'object' ? l.target.id : l.target;
                return (source === d.id && target === n.id) || (target === d.id && source === n.id);
            });
            
            if (n.id === d.id) return 1;
            if (isConnected) {
                if (n.type === 'movie') return 0.9;
                if (n.role === 'director') return 1;
                return 0.9;
            }
            return 0.1;
        });
    }

    // Reset highlighting
    function resetHighlighting() {
        link.style('stroke', '#e0e0e0')
            .style('stroke-opacity', 0.5)
            .style('stroke-width', d => {
                if (d.type === 'director' || d.type === 'actor') {
                    return 1.5;
                } else if (d.type === 'worked_with') {
                    return 1;
                } else if (d.type === 'co_actor') {
                    return 0.5;
                }
                return 1;
            });
        
        node.style('opacity', getNodeOpacity)
            .style('stroke', '#fff')
            .style('stroke-width', 1);
        
        nodeLabels.style('opacity', d => {
            if (d.type === 'movie' && d.shelf === 'wishlist') return 0.6;
            if (d.type === 'movie' && d.shelf === 'dropped') return 0.6;
            if (d.role === 'director') return 0.9;
            return 0.7;
        });
    }

    // Return the public API
    return {
        init,
        zoomIn,
        zoomOut,
        resetView,
        filterByCategory,
        toggleNodeType,
        resize
    };
})();

// Make graphVisualization available globally
window.graphVisualization = graphVisualization;
