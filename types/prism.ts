/**
 * Project Prism - Core Data Schema
 * Version: 1.0 (MVP)
 * 
 * This schema acts as the "Source of Truth" for the video project.
 * It strictly decouples the parsing logic (Module A) from the rendering logic (Module C).
 */

export interface PrismProject {
    id: string;
    width: number; // Canvas width, e.g., 1080
    height: number; // Canvas height, e.g., 1920
    fps: number; // Frames per second, e.g., 30
    durationInFrames: number; // Total duration of the video
    backgroundColor?: string; // Global canvas background color

    // Asset Map: Central repository for external resources
    // Key = assetId (generated uuid)
    assets: {
        [assetId: string]: PrismAsset;
    };

    // Timeline Tracks: Ordered list of layers
    // Order: Bottom to Top (Track[0] is background, Track[length-1] is foreground)
    tracks: PrismTrack[];
}

export type AssetType = 'image' | 'audio' | 'video' | 'font' | 'psd';

export interface PrismAsset {
    id: string;
    type: AssetType;
    src: string; // Remote URL (S3/MinIO)
    metadata?: {
        originalName?: string;
        mimeType?: string;
        width?: number;
        height?: number;
        duration?: number; // Video duration
        // For fonts
        fontFamily?: string;
        fontWeight?: string;
        // For PSDs
        layers?: PsdLayerSummary[];
        // Full parsed project for Drag & Drop
        psdProject?: PrismProject;
        // Internal assets (e.g. PSD layers) hidden from library
        isInternal?: boolean;
        createdAt?: number;
    };
}

export interface PsdLayerSummary {
    id: string; // Unique ID within the PSD asset scope
    name: string;
    type: 'image' | 'text' | 'group';
    visible: boolean;
    // For images, we might have a blob URL for their rendered content
    src?: string;
    // For text
    text?: string;
    // Dimensions relative to PSD canvas
    width: number;
    height: number;
    left: number;
    top: number;
    children?: PsdLayerSummary[]; // For groups
}

export type TrackType = 'image' | 'video' | 'text' | 'shape' | 'audio';

export interface PrismTrack {
    id: string; // Unique layer ID
    type: TrackType;
    startFrame: number; // When the layer appears (absolute frame)
    durationInFrames: number; // How long it stays visible

    // Track State
    locked?: boolean;
    visible?: boolean;
    muted?: boolean; // Audio only

    // Visual properties directly mapped to CSS/Remotion style props
    props: LayerProps;

    // Unified Animation System
    // Entrance (Transitions)
    entrance?: string; // 'fade_in', 'slide_left', 'zoom_in', etc.
    entranceDuration?: number; // Frames (default 30)

    // Motion (Looping)
    motion?: string; // 'pulse', 'shake', 'wiggle', 'spin', 'ken_burns'
    motionSpeed?: number; // Duration of 1 cycle in frames (default 60 or 90)
    motionRepeat?: number; // 0 = infinite, 1 = once, 2 = twice, etc.

    // Legacy (Deprecated) - kept for backward compatibility if needed
    animation?: string;
    transitionDuration?: number;
}

export interface LayerProps {
    // Positioning & Dimensions
    x: number; // Left position in px
    y: number; // Top position in px
    width: number; // Width in px
    height: number; // Height in px

    // Transform & Style
    opacity: number; // 0 to 1
    rotation: number; // Degrees
    scale: number; // 1 = 100%

    // Audio props
    volume?: number;
    playbackRate?: number; // Default 1.0 (Pitch)
    bass?: number; // dB boost (default 0)
    treble?: number; // dB boost (default 0)
    pan?: number; // Stereo pan (-1 to 1, default 0)
    fadeInDuration?: number; // Duration in seconds (default 0)
    fadeOutDuration?: number; // Duration in seconds (default 0)

    // Specific to 'text'
    content?: string; // The actual text string
    fontFamily?: string; // Should match an uploaded font or system font
    fontWeight?: string;
    fontSize?: number; // px
    color?: string; // Hex code or rgba
    textAlign?: 'left' | 'center' | 'right';
    textStrokeWidth?: number;
    textStrokeColor?: string;
    textShadow?: string;

    // Specific to 'image' (or shape referencing an asset)
    assetId?: string; // Reference to `project.assets`
    borderWidth?: number;
    borderColor?: string;

    // Specific to 'shape'
    backgroundColor?: string;
    borderRadius?: number;

    // Raster fallback for text
    isRasterized?: boolean;

    // Clipping Mask Props
    mask?: {
        x: number;
        y: number;
        width: number;
        height: number;
        radius?: number;
    };
    // Animation Duration in frames
    transitionDuration?: number;

    // Media Start Offset (for slipping audio/video)
    mediaOffset?: number;

    // Image Crop & Fit Props
    objectFit?: 'cover' | 'contain' | 'fill' | 'none'; // Default 'cover'
    contentX?: number; // Offset X of the image content relative to the layer center (when objectFit is none/manual)
    contentY?: number; // Offset Y
    contentScale?: number; // Scale of the image content (Zoom) within the layer

    // Visual Filters (Color Correction)
    brightness?: number; // Default 1
    contrast?: number; // Default 1
    saturate?: number; // Default 1
    grayscale?: number; // Default 0 (0-1)
    blur?: number; // Default 0 (px)
}
