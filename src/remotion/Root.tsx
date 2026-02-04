import React from 'react';
import { Composition } from 'remotion';
import { PrismComposition } from '../components/PrismComposition';
import { PrismProject, PrismAsset } from '../../types/prism';

// Default props for testing/preview in Remotion Studio
const defaultProps: { project: PrismProject; assets: Record<string, PrismAsset> } = {
  project: {
    id: 'default',

    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
    tracks: [],
    assets: {},
    backgroundColor: '#000000'
  },
  assets: {}
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PrismComposition"
      component={PrismComposition}
      durationInFrames={300} // This will be overridden by input props during render
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
      // IMPORTANT: Calculate metadata dynamically if needed, 
      // but for simple exports we pass the duration in the input props
      calculateMetadata={async ({ props }) => {
        // Use the explicit project duration if available, otherwise fallback to track max or default
        let duration = props.project?.durationInFrames;
        if (!duration && props.project?.tracks?.length > 0) {
          duration = Math.max(...props.project.tracks.map(t => t.startFrame + t.durationInFrames));
        }
        return {
          durationInFrames: duration || 300,
          width: props.project?.width || 1920,
          height: props.project?.height || 1080,
          fps: props.project?.fps || 30
        };
      }}
    />
  );
};
