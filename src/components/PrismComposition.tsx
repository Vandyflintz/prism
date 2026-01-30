import React from 'react';
import { AbsoluteFill, Sequence, Audio } from 'remotion';
import { PrismProject, PrismTrack } from '../../types/prism';

export const PrismComposition: React.FC<{ project: PrismProject }> = ({ project }) => {
    if (!project) return <AbsoluteFill style={{ backgroundColor: 'red' }}>No Project Data</AbsoluteFill>;

    return (
        <AbsoluteFill style={{ backgroundColor: undefined }}>
            {project.tracks.map((track) => {
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
    const { props, type } = track;
    const { x, y, width, height, opacity, rotation, scale, content, color, fontSize, fontFamily, assetId, textAlign, isRasterized, borderWidth, borderColor, borderRadius, textStrokeWidth, textStrokeColor, textShadow } = props;

    // Common styles
    const style: React.CSSProperties = {
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        transform: `rotate(${rotation}deg) scale(${scale})`,
        borderWidth: borderWidth ? `${borderWidth}px` : undefined,
        borderColor: borderColor || undefined,
        borderStyle: borderWidth ? 'solid' : undefined,
        borderRadius: borderRadius ? `${borderRadius}px` : undefined,
        overflow: borderRadius ? 'hidden' : undefined, // Clip content for radius
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
