import { readPsd, Layer } from 'ag-psd';
import { PrismProject, PrismTrack, PrismAsset, TrackType } from '../types/prism';

// Helper to generate IDs
const generateId = () => crypto.randomUUID();

/**
 * Parses a PSD buffer and converts it into a PrismProject schema.
 */
export async function parsePsd(buffer: ArrayBuffer | Uint8Array): Promise<PrismProject> {
    const psd = readPsd(buffer, {
        skipLayerImageData: false,
        skipThumbnail: true,
    });

    const projectId = generateId();
    const project: PrismProject = {
        id: projectId,
        width: psd.width,
        height: psd.height,
        fps: 30,
        durationInFrames: 300,
        assets: {},
        tracks: [],
    };

    const layers = flattenLayers(psd.children || []);
    // layers.reverse(); // User reported inverted order, so removing this fix.

    let staggerFrame = 0;
    const STAGGER_STEP = 5;

    for (const layer of layers) {
        if (layer.hidden) continue;

        // Calculate dimensions from bounds
        // ag-psd Layer has left, top, right, bottom (numbers)
        const width = (layer.right || 0) - (layer.left || 0);
        const height = (layer.bottom || 0) - (layer.top || 0);

        const trackId = generateId();
        const track: PrismTrack = {
            id: trackId,
            type: determineLayerType(layer),
            startFrame: staggerFrame,
            durationInFrames: project.durationInFrames - staggerFrame,
            props: {
                x: layer.left || 0,
                y: layer.top || 0,
                width: width,
                height: height,
                opacity: (layer.opacity != null) ? (layer.opacity > 1 ? layer.opacity / 255 : layer.opacity) : 1,
                rotation: 0,
                scale: 1,
            }
        };

        staggerFrame += STAGGER_STEP;

        // Debug Opacity
        // console.log(`Layer: ${layer.name}, Opacity Raw: ${layer.opacity}`);

        if (layers.indexOf(layer) < 3) {
            console.log(`Debug Layer [${layer.name}] Keys:`, Object.keys(layer));
            // @ts-ignore
            if (layer.clipping) console.log(`Layer [${layer.name}] has CLIPPING`);
            // @ts-ignore
            if (layer.mask) {
                console.log(`Layer [${layer.name}] has MASK`, Object.keys(layer.mask));
                // @ts-ignore
                if (layer.mask.canvas) console.log(`Layer [${layer.name}] MASK has canvas!`);
            }
        }

        if (track.type === 'text' && layer.text) {
            track.props.content = layer.text.text;
        } else if (track.type === 'image') {
            const assetId = generateId();

            let imgSrc = `https://placehold.co/${width}x${height}`; // Fallback

            let layerCanvas = layer.canvas;

            // Apply Mask if present
            // @ts-ignore
            if (layer.mask && layer.mask.canvas) {
                try {
                    // 1. Setup Composite Canvas (Target size = Layer size)
                    // @ts-ignore
                    const width = layerCanvas.width;
                    // @ts-ignore
                    const height = layerCanvas.height;
                    const compositeCanvas = document.createElement('canvas');
                    compositeCanvas.width = width;
                    compositeCanvas.height = height;
                    const ctx = compositeCanvas.getContext('2d');

                    if (ctx) {
                        // 2. Prepare the Mask (Convert Grayscale to Alpha)
                        // @ts-ignore
                        const maskSource = layer.mask.canvas;
                        const maskCanvas = document.createElement('canvas');
                        maskCanvas.width = maskSource.width;
                        maskCanvas.height = maskSource.height;
                        const maskCtx = maskCanvas.getContext('2d');
                        if (maskCtx) {
                            maskCtx.drawImage(maskSource, 0, 0);
                            const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
                            const data = maskData.data;
                            // Convert Luminance (Red channel) to Alpha
                            // Assumes Mask is White (Display) on Black (Hide) or Grayscale
                            for (let i = 0; i < data.length; i += 4) {
                                data[i + 3] = data[i]; // Alpha = Red
                            }
                            maskCtx.putImageData(maskData, 0, 0);

                            // 3. Draw Layer & Apply Mask
                            // @ts-ignore
                            ctx.drawImage(layerCanvas, 0, 0);

                            // Calculate specific offsets
                            // @ts-ignore
                            const maskLeft = layer.mask.left || 0;
                            // @ts-ignore
                            const maskTop = layer.mask.top || 0;
                            // @ts-ignore
                            const layerLeft = layer.left || 0;
                            // @ts-ignore
                            const layerTop = layer.top || 0;

                            const dx = maskLeft - layerLeft;
                            const dy = maskTop - layerTop;

                            ctx.globalCompositeOperation = 'destination-in';
                            ctx.drawImage(maskCanvas, dx, dy);

                            // Update reference to valid composite
                            // @ts-ignore
                            layerCanvas = compositeCanvas;
                            console.log(`Layer [${layer.name}] Mask Applied.`);
                        }
                    }
                } catch (maskErr) {
                    console.error(`Failed to apply mask for layer ${layer.name}`, maskErr);
                }
            }

            if (layerCanvas) {
                try {
                    console.log(`Processing layer: ${layer.name}`);
                    // @ts-ignore
                    console.log(`Canvas dimensions: ${layerCanvas.width}x${layerCanvas.height}`);
                    console.log(`Bounds: ${width}x${height} (x:${track.props.x}, y:${track.props.y})`);

                    // @ts-ignore
                    const blob = await new Promise<Blob | null>(resolve => layerCanvas.toBlob(resolve, 'image/webp'));

                    if (blob) {
                        console.log(`Blob created: size=${blob.size}, type=${blob.type}`);
                        imgSrc = URL.createObjectURL(blob);
                        console.log(`Blob URL: ${imgSrc}`);
                    } else {
                        console.error('Blob is null');
                    }
                } catch (e) {
                    console.error('Failed to create blob from layer canvas', e);
                }
            } else {
                console.warn(`Layer ${layer.name} has no canvas`);
            }

            const asset: PrismAsset = {
                id: assetId,
                type: 'image',
                src: imgSrc,
            };

            project.assets[assetId] = asset;
            track.props.assetId = assetId;
        }

        project.tracks.push(track);
    }

    return project;
}

function flattenLayers(layers: Layer[]): Layer[] {
    let result: Layer[] = [];
    for (const layer of layers) {
        if (layer.children && layer.children.length > 0) {
            result = result.concat(flattenLayers(layer.children));
        } else {
            result.push(layer);
        }
    }
    return result;
}

function determineLayerType(layer: Layer): TrackType {
    if (layer.text) return 'text';
    return 'image';
}
