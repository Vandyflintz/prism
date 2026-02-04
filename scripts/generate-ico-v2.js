const fs = require('fs');
const path = require('path');

async function createIco() {
    const pngPath = 'resources/icon.iconset/icon_256x256.png';
    if (!fs.existsSync(pngPath)) {
        console.error('Source PNG not found:', pngPath);
        process.exit(1);
    }

    const png = fs.readFileSync(pngPath);

    const width = 0; // 256 -> 0
    const height = 0; // 256 -> 0
    const colors = 0;
    const reserved = 0;
    const planes = 1;
    const bpp = 32;
    const size = png.length;
    const offset = 6 + 16;

    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type 1 = ICO
    header.writeUInt16LE(1, 4); // Count 1

    const entry = Buffer.alloc(16);
    entry.writeUInt8(width, 0);
    entry.writeUInt8(height, 1);
    entry.writeUInt8(colors, 2);
    entry.writeUInt8(reserved, 3);
    entry.writeUInt16LE(planes, 4);
    entry.writeUInt16LE(bpp, 6);
    entry.writeUInt32LE(size, 8);
    entry.writeUInt32LE(offset, 12);

    const ico = Buffer.concat([header, entry, png]);
    fs.writeFileSync('resources/icon.ico', ico);

    console.log('Created resources/icon.ico');
}

createIco();
