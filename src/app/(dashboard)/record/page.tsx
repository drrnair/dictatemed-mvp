// src/app/(dashboard)/record/page.tsx
// Recording page with dual-mode audio capture and file upload

'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ModeSelector,
  RecordingControls,
  RecordingTimer,
  WaveformVisualizer,
  AudioQualityIndicator,
  ConsentDialog,
  type RecordingMode,
  type ConsentType,
} from '@/components/recording';
import { useRecording } from '@/hooks/useRecording';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { logger } from '@/lib/logger';
import { AlertCircle, Loader2, Cloud, CloudOff, Upload, FileAudio, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const recordLogger = logger.child({ action: 'recording' });

export default function RecordPage() {
  const [selectedMode, setSelectedMode] = useState<RecordingMode>('AMBIENT');
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const consentTypeRef = useRef<ConsentType>('VERBAL');

  const {
    state,
    durationSeconds,
    audioLevel,
    quality,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
  } = useRecording();

  const {
    pendingCount,
    syncStatus,
    isOnline,
    queueRecording,
    syncNow,
  } = useOfflineQueue();

  // Handle starting a recording
  const handleStartClick = useCallback(() => {
    setShowConsentDialog(true);
  }, []);

  // Handle consent confirmation
  const handleConsentConfirm = useCallback(
    async (consentType: ConsentType) => {
      setShowConsentDialog(false);
      consentTypeRef.current = consentType;
      await start({
        mode: selectedMode,
        consentType,
      });
    },
    [selectedMode, start]
  );

  // Handle consent cancellation
  const handleConsentCancel = useCallback(() => {
    setShowConsentDialog(false);
  }, []);

  // Handle stopping the recording
  const handleStop = useCallback(async () => {
    try {
      setIsSaving(true);
      const result = await stop();

      // Queue recording for upload (works offline)
      await queueRecording({
        mode: selectedMode,
        consentType: consentTypeRef.current,
        audioBlob: result.blob,
        durationSeconds: result.durationSeconds,
      });

      // Reset after a short delay to show completion state
      setTimeout(() => {
        reset();
        setIsSaving(false);
      }, 1000);
    } catch (err) {
      recordLogger.error('Failed to save recording', {}, err instanceof Error ? err : new Error(String(err)));
      setIsSaving(false);
    }
  }, [stop, reset, queueRecording, selectedMode]);

  const isRecording = state === 'recording' || state === 'paused';

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/ogg', 'audio/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
      setUploadError('Please upload an audio file (MP3, WAV, M4A, OGG, or WebM)');
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File size must be less than 100MB');
      return;
    }

    setUploadedFile(file);
    setUploadError(null);
    setUploadProgress('idle');
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async () => {
    if (!uploadedFile) return;

    try {
      setUploadProgress('uploading');
      setUploadError(null);

      // Read file as blob
      const audioBlob = uploadedFile;

      // Get audio duration
      const audio = new Audio();
      const durationPromise = new Promise<number>((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          resolve(audio.duration);
        });
        audio.addEventListener('error', () => {
          resolve(0); // Default to 0 if we can't get duration
        });
      });
      audio.src = URL.createObjectURL(audioBlob);

      const duration = await durationPromise;
      URL.revokeObjectURL(audio.src);

      // Queue recording for upload
      await queueRecording({
        mode: selectedMode,
        consentType: 'VERBAL', // Default consent type for uploads
        audioBlob,
        durationSeconds: Math.round(duration),
      });

      setUploadProgress('success');

      // Reset after showing success
      setTimeout(() => {
        setUploadedFile(null);
        setUploadProgress('idle');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    } catch (err) {
      recordLogger.error('Failed to upload file', {}, err instanceof Error ? err : new Error(String(err)));
      setUploadProgress('error');
      setUploadError(err instanceof Error ? err.message : 'Failed to upload file');
    }
  }, [uploadedFile, queueRecording, selectedMode]);

  // Clear selected file
  const handleClearFile = useCallback(() => {
    setUploadedFile(null);
    setUploadError(null);
    setUploadProgress('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with status */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Record</h1>
          <p className="text-muted-foreground">
            Start a new consultation recording session.
          </p>
        </div>

        {/* Network and sync status */}
        <div className="flex items-center gap-2">
          {/* Network indicator */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              isOnline
                ? 'bg-green-500/10 text-green-600'
                : 'bg-destructive/10 text-destructive'
            )}
          >
            {isOnline ? (
              <Cloud className="h-3.5 w-3.5" />
            ) : (
              <CloudOff className="h-3.5 w-3.5" />
            )}
            {isOnline ? 'Online' : 'Offline'}
          </div>

          {/* Pending recordings */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => syncNow()}
              disabled={!isOnline || syncStatus === 'syncing'}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                'bg-primary/10 text-primary',
                'hover:bg-primary/20 transition-colors',
                (!isOnline || syncStatus === 'syncing') && 'opacity-50 cursor-not-allowed'
              )}
            >
              {syncStatus === 'syncing' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {pendingCount} pending
            </button>
          )}
        </div>
      </div>

      {/* Mode selector */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Recording Mode
        </h2>
        <ModeSelector
          mode={selectedMode}
          onModeChange={setSelectedMode}
          disabled={isRecording}
        />
      </div>

      {/* Recording interface */}
      <div className="rounded-lg border border-border bg-card p-6">
        {/* Waveform visualizer */}
        <WaveformVisualizer
          audioLevel={audioLevel}
          isActive={state === 'recording'}
          className="mb-6"
        />

        {/* Timer */}
        <div className="mb-6">
          <RecordingTimer durationSeconds={durationSeconds} state={state} />
        </div>

        {/* Recording controls */}
        <RecordingControls
          state={state}
          onStart={handleStartClick}
          onPause={pause}
          onResume={resume}
          onStop={handleStop}
          disabled={isSaving}
        />

        {/* Error message */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Saving indicator */}
        {isSaving && (
          <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-sm">Saving recording...</p>
          </div>
        )}
      </div>

      {/* Audio quality indicator (visible during recording) */}
      {isRecording && (
        <AudioQualityIndicator quality={quality} audioLevel={audioLevel} />
      )}

      {/* File Upload Section */}
      {!isRecording && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Or Upload an Audio File
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload a pre-recorded dictation or ambient consultation recording for transcription.
          </p>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!uploadedFile ? (
            /* Drop zone / Upload button */
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'w-full cursor-pointer rounded-lg border-2 border-dashed border-border p-8',
                'flex flex-col items-center justify-center gap-3',
                'transition-colors hover:border-primary hover:bg-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
              )}
            >
              <FileAudio className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Click to upload audio file</p>
                <p className="text-sm text-muted-foreground">
                  MP3, WAV, M4A, OGG, or WebM (max 100MB)
                </p>
              </div>
            </button>
          ) : (
            /* Selected file preview */
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClearFile}
                  className="rounded-full p-1 hover:bg-muted"
                  disabled={uploadProgress === 'uploading'}
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Upload button */}
              <div className="mt-4 flex items-center gap-3">
                <Button
                  onClick={handleFileUpload}
                  disabled={uploadProgress === 'uploading' || uploadProgress === 'success'}
                  className="flex-1"
                >
                  {uploadProgress === 'uploading' && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {uploadProgress === 'success' && (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {uploadProgress === 'idle' && 'Upload & Transcribe'}
                  {uploadProgress === 'uploading' && 'Uploading...'}
                  {uploadProgress === 'success' && 'Uploaded!'}
                  {uploadProgress === 'error' && 'Retry Upload'}
                </Button>
              </div>
            </div>
          )}

          {/* Upload error */}
          {uploadError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{uploadError}</p>
            </div>
          )}
        </div>
      )}

      {/* Recording tips */}
      {!isRecording && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <h3 className="mb-2 font-medium">Recording Tips</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>Ensure you&apos;re in a quiet environment</li>
            <li>Position the microphone 15-30cm from your mouth</li>
            <li>Speak clearly at a consistent volume</li>
            <li>
              {selectedMode === 'AMBIENT'
                ? 'Both patient and physician voices will be captured'
                : 'Dictate clearly for optimal transcription'}
            </li>
          </ul>
        </div>
      )}

      {/* Consent dialog */}
      <ConsentDialog
        isOpen={showConsentDialog}
        onConfirm={handleConsentConfirm}
        onCancel={handleConsentCancel}
      />
    </div>
  );
}
