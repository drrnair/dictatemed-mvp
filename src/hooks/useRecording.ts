// src/hooks/useRecording.ts
// Recording state management hook with MediaRecorder integration

'use client';

import { useCallback, useRef, useState } from 'react';
import { AUDIO, AUDIO_QUALITY_THRESHOLDS } from '@/lib/constants';

export type RecordingMode = 'AMBIENT' | 'DICTATION';
export type ConsentType = 'VERBAL' | 'WRITTEN' | 'STANDING';
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';
export type AudioQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface RecordingConfig {
  mode: RecordingMode;
  consentType: ConsentType;
  patientId?: string | undefined;
}

export interface RecordingResult {
  blob: Blob;
  durationSeconds: number;
  quality: AudioQuality;
}

interface UseRecordingReturn {
  state: RecordingState;
  mode: RecordingMode;
  durationSeconds: number;
  audioLevel: number;
  quality: AudioQuality;
  error: string | null;
  start: (config: RecordingConfig) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<RecordingResult>;
  reset: () => void;
}

// Audio constraints for optimal quality
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: AUDIO.SAMPLE_RATE,
  channelCount: AUDIO.CHANNEL_COUNT,
};

// MediaRecorder options
const RECORDER_OPTIONS: MediaRecorderOptions = {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: AUDIO.BITS_PER_SECOND,
};

export function useRecording(): UseRecordingReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [mode, setMode] = useState<RecordingMode>('AMBIENT');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [quality, setQuality] = useState<AudioQuality>('good');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const audioLevelSamplesRef = useRef<number[]>([]);

  // Clean up resources
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    analyserRef.current = null;
  }, []);

  // Calculate audio quality from samples
  const calculateQuality = useCallback((): AudioQuality => {
    const samples = audioLevelSamplesRef.current;
    if (samples.length < AUDIO.MIN_QUALITY_SAMPLES) return 'good';

    const avgLevel =
      samples.reduce((sum, val) => sum + val, 0) / samples.length;

    if (avgLevel >= AUDIO_QUALITY_THRESHOLDS.EXCELLENT) return 'excellent';
    if (avgLevel >= AUDIO_QUALITY_THRESHOLDS.GOOD) return 'good';
    if (avgLevel >= AUDIO_QUALITY_THRESHOLDS.FAIR) return 'fair';
    return 'poor';
  }, []);

  // Update audio level from analyser
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || state !== 'recording') return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate RMS level
    const sum = dataArray.reduce(
      (acc, val) => acc + (val / AUDIO.MAX_BYTE_VALUE) * (val / AUDIO.MAX_BYTE_VALUE),
      0
    );
    const rms = Math.sqrt(sum / dataArray.length);
    setAudioLevel(rms);

    // Store sample for quality calculation
    audioLevelSamplesRef.current.push(rms);
    if (audioLevelSamplesRef.current.length > AUDIO.MAX_LEVEL_SAMPLES) {
      audioLevelSamplesRef.current.shift();
    }

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [state]);

  // Start recording
  const start = useCallback(
    async (config: RecordingConfig) => {
      try {
        setError(null);
        setMode(config.mode);
        chunksRef.current = [];
        audioLevelSamplesRef.current = [];

        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
        });
        streamRef.current = stream;

        // Set up audio analysis
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = AUDIO.FFT_SIZE;
        source.connect(analyserRef.current);

        // Check MediaRecorder support
        let options = RECORDER_OPTIONS;
        if (!MediaRecorder.isTypeSupported(RECORDER_OPTIONS.mimeType!)) {
          options = { mimeType: 'audio/webm' };
          if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
            options = { mimeType: 'audio/mp4' };
          }
        }

        // Create MediaRecorder
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onerror = () => {
          setError('Recording error occurred');
          cleanup();
          setState('idle');
        };

        // Start recording
        recorder.start(AUDIO.DATA_COLLECTION_INTERVAL_MS); // Collect data every second
        startTimeRef.current = Date.now();
        setState('recording');

        // Start timer
        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / AUDIO.TIMER_UPDATE_INTERVAL_MS);
          setDurationSeconds(elapsed);
        }, AUDIO.TIMER_UPDATE_INTERVAL_MS);

        // Start audio level monitoring
        updateAudioLevel();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start recording';
        setError(message);
        cleanup();
        setState('idle');
      }
    },
    [cleanup, updateAudioLevel]
  );

  // Pause recording
  const pause = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [state]);

  // Resume recording
  const resume = useCallback(() => {
    if (mediaRecorderRef.current && state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');

      // Resume timer from current duration
      const pausedDuration = durationSeconds;
      startTimeRef.current = Date.now() - pausedDuration * AUDIO.TIMER_UPDATE_INTERVAL_MS;
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / AUDIO.TIMER_UPDATE_INTERVAL_MS);
        setDurationSeconds(elapsed);
      }, AUDIO.TIMER_UPDATE_INTERVAL_MS);

      updateAudioLevel();
    }
  }, [state, durationSeconds, updateAudioLevel]);

  // Stop recording
  const stop = useCallback((): Promise<RecordingResult> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error('No recording in progress'));
        return;
      }

      const recorder = mediaRecorderRef.current;

      recorder.onstop = () => {
        const finalQuality = calculateQuality();
        setQuality(finalQuality);

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        cleanup();
        setState('stopped');

        resolve({
          blob,
          durationSeconds,
          quality: finalQuality,
        });
      };

      recorder.stop();
    });
  }, [durationSeconds, calculateQuality, cleanup]);

  // Reset to initial state
  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setMode('AMBIENT');
    setDurationSeconds(0);
    setAudioLevel(0);
    setQuality('good');
    setError(null);
    chunksRef.current = [];
    audioLevelSamplesRef.current = [];
  }, [cleanup]);

  return {
    state,
    mode,
    durationSeconds,
    audioLevel,
    quality,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
