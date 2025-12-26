// tests/unit/components/FastExtractionResult.test.tsx
// Unit tests for FastExtractionResult component

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FastExtractionResult } from '@/components/referral/FastExtractionResult';
import type { FastExtractedData } from '@/domains/referrals';

// Helper to create mock fast extraction data
function createMockFastExtractionData(
  overrides: Partial<FastExtractedData> = {}
): FastExtractedData {
  return {
    patientName: {
      value: 'John Smith',
      confidence: 0.95,
      level: 'high',
    },
    dateOfBirth: {
      value: '1965-03-15',
      confidence: 0.9,
      level: 'high',
    },
    mrn: {
      value: 'MRN12345678',
      confidence: 0.85,
      level: 'high',
    },
    overallConfidence: 0.9,
    extractedAt: new Date().toISOString(),
    modelUsed: 'claude-sonnet-4-20250514',
    processingTimeMs: 2500,
    ...overrides,
  };
}

describe('FastExtractionResult', () => {
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders the component with header', () => {
      render(<FastExtractionResult data={createMockFastExtractionData()} />);

      expect(screen.getByText('Patient Identified')).toBeInTheDocument();
      expect(screen.getByTestId('fast-extraction-result')).toBeInTheDocument();
    });

    it('renders overall confidence indicator', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({ overallConfidence: 0.9 })}
        />
      );

      expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('displays processing time', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({ processingTimeMs: 2500 })}
        />
      );

      expect(screen.getByText('Extracted in 2.5s')).toBeInTheDocument();
    });
  });

  describe('Field display', () => {
    it('displays patient name', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            patientName: { value: 'Jane Doe', confidence: 0.95, level: 'high' },
          })}
        />
      );

      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('displays formatted date of birth', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            dateOfBirth: { value: '1985-07-20', confidence: 0.9, level: 'high' },
          })}
        />
      );

      // Date should be formatted as DD/MM/YYYY
      expect(screen.getByText('20/07/1985')).toBeInTheDocument();
    });

    it('displays MRN', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            mrn: { value: 'URN987654', confidence: 0.85, level: 'high' },
          })}
        />
      );

      expect(screen.getByText('URN987654')).toBeInTheDocument();
    });

    it('displays "Not found" for null values', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            mrn: { value: null, confidence: 0, level: 'low' },
          })}
        />
      );

      expect(screen.getByText('Not found')).toBeInTheDocument();
    });

    it('displays "Not found" for empty string values', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            patientName: { value: '', confidence: 0, level: 'low' },
          })}
        />
      );

      expect(screen.getAllByText('Not found').length).toBeGreaterThan(0);
    });
  });

  describe('Confidence indicators', () => {
    it('shows confidence indicator for each field with value', () => {
      render(<FastExtractionResult data={createMockFastExtractionData()} />);

      // Should have confidence indicators (3 for fields + 1 for overall)
      const indicators = screen.getAllByTestId('confidence-indicator');
      expect(indicators.length).toBe(4);
    });

    it('does not show confidence indicator for fields without value', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            mrn: { value: null, confidence: 0, level: 'low' },
          })}
        />
      );

      // Should have 3 indicators (2 for fields + 1 for overall)
      const indicators = screen.getAllByTestId('confidence-indicator');
      expect(indicators.length).toBe(3);
    });
  });

  describe('Low confidence warning', () => {
    it('shows warning when any field has low confidence', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            patientName: { value: 'John', confidence: 0.5, level: 'low' },
          })}
        />
      );

      expect(screen.getByTestId('low-confidence-warning')).toBeInTheDocument();
      expect(
        screen.getByText(/Some fields have low confidence/)
      ).toBeInTheDocument();
    });

    it('does not show warning when all fields have medium or high confidence', () => {
      render(<FastExtractionResult data={createMockFastExtractionData()} />);

      expect(screen.queryByTestId('low-confidence-warning')).not.toBeInTheDocument();
    });
  });

  describe('No data warning', () => {
    it('shows warning when no fields have data', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            patientName: { value: null, confidence: 0, level: 'low' },
            dateOfBirth: { value: null, confidence: 0, level: 'low' },
            mrn: { value: null, confidence: 0, level: 'low' },
          })}
        />
      );

      expect(screen.getByTestId('no-data-warning')).toBeInTheDocument();
      expect(
        screen.getByText(/Could not extract patient identifiers/)
      ).toBeInTheDocument();
    });

    it('does not show warning when at least one field has data', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            patientName: { value: 'John', confidence: 0.9, level: 'high' },
            dateOfBirth: { value: null, confidence: 0, level: 'low' },
            mrn: { value: null, confidence: 0, level: 'low' },
          })}
        />
      );

      expect(screen.queryByTestId('no-data-warning')).not.toBeInTheDocument();
    });
  });

  describe('Editing', () => {
    it('shows edit button on hover', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData()}
          onEdit={mockOnEdit}
        />
      );

      const editButtons = screen.getAllByTestId('field-edit-button');
      expect(editButtons.length).toBe(3);
    });

    it('switches to edit mode when edit button is clicked', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData()}
          onEdit={mockOnEdit}
        />
      );

      const editButtons = screen.getAllByTestId('field-edit-button');
      fireEvent.click(editButtons[0]); // Edit patient name

      expect(screen.getByTestId('field-edit-input')).toBeInTheDocument();
    });

    it('populates input with current value when editing', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            patientName: { value: 'John Smith', confidence: 0.95, level: 'high' },
          })}
          onEdit={mockOnEdit}
        />
      );

      const editButtons = screen.getAllByTestId('field-edit-button');
      fireEvent.click(editButtons[0]);

      const input = screen.getByTestId('field-edit-input') as HTMLInputElement;
      expect(input.value).toBe('John Smith');
    });

    it('calls onEdit with new value when save button is clicked', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData()}
          onEdit={mockOnEdit}
        />
      );

      const editButtons = screen.getAllByTestId('field-edit-button');
      fireEvent.click(editButtons[0]);

      const input = screen.getByTestId('field-edit-input');
      fireEvent.change(input, { target: { value: 'Jane Doe' } });

      fireEvent.click(screen.getByTestId('field-save-button'));

      expect(mockOnEdit).toHaveBeenCalledWith('patientName', 'Jane Doe');
    });

    it('calls onEdit when Enter key is pressed', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData()}
          onEdit={mockOnEdit}
        />
      );

      const editButtons = screen.getAllByTestId('field-edit-button');
      fireEvent.click(editButtons[0]);

      const input = screen.getByTestId('field-edit-input');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnEdit).toHaveBeenCalledWith('patientName', 'New Name');
    });

    it('cancels edit when Escape key is pressed', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData()}
          onEdit={mockOnEdit}
        />
      );

      const editButtons = screen.getAllByTestId('field-edit-button');
      fireEvent.click(editButtons[0]);

      const input = screen.getByTestId('field-edit-input');
      fireEvent.change(input, { target: { value: 'Changed Value' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should exit edit mode without calling onEdit
      expect(mockOnEdit).not.toHaveBeenCalled();
      expect(screen.queryByTestId('field-edit-input')).not.toBeInTheDocument();
    });

    it('can edit date of birth field', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData()}
          onEdit={mockOnEdit}
        />
      );

      const editButtons = screen.getAllByTestId('field-edit-button');
      fireEvent.click(editButtons[1]); // Edit DOB

      const input = screen.getByTestId('field-edit-input');
      fireEvent.change(input, { target: { value: '1990-01-01' } });
      fireEvent.click(screen.getByTestId('field-save-button'));

      expect(mockOnEdit).toHaveBeenCalledWith('dateOfBirth', '1990-01-01');
    });

    it('can edit MRN field', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData()}
          onEdit={mockOnEdit}
        />
      );

      const editButtons = screen.getAllByTestId('field-edit-button');
      fireEvent.click(editButtons[2]); // Edit MRN

      const input = screen.getByTestId('field-edit-input');
      fireEvent.change(input, { target: { value: 'NEW123456' } });
      fireEvent.click(screen.getByTestId('field-save-button'));

      expect(mockOnEdit).toHaveBeenCalledWith('mrn', 'NEW123456');
    });
  });

  describe('Date formatting', () => {
    it('formats ISO date to DD/MM/YYYY', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            dateOfBirth: { value: '2000-12-25', confidence: 0.9, level: 'high' },
          })}
        />
      );

      expect(screen.getByText('25/12/2000')).toBeInTheDocument();
    });

    it('preserves DD/MM/YYYY format if already formatted', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData({
            dateOfBirth: { value: '25/12/2000', confidence: 0.9, level: 'high' },
          })}
        />
      );

      expect(screen.getByText('25/12/2000')).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(
        <FastExtractionResult
          data={createMockFastExtractionData()}
          className="custom-class"
        />
      );

      expect(screen.getByTestId('fast-extraction-result')).toHaveClass(
        'custom-class'
      );
    });
  });
});
