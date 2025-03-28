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
        console.log('Getting color for node:', d); // Debug log
        if (d.type === 'movie') {
            return colorUtils.calculateMovieColor(d, nodes, links);
        } else if (d.type === 'creator') {
            return colorUtils.getCreatorColor(d.id, d.role === 'director');
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
            return d.role === 'director' ? 6 : 4;
        }
        return 3; // Movies
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
            .force('center', d3.forceCenter(0, 0))
            .alpha(0.3)
            .restart();
    }

    // Initialize the visualization
    function init(containerId, graphData) {
        console.log('Initializing visualization with:', {
            nodes: graphData.nodes.length,
            links: graphData.links.length
        });
        
        // Store data
        data = graphData;
        nodes = graphData.nodes;
        links = graphData.links;
        
        // Set dimensions based on container
        const container = document.getElementById(containerId);
        width = container.clientWidth;
        height = container.clientHeight;
        
        // Create SVG
        svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', [-width/2, -height/2, width, height])
            .style('background', '#ffffff')
            .style('overflow', 'visible');
        
        // Create zoom behavior with initial zoom to fit
        zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        // Create main group
        g = svg.append('g');
        
        // Create links with reduced opacity for better performance
        link = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', colorUtils.PALETTE.fujiGray)
            .attr('stroke-opacity', 0.2)
            .attr('stroke-width', 0.3);
        
        // Create nodes with smaller radius
        node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', d => getNodeSize(d) * 0.8) // Smaller nodes
            .attr('fill', getNodeColor)
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.3)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Create labels with initial low opacity
        nodeLabels = g.append('g')
            .attr('class', 'labels')
            .selectAll('text')
            .data(nodes)
            .join('text')
            .attr('dx', 6)
            .attr('dy', 3)
            .text(d => d.name)
            .attr('font-family', 'sans-serif')
            .attr('font-size', d => d.type === 'creator' ? '8px' : '6px')
            .attr('fill', '#333')
            .style('pointer-events', 'none')
            .style('user-select', 'none')
            .style('opacity', 0.5);
        
        // Optimized force simulation
        simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id(d => d.id)
                .distance(30) // Shorter distances
                .strength(0.1)) // Weaker links
            .force('charge', d3.forceManyBody()
                .strength(-10) // Weaker repulsion
                .distanceMax(100)) // Shorter distance max
            .force('x', d3.forceX().strength(0.02))
            .force('y', d3.forceY().strength(0.02))
            .force('collision', d3.forceCollide()
                .radius(d => getNodeSize(d) * 1.2)
                .strength(0.2))
            .velocityDecay(0.6) // Faster stabilization
            .alphaDecay(0.05) // Faster cooling
            .alpha(0.3) // Lower initial energy
            .on('tick', () => {
                // Batch DOM updates for better performance
                requestAnimationFrame(() => {
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
            });
        
        // Stop simulation after 1 second
        setTimeout(() => {
            if (simulation) {
                simulation.stop();
                console.log('Simulation stopped');
            }
        }, 1000);

        // Initial zoom to fit
        const bounds = g.node().getBBox();
        const fullWidth = bounds.width;
        const fullHeight = bounds.height;
        const scale = 0.8 / Math.max(fullWidth / width, fullHeight / height);
        const transform = d3.zoomIdentity
            .translate(width/2, height/2)
            .scale(scale)
            .translate(-bounds.x - fullWidth/2, -bounds.y - fullHeight/2);
        
        svg.call(zoom.transform, transform);

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
