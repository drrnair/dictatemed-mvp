// tests/unit/components/ReferralFieldGroup.test.tsx
// Unit tests for ReferralFieldGroup and ReferralContextFieldGroup components

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ReferralFieldGroup,
  ReferralContextFieldGroup,
} from '@/components/referral/ReferralFieldGroup';

describe('ReferralFieldGroup', () => {
  const defaultProps = {
    title: 'Patient Details',
    icon: <span data-testid="test-icon">Icon</span>,
    confidence: 0.9,
    fields: [
      { key: 'fullName', label: 'Full Name', value: 'John Smith' },
      { key: 'dob', label: 'Date of Birth', value: '1980-01-15', type: 'date' as const },
      { key: 'email', label: 'Email', value: '', type: 'email' as const },
    ],
    onFieldChange: vi.fn(),
    onAccept: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial render', () => {
    it('renders the title', () => {
      render(<ReferralFieldGroup {...defaultProps} />);

      expect(screen.getByText('Patient Details')).toBeInTheDocument();
    });

    it('renders the icon', () => {
      render(<ReferralFieldGroup {...defaultProps} />);

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('renders all field labels', () => {
      render(<ReferralFieldGroup {...defaultProps} />);

      expect(screen.getByText('Full Name')).toBeInTheDocument();
      expect(screen.getByText('Date of Birth')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('renders field values', () => {
      render(<ReferralFieldGroup {...defaultProps} />);

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('1980-01-15')).toBeInTheDocument();
    });

    it('shows placeholder for empty fields', () => {
      render(<ReferralFieldGroup {...defaultProps} />);

      expect(screen.getByText('Not provided')).toBeInTheDocument();
    });

    it('renders confidence indicator', () => {
      render(<ReferralFieldGroup {...defaultProps} />);

      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('starts expanded by default', () => {
      render(<ReferralFieldGroup {...defaultProps} />);

      expect(screen.getByText('John Smith')).toBeInTheDocument();
    });

    it('collapses when header is clicked', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} />);

      const header = screen.getByRole('button', { name: /patient details/i });
      await user.click(header);

      // When collapsed, the content section should not be in the document
      expect(screen.queryByText('Full Name')).not.toBeInTheDocument();
    });

    it('has correct aria-expanded attribute', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} />);

      const header = screen.getByRole('button', { name: /patient details/i });
      expect(header).toHaveAttribute('aria-expanded', 'true');

      await user.click(header);
      expect(header).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Field editing', () => {
    it('enters edit mode when field is clicked', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} />);

      const fieldButton = screen.getByText('John Smith');
      await user.click(fieldButton);

      const input = screen.getByDisplayValue('John Smith');
      expect(input).toBeInTheDocument();
      expect(input).toHaveFocus();
    });

    it('calls onFieldChange when field value changes', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} />);

      const fieldButton = screen.getByText('John Smith');
      await user.click(fieldButton);

      const input = screen.getByDisplayValue('John Smith');
      // Type a character to verify onChange is called
      await user.type(input, 'X');

      // onFieldChange is called for each keystroke
      expect(defaultProps.onFieldChange).toHaveBeenCalled();
      // The last call should have the appended character
      expect(defaultProps.onFieldChange).toHaveBeenLastCalledWith('fullName', 'John SmithX');
    });

    it('exits edit mode on blur', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} />);

      const fieldButton = screen.getByText('John Smith');
      await user.click(fieldButton);

      const input = screen.getByDisplayValue('John Smith');
      fireEvent.blur(input);

      expect(screen.queryByDisplayValue('John Smith')).not.toBeInTheDocument();
    });

    it('exits edit mode on Enter key', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} />);

      const fieldButton = screen.getByText('John Smith');
      await user.click(fieldButton);

      const input = screen.getByDisplayValue('John Smith');
      await user.keyboard('{Enter}');

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('exits edit mode on Escape key', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} />);

      const fieldButton = screen.getByText('John Smith');
      await user.click(fieldButton);

      const input = screen.getByDisplayValue('John Smith');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('Accept action', () => {
    it('renders Accept button', () => {
      render(<ReferralFieldGroup {...defaultProps} />);

      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });

    it('calls onAccept when Accept button is clicked', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /accept/i }));

      expect(defaultProps.onAccept).toHaveBeenCalled();
    });

    it('shows Accepted label when isAccepted is true', () => {
      render(<ReferralFieldGroup {...defaultProps} isAccepted />);

      // There will be "Accepted" in header and in button text
      const acceptedTexts = screen.getAllByText('Accepted');
      expect(acceptedTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('applies accepted styling when isAccepted is true', () => {
      const { container } = render(
        <ReferralFieldGroup {...defaultProps} isAccepted />
      );

      const group = container.firstChild;
      expect(group).toHaveClass('border-green-200', 'bg-green-50/50');
    });
  });

  describe('Clear action', () => {
    it('renders Clear button', () => {
      render(<ReferralFieldGroup {...defaultProps} />);

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('calls onClear when Clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /clear/i }));

      expect(defaultProps.onClear).toHaveBeenCalled();
    });

    it('shows cleared state when isCleared is true', () => {
      render(<ReferralFieldGroup {...defaultProps} isCleared />);

      expect(screen.getByText('(cleared)')).toBeInTheDocument();
    });

    it('shows Restore button when cleared', () => {
      render(<ReferralFieldGroup {...defaultProps} isCleared />);

      expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    });

    it('calls onRestore when Restore is clicked (if provided)', async () => {
      const onRestore = vi.fn();
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} isCleared onRestore={onRestore} />);

      await user.click(screen.getByRole('button', { name: /restore/i }));

      expect(onRestore).toHaveBeenCalled();
      expect(defaultProps.onAccept).not.toHaveBeenCalled();
    });

    it('falls back to onAccept when Restore is clicked (if onRestore not provided)', async () => {
      const user = userEvent.setup();
      render(<ReferralFieldGroup {...defaultProps} isCleared />);

      await user.click(screen.getByRole('button', { name: /restore/i }));

      expect(defaultProps.onAccept).toHaveBeenCalled();
    });

    it('does not allow editing when cleared', () => {
      render(<ReferralFieldGroup {...defaultProps} isCleared />);

      expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    });
  });

  describe('No data state', () => {
    it('does not show Accept/Clear buttons when no data', () => {
      const emptyFields = [
        { key: 'fullName', label: 'Full Name', value: '' },
        { key: 'dob', label: 'Date of Birth', value: '' },
      ];

      render(<ReferralFieldGroup {...defaultProps} fields={emptyFields} />);

      expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });
  });
});

