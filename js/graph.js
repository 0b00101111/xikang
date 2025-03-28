// Movie-only graph visualization using D3.js
// This file implements a clean graph visualization just for movies

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
            // Color based on shelf status
            if (d.shelf === 'wishlist') {
                return '#a0a0a0'; // Grey for wishlist items
            } else if (d.shelf === 'dropped') {
                return '#c0c0c0'; // Light grey for dropped items
            } else {
                return movieColor; // Full color for complete/progress
            }
        } else if (d.type === 'creator') {
            if (d.role === 'director') {
                return directorColor;
            } else if (d.role === 'actor') {
                return actorColor;
            }
        }
        return '#999'; // Default color
    }

    // Get node opacity based on shelf status
    function getNodeOpacity(d) {
        if (d.type === 'movie' && d.shelf === 'progress') {
            return 0.5; // Half transparent for in-progress items
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
                
                if (!source || !target) return 50;
                
                if (d.type === 'director' || d.type === 'actor') {
                    return 70; // Movie to creator links
                } else if (d.type === 'worked_with') {
                    return 100; // Director to actor links
                } else if (d.type === 'co_actor') {
                    return 80; // Actor to actor links
                }
                return 50; // Default distance
            }))
            // Strong repulsive force
            .force('charge', d3.forceManyBody().strength(d => {
                if (d.role === 'director') return -300;
                if (d.role === 'actor') return -200;
                return -100; // Movies
            }))
            // Very weak center gravity
            .force('x', d3.forceX().strength(0.01))
            .force('y', d3.forceY().strength(0.01))
            // Collision prevention
            .force('collision', d3.forceCollide().radius(d => getNodeSize(d) * 2));
        
        // Add hover behavior for highlighting and tooltip
        node.on('mouseover', function(event, d) {
            // Show tooltip with node details
            let tooltipContent = `<strong>${d.name}</strong><br>`;
            
            if (d.type === 'movie') {
                tooltipContent += `Type: Movie<br>Status: ${d.shelf || 'Unknown'}`;
                
                if (d.rating) {
                    tooltipContent += `<br>Rating: ${d.rating}/10`;
                }
            } else if (d.type === 'creator') {
                tooltipContent += `Role: ${d.role || 'Creator'}`;
                
                // Find connected movies for this creator
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
        })
        .on('mousemove', function(event) {
            // Move tooltip with cursor
            tooltip.style('left', (event.pageX + 10) + 'px')
                   .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            // Hide tooltip
            tooltip.style('visibility', 'hidden');
            
            // Reset all styles if no node is selected
            if (!selectedNode) {
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
                
                node.style('opacity', getNodeOpacity);
                
                nodeLabels.style('opacity', d => {
                    if (d.type === 'movie' && d.shelf === 'wishlist') return 0.6;
                    if (d.type === 'movie' && d.shelf === 'dropped') return 0.6;
                    if (d.role === 'director') return 0.9;
                    return 0.7;
                });
            }
        });
        
        // Add click behavior for persisting selection
        node.on('click', function(event, d) {
            event.stopPropagation();
            
            // Toggle selection
            if (selectedNode === d) {
                // Deselect if already selected
                selectedNode = null;
                
                // Reset styles
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
            } else {
                // Select this node
                selectedNode = d;
                
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
                    
                    // Highlight node outline if selected
                    if (n.id === d.id) {
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
        });
        
        // Clear selection when clicking on background
        svg.on('click', function(event) {
            if (event.target === this && selectedNode) {
                selectedNode = null;
                
                // Reset styles
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
                    if (d.type === 'movie' && d.shelf === 'dropped') return 0
