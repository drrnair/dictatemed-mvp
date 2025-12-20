// src/infrastructure/deepgram/client.ts
// Deepgram SDK client and transcription service

import { createClient, type DeepgramClient } from '@deepgram/sdk';
import { logger } from '@/lib/logger';
import { getDeepgramKeyterms } from './keyterms';
import type {
  TranscriptionRequest,
  TranscriptionOptions,
  TranscriptionResult,
  ProcessedTranscript,
  TranscriptSegment,
} from './types';

// Singleton client instance
let deepgramClient: DeepgramClient | null = null;

/**
 * Get or create the Deepgram client.
 */
export function getDeepgramClient(): DeepgramClient {
  if (!deepgramClient) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY environment variable is required');
    }
    deepgramClient = createClient(apiKey);
  }
  return deepgramClient;
}

/**
 * Default transcription options for cardiology.
 */
function getDefaultOptions(mode: 'AMBIENT' | 'DICTATION'): TranscriptionOptions {
  return {
    diarize: mode === 'AMBIENT', // Only for ambient (conversation) mode
    speakerCount: mode === 'AMBIENT' ? 2 : undefined, // Doctor + patient
    redact: true, // PHI redaction enabled
    keywords: getDeepgramKeyterms().map((k) =>
      typeof k === 'string' ? k : k.term
    ),
    language: 'en-AU', // Australian English
    model: 'nova-2-medical', // Medical-specific model
  };
}

/**
 * Submit audio for transcription via REST API with callback.
 * Returns the request ID for tracking.
 */
export async function submitTranscription(
  request: TranscriptionRequest
): Promise<string> {
  const log = logger.child({
    recordingId: request.recordingId,
    action: 'submitTranscription',
  });

  const options = getDefaultOptions(request.mode);

  log.info('Submitting transcription request', {
    mode: request.mode,
    diarize: options.diarize,
    model: options.model,
  });

  // Build query parameters for Deepgram callback API
  const params = new URLSearchParams({
    model: options.model,
    language: options.language,
    smart_format: 'true',
    punctuate: 'true',
    paragraphs: 'true',
    utterances: String(options.diarize),
    diarize: String(options.diarize),
    callback: request.callbackUrl,
  });

  // Add keywords
  for (const keyword of options.keywords.slice(0, 100)) {
    params.append('keywords', keyword);
  }

  // Add redaction if enabled
  if (options.redact) {
    params.append('redact', 'pci');
    params.append('redact', 'ssn');
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required');
  }

  try {
    // Use Deepgram REST API with callback
    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: request.audioUrl,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepgram API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const requestId = result.request_id ?? `req-${Date.now()}`;

    log.info('Transcription submitted', { requestId });
    return requestId;
  } catch (error) {
    log.error(
      'Failed to submit transcription',
      {},
      error instanceof Error ? error : undefined
    );
    throw error;
  }
}

/**
 * Process transcription result into structured format.
 */
export function processTranscriptionResult(
  recordingId: string,
  result: TranscriptionResult
): ProcessedTranscript {
  const channel = result.results.channels[0];
  if (!channel) {
    throw new Error('No channel data in transcription result');
  }

  const alternative = channel.alternatives[0];
  if (!alternative) {
    throw new Error('No alternative data in transcription result');
  }

  // Extract full text
  const fullText = alternative.transcript;

  // Build segments from utterances or words
  const segments: TranscriptSegment[] = [];
  const speakerSet = new Set<string>();

  if (result.results.utterances && result.results.utterances.length > 0) {
    // Use utterances for diarized transcripts
    for (const utterance of result.results.utterances) {
      const speakerLabel =
        utterance.speaker !== undefined
          ? `Speaker ${utterance.speaker + 1}`
          : 'Speaker';

      speakerSet.add(speakerLabel);

      segments.push({
        id: utterance.id,
        start: utterance.start,
        end: utterance.end,
        text: utterance.transcript,
        speaker: speakerLabel,
        speakerNumber: utterance.speaker,
        confidence: utterance.confidence,
        words: utterance.words,
      });
    }
  } else {
    // Create a single segment for non-diarized transcripts
    const words = alternative.words;
    if (words.length > 0) {
      const firstWord = words[0];
      const lastWord = words[words.length - 1];

      if (firstWord && lastWord) {
        segments.push({
          id: `segment-0`,
          start: firstWord.start,
          end: lastWord.end,
          text: fullText,
          confidence: alternative.confidence,
          words,
        });
      }
    }
  }

  // Calculate average confidence
  const avgConfidence =
    segments.length > 0
      ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length
      : 0;

  // Count words
  const wordCount = alternative.words.length;

  return {
    recordingId,
    fullText,
    segments,
    speakers: Array.from(speakerSet),
    duration: result.metadata.duration,
    confidence: avgConfidence,
    wordCount,
    processedAt: new Date(),
  };
}

/**
 * Transcribe audio synchronously (for testing/short clips).
 * Not recommended for production - use callback-based approach instead.
 */
export async function transcribeSync(
  audioUrl: string,
  mode: 'AMBIENT' | 'DICTATION'
): Promise<TranscriptionResult> {
  const client = getDeepgramClient();
  const options = getDefaultOptions(mode);

  const response = await client.listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: options.model,
      language: options.language,
      smart_format: true,
      punctuate: true,
      paragraphs: true,
      utterances: options.diarize,
      diarize: options.diarize,
      keywords: options.keywords,
    }
  );

  // Map SDK response to our type
  const result = response.result;
  if (!result) {
    throw new Error('No transcription result');
  }

  return {
    request_id: (result as { request_id?: string }).request_id ?? `req-${Date.now()}`,
    metadata: {
      request_id: (result as { request_id?: string }).request_id ?? `req-${Date.now()}`,
      created: new Date().toISOString(),
      duration: result.metadata?.duration ?? 0,
      channels: result.metadata?.channels ?? 1,
      models: result.metadata?.models ?? [options.model],
    },
    results: {
      channels: result.results?.channels ?? [],
      utterances: result.results?.utterances,
    },
  };
}
