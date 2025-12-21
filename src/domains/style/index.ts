// src/domains/style/index.ts
// Unified export for style learning functionality

export {
  recordEdit,
  analyzeStyle,
  getStyleProfile,
  applyStyleHints,
  getEditStatistics,
} from './style.service';

export {
  analyzeEditsForStyle,
  mergeStyleAnalysis,
} from './style-analyzer';

export type {
  StyleProfile,
  StyleEdit,
  StyleAnalysisResult,
  StyleHints,
  AnalyzeStyleRequest,
  StyleEditModel,
} from './style.types';
