'use client';

// src/components/recording/RecordingSection.tsx
// Unified recording section with mode selector and controls

import { useState, useRef, useCallback } from 'react';
import { Upload, Loader2, FileAudio, AlertCircle } from 'lucide-react';
import { RecordingModeSelector, type RecordingMode } from './RecordingModeSelector';
import { RecordingControls, RecordingTimer } from './RecordingControls';
import { WaveformVisualizer } from './WaveformVisualizer';
import { AudioQualityIndicator } from './AudioQualityIndicator';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface RecordingSectionProps {
  disabled?: boolean;
  consultationId?: string;
  onRecordingComplete?: (recordingId: string) => void;
}

const AUDIO_TYPES = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm', 'audio/mpeg'];
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB

export function RecordingSection({
  disabled = false,
  consultationId,
  onRecordingComplete,
}: RecordingSectionProps) {
  const [mode, setMode] = useState<RecordingMode>('DICTATION');

  // Recording state (using existing patterns from the codebase)
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle');
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [quality, setQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start recording
  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis for visualizer
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.start();
      setRecordingState('recording');
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);

        // Update audio level
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, []);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          // Here we would queue the recording for upload
          // For now, just mark as complete
          setRecordingState('stopped');
          // onRecordingComplete would be called after upload
        }
      };
    }

    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setRecordingState('stopped');
  }, []);

  // Handle file selection for upload mode
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileExtension = file.type.split('/')[1] || '';
    if (!AUDIO_TYPES.some((type) => {
      const ext = type.split('/')[1] || '';
      return file.type.includes(ext) || fileExtension === ext;
    })) {
      setError('Invalid audio format. Please upload MP3, WAV, M4A, OGG, or WebM.');
      return;
    }

    // Validate file size
    if (file.size > MAX_AUDIO_SIZE) {
      setError('File too large. Maximum size is 100MB.');
      return;
    }

    setError(null);
    setUploadFile(file);

    // Get audio duration
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      setAudioDuration(Math.floor(audio.duration));
      URL.revokeObjectURL(audio.src);
    };
  }, []);

  // Upload the selected file
  const uploadAudioFile = useCallback(async () => {
    if (!uploadFile) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Create recording entry
      const createResponse = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'DICTATION', // Upload defaults to dictation
          durationSeconds: audioDuration,
          consultationId,
        }),
      });

      if (!createResponse.ok) throw new Error('Failed to create recording');

      const { recording, uploadUrl } = await createResponse.json();
      setUploadProgress(20);

      // Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: uploadFile,
        headers: { 'Content-Type': uploadFile.type },
      });

      if (!uploadResponse.ok) throw new Error('Failed to upload file');
      setUploadProgress(70);

      // Confirm upload
      await fetch(`/api/recordings/${recording.id}/upload`, {
        method: 'POST',
      });
      setUploadProgress(100);

      onRecordingComplete?.(recording.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [uploadFile, audioDuration, consultationId, onRecordingComplete]);

  // Reset upload
  const clearUpload = useCallback(() => {
    setUploadFile(null);
    setAudioDuration(null);
    setUploadProgress(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const isRecording = recordingState === 'recording' || recordingState === 'paused';

  return (
    <div className="space-y-space-6">
      {/* Mode selector */}
      <RecordingModeSelector
        value={mode}
        onChange={setMode}
        disabled={disabled || isRecording || uploading}
      />

      {/* Error display */}
      {error && (
        <div
          className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4 text-rose-600 dark:text-rose-400"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Recording UI (Ambient/Dictation modes) */}
      {mode !== 'UPLOAD' && (
        <div className={cn('space-y-space-6', disabled && 'opacity-50 pointer-events-none')}>
          {/* Waveform visualizer */}
          <div className="flex justify-center">
            <WaveformVisualizer
              isActive={recordingState === 'recording'}
              audioLevel={audioLevel}
            />
          </div>

          {/* Timer */}
          <div className="text-center">
            <RecordingTimer
              durationSeconds={duration}
              state={recordingState}
            />
          </div>

          {/* Quality indicator (shown during recording) */}
          {isRecording && (
            <div className="flex justify-center">
              <AudioQualityIndicator quality={quality} audioLevel={audioLevel} />
            </div>
          )}

          {/* Recording controls */}
          <div className="flex justify-center">
            <RecordingControls
              state={recordingState}
              onStart={startRecording}
              onPause={pauseRecording}
              onResume={resumeRecording}
              onStop={stopRecording}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Upload UI */}
      {mode === 'UPLOAD' && (
        <div className={cn('space-y-space-4', disabled && 'opacity-50 pointer-events-none')}>
          {!uploadFile ? (
            // File selection
            <div className="rounded-lg border-2 border-dashed border-border/60 p-space-8 text-center transition-colors duration-150 hover:border-primary/40 hover:bg-primary/5">
              <FileAudio className="mx-auto h-10 w-10 text-muted-foreground mb-space-4" aria-hidden="true" />
              <p className="text-label font-medium mb-space-1">Upload existing audio</p>
              <p className="text-caption text-muted-foreground mb-space-4">
                MP3, WAV, M4A, OGG, WebM up to 100MB
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Select Audio File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={AUDIO_TYPES.join(',')}
                onChange={handleFileSelect}
                disabled={disabled}
                aria-label="Select audio file to upload"
              />
            </div>
          ) : (
            // File selected - show details and upload button
            <div className="rounded-lg border border-border/60 p-space-4 space-y-space-4 shadow-card">
              <div className="flex items-center gap-space-3">
                <div className="rounded-lg bg-muted p-space-2">
                  <FileAudio className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-label font-medium truncate">{uploadFile.name}</p>
                  <p className="text-caption text-muted-foreground">
                    {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
                    {audioDuration && ` • ${formatDuration(audioDuration)}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearUpload}
                  disabled={uploading}
                >
                  Change
                </Button>
              </div>

              {uploading && (
                <div className="space-y-space-1" role="status" aria-live="polite">
                  <Progress value={uploadProgress} />
                  <p className="text-caption text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={uploadAudioFile}
                disabled={uploading || disabled}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Upload Audio
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
