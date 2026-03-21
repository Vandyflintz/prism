import { app } from 'electron';
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

    // FIX: Remotion tries to write to ~/.remotion, which might fail or resolve to / in some contexts.
    // We explicitly set the cache directory to a writable user data path.
    const cacheDir = path.join(app.getPath('userData'), 'remotion-cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    console.log(`[Render] Set REMOTION_CACHE_DIR to ${cacheDir}`);

    let binariesDirectory: string | undefined;

    if (app.isPackaged) {
        // FIX: Ensure binaries in app.asar.unpacked are executable.
        // Remotion tries to chmod the files via the ASAR path, which fails.
        // We chmod the actual unpacked files first.
        try {
            const unpackedNodeModules = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules');
            const platform = process.platform;
            const arch = process.arch;
            let compositorPackage = '';

            if (platform === 'darwin' && arch === 'arm64') compositorPackage = '@remotion/compositor-darwin-arm64';
            else if (platform === 'darwin' && arch === 'x64') compositorPackage = '@remotion/compositor-darwin-x64';
            else if (platform === 'linux' && arch === 'x64') compositorPackage = '@remotion/compositor-linux-x64';
            else if (platform === 'win32' && arch === 'x64') compositorPackage = '@remotion/compositor-win32-x64';

            if (compositorPackage) {
                const base = path.join(unpackedNodeModules, compositorPackage);
                binariesDirectory = base;
                console.log(`[Render] Looking for binaries in: ${base}`);

                const remotionBin = path.join(base, 'remotion');
                const ffmpegBin = path.join(base, 'ffmpeg');
                const ffprobeBin = path.join(base, 'ffprobe');

                if (fs.existsSync(remotionBin)) {
                    fs.chmodSync(remotionBin, 0o755);
                    process.env.REMOTION_COMPOSITOR_BIN = remotionBin;
                    console.log(`[Render] Set REMOTION_COMPOSITOR_BIN to ${remotionBin}`);
                } else {
                    console.error(`[Render] Binary not found: ${remotionBin}`);
                }

                if (fs.existsSync(ffmpegBin)) {
                    fs.chmodSync(ffmpegBin, 0o755);
                    // Remotion might pick this up or we might need another way, 
                    // but setting execution permission is Step 1.
                    // Some ffmpeg wrappers check FFMPEG_PATH.
                }

                if (fs.existsSync(ffprobeBin)) {
                    fs.chmodSync(ffprobeBin, 0o755);
                }
            }
        } catch (e) {
            console.error('[Render] Failed to chmod binaries:', e);
        }
    }

    // 1. Bundle the project
    // 1. Bundle the project
    let bundleLocation: string;

    if (app.isPackaged) {
        bundleLocation = path.join(process.resourcesPath, 'remotion-bundle');
        console.log("Using pre-bundled Remotion assets:", bundleLocation);
    } else {
        const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");
        console.log("Bundling...", entryPoint);
        bundleLocation = await bundle({
            entryPoint,
        });
    }

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
            ...(binariesDirectory ? { binariesDirectory } : {})
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
            ...(binariesDirectory ? { binariesDirectory } : {}),
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

        // Clean up temp files
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
                console.log(`[Render] Cleaned up temp directory: ${tempDir}`);
            }
        } catch (e) {
            console.error(`[Render] Failed to clean up temp directory:`, e);
        }
    }
};
