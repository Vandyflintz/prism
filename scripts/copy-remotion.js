const fs = require('fs');
const path = require('path');

const source = path.resolve('build');
const destination = path.resolve('resources/remotion-bundle');

console.log(`Copying Remotion bundle...`);
console.log(`Source:      ${source}`);
console.log(`Destination: ${destination}`);

if (!fs.existsSync(source)) {
    console.error(`Source directory does not exist: ${source}`);
    process.exit(1);
}

fs.rmSync(destination, {
    recursive: true,
    force: true,
});

fs.mkdirSync(destination, {
    recursive: true,
});

fs.cpSync(source, destination, {
    recursive: true,
});

console.log('Remotion bundle copied successfully.');