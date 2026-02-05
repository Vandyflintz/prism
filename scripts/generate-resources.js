const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_ICON = path.join(__dirname, '../prism.png');
const RESOURCES_DIR = path.join(__dirname, '../resources');
const ICONSET_DIR = path.join(RESOURCES_DIR, 'icon.iconset');

const SIZES = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' },
];

function runCommand(command) {
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        process.exit(1);
    }
}

function createIco(pngPath, outputPath) {
    console.log('Creating .ico file...');
    const png = fs.readFileSync(pngPath);
    
    // ICO Header
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type 1 = ICO
    header.writeUInt16LE(1, 4); // Count 1
    
    // ICO Entry
    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0); // Width (0 = 256)
    entry.writeUInt8(0, 1); // Height (0 = 256)
    entry.writeUInt8(0, 2); // Colors
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Planes
    entry.writeUInt16LE(32, 6); // BPP
    entry.writeUInt32LE(png.length, 8); // Size
    entry.writeUInt32LE(22, 12); // Offset (6 + 16)
    
    const ico = Buffer.concat([header, entry, png]);
    fs.writeFileSync(outputPath, ico);
    console.log(`Generated: ${outputPath}`);
}

async function main() {
    // 1. Verify source
    if (!fs.existsSync(SOURCE_ICON)) {
        console.error(`Source icon not found at: ${SOURCE_ICON}`);
        console.error('Please ensure "prism.png" is in the project root.');
        process.exit(1);
    }

    // 2. Prepare directories
    if (fs.existsSync(RESOURCES_DIR)) {
        fs.rmSync(RESOURCES_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(RESOURCES_DIR);
    fs.mkdirSync(ICONSET_DIR);

    console.log('Generating iconset images...');
    
    // 3. Generate PNGs for Iconset
    for (const { size, name } of SIZES) {
        const dest = path.join(ICONSET_DIR, name);
        runCommand(`sips -z ${size} ${size} "${SOURCE_ICON}" --out "${dest}"`);
    }

    // 4. Generate .icns
    console.log('Generating .icns file...');
    runCommand(`iconutil -c icns "${ICONSET_DIR}" -o "${path.join(RESOURCES_DIR, 'icon.icns')}"`);

    // 5. Generate .png (Linux) - Use 512x512
    console.log('Generating Linux .png...');
    fs.copyFileSync(
        path.join(ICONSET_DIR, 'icon_512x512.png'),
        path.join(RESOURCES_DIR, 'icon.png')
    );

    // 6. Generate .ico (Windows)
    // We'll use the 256x256 version for the ICO as 1024 or 512 is often too large for simple ICO headers
    const icoSource = path.join(ICONSET_DIR, 'icon_256x256.png');
    createIco(icoSource, path.join(RESOURCES_DIR, 'icon.ico'));

    // 7. Cleanup
    fs.rmSync(ICONSET_DIR, { recursive: true, force: true });
    
    console.log('\n✅ Resources generated successfully!');
    console.log('📁 resources/icon.icns');
    console.log('📁 resources/icon.ico');
    console.log('📁 resources/icon.png');
}

main();
