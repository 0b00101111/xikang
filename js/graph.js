// Movie-only graph visualization using D3.js with Canvas for better performance
const graphVisualization = (function() {
    // Private variables
    let canvas, context, simulation;
    let width, height, data;
    let nodes = [], links = [];
    let selectedNode = null;
    let transform = d3.zoomIdentity;
    let isDragging = false;
    let draggedNode = null;

    // Color scheme
    const movieColor = '#E07A5F';
    const directorColor = '#FB8500';
    const actorColor = '#FF006E';

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
        return 3;
    }

    // Convert screen coordinates to graph coordinates
    function screenToGraph(point) {
        const transformed = transform.invert([point[0], point[1]]);
        return transformed;
    }

    // Find node at coordinates
    function findNodeAtCoordinates(x, y) {
        const pos = screenToGraph([x, y]);
        const radius = 5 / transform.k; // Adjust for zoom
        
        return simulation.nodes().find(node => {
            const dx = node.x - pos[0];
            const dy = node.y - pos[1];
            return dx * dx + dy * dy < radius * radius;
        });
    }

    // Handle zoom events
    function handleZoom(event) {
        transform = event.transform;
        render();
    }

    // Mouse event handlers
    function handleMouseMove(event) {
        const [x, y] = d3.pointer(event);
        
        if (isDragging && draggedNode) {
            const pos = screenToGraph([x, y]);
            draggedNode.fx = pos[0];
            draggedNode.fy = pos[1];
            simulation.alpha(0.3).restart();
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
            simulation.alphaTarget(0.3).restart();
        }
    }

    function handleMouseUp() {
        isDragging = false;
        if (draggedNode) {
            draggedNode.fx = null;
            draggedNode.fy = null;
            draggedNode = null;
            simulation.alphaTarget(0);
        }
    }

    function handleClick(event) {
        const [x, y] = d3.pointer(event);
        const node = findNodeAtCoordinates(x, y);
        
        if (node) {
            selectedNode = selectedNode === node ? null : node;
            render();
        } else {
            selectedNode = null;
            render();
        }
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
        }
        
        tooltip.html(tooltipContent)
            .style('visibility', 'visible')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }

    // Hide tooltip
    function hideTooltip() {
        d3.select('.node-tooltip').style('visibility', 'hidden');
    }

    // Main render function with culling
    function render() {
        // Clear canvas
        context.save();
        context.clearRect(0, 0, width, height);
        context.translate(transform.x, transform.y);
        context.scale(transform.k, transform.k);

        // Get visible area in graph coordinates
        const visible = {
            x1: (-transform.x) / transform.k,
            y1: (-transform.y) / transform.k,
            x2: (width - transform.x) / transform.k,
            y2: (height - transform.y) / transform.k,
            margin: 50 // Add margin for smoother panning
        };

        // Draw links
        context.strokeStyle = '#999';
        context.lineWidth = 0.5 / transform.k;
        context.beginPath();
        
        // Only draw visible links
        links.forEach(link => {
            if ((link.source.x >= visible.x1 - visible.margin && 
                 link.source.x <= visible.x2 + visible.margin &&
                 link.source.y >= visible.y1 - visible.margin && 
                 link.source.y <= visible.y2 + visible.margin) ||
                (link.target.x >= visible.x1 - visible.margin && 
                 link.target.x <= visible.x2 + visible.margin &&
                 link.target.y >= visible.y1 - visible.margin && 
                 link.target.y <= visible.y2 + visible.margin)) {
                context.moveTo(link.source.x, link.source.y);
                context.lineTo(link.target.x, link.target.y);
            }
        });
        context.stroke();

        // Draw nodes
        nodes.forEach(node => {
            // Only draw if node is visible
            if (node.x >= visible.x1 - visible.margin && 
                node.x <= visible.x2 + visible.margin &&
                node.y >= visible.y1 - visible.margin && 
                node.y <= visible.y2 + visible.margin) {
                
                context.beginPath();
                context.fillStyle = getNodeColor(node);
                const nodeSize = getNodeSize(node);
                context.arc(node.x, node.y, nodeSize / transform.k, 0, 2 * Math.PI);
                context.fill();

                // Draw selected node highlight
                if (node === selectedNode) {
                    context.strokeStyle = '#000';
                    context.lineWidth = 2 / transform.k;
                    context.stroke();
                }

                // Draw node labels if zoomed in enough
                if (transform.k > 0.5) {
                    context.fillStyle = '#000';
                    context.font = `${10 / transform.k}px Arial`;
                    context.textAlign = 'center';
                    context.fillText(node.name, node.x, node.y + (15 / transform.k));
                }
            }
        });

        context.restore();
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
        
        // Optimized force simulation
        simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id(d => d.id)
                .distance(d => d.type === 'acted_in' ? 20 : 30)
                .strength(0.3))
            .force('charge', d3.forceManyBody()
                .strength(d => d.type === 'movie' ? -30 : -10)
                .distanceMax(150))
            .force('collision', d3.forceCollide()
                .radius(d => getNodeSize(d) * 1.5)
                .strength(0.5))
            .velocityDecay(0.7)
            .alphaDecay(0.1)
            .alpha(0.5)
            .on('tick', render);
        
        // Stop simulation after 3 seconds
        setTimeout(() => {
            simulation.stop();
            console.log('Simulation stopped');
        }, 3000);
    }

    // Handle window resizing
    function resize() {
        const container = document.getElementById('graph-container');
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
        resize
    };
})();

// Make graphVisualization available globally
window.graphVisualization = graphVisualization;
