const fs = require('fs');
const path = require('path');

const src = "C:\\Users\\DHANUNJAY\\.gemini\\antigravity\\brain\\c281933b-441c-455c-a043-3c5e23d3bfd3\\farmer_mascot_1775877483051.png";
const dest = path.join(__dirname, 'farmer-mascot.png');
const assetDest = path.join(__dirname, 'app', 'src', 'main', 'assets', 'farmer-mascot.png');

try {
    fs.copyFileSync(src, dest);
    console.log('Copied to root:', dest);
    
    // Ensure asset dir exists
    const assetDir = path.dirname(assetDest);
    if (fs.existsSync(assetDir)) {
        fs.copyFileSync(src, assetDest);
        console.log('Copied to assets:', assetDest);
    } else {
        console.log('Asset directory not found, skipping asset copy.');
    }
} catch (err) {
    console.error('Error copying file:', err);
    process.exit(1);
}
