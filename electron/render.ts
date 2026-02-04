import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import path from "path";
import os from "os";

import http from 'http';
import fs from 'fs';

export const renderComposition = async (
    data: any,
    onProgress: (progress: number) => void
): Promise<string> => {
    console.log("Starting render process...");

    // 1. Bundle the project
    const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");
    console.log("Bundling...", entryPoint);
    const bundleLocation = await bundle({
        entryPoint,
    });

    // --- START LOCAL ASSET SERVER ---
    // Access local assets via HTTP to avoid file:// restrictions in Chrome
    const tempDir = path.join(os.tmpdir(), 'prism-export-assets');
    const port = 0; // Random available port

    const server = http.createServer((req, res) => {
        // Simple static file server for temp assets
        if (!req.url) {
            res.statusCode = 404;
            res.end();
            return;
        }

        // Remove leading slash to get filename
        const filename = req.url.slice(1);
        const filePath = path.join(tempDir, filename);

        // Basic security check (prevent directory traversal)
        if (!filePath.startsWith(tempDir)) {
            res.statusCode = 403;
            res.end();
            return;
        }

        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            const fileSize = stat.size;

            // Determine MIME type
            const ext = path.extname(filePath).toLowerCase();
            let mimeType = 'application/octet-stream';
            if (ext === '.mp4') mimeType = 'video/mp4';
            else if (ext === '.mp3') mimeType = 'audio/mpeg';
            else if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';

            const range = req.headers.range;

            if (range) {
                // Handle Range Request
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(filePath, { start, end });

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mimeType,
                    'Access-Control-Allow-Origin': '*'
                });
                file.pipe(res);
            } else {
                // Handle Full Request
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': mimeType,
                    'Access-Control-Allow-Origin': '*'
                });
                fs.createReadStream(filePath).pipe(res);
            }
        } else {
            res.statusCode = 404;
            res.end('Not Found');
        }
    });

    // Start listening
    await new Promise<void>((resolve) => {
        server.listen(port, '127.0.0.1', () => resolve());
    });

    // Get assigned port
    const address = server.address();
    const assignedPort = typeof address === 'object' && address ? address.port : 0;
    const serverUrl = `http://127.0.0.1:${assignedPort}`;
    console.log(`[Render] Asset server running at ${serverUrl}`);

    // --- REWRITE ASSET URLS ---
    const modifiedData = JSON.parse(JSON.stringify(data)); // Deep clone
    if (modifiedData.assets) {
        for (const key in modifiedData.assets) {
            const asset = modifiedData.assets[key];
            if (asset.src && asset.src.startsWith('file://')) {
                // Extract filename
                // file:///var/folders/.../prism-export-assets/img.png
                // We assume the file is in our temp dir.
                const filename = path.basename(asset.src);
                asset.src = `${serverUrl}/${filename}`;
                console.log(`[Render] Rewrote ${key} to ${asset.src}`);
            }
        }
    }

    try {
        // 2. Resolve Composition
        const compositions = await getCompositions(bundleLocation, {
            inputProps: modifiedData,
        });

        const composition = compositions.find((c) => c.id === "PrismComposition");
        if (!composition) {
            throw new Error("Composition 'PrismComposition' not found in bundle.");
        }

        // 3. Render
        const outputLocation = path.join(os.homedir(), "Desktop", `PrismExport-${Date.now()}.mp4`);
        console.log("Rendering to:", outputLocation);

        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: "h264",
            outputLocation,
            inputProps: modifiedData,
            onProgress: ({ progress }) => {
                onProgress(progress);
            },
            chromiumOptions: {
                gl: 'swangle',
                headless: true,
                disableWebSecurity: true,
            }
        });

        return outputLocation;

    } finally {
        // Cleanup: Stop server
        server.close();
    }
};
