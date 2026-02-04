import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import path from "path";
import os from "os";

export const renderComposition = async (
    data: any,
    onProgress: (progress: number) => void
): Promise<string> => {
    console.log("Starting render process...");

    // 1. Bundle the project
    // We point to the Remotion Root entry point (src/remotion/index.ts)
    const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");

    console.log("Bundling...", entryPoint);
    const bundleLocation = await bundle({
        entryPoint,
        // Webpack override if needed for Electron context? 
        // Usually bundled automatically works if standard deps are used.
    });

    // 2. Resolve Composition
    const compositions = await getCompositions(bundleLocation, {
        inputProps: data, // Pass project data here
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
        inputProps: data,
        onProgress: ({ progress }) => {
            onProgress(progress);
        },
    });

    return outputLocation;
};
