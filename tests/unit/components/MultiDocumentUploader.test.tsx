// tests/unit/components/MultiDocumentUploader.test.tsx
// Unit tests for MultiDocumentUploader component

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiDocumentUploader } from '@/components/referral/MultiDocumentUploader';
import * as uploadQueueHook from '@/hooks/use-document-upload-queue';
import type { UseDocumentUploadQueueResult } from '@/hooks/use-document-upload-queue';
import type { QueuedFile, FastExtractedData } from '@/domains/referrals';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// Helper to create mock files
function createMockFile(name: string, type: string, size: number): File {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// Helper to create mock queued files
function createQueuedFile(overrides: Partial<QueuedFile> = {}): QueuedFile {
  return {
    id: `file-${Math.random().toString(36).substring(7)}`,
    file: createMockFile('test.pdf', 'application/pdf', 1024 * 1024),
    status: 'queued',
    progress: 0,
    ...overrides,
  };
}

// Helper to create mock fast extraction data
function createMockFastExtractionData(): FastExtractedData {
  return {
    patientName: { value: 'John Smith', confidence: 0.95, level: 'high' },
    dateOfBirth: { value: '1965-03-15', confidence: 0.9, level: 'high' },
    mrn: { value: 'MRN12345678', confidence: 0.85, level: 'high' },
    overallConfidence: 0.9,
    extractedAt: new Date().toISOString(),
    modelUsed: 'claude-sonnet-4-20250514',
    processingTimeMs: 2500,
  };
}

// Default mock hook result
function createDefaultMockHookResult(
  overrides: Partial<UseDocumentUploadQueueResult> = {}
): UseDocumentUploadQueueResult {
  return {
    files: [],
    isProcessing: false,
    hasErrors: false,
    allFastExtractionsComplete: false,
    allFullExtractionsComplete: false,
    aggregatedFastExtraction: null,
    canProceed: false,
    failedFiles: [],
    processingFiles: [],
    completedFiles: [],
    addFiles: vi.fn().mockReturnValue([]),
    removeFile: vi.fn(),
    retryFile: vi.fn(),
    cancelFile: vi.fn(),
    startUpload: vi.fn().mockResolvedValue(undefined),
    clearQueue: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

describe('MultiDocumentUploader', () => {
  let mockHookResult: UseDocumentUploadQueueResult;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHookResult = createDefaultMockHookResult();
    vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('renders the component', () => {
      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('multi-document-uploader')).toBeInTheDocument();
    });

    it('shows info text', () => {
      render(<MultiDocumentUploader />);

      expect(
        screen.getByText(/Upload referral letters and supporting documents/)
      ).toBeInTheDocument();
    });

    it('shows drop zone', () => {
      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
      expect(
        screen.getByText(/Drop documents here or/)
      ).toBeInTheDocument();
    });

    it('shows maximum file count', () => {
      render(<MultiDocumentUploader />);

      expect(screen.getByText('Maximum 10 files')).toBeInTheDocument();
    });

    it('shows accepted file formats', () => {
      render(<MultiDocumentUploader />);

      expect(screen.getByText(/\.pdf/)).toBeInTheDocument();
    });
  });

  describe('File selection', () => {
    it('calls addFiles when files are selected via input', () => {
      const addFiles = vi.fn().mockReturnValue([]);
      mockHookResult = createDefaultMockHookResult({ addFiles });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      const input = screen.getByTestId('file-input');
      const file = createMockFile('test.pdf', 'application/pdf', 1024 * 1024);

      fireEvent.change(input, { target: { files: [file] } });

      expect(addFiles).toHaveBeenCalledWith([file]);
    });

    it('supports multiple file selection', () => {
      render(<MultiDocumentUploader />);

      const input = screen.getByTestId('file-input');
      expect(input).toHaveAttribute('multiple');
    });

    it('calls addFiles when files are dropped', () => {
      const addFiles = vi.fn().mockReturnValue([]);
      mockHookResult = createDefaultMockHookResult({ addFiles });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      const dropZone = screen.getByTestId('drop-zone');
      const file = createMockFile('test.pdf', 'application/pdf', 1024 * 1024);

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      expect(addFiles).toHaveBeenCalledWith([file]);
    });

    it('opens file picker when drop zone is clicked', () => {
      render(<MultiDocumentUploader />);

      const dropZone = screen.getByTestId('drop-zone');
      const input = screen.getByTestId('file-input');

      // Mock click on input
      const clickSpy = vi.spyOn(input, 'click');
      fireEvent.click(dropZone);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file picker when Enter key is pressed on drop zone', () => {
      render(<MultiDocumentUploader />);

      const dropZone = screen.getByTestId('drop-zone');
      const input = screen.getByTestId('file-input');

      const clickSpy = vi.spyOn(input, 'click');
      fireEvent.keyDown(dropZone, { key: 'Enter' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not respond to input when disabled', () => {
      const addFiles = vi.fn().mockReturnValue([]);
      mockHookResult = createDefaultMockHookResult({ addFiles });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader disabled />);

      const input = screen.getByTestId('file-input');
      expect(input).toBeDisabled();
    });
  });

  describe('Drag and drop', () => {
    it('shows visual feedback when dragging over', () => {
      render(<MultiDocumentUploader />);

      const dropZone = screen.getByTestId('drop-zone');

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { items: [{ kind: 'file' }] },
      });

      expect(dropZone).toHaveClass('border-primary', 'bg-primary/5');
    });

    it('removes visual feedback when drag leaves', () => {
      render(<MultiDocumentUploader />);

      const dropZone = screen.getByTestId('drop-zone');

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { items: [{ kind: 'file' }] },
      });
      fireEvent.dragLeave(dropZone);

      expect(dropZone).not.toHaveClass('bg-primary/5');
    });
  });

  describe('File queue display', () => {
    it('shows document queue when files are added', () => {
      const files = [createQueuedFile({ id: 'file-1' })];
      mockHookResult = createDefaultMockHookResult({ files });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('document-upload-queue')).toBeInTheDocument();
    });

    it('hides drop zone when at max files', () => {
      const files = Array.from({ length: 10 }, (_, i) =>
        createQueuedFile({ id: `file-${i}` })
      );
      mockHookResult = createDefaultMockHookResult({ files });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
    });

    it('shows drop zone when under max files', () => {
      const files = [createQueuedFile({ id: 'file-1' })];
      mockHookResult = createDefaultMockHookResult({ files });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
    });
  });

  describe('Action buttons', () => {
    it('shows upload button when there are queued files', () => {
      const files = [createQueuedFile({ status: 'queued' })];
      mockHookResult = createDefaultMockHookResult({ files });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('upload-button')).toBeInTheDocument();
      expect(screen.getByText('Upload 1 file')).toBeInTheDocument();
    });

    it('shows correct plural for multiple queued files', () => {
      const files = [
        createQueuedFile({ id: 'file-1', status: 'queued' }),
        createQueuedFile({ id: 'file-2', status: 'queued' }),
        createQueuedFile({ id: 'file-3', status: 'queued' }),
      ];
      mockHookResult = createDefaultMockHookResult({ files });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.getByText('Upload 3 files')).toBeInTheDocument();
    });

    it('calls startUpload when upload button is clicked', async () => {
      const startUpload = vi.fn().mockResolvedValue(undefined);
      const files = [createQueuedFile({ status: 'queued' })];
      mockHookResult = createDefaultMockHookResult({ files, startUpload });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      fireEvent.click(screen.getByTestId('upload-button'));

      await waitFor(() => {
        expect(startUpload).toHaveBeenCalled();
      });
    });

    it('shows continue button when canProceed is true', () => {
      const files = [createQueuedFile({ status: 'complete', documentId: 'doc-1' })];
      mockHookResult = createDefaultMockHookResult({
        files,
        canProceed: true,
        completedFiles: files,
        aggregatedFastExtraction: createMockFastExtractionData(),
      });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('continue-button')).toBeInTheDocument();
      expect(screen.getByText('Continue to Recording')).toBeInTheDocument();
    });

    it('calls onContinue with document IDs when continue is clicked', () => {
      const onContinue = vi.fn();
      const files = [
        createQueuedFile({ id: 'file-1', status: 'complete', documentId: 'doc-1' }),
        createQueuedFile({ id: 'file-2', status: 'complete', documentId: 'doc-2' }),
      ];
      mockHookResult = createDefaultMockHookResult({
        files,
        canProceed: true,
        completedFiles: files,
        aggregatedFastExtraction: createMockFastExtractionData(),
      });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader onContinue={onContinue} />);

      fireEvent.click(screen.getByTestId('continue-button'));

      expect(onContinue).toHaveBeenCalledWith(['doc-1', 'doc-2']);
    });

    it('calls onFastExtractionComplete when continue is clicked', () => {
      const onFastExtractionComplete = vi.fn();
      const fastData = createMockFastExtractionData();
      const files = [createQueuedFile({ status: 'complete', documentId: 'doc-1' })];
      mockHookResult = createDefaultMockHookResult({
        files,
        canProceed: true,
        completedFiles: files,
        aggregatedFastExtraction: fastData,
      });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(
        <MultiDocumentUploader onFastExtractionComplete={onFastExtractionComplete} />
      );

      fireEvent.click(screen.getByTestId('continue-button'));

      expect(onFastExtractionComplete).toHaveBeenCalledWith(fastData);
    });

    it('shows clear all button when files are present', () => {
      const files = [createQueuedFile()];
      mockHookResult = createDefaultMockHookResult({ files });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('clear-all-button')).toBeInTheDocument();
    });

    it('calls reset when clear all is clicked', () => {
      const reset = vi.fn();
      const files = [createQueuedFile()];
      mockHookResult = createDefaultMockHookResult({ files, reset });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      fireEvent.click(screen.getByTestId('clear-all-button'));

      expect(reset).toHaveBeenCalled();
    });

    it('disables clear all button when processing', () => {
      const files = [createQueuedFile({ status: 'uploading' })];
      mockHookResult = createDefaultMockHookResult({ files, isProcessing: true });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('clear-all-button')).toBeDisabled();
    });
  });

  describe('Fast extraction result', () => {
    it('shows fast extraction result when available and canProceed', () => {
      const files = [createQueuedFile({ status: 'complete' })];
      mockHookResult = createDefaultMockHookResult({
        files,
        canProceed: true,
        completedFiles: files,
        aggregatedFastExtraction: createMockFastExtractionData(),
      });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('fast-extraction-result')).toBeInTheDocument();
    });

    it('does not show fast extraction result when canProceed is false', () => {
      const files = [createQueuedFile({ status: 'uploading' })];
      mockHookResult = createDefaultMockHookResult({
        files,
        canProceed: false,
        aggregatedFastExtraction: createMockFastExtractionData(),
      });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.queryByTestId('fast-extraction-result')).not.toBeInTheDocument();
    });
  });

  describe('Background processing info', () => {
    it('shows background processing info when canProceed', () => {
      const files = [createQueuedFile({ status: 'complete' })];
      mockHookResult = createDefaultMockHookResult({
        files,
        canProceed: true,
        completedFiles: files,
        aggregatedFastExtraction: createMockFastExtractionData(),
      });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader />);

      expect(screen.getByTestId('background-processing-info')).toBeInTheDocument();
    });
  });

  describe('Disabled state', () => {
    it('disables drop zone when disabled prop is true', () => {
      render(<MultiDocumentUploader disabled />);

      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('disables upload button when disabled', () => {
      const files = [createQueuedFile({ status: 'queued' })];
      mockHookResult = createDefaultMockHookResult({ files });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader disabled />);

      expect(screen.getByTestId('upload-button')).toBeDisabled();
    });

    it('disables continue button when disabled', () => {
      const files = [createQueuedFile({ status: 'complete', documentId: 'doc-1' })];
      mockHookResult = createDefaultMockHookResult({
        files,
        canProceed: true,
        completedFiles: files,
        aggregatedFastExtraction: createMockFastExtractionData(),
      });
      vi.spyOn(uploadQueueHook, 'useDocumentUploadQueue').mockReturnValue(mockHookResult);

      render(<MultiDocumentUploader disabled />);

      expect(screen.getByTestId('continue-button')).toBeDisabled();
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(<MultiDocumentUploader className="custom-class" />);

      expect(screen.getByTestId('multi-document-uploader')).toHaveClass(
        'custom-class'
      );
    });
  });
});
