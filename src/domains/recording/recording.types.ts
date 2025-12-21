// src/domains/recording/recording.types.ts
// Type definitions for recording domain

export type RecordingMode = 'AMBIENT' | 'DICTATION';
export type ConsentType = 'VERBAL' | 'WRITTEN' | 'STANDING';
export type RecordingStatus =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'TRANSCRIBING'
  | 'TRANSCRIBED'
  | 'FAILED';

export interface Recording {
  id: string;
  userId: string;
  patientId?: string | undefined;
  consultationId?: string | undefined;
  mode: RecordingMode;
  consentType: ConsentType;
  status: RecordingStatus;
  durationSeconds?: number | undefined;
  audioUrl?: string | undefined;
  transcriptId?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecordingInput {
  mode: RecordingMode;
  consentType: ConsentType;
  patientId?: string | undefined;
  consultationId?: string | undefined;
}

export interface CreateRecordingResult {
  id: string;
  uploadUrl: string;
  expiresAt: Date;
}

export interface ConfirmUploadInput {
  durationSeconds: number;
  contentType: string;
  fileSize: number;
  audioQuality?: 'excellent' | 'good' | 'fair' | 'poor' | undefined;
}

export interface UpdateRecordingInput {
  patientId?: string | null | undefined;
  mode?: RecordingMode | undefined;
  consentType?: ConsentType | undefined;
  audioQuality?: 'excellent' | 'good' | 'fair' | 'poor' | undefined;
}

export interface RecordingListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  status?: RecordingStatus | undefined;
  patientId?: string | undefined;
  mode?: RecordingMode | undefined;
}

export interface RecordingListResult {
  recordings: Recording[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface TranscriptionRequest {
  recordingId: string;
  audioUrl: string;
  mode: RecordingMode;
  callbackUrl: string;
}
