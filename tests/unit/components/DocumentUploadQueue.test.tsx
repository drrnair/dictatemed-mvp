// tests/unit/components/DocumentUploadQueue.test.tsx
// Unit tests for DocumentUploadQueue component

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentUploadQueue } from '@/components/referral/DocumentUploadQueue';
import type { QueuedFile } from '@/domains/referrals';

// Helper to create mock files
function createMockFile(name: string, type: string, size: number): File {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// Helper to create mock queued files
function createQueuedFile(
  overrides: Partial<QueuedFile> = {}
): QueuedFile {
  return {
    id: `file-${Math.random().toString(36).substring(7)}`,
    file: createMockFile('test.pdf', 'application/pdf', 1024 * 1024),
    status: 'queued',
    progress: 0,
    ...overrides,
  };
}

describe('DocumentUploadQueue', () => {
  const mockOnRemoveFile = vi.fn();
  const mockOnRetryFile = vi.fn();
  const mockOnCancelFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('renders nothing when files array is empty', () => {
      const { container } = render(
        <DocumentUploadQueue
          files={[]}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('File display', () => {
    it('renders file list with correct count', () => {
      const files = [
        createQueuedFile({ id: 'file-1' }),
        createQueuedFile({ id: 'file-2' }),
        createQueuedFile({ id: 'file-3' }),
      ];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('3 files')).toBeInTheDocument();
    });

    it('shows singular form for single file', () => {
      const files = [createQueuedFile()];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('1 file')).toBeInTheDocument();
    });

    it('displays file name and size', () => {
      const files = [
        createQueuedFile({
          file: createMockFile('referral-letter.pdf', 'application/pdf', 2 * 1024 * 1024),
        }),
      ];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('referral-letter.pdf')).toBeInTheDocument();
      expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    });
  });

  describe('Status display', () => {
    it('shows "Waiting..." for queued files', () => {
      const files = [createQueuedFile({ status: 'queued' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('Waiting...')).toBeInTheDocument();
    });

    it('shows "Uploading..." for uploading files', () => {
      const files = [createQueuedFile({ status: 'uploading', progress: 45 })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });

    it('shows "Extracting..." for extracting files', () => {
      const files = [createQueuedFile({ status: 'extracting', progress: 75 })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('Extracting...')).toBeInTheDocument();
    });

    it('shows "Complete" for complete files', () => {
      const files = [createQueuedFile({ status: 'complete', progress: 100 })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('shows "Failed" for failed files', () => {
      const files = [createQueuedFile({ status: 'failed', error: 'Upload failed' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });
  });

  describe('Progress bar', () => {
    it('shows progress bar for uploading files', () => {
      const files = [createQueuedFile({ status: 'uploading', progress: 45 })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByTestId('file-progress')).toBeInTheDocument();
    });

    it('shows progress bar for extracting files', () => {
      const files = [createQueuedFile({ status: 'extracting', progress: 75 })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByTestId('file-progress')).toBeInTheDocument();
    });

    it('does not show progress bar for queued files', () => {
      const files = [createQueuedFile({ status: 'queued' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.queryByTestId('file-progress')).not.toBeInTheDocument();
    });

    it('does not show progress bar for complete files', () => {
      const files = [createQueuedFile({ status: 'complete', progress: 100 })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.queryByTestId('file-progress')).not.toBeInTheDocument();
    });
  });

  describe('Summary header', () => {
    it('shows processing count', () => {
      const files = [
        createQueuedFile({ id: 'file-1', status: 'uploading' }),
        createQueuedFile({ id: 'file-2', status: 'extracting' }),
        createQueuedFile({ id: 'file-3', status: 'complete' }),
      ];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('2 processing')).toBeInTheDocument();
    });

    it('shows complete count', () => {
      const files = [
        createQueuedFile({ id: 'file-1', status: 'complete' }),
        createQueuedFile({ id: 'file-2', status: 'complete' }),
        createQueuedFile({ id: 'file-3', status: 'queued' }),
      ];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('2 complete')).toBeInTheDocument();
    });

    it('shows failed count', () => {
      const files = [
        createQueuedFile({ id: 'file-1', status: 'failed' }),
        createQueuedFile({ id: 'file-2', status: 'complete' }),
      ];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByText('1 failed')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('calls onRemoveFile when remove button is clicked for queued file', () => {
      const files = [createQueuedFile({ id: 'file-1', status: 'queued' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      fireEvent.click(screen.getByTestId('file-remove-button'));
      expect(mockOnRemoveFile).toHaveBeenCalledWith('file-1');
    });

    it('calls onRetryFile when retry button is clicked for failed file', () => {
      const files = [createQueuedFile({ id: 'file-1', status: 'failed' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      fireEvent.click(screen.getByTestId('file-retry-button'));
      expect(mockOnRetryFile).toHaveBeenCalledWith('file-1');
    });

    it('calls onCancelFile when cancel button is clicked for uploading file', () => {
      const files = [createQueuedFile({ id: 'file-1', status: 'uploading' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      fireEvent.click(screen.getByTestId('file-cancel-button'));
      expect(mockOnCancelFile).toHaveBeenCalledWith('file-1');
    });

    it('shows loading spinner for processing files', () => {
      const files = [createQueuedFile({ status: 'uploading' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByTestId('file-loading')).toBeInTheDocument();
    });

    it('shows check icon for complete files', () => {
      const files = [createQueuedFile({ status: 'complete' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByTestId('file-complete-icon')).toBeInTheDocument();
    });

    it('shows error icon for failed files', () => {
      const files = [createQueuedFile({ status: 'failed' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByTestId('file-error-icon')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies green styling for complete files', () => {
      const files = [createQueuedFile({ status: 'complete' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      const item = screen.getByTestId('queued-file-item');
      expect(item).toHaveClass('border-green-200', 'bg-green-50/50');
    });

    it('applies red styling for failed files', () => {
      const files = [createQueuedFile({ status: 'failed' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      const item = screen.getByTestId('queued-file-item');
      expect(item).toHaveClass('border-red-200', 'bg-red-50/50');
    });

    it('applies custom className', () => {
      const files = [createQueuedFile()];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
          className="custom-class"
        />
      );

      expect(screen.getByTestId('document-upload-queue')).toHaveClass('custom-class');
    });
  });

  describe('Data attributes', () => {
    it('has correct data attributes on queue container', () => {
      const files = [createQueuedFile({ id: 'test-id' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      expect(screen.getByTestId('document-upload-queue')).toBeInTheDocument();
    });

    it('has correct data attributes on file item', () => {
      const files = [createQueuedFile({ id: 'test-id', status: 'uploading' })];

      render(
        <DocumentUploadQueue
          files={files}
          onRemoveFile={mockOnRemoveFile}
          onRetryFile={mockOnRetryFile}
          onCancelFile={mockOnCancelFile}
        />
      );

      const item = screen.getByTestId('queued-file-item');
      expect(item).toHaveAttribute('data-file-id', 'test-id');
      expect(item).toHaveAttribute('data-status', 'uploading');
    });
  });
});
