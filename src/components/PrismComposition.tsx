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
    const { x, y, width, height, opacity, rotation, scale, content, color, fontSize, fontFamily, assetId, textAlign, isRasterized, borderWidth, borderColor, borderRadius, textStrokeWidth, textStrokeColor, textShadow } = props;

    // Animation Logic (Interpolation)
    const frame = useCurrentFrame();
    const duration = track.durationInFrames;
    const TRANSITION_DURATION = track.props.transitionDuration || 15; // Default 0.5s

    let animOpacity = 1;
    let animScale = 1;
    let animTranslateX = 0;
    let animTranslateY = 0;
    let animClipPath: string | undefined = undefined;

    if (animation === 'fade_in') {
        animOpacity = interpolate(frame, [0, TRANSITION_DURATION], [0, 1], { extrapolateRight: 'clamp' });
    }
    else if (animation === 'slide_in_left') {
        animTranslateX = interpolate(frame, [0, TRANSITION_DURATION], [-width, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    }
    else if (animation === 'slide_in_right') {
        animTranslateX = interpolate(frame, [0, TRANSITION_DURATION], [width, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    }
    else if (animation === 'slide_in_top') {
        animTranslateY = interpolate(frame, [0, TRANSITION_DURATION], [-height, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    }
    else if (animation === 'slide_in_bottom') {
        animTranslateY = interpolate(frame, [0, TRANSITION_DURATION], [height, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    }
    else if (animation === 'zoom_in') {
        animScale = interpolate(frame, [0, TRANSITION_DURATION], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
        animOpacity = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' }); // Quick fade to avoid pop
    }
    else if (animation === 'zoom_out') {
        animScale = interpolate(frame, [0, TRANSITION_DURATION], [1.5, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
        animOpacity = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
    }
    else if (animation === 'wipe_left') {
        // Wipe from Right to Left (Reveals content)
        const p = interpolate(frame, [0, TRANSITION_DURATION], [100, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
        animClipPath = `inset(0 ${p}% 0 0)`;
    }
    else if (animation === 'wipe_right') {
        // Wipe from Left to Right
        const p = interpolate(frame, [0, TRANSITION_DURATION], [100, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
        animClipPath = `inset(0 0 0 ${p}%)`;
    }
    else if (animation === 'ken_burns') {
        animScale = interpolate(frame, [0, duration], [1.1, 1.3], { extrapolateRight: 'clamp' });
    }

    // Common styles
    const style: React.CSSProperties = {
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity: opacity * animOpacity,
        transform: `translateX(${animTranslateX}px) translateY(${animTranslateY}px) rotate(${rotation}deg) scale(${scale * animScale})`,
        clipPath: animClipPath,
        borderWidth: borderWidth ? `${borderWidth}px` : undefined,
        borderColor: borderColor || undefined,
        borderStyle: borderWidth ? 'solid' : undefined,
        borderRadius: borderRadius ? `${borderRadius}px` : undefined,
        overflow: borderRadius ? 'hidden' : undefined,
    };

    if (type === 'text') {
        if (isRasterized && assetId) {
            const asset = assets[assetId];
            if (asset) {
                let finalSrc = asset.src;
                // Path Normalization
                if (finalSrc.includes('\\')) finalSrc = finalSrc.replace(/\\/g, '/');
                if (!finalSrc.startsWith('http') && !finalSrc.startsWith('file://') && !finalSrc.startsWith('blob:')) {
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

        return (
            <div style={style}>
                <Video
                    src={asset.src}
                    startFrom={props.mediaOffset || 0}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
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
        if (finalSrc.includes('\\')) {
            finalSrc = finalSrc.replace(/\\/g, '/');
        }
        if (!finalSrc.startsWith('http') && !finalSrc.startsWith('file://') && !finalSrc.startsWith('blob:')) {
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
