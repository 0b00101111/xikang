// Movie-only graph visualization using D3.js with Canvas for better performance
const graphVisualization = (function() {
    // Private variables
    let canvas, context, simulation;
    let width, height, data;
    let nodes = [], links = [];
    let visibleNodes = [], visibleLinks = [];
    let selectedNode = null;
    let transform = d3.zoomIdentity;
    let isDragging = false;
    let draggedNode = null;
    let animationFrameId = null;
    let nodeFilters = { type: null, shelf: null };
    let isStabilized = false;

    // Color scheme
    const movieColor = '#E07A5F';
    const directorColor = '#FB8500';
    const actorColor = '#FF006E';
    const DEFAULT_NODE_SIZE = 4;

    // Settings for layout and interactivity
    const FORCE_SETTINGS = {
        linkDistance: 30,        // Base distance between nodes
        linkStrength: 0.3,       // How rigid the links are (increased)
        charge: -40,             // Reduced repulsive force
        gravity: 0.25,           // Much stronger gravity
        friction: 0.6,           // Higher friction to slow movement
        collisionRadius: 8       // Smaller collision radius
    };

    // Maximum number of visible nodes to prevent overload
    const MAX_VISIBLE_NODES = 150;
    const MAX_VISIBLE_LINKS = 300;

    // Get node color based on type and shelf status
    function getNodeColor(d) {
        if (d.type === 'movie') {
            return colorUtils.calculateMovieColor(d, nodes, links);
        } else if (d.type === 'creator') {
            return colorUtils.getCreatorColor(d.id, d.role === 'director');
        }
        return colorUtils.PALETTE.sumiInk3;
    }

    // Get node size based on type and importance
    function getNodeSize(d) {
        if (d.type === 'creator') {
            return d.role === 'director' ? 6 : 4;
        }
        if (d.type === 'movie') {
            // Calculate size based on number of connections (importance)
            const connections = links.filter(link => 
                link.source.id === d.id || link.target.id === d.id
            ).length;
            return Math.min(Math.max(3, 3 + connections * 0.1), 8);
        }
        return DEFAULT_NODE_SIZE;
    }

    // Convert screen coordinates to graph coordinates
    function screenToGraph(point) {
        const transformed = transform.invert([point[0], point[1]]);
        return transformed;
    }

    // Find node at coordinates
    function findNodeAtCoordinates(x, y) {
        const pos = screenToGraph([x, y]);
        const threshold = 10 / transform.k; // Adjust for zoom
        
        let closestNode = null;
        let closestDistance = Infinity;
        
        // Find the closest node within threshold
        visibleNodes.forEach(node => {
            const dx = node.x - pos[0];
            const dy = node.y - pos[1];
            const distance = dx * dx + dy * dy;
            
            if (distance < threshold * threshold && distance < closestDistance) {
                closestDistance = distance;
                closestNode = node;
            }
        });
        
        return closestNode;
    }

    // Handle zoom events
    function handleZoom(event) {
        transform = event.transform;
        
        // Recalculate visible nodes based on zoom level
        updateVisibleElements();
        
        render();
    }

    // Mouse event handlers with improved dragging
    function handleMouseMove(event) {
        const [x, y] = d3.pointer(event);
        
        if (isDragging && draggedNode) {
            const pos = screenToGraph([x, y]);
            draggedNode.fx = pos[0];
            draggedNode.fy = pos[1];
            
            // Keep simulation active during dragging
            if (simulation.alpha() < 0.1) {
                simulation.alpha(0.1).restart();
            }
        } else {
            const node = findNodeAtCoordinates(x, y);
            canvas.node().style.cursor = node ? 'pointer' : 'default';
            if (node) {
                showTooltip(node, event);
            } else {
                hideTooltip();
            }
        }
    }

    function handleMouseDown(event) {
        const [x, y] = d3.pointer(event);
        const node = findNodeAtCoordinates(x, y);
        
        if (node) {
            isDragging = true;
            draggedNode = node;
            draggedNode.fx = draggedNode.x;
            draggedNode.fy = draggedNode.y;
            
            // Prevent zoom/pan when dragging nodes
            event.stopPropagation();
            
            // Restart simulation with higher energy
            if (isStabilized) {
                simulation.restart();
                isStabilized = false;
            }
            simulation.alpha(0.3).restart();
        }
    }

    function handleMouseUp() {
        if (isDragging && draggedNode) {
            // Keep the node in place after dragging
            setTimeout(() => {
                if (draggedNode) {
                    draggedNode.fx = null;
                    draggedNode.fy = null;
                    draggedNode = null;
                }
            }, 500); // Brief delay before releasing
            
            isDragging = false;
            simulation.alphaTarget(0);
        }
    }

    function handleClick(event) {
        const [x, y] = d3.pointer(event);
        const node = findNodeAtCoordinates(x, y);
        
        if (node) {
            if (selectedNode === node) {
                // Deselect if already selected
                selectedNode = null;
            } else {
                // Select and highlight connections
                selectedNode = node;
                expandNodeNeighborhood(node);
                highlightConnections(node);
                if (isStabilized) {
                    simulation.restart();
                    isStabilized = false;
                }
                simulation.alpha(0.1).restart(); // Gentle nudge
            }
            render();
        } else {
            // Click on background clears selection
            selectedNode = null;
            resetHighlighting();
            updateVisibleElements(); // Revert to default visible set
            render();
        }
    }

    // Expand to show a node's neighborhood
    function expandNodeNeighborhood(node) {
        // Get all directly connected nodes
        const connectedNodes = new Set();
        connectedNodes.add(node);
        
        links.forEach(link => {
            if (link.source.id === node.id) {
                connectedNodes.add(link.target);
            } else if (link.target.id === node.id) {
                connectedNodes.add(link.source);
            }
        });
        
        // Get links between these nodes
        const neighborhoodLinks = links.filter(link => 
            connectedNodes.has(link.source) && connectedNodes.has(link.target)
        );
        
        // Update visible elements to include this neighborhood
        visibleNodes = Array.from(connectedNodes);
        visibleLinks = neighborhoodLinks;
        
        // Ensure the simulation uses these nodes
        simulation.nodes(visibleNodes);
        simulation.force('link').links(visibleLinks);
    }

    // Highlighting and selection functions
    function highlightConnections(node) {
        // Find connected nodes and links
        visibleLinks.forEach(link => {
            link.highlighted = false;
            link.visible = false;
            
            if (link.source.id === node.id || link.target.id === node.id) {
                link.highlighted = true;
                link.visible = true;
                
                // Also set connected nodes as highlighted
                if (link.source.id === node.id) {
                    link.target.highlighted = true;
                } else {
                    link.source.highlighted = true;
                }
            }
        });
        
        // Mark the selected node
        visibleNodes.forEach(n => {
            n.highlighted = n === node || n.highlighted;
            // Dim non-highlighted nodes
            n.dimmed = !n.highlighted;
        });
    }
    
    function resetHighlighting() {
        // Reset all highlights
        nodes.forEach(node => {
            node.highlighted = false;
            node.dimmed = false;
        });
        
        links.forEach(link => {
            link.highlighted = false;
            link.visible = true;
        });
        
        // Reflect this in visible elements too
        visibleNodes.forEach(node => {
            node.highlighted = false;
            node.dimmed = false;
        });
        
        visibleLinks.forEach(link => {
            link.highlighted = false;
            link.visible = true;
        });
    }

    // Show tooltip
    function showTooltip(node, event) {
        const tooltip = d3.select('.node-tooltip');
        let tooltipContent = `<strong>${node.name}</strong><br>`;
        
        if (node.type === 'movie') {
            tooltipContent += `Type: Movie<br>Status: ${node.shelf || 'Unknown'}`;
            if (node.rating) {
                tooltipContent += `<br>Rating: ${node.rating}/10`;
            }
        } else if (node.type === 'creator') {
            tooltipContent += `Role: ${node.role || 'Creator'}`;
            
            // List connected movies
            const connectedMovies = getConnectedMovies(node);
            if (connectedMovies.length > 0) {
                tooltipContent += '<br><br>Movies:';
                connectedMovies.slice(0, 5).forEach(movie => {
                    tooltipContent += `<br>• ${movie.name}`;
                });
                if (connectedMovies.length > 5) {
                    tooltipContent += `<br>• ...and ${connectedMovies.length - 5} more`;
                }
            }
        }
        
        tooltip.html(tooltipContent)
            .style('visibility', 'visible')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }

    // Get movies connected to a creator
    function getConnectedMovies(creatorNode) {
        return links
            .filter(link => 
                (link.source.id === creatorNode.id && link.target.type === 'movie') ||
                (link.target.id === creatorNode.id && link.source.type === 'movie')
            )
            .map(link => 
                link.source.id === creatorNode.id ? link.target : link.source
            );
    }

    // Hide tooltip
    function hideTooltip() {
        d3.select('.node-tooltip').style('visibility', 'hidden');
    }

    // Select most important nodes based on connectivity
    function getImportantNodes() {
        // Calculate connection count for each node
        const nodeDegrees = new Map();
        
        nodes.forEach(node => {
            let connectionCount = 0;
            links.forEach(link => {
                if (link.source.id === node.id || link.target.id === node.id) {
                    connectionCount++;
                }
            });
            nodeDegrees.set(node.id, connectionCount);
        });
        
        // Apply any current filters
        let filteredNodes = nodes;
        if (nodeFilters.type) {
            filteredNodes = filteredNodes.filter(n => n.type === nodeFilters.type);
        }
        if (nodeFilters.shelf) {
            filteredNodes = filteredNodes.filter(n => n.shelf === nodeFilters.shelf);
        }
        
        // Sort by degree centrality (highest connection count first)
        return filteredNodes
            .sort((a, b) => {
                const degreeA = nodeDegrees.get(a.id) || 0;
                const degreeB = nodeDegrees.get(b.id) || 0;
                return degreeB - degreeA;
            })
            .slice(0, MAX_VISIBLE_NODES);
    }

    // Update which nodes and links are visible
    function updateVisibleElements() {
        if (selectedNode) {
            // If a node is selected, we already set visible elements
            return;
        }
        
        // Get the most important nodes
        visibleNodes = getImportantNodes();
        
        // Create a set of visible node IDs for quick lookup
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
        
        // Only include links between visible nodes
        visibleLinks = links.filter(link => 
            visibleNodeIds.has(link.source.id) && visibleNodeIds.has(link.target.id)
        ).slice(0, MAX_VISIBLE_LINKS);
        
        // Update simulation to use only visible elements
        simulation.nodes(visibleNodes);
        simulation.force('link').links(visibleLinks);
        
        // Log visible nodes count for debugging
        console.log(`Showing ${visibleNodes.length} nodes and ${visibleLinks.length} links`);
    }

    // Main render function with culling
    function render() {
        // Clear canvas
        context.save();
        context.clearRect(0, 0, width, height);
        context.translate(transform.x, transform.y);
        context.scale(transform.k, transform.k);

        // Get visible area in graph coordinates with margin
        const visible = {
            x1: (-transform.x) / transform.k - 50,
            y1: (-transform.y) / transform.k - 50,
            x2: (width - transform.x) / transform.k + 50,
            y2: (height - transform.y) / transform.k + 50
        };

        // First draw links (under nodes)
        context.strokeStyle = '#999';
        context.lineWidth = 0.5 / transform.k;
        
        // Draw regular links first (dimmed if not highlighted)
        visibleLinks.forEach(link => {
            // Skip if not visible or not in viewport
            if (!isLinkVisible(link, visible)) return;
            
            // Skip highlighted links for now (draw later on top)
            if (link.highlighted) return;
            
            // Calculate opacity based on selection state
            const opacity = selectedNode ? 0.1 : 0.4;
            
            // Draw the link
            context.beginPath();
            context.strokeStyle = `rgba(153, 153, 153, ${opacity})`;
            context.moveTo(link.source.x, link.source.y);
            context.lineTo(link.target.x, link.target.y);
            context.stroke();
        });
        
        // Draw highlighted links on top with stronger appearance
        visibleLinks.forEach(link => {
            if (!isLinkVisible(link, visible) || !link.highlighted) return;
            
            context.beginPath();
            context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            context.lineWidth = 1.5 / transform.k;
            context.moveTo(link.source.x, link.source.y);
            context.lineTo(link.target.x, link.target.y);
            context.stroke();
        });

        // Draw nodes
        visibleNodes.forEach(node => {
            // Skip if node is outside viewport
            if (!isNodeVisible(node, visible)) return;
            
            const nodeSize = getNodeSize(node) / transform.k;
            context.beginPath();
            
            // Adjust color and size based on highlighted status
            let nodeColor = getNodeColor(node);
            
            if (node.dimmed) {
                // Apply translucency to dimmed nodes
                context.fillStyle = toRGBA(nodeColor, 0.3);
                context.arc(node.x, node.y, nodeSize * 0.8, 0, 2 * Math.PI);
            } else if (node.highlighted) {
                // Make highlighted nodes pop
                context.fillStyle = nodeColor;
                context.arc(node.x, node.y, nodeSize * 1.2, 0, 2 * Math.PI);
                // Add a subtle glow/shadow effect
                context.shadowColor = nodeColor;
                context.shadowBlur = 5 / transform.k;
            } else {
                // Normal nodes
                context.fillStyle = nodeColor;
                context.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
            }
            
            context.fill();
            context.shadowBlur = 0;
            
            // Draw selected node highlight
            if (node === selectedNode) {
                context.strokeStyle = '#000';
                context.lineWidth = 2 / transform.k;
                context.stroke();
            }

            // Draw node labels if zoomed in or selected
            if (transform.k > 1.5 || node.highlighted || node === selectedNode) {
                drawNodeLabel(node, nodeSize);
            }
        });

        // Display node count and status info
        if (transform.k < 1.0) {
            displayStatusInfo();
        }

        context.restore();
    }
    
    // Show information about filters and node counts
    function displayStatusInfo() {
        const padding = 10;
        const infoText = `Showing ${visibleNodes.length} of ${nodes.length} nodes`;
        
        context.save();
        context.resetTransform();
        context.fillStyle = 'rgba(255, 255, 255, 0.8)';
        context.fillRect(padding, padding, 250, 30);
        context.fillStyle = '#000';
        context.font = '14px Arial';
        context.fillText(infoText, padding + 10, padding + 20);
        context.restore();
    }
    
    // Helper for drawing node labels
    function drawNodeLabel(node, nodeSize) {
        context.fillStyle = node.dimmed ? 'rgba(0,0,0,0.3)' : '#000';
        context.font = `${node.highlighted ? 12 : 10}px / ${transform.k}px Arial`;
        context.textAlign = 'center';
        
        // Background for label to improve readability
        let displayName = node.name;
        if (displayName.length > 15 && !node.highlighted) {
            displayName = displayName.substring(0, 12) + '...';
        }
        
        const textWidth = context.measureText(displayName).width;
        const labelY = node.y + nodeSize * 1.5;
        
        // Draw text background 
        context.fillStyle = 'rgba(255,255,255,0.7)';
        context.fillRect(
            node.x - textWidth/2 - 2, 
            labelY - 10, 
            textWidth + 4, 
            14
        );
        
        // Draw text
        context.fillStyle = node.dimmed ? 'rgba(0,0,0,0.3)' : '#000';
        context.fillText(displayName, node.x, labelY);
    }
    
    // Helper for checking if a node is visible
    function isNodeVisible(node, viewport) {
        return node.x >= viewport.x1 && 
               node.x <= viewport.x2 && 
               node.y >= viewport.y1 && 
               node.y <= viewport.y2;
    }
    
    // Helper for checking if a link is visible
    function isLinkVisible(link, viewport) {
        // Check if either end of the link is visible, or if link crosses viewport
        return (isNodeVisible(link.source, viewport) || 
                isNodeVisible(link.target, viewport)) &&
               (selectedNode ? link.visible : true);
    }
    
    // Convert color to rgba
    function toRGBA(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Initialize the visualization
    function init(containerId, graphData) {
        console.log('Initializing graph visualization with:', {
            nodes: graphData.nodes.length,
            links: graphData.links.length
        });
        
        // Store data
        data = graphData;
        nodes = graphData.nodes;
        links = graphData.links;
        
        // Remove duplicate links and ensure proper references
        processLinks();
        
        // Calculate initial layout positions
        precomputeInitialLayout();
        
        // Set dimensions based on container
        const container = document.getElementById(containerId);
        width = container.clientWidth;
        height = container.clientHeight;
        
        // Create canvas
        canvas = d3.select(`#${containerId}`)
            .append('canvas')
            .attr('width', width)
            .attr('height', height)
            .style('display', 'block');
        
        context = canvas.node().getContext('2d');
        
        // Setup zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', handleZoom);
        
        canvas.call(zoom);
        
        // Setup mouse events
        canvas
            .on('mousemove', handleMouseMove)
            .on('mousedown', handleMouseDown)
            .on('mouseup', handleMouseUp)
            .on('click', handleClick);
        
        // Select and limit visible nodes to avoid overloading
        updateVisibleElements();
        
        // Optimized force simulation with Anytype-like settings
        simulation = d3.forceSimulation(visibleNodes)
            .force('link', d3.forceLink(visibleLinks)
                .id(d => d.id)
                .distance(d => {
                    if (d.type === 'acted_in') return FORCE_SETTINGS.linkDistance * 0.7;
                    if (d.type === 'directed') return FORCE_SETTINGS.linkDistance * 0.9;
                    return FORCE_SETTINGS.linkDistance;
                })
                .strength(FORCE_SETTINGS.linkStrength))
            .force('charge', d3.forceManyBody()
                .strength(d => {
                    if (d.type === 'movie') return FORCE_SETTINGS.charge * 1.2;
                    if (d.type === 'creator' && d.role === 'director') return FORCE_SETTINGS.charge;
                    return FORCE_SETTINGS.charge * 0.8;
                })
                .distanceMax(150))
            .force('x', d3.forceX().strength(FORCE_SETTINGS.gravity))
            .force('y', d3.forceY().strength(FORCE_SETTINGS.gravity))
            .force('collision', d3.forceCollide()
                .radius(d => getNodeSize(d) * FORCE_SETTINGS.collisionRadius * 0.8)
                .strength(0.9))
            .velocityDecay(FORCE_SETTINGS.friction)
            .alphaDecay(0.02)
            .alpha(0.8)
            .on('tick', render);
            
        // Keep simulation running at low alpha for responsiveness
        simulation.alphaMin(0.005);
        
        // Force stabilization after a set time
        setTimeout(() => {
            // Reduce simulation to minimum activity
            simulation.alpha(0.01);
            
            // After another delay, stop simulation completely
            setTimeout(() => {
                simulation.stop();
                isStabilized = true;
                console.log("Simulation stabilized and stopped");
            }, 3000);
        }, 5000);
        
        // Set initial node positions
        visibleNodes.forEach(node => {
            if (node.initialX && node.initialY) {
                node.x = node.initialX;
                node.y = node.initialY;
            }
        });
        
        // Apply an initial zoom to fit
        setTimeout(() => {
            zoomToFit();
        }, 100);
        
        // Setup window resize handler
        window.addEventListener('resize', resize);
        
        // Setup filter controls if they exist
        setupFilterControls();
        
        // Display loading spinner until first render
        const loading = document.getElementById('loading');
        if (loading) {
            setTimeout(() => {
                loading.style.display = 'none';
            }, 2000);
        }
        
        // Add filter UI
        addFilterUI(container);
    }

    // Add filter UI elements
    function addFilterUI(container) {
        // Create filter controls container
        const filterContainer = document.createElement('div');
        filterContainer.className = 'graph-filters';
        filterContainer.style.cssText = 'position: absolute; top: 10px; left: 10px; background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 100;';
        
        // Add title
        const title = document.createElement('div');
        title.innerText = 'Filter Graph';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '8px';
        filterContainer.appendChild(title);
        
        // Create shelf filter
        const shelfSelect = document.createElement('select');
        shelfSelect.innerHTML = `
            <option value="">All Shelves</option>
            <option value="wishlist">Wishlist</option>
            <option value="progress">In Progress</option>
            <option value="complete">Completed</option>
            <option value="dropped">Dropped</option>
        `;
        shelfSelect.style.marginBottom = '5px';
        shelfSelect.style.width = '100%';
        filterContainer.appendChild(shelfSelect);
        
        // Create type filter
        const typeSelect = document.createElement('select');
        typeSelect.innerHTML = `
            <option value="">All Types</option>
            <option value="movie">Movies Only</option>
            <option value="creator">Creators Only</option>
        `;
        typeSelect.style.marginBottom = '5px';
        typeSelect.style.width = '100%';
        filterContainer.appendChild(typeSelect);
        
        // Add event listeners
        shelfSelect.addEventListener('change', () => {
            nodeFilters.shelf = shelfSelect.value || null;
            updateVisibleElements();
            if (isStabilized) {
                simulation.restart();
                isStabilized = false;
            }
            simulation.alpha(0.3).restart();
        });
        
        typeSelect.addEventListener('change', () => {
            nodeFilters.type = typeSelect.value || null;
            updateVisibleElements();
            if (isStabilized) {
                simulation.restart();
                isStabilized = false;
            }
            simulation.alpha(0.3).restart();
        });
        
        // Append to container
        container.appendChild(filterContainer);
    }

    // Setup existing filter controls if they exist in the DOM
    function setupFilterControls() {
        const shelfFilter = document.getElementById('shelf-filter');
        const typeFilter = document.getElementById('type-filter');
        
        if (shelfFilter) {
            shelfFilter.addEventListener('change', () => {
                nodeFilters.shelf = shelfFilter.value || null;
                updateVisibleElements();
                if (isStabilized) {
                    simulation.restart();
                    isStabilized = false;
                }
                simulation.alpha(0.3).restart();
            });
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                nodeFilters.type = typeFilter.value || null;
                updateVisibleElements();
                if (isStabilized) {
                    simulation.restart();
                    isStabilized = false;
                }
                simulation.alpha(0.3).restart();
            });
        }
    }

    // Process links to remove duplicates and ensure proper references
    function processLinks() {
        // Create a set to track unique links
        const uniqueLinks = new Map();
        
        links.forEach(link => {
            // Create a unique key for each link
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const key = `${sourceId}-${targetId}-${link.type || 'default'}`;
            
            // Only keep the first occurrence
            if (!uniqueLinks.has(key)) {
                uniqueLinks.set(key, link);
            }
        });
        
        // Replace links array with unique links
        links = Array.from(uniqueLinks.values());
        
        // Ensure all links have proper references to nodes
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        
        links = links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            const sourceNode = nodeMap.get(sourceId);
            const targetNode = nodeMap.get(targetId);
            
            // Skip links to non-existent nodes
            if (!sourceNode || !targetNode) return false;
            
            // Update references
            link.source = sourceNode;
            link.target = targetNode;
            return true;
        });
    }

    // Precompute initial layout for better starting positions
    function precomputeInitialLayout() {
        // Separate nodes by type
        const movieNodes = nodes.filter(n => n.type === 'movie');
        const creatorNodes = nodes.filter(n => n.type === 'creator');
        
        // Create a simple grid layout
        const rows = Math.ceil(Math.sqrt(movieNodes.length));
        const spacing = 50;
        
        // Position movie nodes in a grid
        movieNodes.forEach((node, i) => {
            const row = Math.floor(i / rows);
            const col = i % rows;
            node.initialX = col * spacing * 2;
            node.initialY = row * spacing * 2;
        });
        
        // Position creator nodes near connected movies
        creatorNodes.forEach(node => {
            const connectedMovies = getConnectedMovies(node);
            
            if (connectedMovies.length > 0) {
                // Position near the average of connected movies
                const avgX = connectedMovies.reduce((sum, m) => sum + (m.initialX || 0), 0) / connectedMovies.length;
                const avgY = connectedMovies.reduce((sum, m) => sum + (m.initialY || 0), 0) / connectedMovies.length;
                
                node.initialX = avgX + (Math.random() - 0.5) * spacing;
                node.initialY = avgY + (Math.random() - 0.5) * spacing;
            } else {
                // Random position for disconnected creators
                node.initialX = (Math.random() - 0.5) * spacing * rows * 2;
                node.initialY = (Math.random() - 0.5) * spacing * rows * 2;
            }
        });
    }

    // Zoom to fit all nodes
    function zoomToFit() {
        if (!visibleNodes.length) return;
        
        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        visibleNodes.forEach(d => {
            minX = Math.min(minX, d.x);
            minY = Math.min(minY, d.y);
            maxX = Math.max(maxX, d.x);
            maxY = Math.max(maxY, d.y);
        });
        
        // Add padding
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        // Calculate zoom parameters
        const dx = maxX - minX;
        const dy = maxY - minY;
        const scale = 0.9 / Math.max(dx / width, dy / height);
        const translate = [width / 2 - scale * (minX + maxX) / 2, height / 2 - scale * (minY + maxY) / 2];
        
        // Apply zoom transform
        canvas.call(d3.zoom().transform, d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale));
    }

    // Basic zoom operations
    function zoomIn() {
        if (!canvas) return;
        const currentTransform = d3.zoomTransform(canvas.node());
        const newScale = currentTransform.k * 1.3;
        canvas.call(d3.zoom().transform, currentTransform.scale(newScale / currentTransform.k));
    }

    function zoomOut() {
        if (!canvas) return;
        const currentTransform = d3.zoomTransform(canvas.node());
        const newScale = currentTransform.k / 1.3;
        canvas.call(d3.zoom().transform, currentTransform.scale(newScale / currentTransform.k));
    }

    function resetView() {
        if (!canvas) return;
        canvas.call(d3.zoom().transform, d3.zoomIdentity);
        setTimeout(zoomToFit, 100);
    }

    // Filter to specific shelf
    function filterByShelf(shelf) {
        nodeFilters.shelf = shelf;
        updateVisibleElements();
        if (isStabilized) {
            simulation.restart();
            isStabilized = false;
        }
        simulation.alpha(0.3).restart();
        setTimeout(zoomToFit, 100);
    }

    // Filter to specific type
    function filterByType(type) {
        nodeFilters.type = type;
        updateVisibleElements();
        if (isStabilized) {
            simulation.restart();
            isStabilized = false;
        }
        simulation.alpha(0.3).restart();
        setTimeout(zoomToFit, 100);
    }

    // Handle window resizing
    function resize() {
        const container = document.getElementById('graph-container');
        if (!container || !canvas) return;
        
        width = container.clientWidth;
        height = container.clientHeight;
        
        canvas
            .attr('width', width)
            .attr('height', height);
        
        render();
    }

    // Return the public API
    return {
        init,
        resize,
        zoomToFit,
        filterByShelf,
        filterByType,
        zoomIn,
        zoomOut,
        resetView
    };
})();

// Make graphVisualization available globally
window.graphVisualization = graphVisualization;
