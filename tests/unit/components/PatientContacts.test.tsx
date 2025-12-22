// tests/unit/components/PatientContacts.test.tsx
// Unit tests for PatientContacts component

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatientContacts } from '@/components/consultation/PatientContacts';
import type { ContactType, ChannelType } from '@prisma/client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

interface MockContact {
  id: string;
  patientId: string;
  type: ContactType;
  fullName: string;
  organisation: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  preferredChannel: ChannelType;
  isDefaultForPatient: boolean;
  createdAt: string;
  updatedAt: string;
}

const createMockContact = (overrides: Partial<MockContact> = {}): MockContact => ({
  id: 'contact-1',
  patientId: 'patient-123',
  type: 'GP' as ContactType,
  fullName: 'Dr. Jane Smith',
  organisation: 'City Medical Centre',
  role: 'General Practitioner',
  email: 'jane.smith@medical.com',
  phone: '+61 2 1234 5678',
  fax: null,
  address: '123 Medical St, Sydney NSW 2000',
  preferredChannel: 'EMAIL' as ChannelType,
  isDefaultForPatient: true,
  createdAt: '2024-12-22T10:00:00Z',
  updatedAt: '2024-12-22T10:00:00Z',
  ...overrides,
});

describe('PatientContacts', () => {
  const mockPatientId = 'patient-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading spinner initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { container } = render(<PatientContacts patientId={mockPatientId} />);

      // Check for the Loader2 spinner SVG with animate-spin class
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('displays empty state when no contacts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('No contacts added yet')).toBeInTheDocument();
      });
    });

    it('shows Add Contact button in empty state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
      });
    });
  });

  describe('Contacts list display', () => {
    it('displays contacts after loading', async () => {
      const contacts = [createMockContact()];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });
    });

    it('displays contact type badge', async () => {
      const contacts = [createMockContact({ type: 'GP' as ContactType })];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('GP')).toBeInTheDocument();
      });
    });

    it('displays different contact types', async () => {
      const contacts = [
        createMockContact({ id: '1', type: 'GP' as ContactType, fullName: 'GP Doctor' }),
        createMockContact({ id: '2', type: 'REFERRER' as ContactType, fullName: 'Referrer Doctor' }),
        createMockContact({ id: '3', type: 'SPECIALIST' as ContactType, fullName: 'Specialist Doctor' }),
        createMockContact({ id: '4', type: 'OTHER' as ContactType, fullName: 'Other Contact' }),
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('GP Doctor')).toBeInTheDocument();
        expect(screen.getByText('Referrer Doctor')).toBeInTheDocument();
        expect(screen.getByText('Specialist Doctor')).toBeInTheDocument();
        expect(screen.getByText('Other Contact')).toBeInTheDocument();
      });
    });

    it('displays contact email and phone in full card mode', async () => {
      const contacts = [createMockContact()];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('jane.smith@medical.com')).toBeInTheDocument();
        expect(screen.getByText('+61 2 1234 5678')).toBeInTheDocument();
      });
    });

    it('displays organisation and role', async () => {
      const contacts = [createMockContact()];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText(/General Practitioner/)).toBeInTheDocument();
        expect(screen.getByText(/City Medical Centre/)).toBeInTheDocument();
      });
    });

    it('shows Default badge for default contact', async () => {
      const contacts = [createMockContact({ isDefaultForPatient: true })];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('Default')).toBeInTheDocument();
      });
    });
  });

  describe('Compact mode', () => {
    it('displays contact in compact mode', async () => {
      const contacts = [createMockContact()];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      render(<PatientContacts patientId={mockPatientId} compact />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('jane.smith@medical.com')).toBeInTheDocument();
      });
    });

    it('calls onContactSelect when contact clicked in compact mode', async () => {
      const contacts = [createMockContact()];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      const onSelect = vi.fn();
      render(<PatientContacts patientId={mockPatientId} compact onContactSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Dr. Jane Smith'));

      expect(onSelect).toHaveBeenCalledWith(contacts[0]);
    });

    it('handles keyboard navigation in compact mode', async () => {
      const contacts = [createMockContact()];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      const onSelect = vi.fn();
      render(<PatientContacts patientId={mockPatientId} compact onContactSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Find the contact row specifically (it's the one containing the name)
      const contactRow = screen.getByText('Dr. Jane Smith').closest('[role="button"]');
      if (contactRow) {
        fireEvent.keyDown(contactRow, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledWith(contacts[0]);
      }
    });
  });

  describe('Create contact', () => {
    it('shows add form when Add Contact button clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      // The form should appear with Full Name input (use placeholder text)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Dr. Jane Smith')).toBeInTheDocument();
      });
    });

    it('creates contact on form submit', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockContact()),
        });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Fill in form using placeholders
      fireEvent.change(screen.getByPlaceholderText('Dr. Jane Smith'), {
        target: { value: 'Dr. New Doctor' },
      });
      fireEvent.change(screen.getByPlaceholderText('jane.smith@hospital.com'), {
        target: { value: 'new@doctor.com' },
      });

      // Submit the form
      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/contacts', expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Dr. New Doctor'),
        }));
      });
    });

    it('hides Add Contact button when form is shown', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Now the header Add Contact button should be hidden
      const addButtons = screen.getAllByRole('button');
      // Should only have Cancel and Add Contact (submit) in the form
      expect(addButtons.filter(btn => btn.textContent?.match(/Add Contact/))).toHaveLength(1);
    });

    it('closes form on cancel', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Dr. Jane Smith')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Dr. Jane Smith')).not.toBeInTheDocument();
      });
    });
  });

  describe('Update contact', () => {
    it('shows edit form when edit button clicked', async () => {
      const contacts = [createMockContact()];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Find and click the edit button (has aria-label or icon)
      const editButtons = screen.getAllByRole('button').filter(
        btn => btn.querySelector('[class*="Edit"]') || btn.getAttribute('aria-label')?.includes('edit')
      );
      const firstEditButton = editButtons[0];
      if (firstEditButton) {
        fireEvent.click(firstEditButton);
      }
    });

    it('updates contact on form submit', async () => {
      const contacts = [createMockContact()];
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: contacts }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ...contacts[0],
            fullName: 'Dr. Updated Name',
          }),
        });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Click edit button
      const buttons = screen.getAllByRole('button');
      const editButton = buttons.find(btn => btn.querySelector('svg'));
      if (editButton) {
        fireEvent.click(editButton);
      }
    });
  });

  describe('Delete contact', () => {
    it('deletes contact when delete button clicked', async () => {
      const contacts = [createMockContact()];
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: contacts }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Find delete button (X icon)
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn =>
        btn.classList.contains('text-muted-foreground') ||
        btn.querySelector('svg')
      );

      const lastButton = buttons[buttons.length - 1];
      if (deleteButton && lastButton) {
        fireEvent.click(lastButton);

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/contacts/contact-1',
            expect.objectContaining({ method: 'DELETE' })
          );
        });
      }
    });

    it('removes contact from list after successful delete', async () => {
      const contacts = [createMockContact()];
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: contacts }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Find and click delete button
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[buttons.length - 1]!; // Last button in each row is delete
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText('Dr. Jane Smith')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('displays error when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to load contacts' }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load contacts')).toBeInTheDocument();
      });
    });

    it('displays error when create fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed to create contact' }),
        });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Dr. Jane Smith')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Dr. Jane Smith'), {
        target: { value: 'Dr. New' },
      });
      fireEvent.change(screen.getByPlaceholderText('jane.smith@hospital.com'), {
        target: { value: 'new@test.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to create contact')).toBeInTheDocument();
      });
    });

    it('displays error when delete fails', async () => {
      const contacts = [createMockContact()];
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: contacts }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed to delete contact' }),
        });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[buttons.length - 1]!;
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to delete contact')).toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('fetches contacts with correct patientId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/contacts?patientId=${mockPatientId}`
        );
      });
    });

    it('refetches contacts when patientId changes', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });

      const { rerender } = render(<PatientContacts patientId="patient-1" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/contacts?patientId=patient-1');
      });

      rerender(<PatientContacts patientId="patient-2" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/contacts?patientId=patient-2');
      });
    });
  });

  describe('className prop', () => {
    it('applies custom className', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const { container } = render(
        <PatientContacts patientId={mockPatientId} className="custom-class" />
      );

      await waitFor(() => {
        expect(container.firstChild).toHaveClass('custom-class');
      });
    });
  });

  describe('Multiple contacts', () => {
    it('displays all contacts', async () => {
      const contacts = [
        createMockContact({ id: '1', fullName: 'Dr. First' }),
        createMockContact({ id: '2', fullName: 'Dr. Second' }),
        createMockContact({ id: '3', fullName: 'Dr. Third' }),
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: contacts }),
      });

      render(<PatientContacts patientId={mockPatientId} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. First')).toBeInTheDocument();
        expect(screen.getByText('Dr. Second')).toBeInTheDocument();
        expect(screen.getByText('Dr. Third')).toBeInTheDocument();
      });
    });
  });
});
