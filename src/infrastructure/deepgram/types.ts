// src/infrastructure/deepgram/types.ts
// Type definitions for Deepgram transcription

export interface TranscriptionRequest {
  recordingId: string;
  audioUrl: string;
  mode: 'AMBIENT' | 'DICTATION';
  callbackUrl: string;
}

export interface TranscriptionOptions {
  /** Enable speaker diarization for ambient mode */
  diarize: boolean;
  /** Number of expected speakers (for diarization) */
  speakerCount?: number | undefined;
  /** Enable PHI redaction */
  redact: boolean;
  /** Custom vocabulary terms */
  keywords: string[];
  /** Language code */
  language: string;
  /** Model to use */
  model: string;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word: string;
  speaker?: number | undefined;
}

export interface TranscriptUtterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: TranscriptWord[];
  speaker?: number | undefined;
  id: string;
}

export interface TranscriptChannel {
  alternatives: Array<{
    transcript: string;
    confidence: number;
    words: TranscriptWord[];
  }>;
}

export interface TranscriptionResult {
  request_id: string;
  metadata: {
    request_id: string;
    created: string;
    duration: number;
    channels: number;
    models: string[];
  };
  results: {
    channels: TranscriptChannel[];
    utterances?: TranscriptUtterance[] | undefined;
  };
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string | undefined;
  speakerNumber?: number | undefined;
  confidence: number;
  words: TranscriptWord[];
}

export interface ProcessedTranscript {
  recordingId: string;
  fullText: string;
  segments: TranscriptSegment[];
  speakers: string[];
  duration: number;
  confidence: number;
  wordCount: number;
  processedAt: Date;
}

export interface WebhookPayload {
  request_id: string;
  metadata: {
    request_id: string;
    transaction_key: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
    models: string[];
  };
  results: {
    channels: TranscriptChannel[];
    utterances?: TranscriptUtterance[] | undefined;
  };
}

export interface WebhookCallbackData {
  recordingId: string;
  status: 'success' | 'error';
  error?: string | undefined;
  result?: TranscriptionResult | undefined;
}
