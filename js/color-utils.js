// Color palette inspired by Katsushika Hokusai's paintings
const PALETTE = {
    // Base colors
    sumiInk3: '#363646',  // Default grey for inactive nodes
    fujiGray: '#727169',  // Default link color

    // Vibrant colors for creators
    creatorColors: [
        '#76946A',  // autumnGreen
        '#C34043',  // autumnRed
        '#DCA561',  // autumnYellow
        '#E82424',  // samuraiRed
        '#FF9E3B',  // roninYellow
        '#6A9589',  // waveAqua1
        '#658594',  // dragonBlue
        '#938AA9',  // springViolet1
        '#7E9CD8',  // crystalBlue
        '#7FB4CA',  // springBlue
        '#98BB6C',  // springGreen
        '#D27E99',  // sakuraPink
        '#E46876',  // waveRed
        '#FF5D62',  // peachRed
        '#FFA066'   // surimiOrange
    ]
};

// Store creator colors to ensure consistency
const creatorColorMap = new Map();
let nextColorIndex = 0;

// Convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Convert RGB to hex
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Find the closest color in our palette to a given RGB color
function findClosestPaletteColor(r, g, b) {
    let minDistance = Infinity;
    let closestColor = PALETTE.creatorColors[0];
    
    for (const color of PALETTE.creatorColors) {
        const rgb = hexToRgb(color);
        const distance = Math.sqrt(
            Math.pow(r - rgb.r, 2) +
            Math.pow(g - rgb.g, 2) +
            Math.pow(b - rgb.b, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    }
    
    return closestColor;
}

// Blend colors using a weighted average and map to nearest palette color
function blendColors(colors) {
    if (!colors.length) return PALETTE.sumiInk3;
    if (colors.length === 1) return colors[0];
    
    // Convert all colors to RGB and calculate weighted average
    const rgbColors = colors.map(hexToRgb);
    const blended = rgbColors.reduce((acc, color) => ({
        r: acc.r + color.r / colors.length,
        g: acc.g + color.g / colors.length,
        b: acc.b + color.b / colors.length
    }), { r: 0, g: 0, b: 0 });
    
    // Find the closest color in our palette
    return findClosestPaletteColor(blended.r, blended.g, blended.b);
}

// Get or assign color for a creator
function getCreatorColor(creatorId, hasCompletedMovie) {
    if (!hasCompletedMovie) return PALETTE.sumiInk3;
    
    if (!creatorColorMap.has(creatorId)) {
        const color = PALETTE.creatorColors[nextColorIndex % PALETTE.creatorColors.length];
        creatorColorMap.set(creatorId, color);
        nextColorIndex++;
    }
    
    return creatorColorMap.get(creatorId);
}

// Calculate movie color based on its creators
function calculateMovieColor(movieNode, nodes, links) {
    if (movieNode.shelf !== 'complete') return PALETTE.sumiInk3;
    
    // Find all creators connected to this movie
    const creatorColors = links
        .filter(link => 
            (link.source === movieNode.id || link.target === movieNode.id) &&
            (typeof link.source === 'string' ? link.source : link.source.id) !== movieNode.id
        )
        .map(link => {
            const creatorId = typeof link.source === 'string' 
                ? (link.source === movieNode.id ? link.target : link.source)
                : (link.source.id === movieNode.id ? link.target.id : link.source.id);
            const creator = nodes.find(n => n.id === creatorId);
            return creator ? getCreatorColor(creator.id, true) : null;
        })
        .filter(color => color && color !== PALETTE.sumiInk3);
    
    return blendColors(creatorColors);
}

// Export the color utilities
const colorUtils = {
    PALETTE,
    getCreatorColor,
    calculateMovieColor
};

// Make it available globally
window.colorUtils = colorUtils; 