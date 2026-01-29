
import React from 'react';
import { usePrismStore } from '../store/usePrismStore';

export const PropertySidebar: React.FC = () => {
    const { project, selectedTrackId, updateTrack, setSelectedTrackId } = usePrismStore();

    if (!project) return null;

    const track = project.tracks.find(t => t.id === selectedTrackId);

    const handleChange = (key: string, value: any) => {
        if (!track) return;
        updateTrack(track.id, {
            props: { ...track.props, [key]: value }
        });
    };

    const props = track?.props;
    const type = track?.type;

    return (
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto text-white flex flex-col gap-6">
            <div>
                <h2 className="text-lg font-bold mb-2">Inspector</h2>
                <label className="block text-xs uppercase text-gray-400 mb-1">Active Track</label>
                <select
                    value={selectedTrackId || ''}
                    onChange={(e) => setSelectedTrackId(e.target.value || null)}
                    className="w-full bg-gray-700 rounded p-2 text-sm text-white border border-gray-600 focus:outline-none focus:border-blue-500"
                >
                    <option value="">-- Select Track --</option>
                    {project.tracks.map(t => (
                        <option key={t.id} value={t.id}>
                            {t.type.toUpperCase()} - {t.id}
                        </option>
                    ))}
                </select>
            </div>

            {!track || !props ? (
                <div className="text-gray-500 text-sm text-center mt-10">
                    Select a track to view properties
                </div>
            ) : (
                <>
                    <div className="border-b border-gray-600 pb-2">
                        <h3 className="font-bold text-gray-300">Properties</h3>
                        <div className="text-xs text-gray-500 font-mono mt-1">{track.id}</div>
                    </div>

                    <div className="space-y-4">
                        <div className="mb-4">
                            <label className="block text-xs uppercase text-gray-400 mb-1">Type</label>
                            <div className="bg-gray-700 p-2 rounded text-sm">{type}</div>
                        </div>

                        {/* Opacity */}
                        <div>
                            <label className="block text-xs uppercase text-gray-400 mb-1">Opacity</label>
                            <input
                                type="range"
                                min="0" max="1" step="0.01"
                                value={props.opacity}
                                onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        {/* Position (Visual Only) */}
                        {type !== 'audio' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs uppercase text-gray-400 mb-1">X</label>
                                    <input
                                        type="number"
                                        value={props.x}
                                        onChange={(e) => handleChange('x', parseInt(e.target.value))}
                                        className="w-full bg-gray-700 rounded p-1 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-gray-400 mb-1">Y</label>
                                    <input
                                        type="number"
                                        value={props.y}
                                        onChange={(e) => handleChange('y', parseInt(e.target.value))}
                                        className="w-full bg-gray-700 rounded p-1 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Text Specific */}
                    {type === 'text' && (
                        <div className="mt-6 border-t border-gray-600 pt-4 space-y-4">
                            <h3 className="font-semibold text-sm">Text Style</h3>

                            <div>
                                <label className="block text-xs uppercase text-gray-400 mb-1">Content</label>
                                <textarea
                                    value={props.content}
                                    onChange={(e) => handleChange('content', e.target.value)}
                                    className="w-full bg-gray-700 rounded p-2 text-sm text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs uppercase text-gray-400 mb-1">Color</label>
                                <input
                                    type="color"
                                    value={props.color || '#000000'}
                                    onChange={(e) => handleChange('color', e.target.value)}
                                    className="w-full h-10 rounded cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-xs uppercase text-gray-400 mb-1">Font Size</label>
                                <input
                                    type="number"
                                    value={props.fontSize}
                                    onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
                                    className="w-full bg-gray-700 rounded p-1 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Audio Specific */}
                    {type === 'audio' && (
                        <div className="mt-6 border-t border-gray-600 pt-4 space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-gray-400 mb-1">Volume</label>
                                <input
                                    type="range"
                                    min="0" max="1" step="0.1"
                                    value={props.volume ?? 1}
                                    onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
                                    className="w-full"
                                />
                                <div className="text-right text-xs text-gray-400">{props.volume ?? 1}</div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
