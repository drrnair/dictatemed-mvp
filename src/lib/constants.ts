/**
 * Application Constants
 *
 * Centralized constants to replace magic numbers throughout the codebase.
 * Organized by domain/feature for discoverability and maintainability.
 */

// =============================================================================
// AUDIO & RECORDING
// =============================================================================

export const AUDIO = {
  /** Sample rate in Hz (CD quality is 44100, we use 48000 for broadcast quality) */
  SAMPLE_RATE: 48000,
  /** Number of audio channels (1 = mono, 2 = stereo) */
  CHANNEL_COUNT: 1,
  /** Audio bitrate in bits per second */
  BITS_PER_SECOND: 64000,
  /** FFT size for frequency analysis (power of 2) */
  FFT_SIZE: 256,
  /** Smoothing factor for audio analysis (0-1) */
  SMOOTHING_TIME_CONSTANT: 0.8,
  /** Audio level update interval in milliseconds */
  LEVEL_UPDATE_INTERVAL_MS: 50,
  /** MediaRecorder data collection interval in milliseconds */
  DATA_COLLECTION_INTERVAL_MS: 1000,
  /** Timer update interval in milliseconds */
  TIMER_UPDATE_INTERVAL_MS: 1000,
  /** Maximum audio level samples to store for quality calculation */
  MAX_LEVEL_SAMPLES: 100,
  /** Minimum samples needed for quality calculation */
  MIN_QUALITY_SAMPLES: 10,
  /** Maximum byte value for frequency data normalization (8-bit audio) */
  MAX_BYTE_VALUE: 255,
} as const;

/** Audio quality thresholds (0-1 scale, higher is better) */
export const AUDIO_QUALITY_THRESHOLDS = {
  /** Threshold for excellent audio quality */
  EXCELLENT: 0.7,
  /** Threshold for good audio quality */
  GOOD: 0.4,
  /** Threshold for fair audio quality */
  FAIR: 0.2,
} as const;

// =============================================================================
// RATE LIMITING
// =============================================================================

/** Rate limit window duration in milliseconds */
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/** Rate limits per resource type (requests per minute) */
export const RATE_LIMITS = {
  RECORDINGS: 10,
  TRANSCRIPTIONS: 5,
  DOCUMENTS: 20,
  LETTERS: 10,
  APPROVALS: 30,
  EMAILS: 10,
  STYLE_PROFILES: 30,
  STYLE_ANALYSIS: 5,
  STYLE_SEED_UPLOADS: 10,
  REFERRALS: 10,
  DEFAULT: 60,
} as const;

// =============================================================================
// PAGINATION
// =============================================================================

export const PAGINATION = {
  /** Default number of items per page */
  DEFAULT_LIMIT: 20,
  /** Maximum items per page for recordings */
  MAX_RECORDINGS_LIMIT: 100,
  /** Maximum items per page for consultations */
  MAX_CONSULTATIONS_LIMIT: 50,
  /** Number of recent activity items on dashboard */
  RECENT_ACTIVITY_COUNT: 5,
  /** Number of top subspecialties to fetch */
  TOP_SUBSPECIALTIES_COUNT: 3,
  /** Number of related specialties to fetch */
  RELATED_SPECIALTIES_COUNT: 5,
  /** Number of seed letters for style learning */
  SEED_LETTERS_LIMIT: 10,
} as const;

// =============================================================================
// SYNC & OFFLINE
// =============================================================================

export const SYNC = {
  /** Default maximum retry attempts */
  MAX_RETRIES: 3,
  /** Base retry delay in milliseconds */
  BASE_RETRY_DELAY_MS: 1000,
  /** Default concurrency limit for sync operations */
  CONCURRENCY_LIMIT: 2,
  /** Exponential backoff multiplier */
  BACKOFF_MULTIPLIER: 2,
  /** Auto-sync interval in milliseconds (30 seconds) */
  AUTO_SYNC_INTERVAL_MS: 30000,
} as const;

export const CONNECTION = {
  /** Round-trip time threshold for slow connection (milliseconds) */
  SLOW_RTT_THRESHOLD_MS: 500,
  /** Download speed threshold for slow connection (Mbps) */
  SLOW_DOWNLOAD_THRESHOLD_MBPS: 1,
} as const;

// =============================================================================
// PDF GENERATION
// =============================================================================

/** A4 page dimensions in points (1 inch = 72 points) */
export const PDF_PAGE = {
  /** A4 width in points */
  WIDTH: 595.28,
  /** A4 height in points */
  HEIGHT: 841.89,
} as const;

/** PDF margins in points (72 points = 1 inch) */
export const PDF_MARGINS = {
  TOP: 72,
  BOTTOM: 72,
  LEFT: 72,
  RIGHT: 72,
} as const;

