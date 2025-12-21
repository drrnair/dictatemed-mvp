// src/components/recording/RecordingErrorBoundary.tsx
// Specialized error boundary for recording with audio recovery

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Mic, Home, RefreshCw, Save, AlertTriangle } from 'lucide-react';
import { logError } from '@/lib/error-logger';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  onSaveRecording?: (audioBlob: Blob) => Promise<void>;
  audioRef?: React.RefObject<Blob | null>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isSavingAudio: boolean;
  audioSaved: boolean;
  audioSaveError: Error | null;
}

export class RecordingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isSavingAudio: false,
      audioSaved: false,
      audioSaveError: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo): Promise<void> {
    // Log error
    logError(error, {
      errorBoundary: 'RecordingErrorBoundary',
      componentStack: errorInfo.componentStack || undefined,
    }, 'high');

    this.setState({ errorInfo });

    // Attempt to save any captured audio
    await this.attemptAudioRecovery();
  }

  attemptAudioRecovery = async (): Promise<void> => {
    const { onSaveRecording, audioRef } = this.props;

    // Check if there's audio to save
    const audioBlob = audioRef?.current;
    if (!audioBlob || !onSaveRecording) {
      return;
    }

    this.setState({ isSavingAudio: true });

    try {
      await onSaveRecording(audioBlob);
      this.setState({
        audioSaved: true,
        isSavingAudio: false,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save audio');
      logError(error, {
        context: 'audio-recovery',
      }, 'high');
      this.setState({
        audioSaveError: error,
        isSavingAudio: false,
      });
    }
  };

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isSavingAudio: false,
      audioSaved: false,
      audioSaveError: null,
    });
  };

  handleGoHome = (): void => {
    window.location.href = '/dashboard';
  };

  handleStartNewRecording = (): void => {
    window.location.href = '/record';
  };

  render(): ReactNode {
    const {
      hasError,
      error,
      errorInfo,
      isSavingAudio,
      audioSaved,
      audioSaveError,
    } = this.state;
    const { children } = this.props;

    if (hasError && error) {
      const actions = [];

      // Show different actions based on audio save state
      if (isSavingAudio) {
        return (
          <div className="flex min-h-[400px] items-center justify-center p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-clinical-primary" />
              <p className="text-gray-600">Saving your recording...</p>
            </div>
          </div>
        );
      }

      if (audioSaved) {
        actions.push({
          label: 'Start New Recording',
          onClick: this.handleStartNewRecording,
          icon: <Mic className="h-4 w-4" />,
        });
        actions.push({
          label: 'Go to Dashboard',
          onClick: this.handleGoHome,
          variant: 'outline' as const,
          icon: <Home className="h-4 w-4" />,
        });
      } else {
        actions.push({
          label: 'Try Again',
          onClick: this.handleReset,
          icon: <RefreshCw className="h-4 w-4" />,
        });
        actions.push({
          label: 'Start Over',
          onClick: this.handleStartNewRecording,
          variant: 'outline' as const,
          icon: <Mic className="h-4 w-4" />,
        });
      }

      return (
        <ErrorFallback
          title={
            audioSaved
              ? 'Recording Saved'
              : 'Recording Error'
          }
          message={
            audioSaved
              ? 'We encountered an error but your recording has been saved. You can start a new recording or return to the dashboard.'
              : audioSaveError
              ? 'An error occurred and we were unable to save your recording. Please try starting a new recording.'
              : 'An error occurred during recording. Please try again.'
          }
          icon={audioSaved ? 'info' : 'error'}
          actions={actions}
          showStack={process.env.NODE_ENV === 'development'}
          stack={errorInfo?.componentStack || error.stack}
        >
          {audioSaved && (
            <div className="mb-4 rounded-lg bg-clinical-verified/10 p-4">
              <div className="flex items-center justify-center text-clinical-verified">
                <Save className="mr-2 h-5 w-5" />
                <span className="font-medium">Your audio was recovered successfully</span>
              </div>
            </div>
          )}

          {audioSaveError && (
            <div className="mb-4 rounded-lg bg-clinical-warning/10 p-4">
              <div className="flex items-center justify-center text-clinical-warning">
                <AlertTriangle className="mr-2 h-5 w-5" />
                <span className="text-sm">Unable to save recording</span>
              </div>
            </div>
          )}
        </ErrorFallback>
      );
    }

    return children;
  }
}

// Hook for getting audio blob reference in recording components
export function useAudioRecovery() {
  const audioBlobRef = React.useRef<Blob | null>(null);

  const setAudioBlob = React.useCallback((blob: Blob | null) => {
    audioBlobRef.current = blob;
  }, []);

  return {
    audioBlobRef,
    setAudioBlob,
  };
}
