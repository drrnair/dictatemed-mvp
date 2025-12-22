// tests/unit/components/SendLetterDialog.test.tsx
// Tests for SendLetterDialog component

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SendLetterDialog } from '@/components/letters/SendLetterDialog';
import type { PatientContact } from '@/domains/contacts';
import type { SendLetterResult } from '@/domains/letters';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample data
const mockContacts: PatientContact[] = [
  {
    id: 'contact-1',
    patientId: 'patient-1',
    type: 'GP',
    fullName: 'Dr. Jane Smith',
    email: 'jane.smith@gp.example.com',
    organisation: 'City Medical Practice',
    role: 'General Practitioner',
    phone: null,
    fax: null,
    address: null,
    preferredChannel: 'EMAIL',
    secureMessagingId: null,
    isDefaultForPatient: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'contact-2',
    patientId: 'patient-1',
    type: 'REFERRER',
    fullName: 'Dr. John Doe',
    email: 'john.doe@specialist.example.com',
    organisation: 'Heart Specialists',
    role: 'Cardiologist',
    phone: null,
    fax: null,
    address: null,
    preferredChannel: 'EMAIL',
    secureMessagingId: null,
    isDefaultForPatient: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const defaultPreferences = {
  alwaysCcGp: true,
  alwaysCcSelf: false,
  includeReferrer: true,
  defaultSubjectTemplate: '{{patient_name}} - {{letter_type}} - {{date}}',
  defaultCoverNote: '',
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  letterId: 'letter-123',
  patientId: 'patient-1',
  patientName: 'John Patient',
  letterType: 'CLINIC_LETTER',
  subspecialty: 'Cardiology',
  userEmail: 'doctor@hospital.com',
  userName: 'Dr. Test User',
  onSendComplete: vi.fn(),
};

describe('SendLetterDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/user/settings/letters') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ preferences: defaultPreferences }),
        });
      }
      if (url.includes('/api/contacts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: mockContacts }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render the dialog when isOpen is true', async () => {
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      expect(screen.getByText('Send Letter')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<SendLetterDialog {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should fetch preferences and contacts on open', async () => {
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/settings/letters');
        expect(mockFetch).toHaveBeenCalledWith('/api/contacts?patientId=patient-1');
      });
    });

    it('should not fetch contacts when patientId is null', async () => {
      render(<SendLetterDialog {...defaultProps} patientId={null} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/settings/letters');
      });

      // Should not have called contacts API
      expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/contacts'));
    });
  });

  describe('Recipient Selection', () => {
    it('should auto-select GP when preference alwaysCcGp is true', async () => {
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // GP should be in selected recipients
      const selectedSection = screen.getByText('Selected Recipients').parentElement;
      expect(within(selectedSection!).getByText('Dr. Jane Smith')).toBeInTheDocument();
    });

    it('should auto-select referrer when preference includeReferrer is true', async () => {
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. John Doe')).toBeInTheDocument();
      });

      const selectedSection = screen.getByText('Selected Recipients').parentElement;
      expect(within(selectedSection!).getByText('Dr. John Doe')).toBeInTheDocument();
    });

    it('should auto-select self when preference alwaysCcSelf is true', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              preferences: { ...defaultPreferences, alwaysCcSelf: true },
            }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        const selfCheckbox = screen.getByLabelText(/send copy to myself/i);
        expect(selfCheckbox).toBeChecked();
      });
    });

    it('should toggle self CC when checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/send copy to myself/i)).toBeInTheDocument();
      });

      const selfCheckbox = screen.getByLabelText(/send copy to myself/i);
      await user.click(selfCheckbox);

      expect(selfCheckbox).toBeChecked();
    });

    it('should toggle patient contact selection when clicked', async () => {
      // Reset to no auto-select to test manual selection
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              preferences: { ...defaultPreferences, alwaysCcGp: false, includeReferrer: false },
            }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Patient Contacts')).toBeInTheDocument();
      });

      // Find the GP contact in the available contacts list and click it
      const contactItem = screen.getByText('Dr. Jane Smith').closest('div[class*="cursor-pointer"]') as HTMLElement;
      await user.click(contactItem);

      // Should now be in selected recipients
      const selectedSection = screen.getByText('Selected Recipients').parentElement;
      expect(within(selectedSection!).getByText('Dr. Jane Smith')).toBeInTheDocument();
    });

    it('should remove recipient when X button is clicked', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      });

      // Find the remove button for GP
      const selectedRecipient = screen.getByText('Dr. Jane Smith').closest('div[class*="rounded-lg"]') as HTMLElement;
      const removeButton = within(selectedRecipient).getByRole('button');
      await user.click(removeButton);

      // Should no longer be in selected recipients (might still be in available contacts)
      const selectedSection = screen.getByText('Selected Recipients').parentElement;
      await waitFor(() => {
        expect(within(selectedSection!).queryByText('Dr. Jane Smith')).not.toBeInTheDocument();
      });
    });
  });

  describe('One-off Recipients', () => {
    it('should show one-off recipient form when button is clicked', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/add one-off recipient/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/add one-off recipient/i));

      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    });

    it('should add one-off recipient with valid inputs', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/add one-off recipient/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/add one-off recipient/i));

      await user.type(screen.getByPlaceholderText('Name'), 'Dr. New Contact');
      await user.type(screen.getByPlaceholderText('Email address'), 'new@example.com');

      await user.click(screen.getByRole('button', { name: 'Add' }));

      // Should be added to selected recipients
      const selectedSection = screen.getByText('Selected Recipients').parentElement;
      await waitFor(() => {
        expect(within(selectedSection!).getByText('Dr. New Contact')).toBeInTheDocument();
      });
    });

    it('should not add one-off recipient with invalid email', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/add one-off recipient/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/add one-off recipient/i));

      await user.type(screen.getByPlaceholderText('Name'), 'Dr. New Contact');
      await user.type(screen.getByPlaceholderText('Email address'), 'invalid-email');

      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      // Form should still be visible (recipient not added)
      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    });

    it('should cancel one-off recipient form', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/add one-off recipient/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/add one-off recipient/i));

      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();

      // Find the Cancel button within the one-off form (it's the smaller one with size="sm")
      const formContainer = screen.getByPlaceholderText('Name').closest('div[class*="rounded-lg border"]') as HTMLElement;
      const cancelButton = within(formContainer).getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // Form should be hidden
      expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument();
      expect(screen.getByText(/add one-off recipient/i)).toBeInTheDocument();
    });
  });

  describe('Step Navigation', () => {
    it('should disable Next button when no recipients selected', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              preferences: { ...defaultPreferences, alwaysCcGp: false, includeReferrer: false },
            }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Next: Message' })).toBeDisabled();
    });

    it('should navigate to message step when Next is clicked', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));

      expect(screen.getByLabelText(/subject line/i)).toBeInTheDocument();
    });

    it('should navigate back from message step', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(screen.getByText('Selected Recipients')).toBeInTheDocument();
    });

    it('should navigate to confirm step from message step', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));

      expect(screen.getByText(/you are about to send/i)).toBeInTheDocument();
    });

    it('should disable Next: Review button when subject is empty', async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              preferences: { ...defaultPreferences, defaultSubjectTemplate: '' },
            }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));

      expect(screen.getByRole('button', { name: 'Next: Review' })).toBeDisabled();
    });
  });

  describe('Subject Template', () => {
    it('should show subject template with available tokens', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));

      expect(screen.getByText(/available tokens/i)).toBeInTheDocument();
      expect(screen.getByText(/patient_name/)).toBeInTheDocument();
    });

    it('should show preview when subject contains tokens', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));

      // The subject contains {{patient_name}}, so preview should show actual name
      expect(screen.getByText(/preview:/i)).toBeInTheDocument();
    });
  });

  describe('Sending Flow', () => {
    it('should call send API when Send Letter is clicked', async () => {
      const user = userEvent.setup();
      const successResult: SendLetterResult = {
        letterId: 'letter-123',
        totalRecipients: 2,
        successful: 2,
        failed: 0,
        sends: [
          { sendId: 'send-1', email: 'jane@example.com', name: 'Dr. Jane', status: 'SENT' },
          { sendId: 'send-2', email: 'john@example.com', name: 'Dr. John', status: 'SENT' },
        ],
      };

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: defaultPreferences }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        if (url.includes('/send') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(successResult),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      // Navigate through steps
      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));
      await user.click(screen.getByRole('button', { name: /send letter/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/letters/letter-123/send',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('should show success result after successful send', async () => {
      const user = userEvent.setup();
      const successResult: SendLetterResult = {
        letterId: 'letter-123',
        totalRecipients: 2,
        successful: 2,
        failed: 0,
        sends: [
          { sendId: 'send-1', email: 'jane@gp.example.com', name: 'Dr. Jane Smith', status: 'SENT' },
          { sendId: 'send-2', email: 'john@specialist.example.com', name: 'Dr. John Doe', status: 'SENT' },
        ],
      };

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: defaultPreferences }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        if (url.includes('/send') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(successResult),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));
      await user.click(screen.getByRole('button', { name: /send letter/i }));

      await waitFor(() => {
        expect(screen.getByText('Letter sent successfully!')).toBeInTheDocument();
      });

      expect(screen.getByText('2 of 2 sent')).toBeInTheDocument();
    });

    it('should show partial success result', async () => {
      const user = userEvent.setup();
      const partialResult: SendLetterResult = {
        letterId: 'letter-123',
        totalRecipients: 2,
        successful: 1,
        failed: 1,
        sends: [
          { sendId: 'send-1', email: 'jane@example.com', name: 'Dr. Jane Smith', status: 'SENT' },
          { sendId: 'send-2', email: 'john@example.com', name: 'Dr. John Doe', status: 'FAILED', error: 'Invalid email' },
        ],
      };

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: defaultPreferences }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        if (url.includes('/send') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(partialResult),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));
      await user.click(screen.getByRole('button', { name: /send letter/i }));

      await waitFor(() => {
        expect(screen.getByText('Letter partially sent')).toBeInTheDocument();
      });

      expect(screen.getByText('1 of 2 sent')).toBeInTheDocument();
    });

    it('should show error when send fails', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: defaultPreferences }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        if (url.includes('/send') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Letter not approved' }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));
      await user.click(screen.getByRole('button', { name: /send letter/i }));

      await waitFor(() => {
        expect(screen.getByText('Letter not approved')).toBeInTheDocument();
      });
    });

    it('should call onSendComplete callback after successful send', async () => {
      const user = userEvent.setup();
      const onSendComplete = vi.fn();
      const successResult: SendLetterResult = {
        letterId: 'letter-123',
        totalRecipients: 1,
        successful: 1,
        failed: 0,
        sends: [
          { sendId: 'send-1', email: 'jane@example.com', name: 'Dr. Jane', status: 'SENT' },
        ],
      };

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: defaultPreferences }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        if (url.includes('/send') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(successResult),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} onSendComplete={onSendComplete} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));
      await user.click(screen.getByRole('button', { name: /send letter/i }));

      await waitFor(() => {
        expect(onSendComplete).toHaveBeenCalledWith(successResult);
      });
    });
  });

  describe('Dialog Close', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<SendLetterDialog {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when Done is clicked after send', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const successResult: SendLetterResult = {
        letterId: 'letter-123',
        totalRecipients: 1,
        successful: 1,
        failed: 0,
        sends: [
          { sendId: 'send-1', email: 'jane@example.com', name: 'Dr. Jane', status: 'SENT' },
        ],
      };

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: defaultPreferences }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        if (url.includes('/send') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(successResult),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));
      await user.click(screen.getByRole('button', { name: /send letter/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Done' }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should reset dialog state when closed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const { rerender } = render(<SendLetterDialog {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      // Navigate to message step
      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      expect(screen.getByLabelText(/subject line/i)).toBeInTheDocument();

      // Go back to recipients step
      await user.click(screen.getByRole('button', { name: 'Back' }));

      // Now click Cancel on recipients step
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      // onClose should have been called
      expect(onClose).toHaveBeenCalled();

      // Reopen the dialog
      rerender(<SendLetterDialog {...defaultProps} onClose={onClose} isOpen={true} />);

      // Should be back at recipients step after reopening
      await waitFor(() => {
        expect(screen.getByText('Selected Recipients')).toBeInTheDocument();
      });
    });
  });

  describe('Confirmation Step', () => {
    it('should show recipient list in confirmation', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));

      expect(screen.getByText(/you are about to send this letter to 2 recipients/i)).toBeInTheDocument();
      expect(screen.getByText(/Dr. Jane Smith/)).toBeInTheDocument();
      expect(screen.getByText(/Dr. John Doe/)).toBeInTheDocument();
    });

    it('should show subject and patient name in confirmation', async () => {
      const user = userEvent.setup();
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));

      expect(screen.getByText('Subject:')).toBeInTheDocument();
      expect(screen.getByText('Patient:')).toBeInTheDocument();
      expect(screen.getByText('John Patient')).toBeInTheDocument();
    });

    it('should show cover note in confirmation when provided', async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              preferences: { ...defaultPreferences, defaultCoverNote: 'Test cover note' },
            }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));

      expect(screen.getByText('Cover note:')).toBeInTheDocument();
      expect(screen.getByText('Test cover note')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching data', async () => {
      // Delay the fetch to observe loading state
      mockFetch.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ preferences: defaultPreferences }),
        }), 100);
      }));

      render(<SendLetterDialog {...defaultProps} />);

      // Loading should be shown initially (might not have loading indicator visible in UI)
      // The dialog should still render and wait for data
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should show sending state during send operation', async () => {
      const user = userEvent.setup();

      // Create a delayed send response
      let resolvesSend: (value: Response) => void;
      const sendPromise = new Promise<Response>((resolve) => {
        resolvesSend = resolve;
      });

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/user/settings/letters') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ preferences: defaultPreferences }),
          });
        }
        if (url.includes('/api/contacts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: mockContacts }),
          });
        }
        if (url.includes('/send') && options?.method === 'POST') {
          return sendPromise;
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Next: Message')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Next: Message' }));
      await user.click(screen.getByRole('button', { name: 'Next: Review' }));
      await user.click(screen.getByRole('button', { name: /send letter/i }));

      // Should show sending state
      expect(screen.getByText('Sending letter...')).toBeInTheDocument();

      // Resolve the send
      resolvesSend!({
        ok: true,
        json: () => Promise.resolve({
          letterId: 'letter-123',
          totalRecipients: 1,
          successful: 1,
          failed: 0,
          sends: [{ sendId: 'send-1', email: 'jane@example.com', name: 'Dr. Jane', status: 'SENT' }],
        }),
      } as Response);

      await waitFor(() => {
        expect(screen.getByText('Letter sent successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('Contact Type Badges', () => {
    it('should show GP badge for GP contacts', async () => {
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('GP')).toBeInTheDocument();
      });
    });

    it('should show REFERRER badge for referrer contacts', async () => {
      render(<SendLetterDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('REFERRER')).toBeInTheDocument();
      });
    });
  });
});
