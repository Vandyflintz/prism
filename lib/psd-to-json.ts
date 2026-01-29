import { readPsd, Layer } from 'ag-psd';
import { PrismProject, PrismTrack, PrismAsset, TrackType } from '../types/prism';

// Helper to generate IDs
const generateId = () => crypto.randomUUID();

/**
 * Parses a PSD buffer and converts it into a PrismProject schema.
 */
export async function parsePsd(buffer: Buffer): Promise<PrismProject> {
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
    layers.reverse();

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
                opacity: layer.opacity != null ? layer.opacity / 255 : 1,
                rotation: 0,
                scale: 1,
            }
        };

        staggerFrame += STAGGER_STEP;

        if (track.type === 'text' && layer.text) {
            track.props.content = layer.text.text;
        } else if (track.type === 'image') {
            const assetId = generateId();

            const asset: PrismAsset = {
                id: assetId,
                type: 'image',
                src: `https://placehold.co/${width}x${height}`,
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
