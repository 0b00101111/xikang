// Minimal graph visualization using D3.js
// This file implements a clean graph visualization with no extra UI elements

const graphVisualization = (function() {
    // Private variables
    let svg, g, simulation, link, node, nodeLabels;
    let width, height, data;
    let nodes = [], links = [];
    let selectedNode = null;
    let zoom;

    // Simple color scheme
    const nodeColors = {
        user: '#555',
        tag: '#86C3D7',
        shelf: '#FFD166',
        book: '#5D7CA6',
        movie: '#E07A5F',
        tv: '#8D6A9F',
        music: '#D62828',
        podcast: '#5FA8D3',
        game: '#8EA604',
        Edition: '#5D7CA6',  // Same as book
        album: '#D62828',    // Same as music
        media: '#5D7CA6'     // Default media color
    };

    // Get node color based on type
    function getNodeColor(d) {
        if (d.type === 'media' && d.category) {
            return nodeColors[d.category] || nodeColors.media;
        }
        return nodeColors[d.type] || '#999';
    }

    // Get fixed node size
    function getNodeSize(d) {
        if (d.type === 'user') return 6; 
        if (d.type === 'tag' || d.type === 'shelf') return 5;
        return 4; // Media items
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
        
        // Create links
        link = g.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#e0e0e0')
            .attr('stroke-opacity', 0.5)
            .attr('stroke-width', 1);
        
        // Create nodes
        node = g.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('r', getNodeSize)
            .attr('fill', getNodeColor)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Create labels for all nodes, not just category nodes
nodeLabels = g.append('g')
    .selectAll('text')
    .data(nodes)  // Use all nodes instead of filtering
    .enter().append('text')
    .attr('dx', 6)
    .attr('dy', 3)
    .text(d => d.name)
    .attr('font-family', 'sans-serif')
    .attr('font-size', d => {
        if (d.type === 'user' || d.type === 'category') return '10px';
        return '8px';  // Smaller font for media items
    })
    .attr('fill', '#555')
    .style('pointer-events', 'none')
    .style('user-select', 'none')
    // Show labels based on node type
    .style('opacity', d => {
        if (d.type === 'user' || d.type === 'category') return 0.9;
        return 0.7;  // Slightly less visible for media items
    });
        
        // Create force simulation with more space
        simulation = d3.forceSimulation(nodes)
            // Links with variable distances
            .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
                const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
                const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
                
                if (source.type === 'user' || target.type === 'user') {
                    return 150; // Links to user are longer
                } else if (source.type === 'tag' || target.type === 'tag' ||
                           source.type === 'shelf' || target.type === 'shelf') {
                    return 100; // Links to organizational nodes medium
                }
                return 30; // Default is shorter
            }))
            // Strong repulsive force
            .force('charge', d3.forceManyBody().strength(d => {
                if (d.type === 'user') return -1000;
                if (d.type === 'tag' || d.type === 'shelf') return -300;
                return -100;
            }))
            // Very weak center gravity
            .force('x', d3.forceX().strength(0.01))
            .force('y', d3.forceY().strength(0.01))
            // Collision prevention
            .force('collision', d3.forceCollide().radius(d => getNodeSize(d) * 2));
        
        // Add hover behavior for highlighting
        node.on('mouseover', function(event, d) {
            // Highlight connected links
            link.style('stroke', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? '#666' : '#e0e0e0';
            })
            .style('stroke-opacity', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? 0.9 : 0.1;
            })
            .style('stroke-width', l => {
                const source = typeof l.source === 'object' ? l.source : nodes.find(n => n.id === l.source);
                const target = typeof l.target === 'object' ? l.target : nodes.find(n => n.id === l.target);
                return (source.id === d.id || target.id === d.id) ? 1.5 : 0.5;
            });
            
            // Highlight connected nodes
            node.style('opacity', n => {
                const isConnected = links.some(l => {
                    const source = typeof l.source === 'object' ? l.source : nodes.find(node => node.id === l.source);
                    const target = typeof l.target === 'object' ? l.target : nodes.find(node => node.id === l.target);
                    return (source.id === d.id && target.id === n.id) || (target.id === d.id && source.id === n.id);
                });
                
                return n.id === d.id || isConnected ? 1 : 0.2;
            });
            
            // Highlight relevant labels
            nodeLabels.style('opacity', n => {
                const isConnected = links.some(l => {
                    const source = typeof l.source === 'object' ? l.source : nodes.find(node => node.id === l.source);
                    const target = typeof l.target === 'object' ? l.target : nodes.find(node => node.id === l.target);
                    return (source.id === d.id && target.id === n.id) || (target.id === d.id && source.id === n.id);
                });
                
                return n.id === d.id || isConnected ? 1 : 0.2;
            });
        })
        .on('mouseout', function() {
            // Reset all styles
            link.style('stroke', '#e0e0e0')
                .style('stroke-opacity', 0.5)
                .style('stroke-width', 1);
            
            node.style('opacity', 1);
            nodeLabels.style('opacity', 0.8);
        });
        
        // Update positions on simulation tick
        simulation.on('tick', () => {
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
        
        // Initial centering zoom
        svg.call(zoom.transform, d3.zoomIdentity.scale(0.7));
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
        // Keep user node fixed if dragged
        if (d.type !== 'user') {
            d.fx = null;
            d.fy = null;
        }
    }

    // Zooming controls
    function zoomIn() {
        svg.transition().duration(300).call(zoom.scaleBy, 1.5);
    }

    function zoomOut() {
        svg.transition().duration(300).call(zoom.scaleBy, 0.67);
    }

    function resetView() {
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.scale(0.7));
    }

    // Window resize handler
    function resize() {
        const container = document.getElementById('graph-container');
        width = container.clientWidth;
        height = container.clientHeight;
        
        svg.attr('viewBox', [-width/2, -height/2, width, height]);
        
        // Restart simulation gently
        simulation.alpha(0.1).restart();
    }

    // Public API - only expose necessary methods
    return {
        init: init,
        zoomIn: zoomIn,
        zoomOut: zoomOut,
        resetView: resetView,
        resize: resize
    };
})();
