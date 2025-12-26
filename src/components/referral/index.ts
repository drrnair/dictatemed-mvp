// src/components/referral/index.ts
// Referral component exports

export { ReferralUploader } from './ReferralUploader';
export type { ReferralUploadState, ReferralUploadStatus } from './ReferralUploader';

export { ReferralReviewPanel } from './ReferralReviewPanel';
export type { ReferralReviewPanelProps } from './ReferralReviewPanel';

export { ReferralFieldGroup, ReferralContextFieldGroup } from './ReferralFieldGroup';
export type {
  FieldConfig,
  ReferralFieldGroupProps,
  ReferralContextFieldGroupProps,
} from './ReferralFieldGroup';

export { ConfidenceIndicator, ConfidenceIndicatorInline } from './ConfidenceIndicator';
export type { ConfidenceIndicatorProps } from './ConfidenceIndicator';

// Multi-document upload components
export { MultiDocumentUploader } from './MultiDocumentUploader';
export type { MultiDocumentUploaderProps } from './MultiDocumentUploader';

export { DocumentUploadQueue } from './DocumentUploadQueue';
export type { DocumentUploadQueueProps } from './DocumentUploadQueue';

export { FastExtractionResult } from './FastExtractionResult';
export type { FastExtractionResultProps } from './FastExtractionResult';

export {
  BackgroundProcessingIndicator,
  BackgroundProcessingBadge,
  BackgroundProcessingInfo,
} from './BackgroundProcessingIndicator';
export type { BackgroundProcessingIndicatorProps } from './BackgroundProcessingIndicator';
