// tests/unit/domains/letters/sending.service.test.ts
// Tests for letter sending service (unit tests with mocked dependencies)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing the service
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    letter: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    letterSend: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock encryption
vi.mock('@/infrastructure/db/encryption', () => ({
  decryptPatientData: vi.fn(),
}));

// Mock PDF service
vi.mock('@/domains/letters/pdf.service', () => ({
  generateLetterPdf: vi.fn(),
}));

// Mock email infrastructure
const mockSendEmail = vi.fn();
vi.mock('@/infrastructure/email', () => ({
  getEmailAdapter: () => ({
    sendEmail: mockSendEmail,
    validateEmail: (email: string) => email.includes('@'),
    getName: () => 'MockEmailAdapter',
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import {
  sendLetter,
  retrySend,
  getSendHistory,
  getSend,
  processSubjectTemplate,
} from '@/domains/letters/sending.service';
import { prisma } from '@/infrastructure/db/client';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { generateLetterPdf } from '@/domains/letters/pdf.service';
import type { PatientData } from '@/infrastructure/db/encryption';

// Helper to create mock patient data with required fields
const mockPatientData = (name: string): PatientData => ({
  name,
  dateOfBirth: '1960-01-01',
});

describe('sending.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLetter = {
    id: 'letter-1',
    status: 'APPROVED',
    contentFinal: 'This is the letter content.',
    letterType: 'NEW_PATIENT',
    approvedAt: new Date('2024-03-15'),
    patient: {
      id: 'patient-1',
      encryptedData: 'encrypted-patient-data',
    },
    user: {
      id: 'user-1',
      practiceId: 'practice-1',
    },
  };

  const mockSender = {
    id: 'sender-1',
    practiceId: 'practice-1',
  };

  const mockLetterSend = {
    id: 'send-1',
    letterId: 'letter-1',
    senderId: 'sender-1',
    patientContactId: 'contact-1',
    recipientName: 'Dr. John Smith',
    recipientEmail: 'john.smith@example.com',
    recipientType: 'GP',
    channel: 'EMAIL',
    subject: 'Patient Letter',
    coverNote: null,
    status: 'QUEUED',
    queuedAt: new Date(),
    sentAt: null,
    failedAt: null,
    errorMessage: null,
    externalId: null,
    createdAt: new Date(),
  };

  describe('sendLetter', () => {
    it('should send a letter to single recipient successfully', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue({
        ...mockLetterSend,
        status: 'SENT',
        sentAt: new Date(),
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-123' });

      const result = await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [
          {
            contactId: 'contact-1',
            name: 'Dr. John Smith',
            email: 'john.smith@example.com',
            type: 'GP',
            channel: 'EMAIL',
          },
        ],
        subject: 'Patient Letter',
      });

      expect(result.letterId).toBe('letter-1');
      expect(result.totalRecipients).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.sends[0]!.status).toBe('SENT');
      expect(result.sends[0]!.messageId).toBe('msg-123');
    });

    it('should send to multiple recipients and track individual results', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue({
        ...mockLetterSend,
        status: 'SENT',
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-123' });

      const result = await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [
          { name: 'Dr. Smith', email: 'smith@example.com', channel: 'EMAIL' },
          { name: 'Dr. Jones', email: 'jones@example.com', channel: 'EMAIL' },
          { name: 'Self', email: 'me@example.com', channel: 'EMAIL' },
        ],
        subject: 'Patient Letter',
      });

      expect(result.totalRecipients).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.sends).toHaveLength(3);
    });

    it('should handle partial failures correctly', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      // First send succeeds, second fails
      mockSendEmail
        .mockResolvedValueOnce({ success: true, messageId: 'msg-1' })
        .mockResolvedValueOnce({ success: false, error: 'Invalid recipient' });

      const result = await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [
          { name: 'Dr. Good', email: 'good@example.com', channel: 'EMAIL' },
          { name: 'Dr. Bad', email: 'bad@example.com', channel: 'EMAIL' },
        ],
        subject: 'Patient Letter',
      });

      expect(result.totalRecipients).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.sends[0]!.status).toBe('SENT');
      expect(result.sends[1]!.status).toBe('FAILED');
      expect(result.sends[1]!.error).toBe('Invalid recipient');
    });

    it('should throw error when letter not found', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(null);

      await expect(
        sendLetter({
          letterId: 'non-existent',
          senderId: 'sender-1',
          recipients: [{ name: 'Test', email: 'test@example.com', channel: 'EMAIL' }],
          subject: 'Test',
        })
      ).rejects.toThrow('Letter not found');
    });

    it('should throw error when letter is not approved', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        status: 'DRAFT',
      } as any);

      await expect(
        sendLetter({
          letterId: 'letter-1',
          senderId: 'sender-1',
          recipients: [{ name: 'Test', email: 'test@example.com', channel: 'EMAIL' }],
          subject: 'Test',
        })
      ).rejects.toThrow('Only approved letters can be sent');
    });

    it('should throw error when letter has no content', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: null,
      } as any);

      await expect(
        sendLetter({
          letterId: 'letter-1',
          senderId: 'sender-1',
          recipients: [{ name: 'Test', email: 'test@example.com', channel: 'EMAIL' }],
          subject: 'Test',
        })
      ).rejects.toThrow('Letter has no approved content');
    });

    it('should throw error when sender is not authorized', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        practiceId: 'different-practice',
      } as any);

      await expect(
        sendLetter({
          letterId: 'letter-1',
          senderId: 'sender-1',
          recipients: [{ name: 'Test', email: 'test@example.com', channel: 'EMAIL' }],
          subject: 'Test',
        })
      ).rejects.toThrow('Unauthorized');
    });

    it('should include cover note in email when provided', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue({ success: true });

      await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [{ name: 'Dr. Smith', email: 'smith@example.com', channel: 'EMAIL' }],
        subject: 'Patient Letter',
        coverNote: 'Please see attached for your records.',
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyHtml: expect.stringContaining('Please see attached for your records.'),
        })
      );
    });

    it('should create audit log entry with correct metadata', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      mockSendEmail.mockResolvedValue({ success: true });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [
          { name: 'Dr. Smith', email: 'smith@example.com', channel: 'EMAIL' },
          { name: 'Dr. Jones', email: 'jones@example.com', channel: 'EMAIL' },
        ],
        subject: 'Patient Letter',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'sender-1',
          action: 'letter.send',
          resourceType: 'letter',
          resourceId: 'letter-1',
          metadata: {
            recipientCount: 2,
            successCount: 2,
            failedCount: 0,
          },
        },
      });
    });

    it('should handle email adapter throwing an error', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      mockSendEmail.mockRejectedValue(new Error('Network error'));

      const result = await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [{ name: 'Test', email: 'test@example.com', channel: 'EMAIL' }],
        subject: 'Test',
      });

      expect(result.failed).toBe(1);
      expect(result.sends[0]!.status).toBe('FAILED');
      expect(result.sends[0]!.error).toBe('Network error');
    });

    it('should handle patient decryption failure gracefully', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue({ success: true });

      // Should not throw, should use "Patient" as default
      const result = await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [{ name: 'Test', email: 'test@example.com', channel: 'EMAIL' }],
        subject: 'Test',
      });

      expect(result.successful).toBe(1);
    });

    it('should handle one-off recipients without contactId', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue({
        ...mockLetterSend,
        patientContactId: null,
      } as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue({ success: true });

      await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [
          {
            name: 'One-off Recipient',
            email: 'oneoff@example.com',
            channel: 'EMAIL',
            // No contactId - one-off recipient
          },
        ],
        subject: 'Patient Letter',
      });

      expect(prisma.letterSend.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientContactId: null,
        }),
      });
    });
  });

  describe('retrySend', () => {
    const mockFailedSend = {
      ...mockLetterSend,
      status: 'FAILED',
      failedAt: new Date(),
      errorMessage: 'Previous failure',
      letter: {
        id: 'letter-1',
        status: 'APPROVED',
        user: {
          practiceId: 'practice-1',
        },
        patient: {
          encryptedData: 'encrypted-data',
        },
      },
    };

    it('should retry a failed send successfully', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue(mockFailedSend as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.update).mockResolvedValue({
        ...mockLetterSend,
        status: 'SENT',
        sentAt: new Date(),
      } as any);
      mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-retry' });

      const result = await retrySend({
        sendId: 'send-1',
        userId: 'sender-1',
      });

      expect(result.status).toBe('SENT');
      expect(result.messageId).toBe('msg-retry');
    });

    it('should throw error when send record not found', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue(null);

      await expect(
        retrySend({ sendId: 'non-existent', userId: 'user-1' })
      ).rejects.toThrow('Send record not found');
    });

    it('should throw error when send is not in FAILED status', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue({
        ...mockFailedSend,
        status: 'SENT',
      } as any);

      await expect(
        retrySend({ sendId: 'send-1', userId: 'user-1' })
      ).rejects.toThrow('Only failed sends can be retried');
    });

    it('should throw error when user is not authorized', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue(mockFailedSend as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        practiceId: 'different-practice',
      } as any);

      await expect(
        retrySend({ sendId: 'send-1', userId: 'user-1' })
      ).rejects.toThrow('Unauthorized');
    });

    it('should handle retry failure', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue(mockFailedSend as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.update).mockResolvedValue({
        ...mockLetterSend,
        status: 'FAILED',
      } as any);
      mockSendEmail.mockResolvedValue({ success: false, error: 'Still failing' });

      const result = await retrySend({
        sendId: 'send-1',
        userId: 'sender-1',
      });

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Still failing');
    });

    it('should clear previous error message on retry', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue(mockFailedSend as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      mockSendEmail.mockResolvedValue({ success: true });

      await retrySend({ sendId: 'send-1', userId: 'sender-1' });

      // Check that errorMessage was cleared when updating to SENDING
      expect(prisma.letterSend.update).toHaveBeenCalledWith({
        where: { id: 'send-1' },
        data: {
          status: 'SENDING',
          errorMessage: null,
          failedAt: null,
        },
      });
    });
  });

  describe('getSendHistory', () => {
    it('should return send history for a letter', async () => {
      const sends = [
        {
          ...mockLetterSend,
          id: 'send-1',
          status: 'SENT',
          sentAt: new Date(),
        },
        {
          ...mockLetterSend,
          id: 'send-2',
          recipientEmail: 'another@example.com',
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: 'Delivery failed',
        },
      ];

      vi.mocked(prisma.letterSend.findMany).mockResolvedValue(sends as any);

      const result = await getSendHistory('letter-1');

      expect(prisma.letterSend.findMany).toHaveBeenCalledWith({
        where: { letterId: 'letter-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]!.status).toBe('SENT');
      expect(result[1]!.status).toBe('FAILED');
      expect(result[1]!.errorMessage).toBe('Delivery failed');
    });

    it('should return empty array when no sends exist', async () => {
      vi.mocked(prisma.letterSend.findMany).mockResolvedValue([]);

      const result = await getSendHistory('letter-1');

      expect(result).toEqual([]);
    });
  });

  describe('getSend', () => {
    it('should return a single send record', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue(mockLetterSend as any);

      const result = await getSend('send-1');

      expect(prisma.letterSend.findUnique).toHaveBeenCalledWith({
        where: { id: 'send-1' },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe('send-1');
      expect(result?.recipientName).toBe('Dr. John Smith');
    });

    it('should return null when send not found', async () => {
      vi.mocked(prisma.letterSend.findUnique).mockResolvedValue(null);

      const result = await getSend('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('processSubjectTemplate', () => {
    it('should replace patient_name token', () => {
      const result = processSubjectTemplate('Letter for {{patient_name}}', {
        patientName: 'John Doe',
      });

      expect(result).toBe('Letter for John Doe');
    });

    it('should replace letter_type token', () => {
      const result = processSubjectTemplate('{{letter_type}} Letter', {
        letterType: 'NEW_PATIENT',
      });

      expect(result).toBe('New Patient Letter');
    });

    it('should replace subspecialty token', () => {
      const result = processSubjectTemplate('{{subspecialty}} Consultation', {
        subspecialty: 'Cardiology',
      });

      expect(result).toBe('Cardiology Consultation');
    });

    it('should replace date token with formatted date', () => {
      const testDate = new Date('2024-03-15');
      const result = processSubjectTemplate('Letter dated {{date}}', {
        date: testDate,
      });

      expect(result).toBe('Letter dated 15/03/2024');
    });

    it('should replace multiple tokens', () => {
      const result = processSubjectTemplate(
        '{{patient_name}} - {{letter_type}} - {{date}}',
        {
          patientName: 'John Doe',
          letterType: 'FOLLOW_UP',
          date: new Date('2024-03-15'),
        }
      );

      expect(result).toBe('John Doe - Follow Up - 15/03/2024');
    });

    it('should use default values for missing tokens', () => {
      const result = processSubjectTemplate(
        '{{patient_name}} - {{subspecialty}} - {{letter_type}}',
        {}
      );

      expect(result).toBe('Patient - Cardiology - Letter');
    });

    it('should handle templates with no tokens', () => {
      const result = processSubjectTemplate('Plain subject line', {
        patientName: 'John Doe',
      });

      expect(result).toBe('Plain subject line');
    });

    it('should handle repeated tokens', () => {
      const result = processSubjectTemplate(
        '{{patient_name}} consultation for {{patient_name}}',
        { patientName: 'Jane Smith' }
      );

      expect(result).toBe('Jane Smith consultation for Jane Smith');
    });
  });

  describe('email body generation', () => {
    it('should include confidentiality notice in email body', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue({ success: true });

      await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [{ name: 'Test', email: 'test@example.com', channel: 'EMAIL' }],
        subject: 'Test',
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyHtml: expect.stringContaining('CONFIDENTIAL'),
          bodyText: expect.stringContaining('confidential'),
        })
      );
    });

    it('should include PDF attachment with proper filename', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('John Doe'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue({ success: true });

      await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [{ name: 'Test', email: 'test@example.com', channel: 'EMAIL' }],
        subject: 'Test',
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: expect.stringMatching(/^John_Doe_Letter_\d{8}\.pdf$/),
              contentType: 'application/pdf',
            }),
          ]),
        })
      );
    });

    it('should sanitize patient name in filename', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockSender as any);
      vi.mocked(decryptPatientData).mockReturnValue(mockPatientData('José O\'Brien-Smith'));
      vi.mocked(generateLetterPdf).mockResolvedValue(Buffer.from('%PDF-1.4'));
      vi.mocked(prisma.letterSend.create).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.letterSend.update).mockResolvedValue(mockLetterSend as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      mockSendEmail.mockResolvedValue({ success: true });

      await sendLetter({
        letterId: 'letter-1',
        senderId: 'sender-1',
        recipients: [{ name: 'Test', email: 'test@example.com', channel: 'EMAIL' }],
        subject: 'Test',
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              // Special characters should be removed
              filename: expect.stringMatching(/^Jos_OBrien-Smith_Letter_\d{8}\.pdf$/),
            }),
          ]),
        })
      );
    });
  });
});
