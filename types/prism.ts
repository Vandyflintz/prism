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

    // Asset Map: Central repository for external resources
    // Key = assetId (generated uuid)
    assets: {
        [assetId: string]: PrismAsset;
    };

    // Timeline Tracks: Ordered list of layers
    // Order: Bottom to Top (Track[0] is background, Track[length-1] is foreground)
    tracks: PrismTrack[];
}

export type AssetType = 'image' | 'audio' | 'font';

export interface PrismAsset {
    id: string;
    type: AssetType;
    src: string; // Remote URL (S3/MinIO)
    metadata?: {
        originalName?: string;
        mimeType?: string;
        width?: number;
        height?: number;
        // For fonts
        fontFamily?: string;
        fontWeight?: string;
    };
}

export type TrackType = 'image' | 'text' | 'shape' | 'audio';

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

    // Animation preset identifier (e.g., 'fade_in', 'slide_up')
    // The Renderer will map this string to a concrete transition function
    animation?: string;
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

    // Specific to 'text'
    content?: string; // The actual text string
    fontFamily?: string; // Should match an uploaded font or system font
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
}
