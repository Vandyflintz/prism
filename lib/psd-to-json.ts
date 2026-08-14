import { readPsd, Layer } from 'ag-psd';
import { PrismProject, PrismTrack, PrismAsset, TrackType, LayerProps, PsdLayerSummary } from '../types/prism';
import { generateId } from './id';

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

    // Flatten group structure, preserving order (0=Bottom, N=Top)
    const layers = await flattenLayers(psd.children || []);

    let staggerFrame = 0;
    const STAGGER_STEP = 5;

    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.hidden) continue;

        const width = (layer.right || 0) - (layer.left || 0); // Calculate dimensions from bounds
        const height = (layer.bottom || 0) - (layer.top || 0);

        const trackId = generateId();
        // @ts-ignore
        const isClipped = layer.clipping;

        let clippingMask: { x: number, y: number, width: number, height: number, radius?: number } | undefined = undefined;
        let borderPropsBase: Partial<LayerProps> = {};

        // Handle Clipping Mask Logic (Forward 0..N)
        // [Base, Clipped]
        // i=Base. Look Ahead (i+1) for Clipped.
        // Wait. `layer.clipping` means "I am Clipped".
        // Base does invalid `clipping`.
        // So `isClipped` is true for the CLIPPED layer (i=1).
        // Base is at `i-1` (0).
        // So if `isClipped`, I look BEHIND (i-1).

        if (isClipped) {
            // Look BACKWARDS for the clipping base
            for (let j = i - 1; j >= 0; j--) {
                const potentialBase = layers[j];
                if (potentialBase.hidden) continue;

                if (!potentialBase.clipping) {
                    // FOUND BASE
                    const maskX = potentialBase.left || 0;
                    const maskY = potentialBase.top || 0;
                    const maskW = (potentialBase.right || 0) - maskX;
                    const maskH = (potentialBase.bottom || 0) - maskY;

                    clippingMask = { x: maskX, y: maskY, width: maskW, height: maskH };

                    // Promote Radius
                    // @ts-ignore
                    const radii = potentialBase.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginRRectRadii;
                    if (radii) {
                        const val = radii.topLeft?.value || 0;
                        if (val > 0) clippingMask.radius = val;
                    }
                    else if (potentialBase.children && potentialBase.children.length > 0) {
                        // Check children...
                        // @ts-ignore
                        potentialBase.children.forEach(child => {
                            // @ts-ignore
                            const childRadii = child.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginRRectRadii;
                            if (childRadii) {
                                const val = childRadii.topLeft?.value || 0;
                                if (val > 0 && clippingMask) clippingMask.radius = val;
                            }
                        });
                    }

                    // Promote Effects
                    // @ts-ignore
                    if (potentialBase.effects?.stroke?.[0]) {
                        // @ts-ignore
                        const stroke = potentialBase.effects.stroke[0];
                        if (stroke.enabled && stroke.size) {
                            borderPropsBase.borderWidth = stroke.size.value;
                            if (stroke.color) {
                                const c = stroke.color;
                                if ('r' in c) {
                                    borderPropsBase.borderColor = `rgb(${c.r}, ${c.g}, ${c.b})`;
                                }
                            }
                        }
                    }
                    break;
                }
            }
        }


        const ANIMATIONS = [
            'fade_in',
            'zoom_in',
            'slide_in_bottom',
            'slide_in_top',
            'slide_in_left',
            'slide_in_right'
        ];
        const randomAnim = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];

        const track: PrismTrack = {
            id: trackId,
            type: determineLayerType(layer),
            startFrame: staggerFrame,
            durationInFrames: project.durationInFrames - staggerFrame,
            animation: randomAnim, // Random Animation
            props: {
                transitionDuration: 20, // Default beautiful duration (0.7s)
                x: layer.left || 0,
                y: layer.top || 0,
                width: width,
                height: height,
                opacity: (layer.opacity != null) ? (layer.opacity > 1 ? layer.opacity / 255 : layer.opacity) : 1,
                rotation: 0,
                scale: 1,
            }
        };

        if (clippingMask) {
            track.props.mask = clippingMask;
        }
        if (borderPropsBase.borderWidth) {
            track.props.borderWidth = borderPropsBase.borderWidth;
            track.props.borderColor = borderPropsBase.borderColor;
        }

        staggerFrame += STAGGER_STEP;

        // Note: Mask props and border/stroke are now directly assigned to track.props in the loop above.

        if (track.type === 'text' && layer.text) {
            track.props.content = layer.text.text;

            // Extract Styles
            if (layer.text.style) {
                const style = layer.text.style;
                // Font Size
                if (style.fontSize) track.props.fontSize = style.fontSize;
                // Color
                if (style.fillColor) {
                    const c = style.fillColor;
                    if ('r' in c && 'g' in c && 'b' in c) {
                        track.props.color = `rgb(${c.r}, ${c.g}, ${c.b})`;
                    }
                }

                // Color Overlay Effect Override (Solid Fill)
                // @ts-ignore
                if (layer.effects?.solidFill?.[0]?.enabled) {
                    // @ts-ignore
                    const c = layer.effects.solidFill[0].color;
                    if (c && 'r' in c) {
                        track.props.color = `rgb(${c.r}, ${c.g}, ${c.b})`;
                    }
                }

                // Font Family
                if (style.font && style.font.name) track.props.fontFamily = style.font.name;
            }

            // Extract Effects for Text (Stroke / Shadow)
            // @ts-ignore
            if (layer.effects?.stroke?.[0]) {
                // @ts-ignore
                const stroke = layer.effects.stroke[0];
                if (stroke.enabled && stroke.size) {
                    // Remotion Text style usually uses `textShadow` or `-webkit-text-stroke`.
                    // We'll map to `textStroke` prop if we support it, or generic border?
                    // Text border doesn't work well (box border).
                    // We need a specific text stroke prop.
                    // For now, let's try `textStrokeWidth` and `textStrokeColor`.
                    // @ts-ignore
                    track.props.textStrokeWidth = stroke.size.value || stroke.size;
                    if (stroke.color) {
                        const c = stroke.color;
                        // @ts-ignore
                        if (c) track.props.textStrokeColor = `rgb(${c.r}, ${c.g}, ${c.b})`;
                    }
                }
            }
            // @ts-ignore
            if (layer.effects?.dropShadow?.[0]) {
                // @ts-ignore
                const ds = layer.effects.dropShadow[0];
                if (ds.enabled) {
                    // Construct CSS box-shadow or text-shadow format
                    // x y blur color
                    // @ts-ignore
                    const dist = (ds.distance && typeof ds.distance === 'object') ? ds.distance.value : ds.distance || 0;
                    // @ts-ignore
                    const angle = (ds.angle && typeof ds.angle === 'object') ? ds.angle.value : ds.angle || 0;

                    const rads = (angle) * (Math.PI / 180);
                    const x = -Math.cos(rads) * dist;
                    const y = Math.sin(rads) * dist;

                    // @ts-ignore
                    const blur = (ds.size && typeof ds.size === 'object') ? ds.size.value : ds.size || 0;

                    const c = ds.color || { r: 0, g: 0, b: 0 };
                    // @ts-ignore
                    track.props.textShadow = `${x}px ${y}px ${blur}px rgb(${c.r}, ${c.g}, ${c.b})`;
                }
            }

            // Paragraph / Alignment
            if (layer.text.paragraphStyle && layer.text.paragraphStyle.justification) {
                const map: Record<string, 'left' | 'center' | 'right'> = {
                    'left': 'left', 'right': 'right', 'center': 'center',
                    'justifyLeft': 'left', 'justifyRight': 'right', 'justifyCenter': 'center'
                };
                track.props.textAlign = map[layer.text.paragraphStyle.justification] || 'left';
            }

            // RASTER FALLBACK: Check if text layer has a canvas (bitmap data)
            if (layer.canvas) {
                const assetId = generateId();
                const imgSrc = await processLayerImage(layer, track.props.x, track.props.y);

                if (imgSrc) {
                    const asset: PrismAsset = { id: assetId, type: 'image', src: imgSrc, metadata: { isInternal: true } };
                    project.assets[assetId] = asset;
                    track.props.assetId = assetId;
                    track.props.isRasterized = true;
                }
            }

        } else if (track.type === 'image') {
            const assetId = generateId();
            const imgSrc = await processLayerImage(layer, track.props.x, track.props.y);
            const finalSrc = imgSrc || `https://placehold.co/${width}x${height}`;

            const asset: PrismAsset = {
                id: assetId,
                type: 'image',
                src: finalSrc,
                metadata: { isInternal: true }
            };

            project.assets[assetId] = asset;
            track.props.assetId = assetId;

            // --- EXTRACT STYLES (Stroke / Radius) ---

            // 1. Border Radius from DIRECT Vector Mask (Rectangle)
            // @ts-ignore
            if (layer.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginRRectRadii) {
                // @ts-ignore
                const radii = layer.vectorOrigination.keyDescriptorList[0].keyOriginRRectRadii;
                if (radii) {
                    const val = radii.topLeft?.value || 0;
                    if (val > 0) track.props.borderRadius = val;
                }
            }

            // 1.5 SHAPE FILL COLOR (Solid Color)
            // @ts-ignore
            if (layer.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginShapePaint) {
                // @ts-ignore
                const paint = layer.vectorOrigination.keyDescriptorList[0].keyOriginShapePaint;
                if (paint && paint.fillColor) {
                    const c = paint.fillColor;
                    if ('r' in c) {
                        track.props.backgroundColor = `rgb(${c.r}, ${c.g}, ${c.b})`;
                        // If it's a shape layer, we might want to suppress the Placeholder Image if no src is found
                        if (finalSrc.includes('placehold.co')) {
                            track.props.assetId = undefined; // No asset needed, just color
                        }
                    }
                }
            }

            // 2. Stroke / Border from DIRECT Effects
            // @ts-ignore
            if (layer.effects?.stroke?.[0]) {
                // @ts-ignore
                const stroke = layer.effects.stroke[0];
                if (stroke.enabled && stroke.size) {
                    track.props.borderWidth = stroke.size.value;
                    if (stroke.color) {
                        const c = stroke.color;
                        if ('r' in c) {
                            track.props.borderColor = `rgb(${c.r}, ${c.g}, ${c.b})`;
                        }
                    }
                }
            }
        }

        project.tracks.unshift(track);
    }

    return project;
}

