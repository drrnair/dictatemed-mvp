// src/components/recording/index.ts
// Export all recording components

export { ModeSelector, type RecordingMode } from './ModeSelector';
export {
  RecordingControls,
  RecordingTimer,
  type RecordingState,
} from './RecordingControls';
export { WaveformVisualizer, AudioLevelBar } from './WaveformVisualizer';
export {
  AudioQualityIndicator,
  QualityBadge,
  type AudioQuality,
} from './AudioQualityIndicator';
export { ConsentDialog, type ConsentType } from './ConsentDialog';
export { TranscriptViewer, type TranscriptViewerProps } from './TranscriptViewer';
export { SpeakerSegment, CompactSegment } from './SpeakerSegment';
