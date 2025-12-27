// src/hooks/queries/index.ts
// Barrel export for all React Query hooks

// Re-export queryKeys for external cache invalidation
export { queryKeys } from '@/lib/react-query';

// Letters
export {
  useLettersQuery,
  useLetterQuery,
  useLetterStatsQuery,
  useCreateLetterMutation,
  useUpdateLetterMutation,
  useApproveLetterMutation,
  useSendLetterMutation,
  useDeleteLetterMutation,
  type Letter,
  type LetterType,
  type LetterStatus,
  type LetterStats,
  type LetterFilters,
  type LetterListResponse,
  type CreateLetterInput,
  type UpdateLetterInput,
} from './useLettersQuery';

// Recordings
export {
  useRecordingsQuery,
  useRecordingQuery,
  useRecordingPollQuery,
  useCreateRecordingMutation,
  useUpdateRecordingMutation,
  useGetUploadUrlMutation,
  useTranscribeRecordingMutation,
  useDeleteRecordingMutation,
  type Recording,
  type RecordingStatus,
  type RecordingMode,
  type RecordingFilters,
  type RecordingListResponse,
  type CreateRecordingInput,
  type UpdateRecordingInput,
  type UploadUrlResponse,
} from './useRecordingsQuery';

// Documents
export {
  useDocumentsQuery,
  useDocumentQuery,
  useDocumentPollQuery,
  useUploadDocumentMutation,
  useProcessDocumentMutation,
  useDeleteDocumentMutation,
  type Document,
  type DocumentType,
  type DocumentStatus,
  type DocumentFilters,
  type DocumentListResponse,
  type UploadDocumentInput,
} from './useDocumentsQuery';

// Patients
export {
  usePatientsQuery,
  usePatientQuery,
  useRecentPatientsQuery,
  useCreatePatientMutation,
  useUpdatePatientMutation,
  useDeletePatientMutation,
  type Patient,
  type PatientFilters,
  type PatientListResponse,
  type CreatePatientInput,
  type UpdatePatientInput,
} from './usePatientsQuery';

// Practice Profile
export {
  usePracticeProfileQuery,
  useSavePracticeProfileMutation,
  useCreateCustomSpecialtyMutation,
  useCreateCustomSubspecialtyMutation,
  type SaveProfileInput,
  type SpecialtySelectionInput,
  type SubspecialtySelectionInput,
} from './usePracticeProfileQuery';
