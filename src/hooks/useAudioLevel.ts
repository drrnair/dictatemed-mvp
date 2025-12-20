// src/hooks/useAudioLevel.ts
// Real-time audio level monitoring hook

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAudioLevelOptions {
  /** FFT size for frequency analysis (default: 256) */
  fftSize?: number;
  /** Update interval in ms (default: 50) */
  updateInterval?: number;
  /** Smoothing time constant (default: 0.8) */
  smoothingTimeConstant?: number;
}

interface UseAudioLevelReturn {
  level: number; // 0-1 normalized audio level
  peak: number; // Peak level in current session
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => void;
  error: string | null;
}

const DEFAULT_OPTIONS: Required<UseAudioLevelOptions> = {
  fftSize: 256,
  updateInterval: 50,
  smoothingTimeConstant: 0.8,
};

export function useAudioLevel(
  options: UseAudioLevelOptions = {}
): UseAudioLevelReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const calculateLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate RMS (root mean square) level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] ?? 0) / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    setLevel(rms);
    setPeak((prev) => Math.max(prev, rms));
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      cleanup();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = opts.fftSize;
      analyserRef.current.smoothingTimeConstant = opts.smoothingTimeConstant;

      source.connect(analyserRef.current);

      intervalRef.current = setInterval(calculateLevel, opts.updateInterval);
      setIsActive(true);
      setPeak(0);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      setIsActive(false);
    }
  }, [cleanup, calculateLevel, opts.fftSize, opts.smoothingTimeConstant, opts.updateInterval]);

  const stop = useCallback(() => {
    cleanup();
    setIsActive(false);
    setLevel(0);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    level,
    peak,
    isActive,
    start,
    stop,
    error,
  };
}
