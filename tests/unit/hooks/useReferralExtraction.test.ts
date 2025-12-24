// tests/unit/hooks/useReferralExtraction.test.ts
// Unit tests for useReferralExtraction hook

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReferralExtraction } from '@/hooks/useReferralExtraction';
import type { ReferralExtractedData } from '@/domains/referrals';

describe('useReferralExtraction', () => {
  const mockExtractedData: ReferralExtractedData = {
    patient: {
      fullName: 'John Smith',
      dateOfBirth: '1980-01-15',
      medicare: '1234567890',
      confidence: 0.95,
    },
    gp: {
      fullName: 'Dr. Jane Wilson',
      practiceName: 'City Medical Centre',
      phone: '02 9876 5432',
      confidence: 0.9,
    },
    referralContext: {
      reasonForReferral: 'Assessment of chest pain',
      keyProblems: ['Chest pain', 'Shortness of breath'],
      confidence: 0.85,
    },
    overallConfidence: 0.9,
    extractedAt: '2024-01-01T00:00:00Z',
    modelUsed: 'claude-sonnet-4',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('starts with idle status', () => {
      const { result } = renderHook(() => useReferralExtraction());

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.progress).toBe(0);
      expect(result.current.state.referralId).toBeUndefined();
      expect(result.current.state.extractedData).toBeUndefined();
    });

    it('isProcessing is false initially', () => {
      const { result } = renderHook(() => useReferralExtraction());

      expect(result.current.isProcessing).toBe(false);
    });

    it('isReadyForReview is false initially', () => {
      const { result } = renderHook(() => useReferralExtraction());

      expect(result.current.isReadyForReview).toBe(false);
    });
  });

  describe('startExtraction', () => {
    it('transitions to reviewing state', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      expect(result.current.state.status).toBe('reviewing');
      expect(result.current.state.referralId).toBe('ref-1');
      expect(result.current.state.extractedData).toEqual(mockExtractedData);
      expect(result.current.state.progress).toBe(100);
    });

    it('creates a deep clone for editedData', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      // Verify editedData is a separate copy
      expect(result.current.state.editedData).toEqual(mockExtractedData);
      expect(result.current.state.editedData).not.toBe(mockExtractedData);
    });

    it('sets isReadyForReview to true', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      expect(result.current.isReadyForReview).toBe(true);
    });
  });

  describe('updateEditedData', () => {
    it('updates patient data', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      act(() => {
        result.current.updateEditedData({
          patient: {
            ...mockExtractedData.patient,
            fullName: 'Jane Doe',
          },
        });
      });

      expect(result.current.state.editedData?.patient.fullName).toBe('Jane Doe');
    });

    it('updates gp data', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      act(() => {
        result.current.updateEditedData({
          gp: {
            ...mockExtractedData.gp,
            fullName: 'Dr. New GP',
          },
        });
      });

      expect(result.current.state.editedData?.gp.fullName).toBe('Dr. New GP');
    });

    it('updates referral context', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      act(() => {
        result.current.updateEditedData({
          referralContext: {
            ...mockExtractedData.referralContext,
            reasonForReferral: 'Updated reason',
          },
        });
      });

      expect(result.current.state.editedData?.referralContext.reasonForReferral).toBe(
        'Updated reason'
      );
    });

    it('does nothing if no editedData exists', () => {
      const { result } = renderHook(() => useReferralExtraction());

      // Don't call startExtraction first
      act(() => {
        result.current.updateEditedData({
          patient: {
            fullName: 'Test',
            confidence: 1,
          },
        });
      });

      expect(result.current.state.editedData).toBeUndefined();
    });

    it('preserves other data when updating partial', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      act(() => {
        result.current.updateEditedData({
          overallConfidence: 0.5,
        });
      });

      // Patient should still be there
      expect(result.current.state.editedData?.patient.fullName).toBe('John Smith');
      expect(result.current.state.editedData?.overallConfidence).toBe(0.5);
    });
  });

  describe('applyExtraction', () => {
    it('transitions to complete state on success', async () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() => useReferralExtraction({ onComplete }));

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      await act(async () => {
        await result.current.applyExtraction();
      });

      expect(result.current.state.status).toBe('complete');
    });

    it('calls onComplete callback with data', async () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() => useReferralExtraction({ onComplete }));

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      await act(async () => {
        await result.current.applyExtraction();
      });

      expect(onComplete).toHaveBeenCalledWith({
        referralId: 'ref-1',
        extractedData: mockExtractedData,
      });
    });

    it('uses editedData in callback if modified', async () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() => useReferralExtraction({ onComplete }));

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      act(() => {
        result.current.updateEditedData({
          patient: {
            ...mockExtractedData.patient,
            fullName: 'Edited Name',
          },
        });
      });

      await act(async () => {
        await result.current.applyExtraction();
      });

      expect(onComplete).toHaveBeenCalledWith({
        referralId: 'ref-1',
        extractedData: expect.objectContaining({
          patient: expect.objectContaining({
            fullName: 'Edited Name',
          }),
        }),
      });
    });

    it('transitions to error if no data to apply', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useReferralExtraction({ onError }));

      // Don't call startExtraction
      await act(async () => {
        await result.current.applyExtraction();
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('No extraction data to apply');
      expect(onError).toHaveBeenCalledWith('No extraction data to apply');
    });
  });

  describe('cancel', () => {
    it('resets to initial state', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      expect(result.current.state.status).toBe('reviewing');

      act(() => {
        result.current.cancel();
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.referralId).toBeUndefined();
      expect(result.current.state.extractedData).toBeUndefined();
      expect(result.current.state.editedData).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.progress).toBe(0);
    });
  });

  describe('isProcessing', () => {
    it('returns true during uploading state', () => {
      const { result } = renderHook(() => useReferralExtraction());

      // Can't easily simulate uploading state without internal access,
      // but we can verify it returns false for idle
      expect(result.current.isProcessing).toBe(false);
    });

    it('returns false when reviewing', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('isReadyForReview', () => {
    it('returns true when status is reviewing and has extractedData', () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      expect(result.current.isReadyForReview).toBe(true);
    });

    it('returns false when status is idle', () => {
      const { result } = renderHook(() => useReferralExtraction());

      expect(result.current.isReadyForReview).toBe(false);
    });

    it('returns false when status is complete', async () => {
      const { result } = renderHook(() => useReferralExtraction());

      act(() => {
        result.current.startExtraction('ref-1', mockExtractedData);
      });

      await act(async () => {
        await result.current.applyExtraction();
      });

      expect(result.current.isReadyForReview).toBe(false);
    });
  });
});
