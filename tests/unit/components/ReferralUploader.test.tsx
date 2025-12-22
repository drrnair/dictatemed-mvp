// tests/unit/components/ReferralUploader.test.tsx
// Unit tests for ReferralUploader component

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReferralUploader } from '@/components/referral/ReferralUploader';
import type { ReferralExtractedData } from '@/domains/referrals';

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ReferralUploader', () => {
  const defaultProps = {
    onExtractionComplete: vi.fn(),
    onRemove: vi.fn(),
  };

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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial render (idle state)', () => {
    it('renders the upload zone', () => {
      render(<ReferralUploader {...defaultProps} />);

      expect(screen.getByText(/drop referral letter here/i)).toBeInTheDocument();
      expect(screen.getByText(/browse/i)).toBeInTheDocument();
    });

    it('renders info text explaining the feature', () => {
      render(<ReferralUploader {...defaultProps} />);

      expect(
        screen.getByText(/upload a referral letter and dictatemed will extract/i)
      ).toBeInTheDocument();
    });

    it('shows accepted file types and size limit', () => {
      render(<ReferralUploader {...defaultProps} />);

      expect(screen.getByText(/\.pdf, \.txt/i)).toBeInTheDocument();
      expect(screen.getByText(/10\.0 MB/i)).toBeInTheDocument();
    });

    it('has upload button with aria-label', () => {
      render(<ReferralUploader {...defaultProps} />);

      expect(screen.getByRole('button', { name: /upload referral letter/i })).toBeInTheDocument();
    });

    it('renders hidden file input', () => {
      const { container } = render(<ReferralUploader {...defaultProps} />);

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveClass('hidden');
    });
  });

  describe('Disabled state', () => {
    it('applies disabled styling when disabled', () => {
      render(<ReferralUploader {...defaultProps} disabled />);

      const dropZone = screen.getByRole('button', { name: /upload referral letter/i });
      expect(dropZone).toHaveClass('cursor-not-allowed');
    });

    it('disables file input when disabled', () => {
      const { container } = render(<ReferralUploader {...defaultProps} disabled />);

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeDisabled();
    });
  });

  describe('File validation', () => {
    it('shows specific error for Word documents', async () => {
      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const invalidFile = new File(['test'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      Object.defineProperty(input, 'files', {
        value: [invalidFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/word documents.*not yet supported.*convert to pdf/i)).toBeInTheDocument();
      });
    });

    it('shows generic error for other invalid file types', async () => {
      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const invalidFile = new File(['test'], 'test.exe', {
        type: 'application/x-msdownload',
      });

      Object.defineProperty(input, 'files', {
        value: [invalidFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/invalid file type.*pdf or text/i)).toBeInTheDocument();
      });
    });

    it('shows error for file too large', async () => {
      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      // Create a file larger than 10MB
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      });

      Object.defineProperty(input, 'files', {
        value: [largeFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/file too large/i)).toBeInTheDocument();
      });
    });

    it('accepts valid PDF file', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
        })
        .mockResolvedValueOnce({ ok: true }) // S3 upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Confirm
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Text extract
        .mockResolvedValueOnce({ ok: true, json: async () => ({ extractedData: mockExtractedData }) });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['PDF content'], 'referral.pdf', {
        type: 'application/pdf',
      });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      // Should show file name after selection
      await waitFor(() => {
        expect(screen.getByText('referral.pdf')).toBeInTheDocument();
      });
    });

    it('accepts valid text file', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
        })
        .mockResolvedValueOnce({ ok: true }) // S3 upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Confirm
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Text extract
        .mockResolvedValueOnce({ ok: true, json: async () => ({ extractedData: mockExtractedData }) });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['Text content'], 'referral.txt', {
        type: 'text/plain',
      });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText('referral.txt')).toBeInTheDocument();
      });
    });
  });

  describe('Upload workflow', () => {
    it('shows uploading state during upload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
      });
      // Don't resolve S3 upload to keep in uploading state
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/uploading/i)).toBeInTheDocument();
      });
    });

    it('shows text extraction state', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
        })
        .mockResolvedValueOnce({ ok: true }) // S3 upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Confirm
      // Don't resolve text extraction to keep in that state
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/reading document/i)).toBeInTheDocument();
      });
    });

    it('shows data extraction state', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
        })
        .mockResolvedValueOnce({ ok: true }) // S3 upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Confirm
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Text extract
      // Don't resolve structured extraction to keep in that state
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/extracting details/i)).toBeInTheDocument();
      });
    });

    it('shows ready state after successful extraction', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
        })
        .mockResolvedValueOnce({ ok: true }) // S3 upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Confirm
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Text extract
        .mockResolvedValueOnce({ ok: true, json: async () => ({ extractedData: mockExtractedData }) });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/extraction complete/i)).toBeInTheDocument();
      });
    });

    it('calls onExtractionComplete after successful extraction', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
        })
        .mockResolvedValueOnce({ ok: true }) // S3 upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Confirm
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Text extract
        .mockResolvedValueOnce({ ok: true, json: async () => ({ extractedData: mockExtractedData }) });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(defaultProps.onExtractionComplete).toHaveBeenCalledWith('ref-1', mockExtractedData);
      });
    });
  });

  describe('Error handling', () => {
    it('shows error when API fails to create document', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });

    it('shows error when S3 upload fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
        })
        .mockResolvedValueOnce({ ok: false }); // S3 upload fails

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/failed to upload file/i)).toBeInTheDocument();
      });
    });

    it('shows error when text extraction fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
        })
        .mockResolvedValueOnce({ ok: true }) // S3 upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // Confirm
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Could not read PDF' }),
        });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/could not read pdf/i)).toBeInTheDocument();
      });
    });

    it('shows manual entry fallback message on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed' }),
      });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/complete the form manually/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed' }),
      });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Remove functionality', () => {
    it('shows remove button after file is selected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed' }),
      });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
      });
    });

    it('calls onRemove when remove button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed' }),
      });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        screen.getByRole('button', { name: /remove/i });
      });

      fireEvent.click(screen.getByRole('button', { name: /remove/i }));

      expect(defaultProps.onRemove).toHaveBeenCalled();
    });

    it('resets to idle state after remove', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed' }),
      });

      render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        screen.getByRole('button', { name: /remove/i });
      });

      fireEvent.click(screen.getByRole('button', { name: /remove/i }));

      // Should go back to idle state
      expect(screen.getByText(/drop referral letter here/i)).toBeInTheDocument();
    });
  });

  describe('Drag and drop', () => {
    it('shows drag active state on dragenter', () => {
      render(<ReferralUploader {...defaultProps} />);

      const dropZone = screen.getByRole('button', { name: /upload referral letter/i });

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { items: [{ kind: 'file' }] },
      });

      expect(dropZone).toHaveClass('border-primary');
    });

    it('removes drag active state on dragleave', () => {
      render(<ReferralUploader {...defaultProps} />);

      const dropZone = screen.getByRole('button', { name: /upload referral letter/i });

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { items: [{ kind: 'file' }] },
      });

      fireEvent.dragLeave(dropZone);

      expect(dropZone).not.toHaveClass('bg-primary/5');
    });

    it('handles file drop', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed' }),
      });

      render(<ReferralUploader {...defaultProps} />);

      const dropZone = screen.getByRole('button', { name: /upload referral letter/i });
      const file = new File(['content'], 'dropped.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file' }],
      };

      fireEvent.drop(dropZone, { dataTransfer });

      await waitFor(() => {
        expect(screen.getByText('dropped.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Progress display', () => {
    it('shows progress bar during upload', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ref-1', uploadUrl: 'https://s3.example.com/upload' }),
        })
        .mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      const { container } = render(<ReferralUploader {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        // Progress component creates a div with bg-secondary class for the track
        expect(container.querySelector('.bg-secondary')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard accessibility', () => {
    it('opens file dialog on Enter key', () => {
      render(<ReferralUploader {...defaultProps} />);

      const dropZone = screen.getByRole('button', { name: /upload referral letter/i });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      fireEvent.keyDown(dropZone, { key: 'Enter' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file dialog on Space key', () => {
      render(<ReferralUploader {...defaultProps} />);

      const dropZone = screen.getByRole('button', { name: /upload referral letter/i });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      fireEvent.keyDown(dropZone, { key: ' ' });

      expect(clickSpy).toHaveBeenCalled();
    });
  });
});