// Check if a layer (or group) has active effects that require baking
function hasActiveEffects(layer: Layer): boolean {
    if (!layer.effects) return false;
    const e = layer.effects;
    // Check for common render-altering effects
    if (e.dropShadow?.[0]?.enabled) return true;
    if (e.stroke?.[0]?.enabled) return true;
    if (e.innerShadow?.[0]?.enabled) return true;
    if (e.outerGlow?.enabled) return true;
    if (e.innerGlow?.enabled) return true;
    if (e.bevel?.enabled) return true;
    if (e.solidFill?.[0]?.enabled) return true;
    if (e.gradientOverlay?.[0]?.enabled) return true;
    return false;
}

function containsText(layer: Layer): boolean {
    if (layer.text) return true;
    if (layer.children) return layer.children.some(containsText);
    return false;
}

async function flattenLayers(layers: Layer[]): Promise<Layer[]> {
    let result: Layer[] = [];
    for (const layer of layers) {
        if (layer.hidden) continue;

        // If it's a group AND has active effects AND DOES NOT CONTAIN TEXT, we BAKE it.
        // Baking text is lossy (rasterizes without proper font rendering), so we avoid it.
        // @ts-ignore
        if (layer.children && (hasActiveEffects(layer) || layer.mask || layer.clipping) && !containsText(layer)) {
            // Debug
            console.log(`Baking Group [${layer.name}] due to effects/mask`);
            const baked = await bakeGroupLayer(layer);
            if (baked) {
                result.push(baked);
            } else {
                // Fallback
                const children = await flattenLayers(layer.children);
                result = result.concat(children);
            }
        }
        else if (layer.children && layer.children.length > 0) {
            // Standard group: flatten children
            const children = await flattenLayers(layer.children);
            result = result.concat(children);
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

async function bakeGroupLayer(group: Layer): Promise<Layer | null> {
    // 1. Calculate Bounding Box of clear children
    const bounds = getGroupBounds(group);
    if (bounds.width === 0 || bounds.height === 0) return null;

    // 2. Create Canvas
    const canvas = document.createElement('canvas');
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 3. Render children onto canvas
    await renderLayerToContext(group, ctx, bounds.left, bounds.top);

    // 4. Promote Radius if found
    let foundRadii = null;
    const findRadii = (layers: Layer[]): any => {
        for (const l of layers) {
            // @ts-ignore
            if (l.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginRRectRadii) {
                // @ts-ignore
                return l.vectorOrigination;
            }
            if (l.children) {
                const found = findRadii(l.children);
                if (found) return found;
            }
        }
        return null;
    }
    if (group.children) foundRadii = findRadii(group.children);

    // 5. Return new "Image" Layer
    const newLayer: Layer = {
        name: group.name,
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        opacity: group.opacity,
        blendMode: group.blendMode,
        canvas: canvas,
        effects: group.effects,
        vectorOrigination: foundRadii || undefined,
    };

    return newLayer;
}

function getGroupBounds(layer: Layer): { left: number, top: number, right: number, bottom: number, width: number, height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    function traverse(l: Layer) {
        if (l.hidden) return;
        if (l.children) {
            l.children.forEach(traverse);
        } else {
            const left = l.left || 0;
            const top = l.top || 0;
            // @ts-ignore
            const right = l.right || (left + (l.width || 0));
            // @ts-ignore
            const bottom = l.bottom || (top + (l.height || 0));

            if (right > left && bottom > top) {
                if (left < minX) minX = left;
                if (top < minY) minY = top;
                if (right > maxX) maxX = right;
                if (bottom > maxY) maxY = bottom;
            }
        }
    }

    traverse(layer);

    if (minX === Infinity) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    return {
        left: minX,
        top: minY,
        right: maxX,
        bottom: maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

function pathRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function getClippingChain(children: Layer[], baseIndex: number): Layer[] {
    const chain: Layer[] = [];
    // Base is at `baseIndex` (lower index if 0=Bottom). Clipped layers are AHEAD (i+1).
    // Verify: [Base (0), Clipped1 (1), Clipped2 (2)].
    // Base is 0. Scan 1..N.
    for (let i = baseIndex + 1; i < children.length; i++) {
        const layer = children[i];
        // @ts-ignore
        if (layer.clipping) {
            chain.push(layer);
        } else {
            break;
        }
    }
    return chain;
}

function applyVectorMask(layer: Layer, ctx: CanvasRenderingContext2D, originX: number, originY: number) {
    // @ts-ignore
    const radii = layer.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginRRectRadii;
    // @ts-ignore
    const paint = layer.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginShapePaint;

    // We only clip if there is a radius or specific shape vector.
    // If it's just a paint with no path... we assume Rect.
    // Use bounds.
    if (radii) {
        const val = radii.topLeft?.value || 0;
        const wx = (layer.right || 0) - (layer.left || 0);
        const hx = (layer.bottom || 0) - (layer.top || 0);
        const lx = (layer.left || 0) - originX;
        const ly = (layer.top || 0) - originY;

        pathRoundRect(ctx, lx, ly, wx, hx, val);
        ctx.clip();
    }
}

async function renderLayerToContext(layer: Layer, ctx: CanvasRenderingContext2D, originX: number, originY: number) {
    if (layer.hidden) return;

    ctx.save();

    // Apply Opacity
    // @ts-ignore
    if (layer.opacity != null && layer.opacity < 255) ctx.globalAlpha *= (layer.opacity / 255);

    // Apply Vector Mask (Clip)
    applyVectorMask(layer, ctx, originX, originY);

    if (layer.children) {
        const children = layer.children;
        // Render children from BOTTOM (0) to TOP (N)
        let i = 0;
        while (i < children.length) {
            const child = children[i];

            // Check for Clipping Chain (Look ahead)
            // Base is `i`. Clipped is `i+1`.
            // @ts-ignore
            if (!child.clipping && i + 1 < children.length && children[i + 1].clipping) {
                // BASE found.
                const chain = getClippingChain(children, i);

                // Render Chain Isolated
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = ctx.canvas.width;
                tempCanvas.height = ctx.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    // Draw Base to Temp
                    await renderLayerToContext(child, tempCtx, originX, originY);

                    // CRITICAL FIX: If Base layer didn't render anything (e.g. it's just a vector mask path with no fill/pixels),
                    // the destination alpha is 0, so 'source-atop' will wipe out the clipped layers.
                    // We must ensure the Base provides a Matte.
                    // Check if Base has canvas or fill.
                    // @ts-ignore
                    const hasPixels = child.canvas || (child.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginShapePaint?.fillColor);

                    // @ts-ignore
                    if (!hasPixels && child.vectorOrigination?.keyDescriptorList?.[0]?.keyOriginRRectRadii) {
                        // It has a shape/path but no content. Draw the path usage as Matte.
                        const maskX = (child.left || 0) - originX;
                        const maskY = (child.top || 0) - originY;
                        const maskW = (child.right || 0) - (child.left || 0);
                        const maskH = (child.bottom || 0) - (child.top || 0);
                        // @ts-ignore
                        const radii = child.vectorOrigination.keyDescriptorList[0].keyOriginRRectRadii.topLeft?.value || 0;

                        tempCtx.fillStyle = '#000000'; // Opaque matte
                        pathRoundRect(tempCtx, maskX, maskY, maskW, maskH, radii);
                        tempCtx.fill();
                    }

                    // 2. Draw Clipped Layers using source-atop (Clip to Base Alpha)
                    tempCtx.globalCompositeOperation = 'source-atop';
                    for (const clipped of chain) {
                        await renderLayerToContext(clipped, tempCtx, originX, originY);
                    }
                    ctx.drawImage(tempCanvas, 0, 0);
                }

                i += (1 + chain.length);
            } else if (child.clipping) {
                // Orphan clipping
                i++;
            } else {
                // Normal
                await renderLayerToContext(child, ctx, originX, originY);
                i++;
            }
        }
    } else {
        // Leaf Layer
        // Rasterize/Draw it
        if (layer.canvas) {
            const left = (layer.left || 0) - originX;
            const top = (layer.top || 0) - originY;
            // @ts-ignore
            ctx.globalAlpha = (layer.opacity != null) ? layer.opacity / 255 : 1;

            // Draw
            // @ts-ignore
            ctx.drawImage(layer.canvas, left, top);
            ctx.globalAlpha = 1; // Reset
        }
    }
}

async function processLayerImage(layer: Layer, trackX: number, trackY: number): Promise<string | null> {
    let layerCanvas = layer.canvas;

    // Apply Mask if present
    // @ts-ignore
    if (layer.mask && layer.mask.canvas) {
        try {
            // @ts-ignore
            const width = layerCanvas.width;
            // @ts-ignore
            const height = layerCanvas.height;
            const compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = width;
            compositeCanvas.height = height;
            const ctx = compositeCanvas.getContext('2d');

            if (ctx) {
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
                    for (let i = 0; i < data.length; i += 4) {
                        data[i + 3] = data[i]; // Alpha = Red
                    }
                    maskCtx.putImageData(maskData, 0, 0);

                    // @ts-ignore
                    ctx.drawImage(layerCanvas, 0, 0);

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

                    // @ts-ignore
                    layerCanvas = compositeCanvas;
                }
            }
        } catch (maskErr) {
            console.error(`Failed to apply mask for layer ${layer.name}`, maskErr);
        }
    }

    if (layerCanvas) {
        try {
            // @ts-ignore
            const blob = await new Promise<Blob | null>(resolve => layerCanvas.toBlob(resolve, 'image/webp'));
            if (blob) {
                return URL.createObjectURL(blob);
            }
        } catch (e) {
            console.error('Failed to create blob from layer canvas', e);
        }
    }
    return null;
}

/**
 * Parses a PSD buffer to extract its composite thumbnail or canvas.
 */
export async function getPsdPreview(buffer: ArrayBuffer | Uint8Array): Promise<string | undefined> {
    try {
        const psd = readPsd(buffer, {
            skipLayerImageData: true, // we only want the composite
            skipThumbnail: false,
        });

        // 1. Try Canvas (Composite)
        if (psd.canvas) {
            const blob = await new Promise<Blob | null>(resolve => psd.canvas!.toBlob(resolve, 'image/webp'));
            if (blob) return URL.createObjectURL(blob);
        }
    } catch (e) {
        console.warn("Failed to extract PSD preview", e);
    }
    return undefined;
}

/**
 * Parses a PSD buffer and returns a summary of layers for the Asset Library.
 * Similar to parsePsd but returns PsdLayerSummary[] structure instead of a PrismProject.
 */
export async function getLayersFromPsd(buffer: ArrayBuffer | Uint8Array): Promise<PsdLayerSummary[]> {
    const psd = readPsd(buffer, {
        skipLayerImageData: false,
        skipThumbnail: true,
    });

    const traverse = async (layers: Layer[]): Promise<PsdLayerSummary[]> => {
        const summaries: PsdLayerSummary[] = [];
        for (const layer of layers) {
            const id = generateId();

            // Process Image logic similar to original parsePsd but scoped
            let imgSrc = undefined;
            if (layer.canvas) {
                try {
                    // @ts-ignore
                    const blob = await new Promise<Blob | null>(resolve => layer.canvas.toBlob(resolve, 'image/webp'));
                    if (blob) imgSrc = URL.createObjectURL(blob);
                } catch (e) {
                    console.error('Failed to create blob for summary', e);
                }
            }

            const summary: PsdLayerSummary = {
                id: id,
                name: layer.name || 'Layer',
                type: layer.text ? 'text' : (layer.children ? 'group' : 'image'),
                visible: !layer.hidden,
                left: layer.left || 0,
                top: layer.top || 0,
                width: (layer.right || 0) - (layer.left || 0),
                height: (layer.bottom || 0) - (layer.top || 0),
                text: layer.text?.text,
                src: imgSrc
            };

            if (layer.children) {
                summary.children = await traverse(layer.children);
            }

            summaries.push(summary);
        }
        return summaries;
    };

    return traverse(psd.children || []);
}
