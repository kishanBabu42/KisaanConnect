const fs = require('fs');
const src = "C:\\Users\\DHANUNJAY\\.gemini\\antigravity\\brain\\c281933b-441c-455c-a043-3c5e23d3bfd3\\farmer_mascot_1775877483051.png";

try {
    const data = fs.readFileSync(src);
    const base64 = data.toString('base64');
    console.log('DATA_START');
    console.log(base64);
    console.log('DATA_END');
} catch (err) {
    console.error(err);
}
