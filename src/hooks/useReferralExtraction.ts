// src/hooks/useReferralExtraction.ts
// Hook for managing referral extraction workflow state

import { useState, useCallback } from 'react';
import type { ReferralExtractedData } from '@/domains/referrals';

/**
 * Extraction workflow status
 */
export type ExtractionStatus =
  | 'idle'              // No extraction in progress
  | 'uploading'         // File being uploaded
  | 'extracting_text'   // Text extraction from PDF
  | 'extracting_data'   // AI structured extraction
  | 'reviewing'         // User reviewing extracted data
  | 'applying'          // Applying data to consultation
  | 'complete'          // Extraction applied successfully
  | 'error';            // An error occurred

/**
 * Extraction workflow state
 */
export interface ExtractionState {
  status: ExtractionStatus;
  referralId?: string;
  extractedData?: ReferralExtractedData;
  editedData?: ReferralExtractedData;
  error?: string;
  progress: number;
}

/**
 * Options for the extraction hook
 */
export interface UseReferralExtractionOptions {
  onComplete?: (data: {
    referralId: string;
    extractedData: ReferralExtractedData;
  }) => void;
  onError?: (error: string) => void;
}

/**
 * Return type for the extraction hook
 */
export interface UseReferralExtractionReturn {
  state: ExtractionState;
  // Start extraction from an uploaded file
  startExtraction: (referralId: string, extractedData: ReferralExtractedData) => void;
  // Update edited data during review
  updateEditedData: (data: Partial<ReferralExtractedData>) => void;
  // Apply the extraction to consultation
  applyExtraction: () => Promise<void>;
  // Cancel and reset
  cancel: () => void;
  // Reset to initial state
  reset: () => void;
  // Check if currently processing
  isProcessing: boolean;
  // Check if ready for review
  isReadyForReview: boolean;
}

const initialState: ExtractionState = {
  status: 'idle',
  progress: 0,
};

/**
 * Hook for managing the referral extraction workflow
 *
 * Workflow:
 * 1. ReferralUploader handles upload and extraction
 * 2. This hook receives the extracted data and manages review state
 * 3. User reviews/edits data in ReferralReviewPanel
 * 4. On apply, data is sent to consultation form
 */
export function useReferralExtraction(
  options: UseReferralExtractionOptions = {}
): UseReferralExtractionReturn {
  const { onComplete, onError } = options;
  const [state, setState] = useState<ExtractionState>(initialState);

  // Update state helper
  const updateState = useCallback((updates: Partial<ExtractionState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Start extraction - called after ReferralUploader completes
  const startExtraction = useCallback(
    (referralId: string, extractedData: ReferralExtractedData) => {
      setState({
        status: 'reviewing',
        referralId,
        extractedData,
        editedData: structuredClone(extractedData), // Deep clone for editing
        progress: 100,
      });
    },
    []
  );

  // Update edited data during review
  const updateEditedData = useCallback((updates: Partial<ReferralExtractedData>) => {
    setState((prev) => {
      if (!prev.editedData) return prev;
      return {
        ...prev,
        editedData: {
          ...prev.editedData,
          ...updates,
        },
      };
    });
  }, []);

  // Apply extraction to consultation
  const applyExtraction = useCallback(async () => {
    if (!state.referralId || !state.editedData) {
      const error = 'No extraction data to apply';
      updateState({ status: 'error', error });
      onError?.(error);
      return;
    }

    updateState({ status: 'applying' });

    try {
      // Note: The actual apply API call will be implemented in Step 7
      // For now, we just transition to complete state
      // In Step 7, this will call POST /api/referrals/:id/apply

      updateState({ status: 'complete' });
      onComplete?.({
        referralId: state.referralId,
        extractedData: state.editedData,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to apply extraction';
      updateState({ status: 'error', error: errorMessage });
      onError?.(errorMessage);
    }
  }, [state.referralId, state.editedData, onComplete, onError, updateState]);

  // Cancel the current extraction
  const cancel = useCallback(() => {
    setState(initialState);
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Derived state
  const isProcessing = ['uploading', 'extracting_text', 'extracting_data', 'applying'].includes(
    state.status
  );
  const isReadyForReview = state.status === 'reviewing' && Boolean(state.extractedData);

  return {
    state,
    startExtraction,
    updateEditedData,
    applyExtraction,
    cancel,
    reset,
    isProcessing,
    isReadyForReview,
  };
}
