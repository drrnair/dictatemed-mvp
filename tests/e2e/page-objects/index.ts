// tests/e2e/page-objects/index.ts
// Central export for all page objects

export { BasePage } from './BasePage';
export { LoginPage } from './LoginPage';
export { DashboardPage } from './DashboardPage';
export { NewConsultationPage } from './NewConsultationPage';
export { ReferralUploadPage } from './ReferralUploadPage';
export { LetterDetailPage } from './LetterDetailPage';

// Re-export types
export type { LetterType, RecordingMode, RecordingState } from './NewConsultationPage';
export type {
  ExtractionState,
  ExtractedReferralData,
} from './ReferralUploadPage';
export type {
  LetterStatus,
  SendDialogStep,
  LetterRecipient,
} from './LetterDetailPage';
