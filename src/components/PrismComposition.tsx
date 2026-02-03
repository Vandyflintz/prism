import React from 'react';
import { AbsoluteFill, Sequence, Audio, useCurrentFrame, interpolate, Easing } from 'remotion';
import { PrismProject, PrismTrack } from '../../types/prism';

export const PrismComposition: React.FC<{ project: PrismProject }> = ({ project }) => {
    if (!project) return <AbsoluteFill style={{ backgroundColor: 'red' }}>No Project Data</AbsoluteFill>;

    return (
        <AbsoluteFill style={{ backgroundColor: undefined }}>

            {/* Render in reverse order so the first track in the list (Top of Timeline) is rendered Last (Top Z-Index) */}
            {[...project.tracks].reverse().map((track) => {
                return (
                    <Sequence
                        key={track.id}
                        from={track.startFrame}
                        durationInFrames={Math.max(1, track.durationInFrames)}
                        layout="none"
                    >
                        <PrismLayer track={track} project={project} />
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};

const PrismLayer: React.FC<{ track: PrismTrack; project: PrismProject }> = ({
    track,
    project,
}) => {
    const { props, type, animation } = track;
    const { x, y, width, height, opacity, rotation, scale, content, color, fontSize, fontFamily, assetId, textAlign, isRasterized, borderWidth, borderColor, borderRadius, textStrokeWidth, textStrokeColor, textShadow } = props;

    // Animation Logic (Interpolation)
    const frame = useCurrentFrame();
    const duration = track.durationInFrames;
    let animScale = 1;
    let animTranslateX = 0;

    if (animation === 'zoom_in') {
        animScale = interpolate(frame, [0, duration], [1, 1.2], { extrapolateRight: 'clamp' });
    } else if (animation === 'zoom_out') {
        animScale = interpolate(frame, [0, duration], [1.2, 1], { extrapolateRight: 'clamp' });
    } else if (animation === 'slide_in') {
        animTranslateX = interpolate(frame, [0, 20], [-50, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) });
    } else if (animation === 'ken_burns') {
        animScale = interpolate(frame, [0, duration], [1.1, 1.3], { extrapolateRight: 'clamp' });
    }

    // Common styles
    const style: React.CSSProperties = {
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        transform: `translateX(${animTranslateX}px) rotate(${rotation}deg) scale(${scale * animScale})`,
        borderWidth: borderWidth ? `${borderWidth}px` : undefined,
        borderColor: borderColor || undefined,
        borderStyle: borderWidth ? 'solid' : undefined,
        borderRadius: borderRadius ? `${borderRadius}px` : undefined,
        overflow: borderRadius ? 'hidden' : undefined,
    };

    if (type === 'text') {
        if (isRasterized && assetId) {
            const asset = project.assets[assetId];
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

        const asset = assetId ? project.assets[assetId] : null;

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

        let content = (
            <img
                src={finalSrc}
                style={{
                    ...style,
                    // If masked, we need to reset the position relative to the mask container
                    left: props.mask ? x - props.mask.x : x,
                    top: props.mask ? y - props.mask.y : y,
                    objectFit: 'cover',
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
        const asset = assetId ? project.assets[assetId] : null;
        if (!asset) return null;
        // Same normalization logic might be needed for audio
        return <Audio src={asset.src} volume={props.volume ?? 1} />;
    }

    return <div style={{ ...style, backgroundColor: 'rgba(255,0,0,0.3)' }} />;
};
