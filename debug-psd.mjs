import { readPsd } from 'ag-psd';
import fs from 'fs';

try {
    const buffer = fs.readFileSync('NM CE.psd');
    // Read fully including image data to see if Groups get a canvas
    const psd = readPsd(buffer, { skipLayerImageData: false, skipThumbnail: true });

    console.log(`PSD Loaded: ${psd.width}x${psd.height}`);

    function processLayers(layers, depth = 0) {
        layers.forEach(layer => {
            const isText = !!layer.text;
            const hasCanvas = !!layer.canvas;
            const indent = '  '.repeat(depth);
            console.log(`${indent}- [${layer.name}] (Type: ${isText ? 'Text' : 'Layer'})`);

            // 1. Clipping / Masks
            if (layer.clipping) console.log(`${indent}  -> CLIPPING MASK (Clips layer below)`);
            if (layer.mask) console.log(`${indent}  -> HAS PIXEL MASK`);
            if (layer.vectorMask) console.log(`${indent}  -> HAS VECTOR MASK (Radius/Shape)`);

            // 2. Fills (Solid/Gradient)
            // @ts-ignore
            if (layer.vectorOrigination) {
                // @ts-ignore
                const fill = layer.vectorOrigination.keyDescriptorList?.[0]?.keyOriginShapePaint;
                if (fill) {
                    console.log(`${indent}  -> SHAPE FILL:`, JSON.stringify(fill, null, 2).slice(0, 200));
                }
            }

            // 3. Effects
            if (layer.effects) {
                const e = layer.effects;
                const activeEffects = [];
                if (e.dropShadow && e.dropShadow[0]?.enabled) activeEffects.push('DropShadow');
                if (e.stroke && e.stroke[0]?.enabled) activeEffects.push(`Stroke (${e.stroke[0].size.value}px ${e.stroke[0].position})`);
                if (e.innerShadow && e.innerShadow[0]?.enabled) activeEffects.push('InnerShadow');
                if (e.outerGlow && e.outerGlow.enabled) activeEffects.push('OuterGlow');
                if (e.innerGlow && e.innerGlow.enabled) activeEffects.push('InnerGlow');
                if (e.bevel && e.bevel.enabled) activeEffects.push('Bevel');
                if (e.solidFill && e.solidFill[0]?.enabled) activeEffects.push('ColorOverlay');
                if (e.gradientOverlay && e.gradientOverlay[0]?.enabled) activeEffects.push('GradientOverlay');

                if (activeEffects.length > 0) {
                    console.log(`${indent}  -> ACTIVE EFFECTS: ${activeEffects.join(', ')}`);
                    console.log(`${indent}  -> FULL EFFECTS JSON:`, JSON.stringify(e, null, 2));
                }
            }

            if (layer.children) {
                processLayers(layer.children, depth + 1);
            }
        });
    }

    processLayers(psd.children);

} catch (e) {
    console.error(e);
}
