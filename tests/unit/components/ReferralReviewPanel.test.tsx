// tests/unit/components/ReferralReviewPanel.test.tsx
// Unit tests for ReferralReviewPanel component

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReferralReviewPanel } from '@/components/referral/ReferralReviewPanel';
import type { ReferralExtractedData, ApplyReferralInput } from '@/domains/referrals';

// Mock the dialog component to avoid portal issues in tests
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

// Mock ScrollArea
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>{children}</div>
  ),
}));

describe('ReferralReviewPanel', () => {
  const mockExtractedData: ReferralExtractedData = {
    patient: {
      fullName: 'John Smith',
      dateOfBirth: '1980-01-15',
      sex: 'male',
      medicare: '1234567890',
      mrn: 'MRN001',
      address: '123 Main St, Sydney NSW 2000',
      phone: '0400 000 000',
      email: 'john@example.com',
      confidence: 0.95,
    },
    gp: {
      fullName: 'Dr. Jane Wilson',
      practiceName: 'City Medical Centre',
      address: '456 Health St, Sydney NSW 2000',
      phone: '02 9876 5432',
      fax: '02 9876 5433',
      email: 'info@citymedical.com.au',
      providerNumber: 'PROV123',
      confidence: 0.9,
    },
    referrer: {
      fullName: 'Dr. Robert Brown',
      specialty: 'Cardiology',
      organisation: 'Heart Specialists',
      address: '789 Specialist Ave, Sydney',
      phone: '02 1234 5678',
      email: 'dr.brown@heartspec.com',
      confidence: 0.85,
    },
    referralContext: {
      reasonForReferral: 'Assessment of chest pain and shortness of breath on exertion.',
      keyProblems: ['Chest pain', 'Dyspnea on exertion', 'Hypertension'],
      investigationsMentioned: ['ECG', 'Stress test', 'Chest X-ray'],
      medicationsMentioned: ['Aspirin', 'Metoprolol', 'Lisinopril'],
      urgency: 'routine',
      referralDate: '2024-01-15',
      confidence: 0.88,
    },
    overallConfidence: 0.9,
    extractedAt: '2024-01-15T10:00:00Z',
    modelUsed: 'claude-sonnet-4',
  };

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    extractedData: mockExtractedData,
    onApply: vi.fn(),
    onCancel: vi.fn(),
    isApplying: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial render', () => {
    it('renders the dialog when open', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<ReferralReviewPanel {...defaultProps} open={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('renders the title', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('Review Extracted Details')).toBeInTheDocument();
    });

    it('renders overall confidence indicator', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });

  describe('Patient section', () => {
    it('renders patient details section', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('Patient Details')).toBeInTheDocument();
    });

    it('renders patient name', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('John Smith')).toBeInTheDocument();
    });

    it('renders patient date of birth', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('1980-01-15')).toBeInTheDocument();
    });

    it('renders patient medicare number', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('1234567890')).toBeInTheDocument();
    });

    it('renders patient confidence', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('95%')).toBeInTheDocument();
    });
  });

  describe('GP section', () => {
    it('renders GP details section', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('GP Details')).toBeInTheDocument();
    });

    it('renders GP name', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('Dr. Jane Wilson')).toBeInTheDocument();
    });

    it('renders GP practice name', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('City Medical Centre')).toBeInTheDocument();
    });
  });

  describe('Referrer section', () => {
    it('renders referrer section when referrer exists', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('Referrer Details')).toBeInTheDocument();
    });

    it('renders referrer name', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('Dr. Robert Brown')).toBeInTheDocument();
    });

    it('renders referrer specialty', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('Cardiology')).toBeInTheDocument();
    });

    it('does not render referrer section when no referrer', () => {
      const dataWithoutReferrer = {
        ...mockExtractedData,
        referrer: undefined,
      };

      render(
        <ReferralReviewPanel {...defaultProps} extractedData={dataWithoutReferrer} />
      );

      expect(screen.queryByText('Referrer Details')).not.toBeInTheDocument();
    });
  });

  describe('Referral context section', () => {
    it('renders referral context section', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('Referral Context')).toBeInTheDocument();
    });

    it('renders reason for referral', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(
        screen.getByText('Assessment of chest pain and shortness of breath on exertion.')
      ).toBeInTheDocument();
    });

    it('renders key problems', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('Chest pain')).toBeInTheDocument();
      expect(screen.getByText('Dyspnea on exertion')).toBeInTheDocument();
      expect(screen.getByText('Hypertension')).toBeInTheDocument();
    });

    it('renders investigations', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('ECG')).toBeInTheDocument();
      expect(screen.getByText('Stress test')).toBeInTheDocument();
    });

    it('renders medications', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('Aspirin')).toBeInTheDocument();
      expect(screen.getByText('Metoprolol')).toBeInTheDocument();
    });

    it('renders urgency badge', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByText('routine')).toBeInTheDocument();
    });
  });

  describe('Low confidence warning', () => {
    it('shows warning when overall confidence is low', () => {
      const lowConfidenceData = {
        ...mockExtractedData,
        overallConfidence: 0.5,
      };

      render(
        <ReferralReviewPanel {...defaultProps} extractedData={lowConfidenceData} />
      );

      expect(screen.getByText('Low extraction confidence')).toBeInTheDocument();
    });

    it('does not show warning when confidence is high', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.queryByText('Low extraction confidence')).not.toBeInTheDocument();
    });
  });

  describe('Cancel action', () => {
    it('renders Cancel button', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('calls onCancel when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ReferralReviewPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('disables Cancel button when applying', () => {
      render(<ReferralReviewPanel {...defaultProps} isApplying />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });
  });

  describe('Apply action', () => {
    it('renders Apply button', () => {
      render(<ReferralReviewPanel {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /apply to consultation/i })
      ).toBeInTheDocument();
    });

    it('calls onApply with correct data when Apply is clicked', async () => {
      const user = userEvent.setup();
      render(<ReferralReviewPanel {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /apply to consultation/i })
      );

      expect(defaultProps.onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          patient: expect.objectContaining({
            fullName: 'John Smith',
            dateOfBirth: '1980-01-15',
            sex: 'male',
            medicare: '1234567890',
          }),
          gp: expect.objectContaining({
            fullName: 'Dr. Jane Wilson',
            practiceName: 'City Medical Centre',
          }),
          referrer: expect.objectContaining({
            fullName: 'Dr. Robert Brown',
            specialty: 'Cardiology',
          }),
          referralContext: expect.objectContaining({
            reasonForReferral: 'Assessment of chest pain and shortness of breath on exertion.',
          }),
        })
      );
    });

    it('shows Applying... when isApplying', () => {
      render(<ReferralReviewPanel {...defaultProps} isApplying />);

      expect(screen.getByRole('button', { name: /applying/i })).toBeInTheDocument();
    });

    it('disables Apply button when applying', () => {
      render(<ReferralReviewPanel {...defaultProps} isApplying />);

      expect(screen.getByRole('button', { name: /applying/i })).toBeDisabled();
    });
  });

  describe('Section clearing', () => {
    it('disables Apply when patient section is cleared', async () => {
      const user = userEvent.setup();
      render(<ReferralReviewPanel {...defaultProps} />);

      // Find and click Clear button in patient section
      const patientSection = screen.getByText('Patient Details').closest('div')?.parentElement;
      const clearButtons = screen.getAllByRole('button', { name: /clear/i });

      // Click the first Clear button (patient section)
      await user.click(clearButtons[0]);

      expect(
        screen.getByRole('button', { name: /apply to consultation/i })
      ).toBeDisabled();
    });

    it('shows message when patient data is required', async () => {
      const user = userEvent.setup();
      render(<ReferralReviewPanel {...defaultProps} />);

      const clearButtons = screen.getAllByRole('button', { name: /clear/i });
      await user.click(clearButtons[0]);

      expect(screen.getByText('Patient data is required')).toBeInTheDocument();
    });
  });

  describe('Field editing', () => {
    it('allows editing patient name', async () => {
      const user = userEvent.setup();
      render(<ReferralReviewPanel {...defaultProps} />);

      // Click on patient name to edit
      await user.click(screen.getByText('John Smith'));

      const input = screen.getByDisplayValue('John Smith');
      await user.clear(input);
      await user.type(input, 'Jane Doe');

      // Blur to exit edit mode
      input.blur();

      // Click Apply and verify the updated name is used
      await user.click(
        screen.getByRole('button', { name: /apply to consultation/i })
      );

      expect(defaultProps.onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          patient: expect.objectContaining({
            fullName: 'Jane Doe',
          }),
        })
      );
    });
  });

  describe('Apply without optional sections', () => {
    it('does not include GP when GP section is cleared', async () => {
      const user = userEvent.setup();
      render(<ReferralReviewPanel {...defaultProps} />);

      // Clear GP section (second Clear button)
      const clearButtons = screen.getAllByRole('button', { name: /clear/i });
      await user.click(clearButtons[1]);

      await user.click(
        screen.getByRole('button', { name: /apply to consultation/i })
      );

      const callArg = defaultProps.onApply.mock.calls[0][0] as ApplyReferralInput;
      expect(callArg.gp).toBeUndefined();
    });

    it('does not include referrer when referrer section is cleared', async () => {
      const user = userEvent.setup();
      render(<ReferralReviewPanel {...defaultProps} />);

      // Clear referrer section (third Clear button)
      const clearButtons = screen.getAllByRole('button', { name: /clear/i });
      await user.click(clearButtons[2]);

      await user.click(
        screen.getByRole('button', { name: /apply to consultation/i })
      );

      const callArg = defaultProps.onApply.mock.calls[0][0] as ApplyReferralInput;
      expect(callArg.referrer).toBeUndefined();
    });

    it('does not include context when context section is cleared', async () => {
      const user = userEvent.setup();
      render(<ReferralReviewPanel {...defaultProps} />);

      // Clear context section (fourth Clear button)
      const clearButtons = screen.getAllByRole('button', { name: /clear/i });
      await user.click(clearButtons[3]);

      await user.click(
        screen.getByRole('button', { name: /apply to consultation/i })
      );

      const callArg = defaultProps.onApply.mock.calls[0][0] as ApplyReferralInput;
      expect(callArg.referralContext).toBeUndefined();
    });
  });

  describe('Empty patient name validation', () => {
    it('disables Apply when patient name is empty', async () => {
      const dataWithNoPatientName = {
        ...mockExtractedData,
        patient: {
          ...mockExtractedData.patient,
          fullName: '',
        },
      };

      render(
        <ReferralReviewPanel {...defaultProps} extractedData={dataWithNoPatientName} />
      );

      expect(
        screen.getByRole('button', { name: /apply to consultation/i })
      ).toBeDisabled();
    });

    it('disables Apply when patient name is only whitespace', async () => {
      const dataWithWhitespaceName = {
        ...mockExtractedData,
        patient: {
          ...mockExtractedData.patient,
          fullName: '   ',
        },
      };

      render(
        <ReferralReviewPanel {...defaultProps} extractedData={dataWithWhitespaceName} />
      );

      expect(
        screen.getByRole('button', { name: /apply to consultation/i })
      ).toBeDisabled();
    });
  });
});