/** PDF font sizes in points */
export const PDF_FONTS = {
  TITLE: 14,
  HEADING: 12,
  BODY: 11,
  FOOTER: 9,
  /** Line height multiplier */
  LINE_HEIGHT: 1.4,
} as const;

// =============================================================================
// AI MODEL CONFIGURATION
// =============================================================================

/** Letter type complexity scores (higher = more complex) */
export const LETTER_COMPLEXITY = {
  NEW_PATIENT: 9,
  ANGIOGRAM_PROCEDURE: 8,
  ECHO_REPORT: 5,
  FOLLOW_UP: 3,
  /** Complexity adjustment when multiple sources present */
  MULTIPLE_SOURCES_BONUS: 2,
  /** Complexity reduction when no sources present */
  NO_SOURCES_REDUCTION: 2,
  /** Complexity adjustment for complex medical documents */
  COMPLEX_DOCUMENT_BONUS: 1,
  /** Threshold for using Opus model (complexity >= this) */
  OPUS_THRESHOLD: 7,
  /** Threshold for balanced mode selection */
  BALANCED_MODE_THRESHOLD: 8,
} as const;

/** Estimated output tokens by letter type */
export const LETTER_OUTPUT_TOKENS = {
  NEW_PATIENT: 3000,
  ANGIOGRAM_PROCEDURE: 2500,
  ECHO_REPORT: 1500,
  FOLLOW_UP: 1000,
  /** Buffer to add to max tokens calculation */
  TOKEN_BUFFER: 1000,
} as const;

/** AI model generation parameters */
export const AI_MODEL = {
  /** Temperature for medical letter generation (0 = deterministic, 1 = creative) */
  LETTER_TEMPERATURE: 0.3,
  /** Temperature for style analysis */
  STYLE_TEMPERATURE: 0.2,
  /** Temperature for deterministic extraction */
  EXTRACTION_TEMPERATURE: 0,
  /** Maximum tokens for extraction/analysis tasks */
  MAX_TOKENS_EXTRACTION: 4096,
  /** Characters per token ratio for medical text estimation */
  CHARS_PER_TOKEN: 3.5,
  /** Approximate prompt template size in characters */
  PROMPT_TEMPLATE_SIZE: 3000,
} as const;

/** Token estimation constants */
export const TOKEN_ESTIMATION = {
  /** Character overhead per speaker segment */
  SPEAKER_SEGMENT_OVERHEAD: 50,
  /** Character cap for raw document text in estimation */
  DOCUMENT_TEXT_CAP: 500,
  /** Overhead for document metadata */
  DOCUMENT_METADATA_OVERHEAD: 200,
} as const;

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

export const RETRY = {
  /** Maximum retry attempts */
  MAX_RETRIES: 3,
  /** Initial retry delay in milliseconds */
  INITIAL_DELAY_MS: 1000,
  /** Alternative initial delay for longer operations */
  INITIAL_DELAY_LONG_MS: 2000,
  /** Maximum retry delay in milliseconds */
  MAX_DELAY_MS: 10000,
  /** Alternative maximum delay for critical operations */
  MAX_DELAY_CRITICAL_MS: 15000,
} as const;

// =============================================================================
// DEEPGRAM / TRANSCRIPTION
// =============================================================================

export const TRANSCRIPTION = {
  /** Number of speakers for ambient mode (Doctor + patient) */
  AMBIENT_SPEAKER_COUNT: 2,
  /** Maximum keywords to send to Deepgram API */
  MAX_KEYWORDS: 100,
} as const;

// =============================================================================
// DASHBOARD & TIME CALCULATIONS
// =============================================================================

export const TIME = {
  /** Minutes saved per approved letter (for productivity metrics) */
  MINUTES_SAVED_PER_LETTER: 15,
  /** Milliseconds in a second */
  MS_PER_SECOND: 1000,
  /** Milliseconds in a minute */
  MS_PER_MINUTE: 60000,
  /** Seconds in a minute */
  SECONDS_PER_MINUTE: 60,
  /** Minutes in an hour */
  MINUTES_PER_HOUR: 60,
  /** Hours in a day */
  HOURS_PER_DAY: 24,
  /** Days in a week */
  DAYS_PER_WEEK: 7,
} as const;

// =============================================================================
// FILE OPERATIONS
// =============================================================================

export const FILE = {
  /** Maximum filename length in characters */
  MAX_FILENAME_LENGTH: 200,
} as const;

// =============================================================================
// DISPLAY & UI
// =============================================================================

export const DISPLAY = {
  /** Length of patient initials to show */
  PATIENT_INITIALS_LENGTH: 2,
} as const;
