
import React from 'react';
import { AbsoluteFill, Sequence, Img, Audio } from 'remotion';
import { PrismProject, PrismTrack } from '../../types/prism';

export const PrismComposition: React.FC<{ project: PrismProject }> = ({ project }) => {
    // const { width, height } = useVideoConfig(); 
    // Ideally comp dims match project dims.

    if (!project) return null;

    return (
        <AbsoluteFill style={{ backgroundColor: '#ffffff' }}>
            {project.tracks.map((track) => {
                return (
                    <Sequence
                        key={track.id}
                        from={track.startFrame}
                        durationInFrames={track.durationInFrames}
                        layout="none" // Important so we can control positioning absolutely
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

    const style: React.CSSProperties = {
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        transform: `rotate(${rotation}deg) scale(${scale})`,
        // Basic styling
    };

    if (type === 'text') {
        return (
            <div style={{
                ...style,
                color: color || '#000',
                fontSize: fontSize || 40,
                fontFamily: fontFamily || 'sans-serif',
                display: 'flex',
                alignItems: 'center', // MVP alignment
            }}>
                {content}
            </div>
        );
    }

    if (type === 'image') {
        const asset = assetId ? project.assets[assetId] : null;
        if (!asset) return <div style={style}>Missing Asset</div>;

        return (
            <Img
                src={asset.src}
                style={{
                    ...style,
                    objectFit: 'contain', // or cover? MVP
                }}
            />
        );
    }

    if (type === 'audio') {
        const asset = assetId ? project.assets[assetId] : null;
        if (!asset) return null;
        return <Audio src={asset.src} volume={props.volume ?? 1} />;
    }

    // Fallback for shapes or others
    return <div style={{ ...style, backgroundColor: 'red' }} />;
};
