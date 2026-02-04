"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderComposition = void 0;
const bundler_1 = require("@remotion/bundler");
const renderer_1 = require("@remotion/renderer");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const renderComposition = async (data, onProgress) => {
    console.log("Starting render process...");
    // 1. Bundle the project
    // We point to the Remotion Root entry point (src/remotion/index.ts)
    const entryPoint = path_1.default.join(process.cwd(), "src", "remotion", "index.ts");
    console.log("Bundling...", entryPoint);
    const bundleLocation = await (0, bundler_1.bundle)({
        entryPoint,
        // Webpack override if needed for Electron context? 
        // Usually bundled automatically works if standard deps are used.
    });
    // 2. Resolve Composition
    const compositions = await (0, renderer_1.getCompositions)(bundleLocation, {
        inputProps: data, // Pass project data here
    });
    const composition = compositions.find((c) => c.id === "PrismComposition");
    if (!composition) {
        throw new Error("Composition 'PrismComposition' not found in bundle.");
    }
    // 3. Render
    const outputLocation = path_1.default.join(os_1.default.homedir(), "Desktop", `PrismExport-${Date.now()}.mp4`);
    console.log("Rendering to:", outputLocation);
    await (0, renderer_1.renderMedia)({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation,
        inputProps: data,
        onProgress: ({ progress }) => {
            onProgress(progress);
        },
    });
    return outputLocation;
};
exports.renderComposition = renderComposition;
