// tests/unit/components/ContactForm.test.tsx
// Unit tests for ContactForm component

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactForm, type ContactFormData } from '@/components/consultation/ContactForm';
import type { ContactType, ChannelType } from '@prisma/client';

describe('ContactForm', () => {
  const defaultProps = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial render', () => {
    it('renders all form fields', () => {
      render(<ContactForm {...defaultProps} />);

      expect(screen.getByLabelText(/contact type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organisation/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/fax/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/preferred contact method/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/set as default contact/i)).toBeInTheDocument();
    });

    it('renders Cancel and Add Contact buttons', () => {
      render(<ContactForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
    });

    it('shows Update Contact button when initialData is provided', () => {
      render(
        <ContactForm
          {...defaultProps}
          initialData={{ fullName: 'Test', type: 'GP' as ContactType, preferredChannel: 'EMAIL' as ChannelType, isDefaultForPatient: false }}
        />
      );

      expect(screen.getByRole('button', { name: /update contact/i })).toBeInTheDocument();
    });

    it('uses default values for type and preferredChannel', () => {
      render(<ContactForm {...defaultProps} />);

      // Default contact type should be GP
      expect(screen.getByText('General Practitioner (GP)')).toBeInTheDocument();
      // Default preferred channel should be Email
      expect(screen.getByText('Email')).toBeInTheDocument();
    });
  });

  describe('Initial data population', () => {
    it('populates form with initial data', () => {
      const initialData: Partial<ContactFormData> = {
        type: 'REFERRER' as ContactType,
        fullName: 'Dr. Referrer',
        organisation: 'Hospital ABC',
        role: 'Cardiologist',
        email: 'referrer@hospital.com',
        phone: '+61 2 9876 5432',
        fax: '+61 2 9876 5433',
        address: '456 Hospital Way',
        preferredChannel: 'FAX' as ChannelType,
        isDefaultForPatient: true,
      };

      render(<ContactForm {...defaultProps} initialData={initialData} />);

      expect(screen.getByDisplayValue('Dr. Referrer')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Hospital ABC')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Cardiologist')).toBeInTheDocument();
      expect(screen.getByDisplayValue('referrer@hospital.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+61 2 9876 5432')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+61 2 9876 5433')).toBeInTheDocument();
      expect(screen.getByDisplayValue('456 Hospital Way')).toBeInTheDocument();
    });

    it('checks default checkbox when isDefaultForPatient is true', () => {
      render(
        <ContactForm
          {...defaultProps}
          initialData={{
            type: 'GP' as ContactType,
            fullName: 'Test',
            preferredChannel: 'EMAIL' as ChannelType,
            isDefaultForPatient: true,
          }}
        />
      );

      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  describe('Validation', () => {
    it('shows error when full name is empty', async () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('shows error when no contact method is provided', async () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(screen.getByText('At least one contact method is required')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('shows error for invalid email format', async () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'invalid-email' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email format')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('accepts phone as valid contact method', async () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });
      fireEvent.change(screen.getByLabelText(/phone/i), {
        target: { value: '+61 2 1234 5678' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalled();
      });
    });

    it('accepts fax as valid contact method', async () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });
      fireEvent.change(screen.getByLabelText(/fax/i), {
        target: { value: '+61 2 1234 5678' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalled();
      });
    });

    it('accepts address as valid contact method', async () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });
      fireEvent.change(screen.getByLabelText(/address/i), {
        target: { value: '123 Test Street' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalled();
      });
    });

    it('clears validation errors when field is corrected', async () => {
      render(<ContactForm {...defaultProps} />);

      // Submit empty form
      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });

      // Fix the error
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });

      expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('calls onSubmit with correct data', async () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Jane Smith' },
      });
      fireEvent.change(screen.getByLabelText(/organisation/i), {
        target: { value: 'City Hospital' },
      });
      fireEvent.change(screen.getByLabelText(/role/i), {
        target: { value: 'Cardiologist' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'jane@hospital.com' },
      });
      fireEvent.change(screen.getByLabelText(/phone/i), {
        target: { value: '+61 2 1234 5678' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
          type: 'GP',
          fullName: 'Dr. Jane Smith',
          organisation: 'City Hospital',
          role: 'Cardiologist',
          email: 'jane@hospital.com',
          phone: '+61 2 1234 5678',
          fax: undefined,
          address: undefined,
          preferredChannel: 'EMAIL',
          isDefaultForPatient: false,
        });
      });
    });

    it('trims whitespace from all text fields', async () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: '  Dr. Jane Smith  ' },
      });
      fireEvent.change(screen.getByLabelText(/organisation/i), {
        target: { value: '  City Hospital  ' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: '  jane@hospital.com  ' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            fullName: 'Dr. Jane Smith',
            organisation: 'City Hospital',
            email: 'jane@hospital.com',
          })
        );
      });
    });

    it('converts empty optional fields to undefined', async () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            organisation: undefined,
            role: undefined,
            phone: undefined,
            fax: undefined,
            address: undefined,
          })
        );
      });
    });
  });

  describe('Cancel button', () => {
    it('calls onCancel when Cancel button clicked', () => {
      render(<ContactForm {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('disables all inputs when loading', () => {
      render(<ContactForm {...defaultProps} isLoading />);

      expect(screen.getByLabelText(/full name/i)).toBeDisabled();
      expect(screen.getByLabelText(/organisation/i)).toBeDisabled();
      expect(screen.getByLabelText(/email/i)).toBeDisabled();
      expect(screen.getByLabelText(/phone/i)).toBeDisabled();
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('disables buttons when loading', () => {
      render(<ContactForm {...defaultProps} isLoading />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });

    it('shows loading spinner in submit button', () => {
      render(<ContactForm {...defaultProps} isLoading />);

      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  describe('Contact type selection', () => {
    it('uses the default contact type (GP)', async () => {
      render(<ContactForm {...defaultProps} />);

      // Fill required fields to verify default type is GP
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@test.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'GP' })
        );
      });
    });

    it('preserves contact type from initial data', async () => {
      render(
        <ContactForm
          {...defaultProps}
          initialData={{
            type: 'REFERRER' as ContactType,
            fullName: 'Dr. Referrer',
            preferredChannel: 'EMAIL' as ChannelType,
            isDefaultForPatient: false,
            email: 'ref@test.com',
          }}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /update contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'REFERRER' })
        );
      });
    });

    it('shows the contact type selector', () => {
      render(<ContactForm {...defaultProps} />);

      // The contact type section exists - look for the label
      expect(screen.getByText('Contact Type')).toBeInTheDocument();
    });
  });

  describe('Preferred channel selection', () => {
    it('uses the default preferred channel (EMAIL)', async () => {
      render(<ContactForm {...defaultProps} />);

      // Fill required fields to verify default channel is EMAIL
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@test.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ preferredChannel: 'EMAIL' })
        );
      });
    });

    it('preserves preferred channel from initial data', async () => {
      render(
        <ContactForm
          {...defaultProps}
          initialData={{
            type: 'GP' as ContactType,
            fullName: 'Dr. Test',
            preferredChannel: 'FAX' as ChannelType,
            isDefaultForPatient: false,
            fax: '+61 2 1234 5678',
          }}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /update contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ preferredChannel: 'FAX' })
        );
      });
    });

    it('shows the default channel option in the dropdown', () => {
      render(<ContactForm {...defaultProps} />);

      // The preferred contact method section exists with Email as a label
      const channelLabels = screen.getAllByText(/email/i);
      expect(channelLabels.length).toBeGreaterThan(0);
    });
  });

  describe('Default contact checkbox', () => {
    it('toggles isDefaultForPatient when checkbox clicked', async () => {
      render(<ContactForm {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(checkbox).toBeChecked();

      // Fill required fields
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ isDefaultForPatient: true })
        );
      });
    });
  });

  describe('Error handling from parent', () => {
    it('handles submit failure gracefully', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'));
      render(<ContactForm {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Dr. Test' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });

      // Form should still be rendered (error handled by parent)
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has required indicator on name field', () => {
      render(<ContactForm {...defaultProps} />);

      expect(screen.getByText('Full Name *')).toBeInTheDocument();
    });

    it('associates labels with inputs', () => {
      render(<ContactForm {...defaultProps} />);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    });
  });
});
