import React from 'react';
import { AbsoluteFill, Sequence, Audio, Video, useCurrentFrame, interpolate, Easing } from 'remotion';
import { PrismProject, PrismTrack, PrismAsset } from '../../types/prism';

export const PrismComposition: React.FC<{ project: PrismProject; assets: Record<string, PrismAsset> }> = ({ project, assets }) => {
    if (!project) return <AbsoluteFill style={{ backgroundColor: 'red' }}>No Project Data</AbsoluteFill>;

    return (
        <AbsoluteFill style={{ backgroundColor: project.backgroundColor || '#ffffff' }}>

            {/* Render in reverse order so the first track in the list (Top of Timeline) is rendered Last (Top Z-Index) */}
            {[...project.tracks].reverse().map((track) => {
                if (track.visible === false) return null;
                return (
                    <Sequence
                        key={track.id}
                        from={track.startFrame}
                        durationInFrames={Math.max(1, track.durationInFrames)}
                        layout="none"
                    >
                        <PrismLayer track={track} project={project} assets={assets} />
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};

const PrismLayer: React.FC<{ track: PrismTrack; project: PrismProject; assets: Record<string, PrismAsset> }> = ({
    track,
    project,
    assets
}) => {
    const { props, type, animation } = track;
    const {
        x, y, width, height, opacity, rotation, scale,
        content, color, fontSize, fontFamily, assetId, textAlign, isRasterized,
        borderWidth, borderColor, borderRadius,
        textStrokeWidth, textStrokeColor, textShadow,
        brightness, contrast, saturate, grayscale, blur
    } = props;

    // --- ANIMATION SYSTEM ---
    const frame = useCurrentFrame();
    const duration = track.durationInFrames;

    // 1. Resolve Parameters
    // Backward Compatibility: If 'animation' exists but 'entrance' doesn't, use it.
    let entranceType = track.entrance;
    let motionType = track.motion;

    if (!entranceType && !motionType && track.animation) {
        // Map legacy 'animation' to new types
        if (track.animation === 'ken_burns') {
            motionType = 'ken_burns';
        } else {
            entranceType = track.animation;
        }
    }

    const entranceDuration = track.entranceDuration || track.transitionDuration || 30; // Default 1s (30fps)
    const motionSpeed = track.motionSpeed || 90; // Default Cycle 3s
    const motionRepeat = track.motionRepeat ?? 0; // 0 = Infinite

    // 2. Entrance Calculations
    let entOpacity = 1;
    let entScale = 1;
    let entX = 0;
    let entY = 0;
    let entRotate = 0;
    let entClipPath: string | undefined = undefined;

    if (entranceType) {
        // Clamp frame to entrance duration
        const t = Math.min(frame, entranceDuration);

        if (entranceType === 'fade_in') {
            entOpacity = interpolate(t, [0, entranceDuration], [0, 1]);
        }
        else if (entranceType === 'slide_in_left') {
            entX = interpolate(t, [0, entranceDuration], [-width, 0], { easing: Easing.out(Easing.cubic) });
        }
        else if (entranceType === 'slide_in_right') {
            entX = interpolate(t, [0, entranceDuration], [width, 0], { easing: Easing.out(Easing.cubic) });
        }
        else if (entranceType === 'slide_in_top') {
            entY = interpolate(t, [0, entranceDuration], [-height, 0], { easing: Easing.out(Easing.cubic) });
        }
        else if (entranceType === 'slide_in_bottom') {
            entY = interpolate(t, [0, entranceDuration], [height, 0], { easing: Easing.out(Easing.cubic) });
        }
        else if (entranceType === 'zoom_in') {
            entScale = interpolate(t, [0, entranceDuration], [0, 1], { easing: Easing.out(Easing.cubic) });
            entOpacity = interpolate(t, [0, Math.min(10, entranceDuration)], [0, 1]); // Fast fade
        }
        else if (entranceType === 'zoom_out') {
            entScale = interpolate(t, [0, entranceDuration], [1.5, 1], { easing: Easing.out(Easing.cubic) });
            entOpacity = interpolate(t, [0, Math.min(10, entranceDuration)], [0, 1]);
        }
        else if (entranceType === 'wipe_left') {
            const p = interpolate(t, [0, entranceDuration], [100, 0], { easing: Easing.out(Easing.cubic) });
            entClipPath = `inset(0 ${p}% 0 0)`;
        }
        else if (entranceType === 'wipe_right') {
            const p = interpolate(t, [0, entranceDuration], [100, 0], { easing: Easing.out(Easing.cubic) });
            entClipPath = `inset(0 0 0 ${p}%)`;
        }
    }

    // 3. Motion Calculations (Looping)
    let motScale = 1;
    let motX = 0;
    let motY = 0;
    let motRotate = 0;

    if (motionType) {
        // Calculate Cycle Progress
        let cycleProgress = 0;

        if (motionType === 'ken_burns') {
            // Ken Burns is linear over the WHOLE duration usually, not looping
            const kbProgress = interpolate(frame, [0, duration], [0, 1], { extrapolateRight: 'clamp' });
            motScale = 1 + (kbProgress * 0.2); // 1.0 -> 1.2
        } else {
            // Looping Animations
            // If repeat is set, clamp total cycles
            const totalAllowedFrames = motionRepeat > 0 ? motionRepeat * motionSpeed : Infinity;

            if (frame < totalAllowedFrames) {
                const timeInCycle = frame % motionSpeed;
                cycleProgress = timeInCycle / motionSpeed; // 0 -> 1

                if (motionType === 'pulse') {
                    // 1 -> 1.05 -> 1
                    // Sine wave: 0 -> PI
                    const val = Math.sin(cycleProgress * Math.PI);
                    motScale = 1 + (val * 0.05);
                }
                else if (motionType === 'shake') {
                    // Random-ish shake using sine combination
                    const val = Math.sin(cycleProgress * Math.PI * 4); // 2 wiggles per cycle?
                    motX = val * 5; // +/- 5px
                }
                else if (motionType === 'wiggle') {
                    // Rotate
                    const val = Math.sin(cycleProgress * Math.PI * 2);
                    motRotate = val * 3; // +/- 3 deg
                }
                else if (motionType === 'spin') {
                    // 0 -> 360
                    motRotate = cycleProgress * 360;
                }
                else if (motionType === 'bounce') {
                    // Y axis bounce
                    // abs(sin)
                    const val = Math.abs(Math.sin(cycleProgress * Math.PI));
                    motY = -val * 20; // Jump up 20px
                }
            }
        }
    }

    // 4. Combine Transforms (Entrance * Motion * Base)
    const finalOpacity = opacity * entOpacity;
    const finalScale = scale * entScale * motScale;
    const finalRotate = rotation + entRotate + motRotate;
    const finalX = x + entX + motX;
    const finalY = y + entY + motY;
    const finalClip = entClipPath; // Motion clip not supported yet

    // Update style creation to use these new finals
    // Replaced logic below...

    // Construct Filter String
    // If undefined, defaults will be used in logic or CSS defaults (1 or 0)
    // brightness(1) contrast(1) saturate(1) grayscale(0) blur(0px)
    const filterString = `brightness(${brightness ?? 1}) contrast(${contrast ?? 1}) saturate(${saturate ?? 1}) grayscale(${grayscale ?? 0}) blur(${blur ?? 0}px)`;

    // Common styles
    const style: React.CSSProperties = {
        position: 'absolute',
        // We use the computed finals which include base x/y + entrance + motion
        left: finalX,
        top: finalY,
        width,
        height,
        opacity: finalOpacity,
        transform: `rotate(${finalRotate}deg) scale(${finalScale})`,
        clipPath: finalClip,
        borderWidth: borderWidth ? `${borderWidth}px` : undefined,
        borderColor: borderColor || undefined,
        borderStyle: borderWidth ? 'solid' : undefined,
        borderRadius: borderRadius ? `${borderRadius}px` : undefined,
        overflow: borderRadius ? 'hidden' : undefined,
        // Apply Filters
        filter: filterString,
    };

    if (type === 'text') {
        if (isRasterized && assetId) {
            const asset = assets[assetId];
            if (asset) {
                let finalSrc = asset.src;
                // Path Normalization
                // Path Normalization
                if (finalSrc.includes('\\')) finalSrc = finalSrc.replace(/\\/g, '/');
                if (!finalSrc.startsWith('http') &&
                    !finalSrc.startsWith('file://') &&
                    !finalSrc.startsWith('blob:') &&
                    !finalSrc.startsWith('data:')) {
                    if (finalSrc.startsWith('/')) finalSrc = `file://${finalSrc}`;
                    else finalSrc = `file:///${finalSrc}`;
                }
                return (
                    <img
                        src={finalSrc}
                        style={{ ...style, objectFit: 'contain' }}
                        crossOrigin="anonymous"
                        alt={content}
                    />
                );
            }
        }

        return (
            <div style={{
                ...style,
                color: color || '#000',
                fontSize: fontSize || 40,
                fontFamily: fontFamily || 'sans-serif',
                textAlign: textAlign || 'left',
                whiteSpace: 'pre-wrap', // Preserves newlines from PSD
                lineHeight: 1.2,
                WebkitTextStrokeWidth: textStrokeWidth ? `${textStrokeWidth}px` : undefined,
                WebkitTextStrokeColor: textStrokeColor,
                textShadow: textShadow,
            }}>
                {content}
            </div>
        );
    }

    if (type === 'video') {
        const asset = assetId ? assets[assetId] : null;
        if (!asset) return <div style={{ ...style, border: '2px dashed red' }}>Missing Video Asset</div>;

        const fitMode = props.objectFit || 'cover';

        if (fitMode === 'none') {
            // Manual Mode (Crop)
            return (
                <div style={{
                    ...style,
                    overflow: 'hidden',
                }}>
                    <Video
                        src={asset.src}
                        startFrom={props.mediaOffset || 0}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain', // Use contain so full video is available for transform
                            transformOrigin: 'center center',
                            transform: `translate(${props.contentX || 0}px, ${props.contentY || 0}px) scale(${props.contentScale || 1})`,
                        }}
                        volume={props.volume ?? 1}
                    />
                </div>
            );
        }

        return (
            <div style={style}>
                <Video
                    src={asset.src}
                    startFrom={props.mediaOffset || 0}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: fitMode as any
                    }}
                    volume={props.volume ?? 1}
                />
            </div>
        );
    }

    if (type === 'image') {
        // SHAPE LAYER SUPPORT
        if (props.backgroundColor) {
            return (
                <div style={{
                    ...style,
                    backgroundColor: props.backgroundColor,
                }} />
            );
        }

        const asset = assetId ? assets[assetId] : null;

        if (!asset) {
            // If it's a shape with no asset (handled above) we shouldn't be here.
            // If it's a missing image:
            console.warn(`Missing asset for track: ${track.id}`);
            return <div style={{ ...style, border: '2px dashed red' }}>Missing Asset</div>;
        }

        // --- THE FIX: Path Normalization ---
        let finalSrc = asset.src;
        // Fix Windows paths if present
        if (finalSrc.includes('\\')) {
            finalSrc = finalSrc.replace(/\\/g, '/');
        }

        // Handle common protocols
        if (!finalSrc.startsWith('http') &&
            !finalSrc.startsWith('file://') &&
            !finalSrc.startsWith('blob:') &&
            !finalSrc.startsWith('data:')) { // Allow Data URIs

            if (finalSrc.startsWith('/')) {
                finalSrc = `file://${finalSrc}`;
            } else {
                finalSrc = `file:///${finalSrc}`;
            }
        }
        // -----------------------------------

        // Create the image element with appropriate styles
        const fitMode = props.objectFit || 'cover';

        let imageStyle: React.CSSProperties = {
            ...style, // Inherits x, y, w, h, rotation, opacity
            objectFit: fitMode as any,
        };

        if (fitMode === 'none') {
            // Manual Mode ("Crop")
            // In this mode, the <img> itself is positioned absolutely relative to the container?
            // Actually, 'style' here applies to the container div or img directly?
            // If we use 'style' on the <img>, it positions the IMG.
            // But we want the IMG to be LARGER than the frame (Layer Width/Height).
            // So we need:
            // 1. A container DIV (The Layer Frame) with overflow: hidden
            // 2. The IMG inside, transformed.

            // NOTE: The current structure returns 'content' which is an <img> tag.
            // If we wrap it, we change the structure.
            // Let's modify 'content' to be a wrapper if needed.

            // If manual, we don't set objectFit. We set width/height to 'auto' or 100%?
            // If scale is 1, maybe it matches layer size?
            // Let's say: The image is centered in the layer.

            // Revised approach for Manual Mode:
            // Wrapper (Layer Frame): x, y, width, height, overflow: hidden
            // Image: absolute, left: 50%, top: 50%, translate(-50%, -50%) + translate(contentX, contentY) scale(contentScale)

            // To achieve this without major refactor, let's wrap the IMG in a div that acts as the layer frame.
            // BUT `style` above is already defining position on the canvas.

            // Let's redefine `imageStyle` for the IMG tag when in manual mode.
            // FIX: Use 'contain' so the full image data is available to be transformed. 
            // 'cover' would clip pixels before we can pan/zoom to them.

            return (
                <div style={{
                    ...style, // Position, Size, Rotation, Opacity
                    overflow: 'hidden', // Crop
                }}>
                    <img
                        src={finalSrc}
                        crossOrigin="anonymous"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            transformOrigin: 'center center',
                            transform: `translate(${props.contentX || 0}px, ${props.contentY || 0}px) scale(${props.contentScale || 1})`,
                        }}
                    />
                </div>
            );
        }

        // Standard Modes (Cover, Contain, Fill)
        // Just render the image directly with object-fit
        let content = (
            <img
                src={finalSrc}
                style={{
                    ...style,
                    // If masked, we need to reset the position relative to the mask container
                    left: props.mask ? x - props.mask.x : x,
                    top: props.mask ? y - props.mask.y : y,
                    objectFit: fitMode as any,
                }}
                crossOrigin="anonymous"
                onError={(e) => {
                    console.error("Failed to load image:", finalSrc);
                }}
            />
        );

        // CLIPPING MASK WRAPPER
        if (props.mask) {
            return (
                <div style={{
                    position: 'absolute',
                    left: props.mask.x,
                    top: props.mask.y,
                    width: props.mask.width,
                    height: props.mask.height,
                    borderRadius: props.mask.radius ? `${props.mask.radius}px` : undefined,
                    overflow: 'hidden',
                    opacity: opacity, // Opacity usually applies to the whole group? Or just the layer? inheriting
                    transform: `rotate(${rotation}deg) scale(${scale})`, // Outer transform
                    // Apply Border to the MASK container
                    borderWidth: borderWidth ? `${borderWidth}px` : undefined,
                    borderColor: borderColor || undefined,
                    borderStyle: borderWidth ? 'solid' : undefined,
                }}>
                    {content}
                </div>
            );
        }

        return content;
    }

    if (type === 'audio') {
        const asset = assetId ? assets[assetId] : null;
        if (!asset) return null;
        // Same normalization logic might be needed for audio
        return <Audio src={asset.src} startFrom={props.mediaOffset || 0} volume={props.volume ?? 1} />;
    }

    return <div style={{ ...style, backgroundColor: 'rgba(255,0,0,0.3)' }} />;
};
