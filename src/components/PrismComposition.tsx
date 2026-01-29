import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
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
                        durationInFrames={track.durationInFrames}
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
    const { x, y, width, height, opacity, rotation, scale, content, color, fontSize, fontFamily, assetId } = props;

    // Common styles
    const style: React.CSSProperties = {
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        transform: `rotate(${rotation}deg) scale(${scale})`,
    };

    if (type === 'text') {
        return (
            <div style={{
                ...style,
                color: color || '#000',
                fontSize: fontSize || 40,
                fontFamily: fontFamily || 'sans-serif',
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'pre-wrap', // Preserves newlines from PSD
            }}>
                {content}
            </div>
        );
    }

    if (type === 'image') {
        const asset = assetId ? project.assets[assetId] : null;

        if (!asset) {
            console.warn(`Missing asset for track: ${track.id}`);
            return <div style={{ ...style, border: '2px dashed red' }}>Missing Asset</div>;
        }

        // --- THE FIX: Path Normalization ---
        let finalSrc = asset.src;

        // Debugging: Check the console to see what path is failing
        // console.log(`Loading Image [${track.id}]:`, finalSrc);

        // 1. Handle Windows paths (backslashes)
        if (finalSrc.includes('\\')) {
            finalSrc = finalSrc.replace(/\\/g, '/');
        }

        // 2. If it's a local path and doesn't have a protocol, add file://
        // Note: This only works in Electron. In a normal browser, this will still fail.
        if (!finalSrc.startsWith('http') && !finalSrc.startsWith('file://') && !finalSrc.startsWith('blob:')) {
            if (finalSrc.startsWith('/')) {
                finalSrc = `file://${finalSrc}`;
            } else {
                // It's likely a Windows absolute path starting with C:/
                finalSrc = `file:///${finalSrc}`;
            }
        }
        // -----------------------------------

        return (
            <img
                src={finalSrc}
                style={{
                    ...style,
                    objectFit: 'contain',
                }}
                crossOrigin="anonymous"
                onError={(e) => {
                    console.error("Failed to load image:", finalSrc);
                }}
            />
        );
    }

    if (type === 'audio') {
        const asset = assetId ? project.assets[assetId] : null;
        if (!asset) return null;
        // Same normalization logic might be needed for audio
        return <Audio src={asset.src} volume={props.volume ?? 1} />;
    }

    return <div style={{ ...style, backgroundColor: 'rgba(255,0,0,0.3)' }} />;
};