describe('ReferralContextFieldGroup', () => {
  const defaultProps = {
    confidence: 0.85,
    reasonForReferral: 'Assessment of chest pain and shortness of breath.',
    keyProblems: ['Chest pain', 'Dyspnea on exertion'],
    investigationsMentioned: ['ECG', 'Chest X-ray'],
    medicationsMentioned: ['Aspirin', 'Metoprolol'],
    urgency: 'routine' as const,
    onReasonChange: vi.fn(),
    onProblemsChange: vi.fn(),
    onAccept: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial render', () => {
    it('renders the title', () => {
      render(<ReferralContextFieldGroup {...defaultProps} />);

      expect(screen.getByText('Referral Context')).toBeInTheDocument();
    });

    it('renders reason for referral', () => {
      render(<ReferralContextFieldGroup {...defaultProps} />);

      expect(
        screen.getByText('Assessment of chest pain and shortness of breath.')
      ).toBeInTheDocument();
    });

    it('renders key problems', () => {
      render(<ReferralContextFieldGroup {...defaultProps} />);

      expect(screen.getByText('Chest pain')).toBeInTheDocument();
      expect(screen.getByText('Dyspnea on exertion')).toBeInTheDocument();
    });

    it('renders investigations', () => {
      render(<ReferralContextFieldGroup {...defaultProps} />);

      expect(screen.getByText('ECG')).toBeInTheDocument();
      expect(screen.getByText('Chest X-ray')).toBeInTheDocument();
    });

    it('renders medications', () => {
      render(<ReferralContextFieldGroup {...defaultProps} />);

      expect(screen.getByText('Aspirin')).toBeInTheDocument();
      expect(screen.getByText('Metoprolol')).toBeInTheDocument();
    });

    it('renders urgency badge', () => {
      render(<ReferralContextFieldGroup {...defaultProps} />);

      expect(screen.getByText('routine')).toBeInTheDocument();
    });

    it('renders confidence indicator', () => {
      render(<ReferralContextFieldGroup {...defaultProps} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  describe('Urgency variants', () => {
    it('renders urgent badge with amber styling', () => {
      render(<ReferralContextFieldGroup {...defaultProps} urgency="urgent" />);

      const badge = screen.getByText('urgent');
      expect(badge).toHaveClass('bg-amber-100', 'text-amber-700');
    });

    it('renders emergency badge with red styling', () => {
      render(<ReferralContextFieldGroup {...defaultProps} urgency="emergency" />);

      const badge = screen.getByText('emergency');
      expect(badge).toHaveClass('bg-red-100', 'text-red-700');
    });
  });

  describe('Reason editing', () => {
    it('enters edit mode when reason is clicked', async () => {
      const user = userEvent.setup();
      render(<ReferralContextFieldGroup {...defaultProps} />);

      const reasonText = screen.getByText(
        'Assessment of chest pain and shortness of breath.'
      );
      await user.click(reasonText);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveFocus();
    });

    it('calls onReasonChange when reason is edited', async () => {
      const user = userEvent.setup();
      render(<ReferralContextFieldGroup {...defaultProps} />);

      const reasonText = screen.getByText(
        'Assessment of chest pain and shortness of breath.'
      );
      await user.click(reasonText);

      const textarea = screen.getByRole('textbox');
      // Type a single character to verify onChange is called
      await user.type(textarea, 'X');

      // onReasonChange should be called with original value + new character
      expect(defaultProps.onReasonChange).toHaveBeenCalled();
      // The last call should include the new character appended
      const lastCall = defaultProps.onReasonChange.mock.calls[defaultProps.onReasonChange.mock.calls.length - 1];
      expect(lastCall?.[0]).toContain('X');
    });
  });

  describe('Accept/Clear actions', () => {
    it('renders Accept button', () => {
      render(<ReferralContextFieldGroup {...defaultProps} />);

      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });

    it('calls onAccept when Accept is clicked', async () => {
      const user = userEvent.setup();
      render(<ReferralContextFieldGroup {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /accept/i }));

      expect(defaultProps.onAccept).toHaveBeenCalled();
    });

    it('shows accepted styling when isAccepted', () => {
      const { container } = render(
        <ReferralContextFieldGroup {...defaultProps} isAccepted />
      );

      const group = container.firstChild;
      expect(group).toHaveClass('border-green-200', 'bg-green-50/50');
    });

    it('shows cleared state when isCleared', () => {
      render(<ReferralContextFieldGroup {...defaultProps} isCleared />);

      expect(screen.getByText('(cleared)')).toBeInTheDocument();
    });
  });

  describe('Empty data handling', () => {
    it('shows placeholder when no reason provided', () => {
      render(
        <ReferralContextFieldGroup
          {...defaultProps}
          reasonForReferral={undefined}
          keyProblems={undefined}
          investigationsMentioned={undefined}
          medicationsMentioned={undefined}
        />
      );

      expect(screen.getByText('No reason provided')).toBeInTheDocument();
    });

    it('does not show sections for empty arrays', () => {
      render(
        <ReferralContextFieldGroup
          {...defaultProps}
          keyProblems={[]}
          investigationsMentioned={[]}
          medicationsMentioned={[]}
        />
      );

      expect(screen.queryByText('Key Problems')).not.toBeInTheDocument();
      expect(screen.queryByText('Investigations Mentioned')).not.toBeInTheDocument();
      expect(screen.queryByText('Medications Mentioned')).not.toBeInTheDocument();
    });
  });
});
