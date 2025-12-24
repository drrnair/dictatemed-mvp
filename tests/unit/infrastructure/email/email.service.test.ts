// tests/unit/infrastructure/email/email.service.test.ts
// Unit tests for email service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateLetterEmailHtml,
  generateLetterEmailText,
  generateLetterEmailSubject,
  type LetterEmailData,
} from '@/infrastructure/email/templates/letter';

// Mock data for tests
const mockLetterData: LetterEmailData = {
  recipientName: 'Dr. John Smith',
  senderName: 'Dr. Sarah Johnson',
  practiceName: 'Sydney Cardiology',
  patientIdentifier: 'JD',
  letterType: 'New Patient Consultation',
  consultationDate: '15 December 2024',
  contentPreview: 'Thank you for referring this patient with suspected coronary artery disease.',
};

describe('Email Templates', () => {
  describe('generateLetterEmailSubject', () => {
    it('should generate subject with letter type and patient identifier', () => {
      const subject = generateLetterEmailSubject({
        letterType: 'New Patient Consultation',
        patientIdentifier: 'JD',
        practiceName: 'Sydney Cardiology',
      });

      expect(subject).toBe('New Patient Consultation - Patient JD | Sydney Cardiology');
    });

    it('should handle different letter types', () => {
      const subject = generateLetterEmailSubject({
        letterType: 'Follow-Up Consultation',
        patientIdentifier: 'AB',
        practiceName: 'Heart Centre',
      });

      expect(subject).toBe('Follow-Up Consultation - Patient AB | Heart Centre');
    });
  });

  describe('generateLetterEmailHtml', () => {
    it('should generate valid HTML email', () => {
      const html = generateLetterEmailHtml(mockLetterData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should include recipient name', () => {
      const html = generateLetterEmailHtml(mockLetterData);

      expect(html).toContain('Dear Dr. John Smith');
    });

    it('should include sender name and practice', () => {
      const html = generateLetterEmailHtml(mockLetterData);

      expect(html).toContain('Dr. Sarah Johnson');
      expect(html).toContain('Sydney Cardiology');
    });

    it('should include patient identifier', () => {
      const html = generateLetterEmailHtml(mockLetterData);

      expect(html).toContain('JD');
    });

    it('should include consultation date', () => {
      const html = generateLetterEmailHtml(mockLetterData);

      expect(html).toContain('15 December 2024');
    });

    it('should include content preview when provided', () => {
      const html = generateLetterEmailHtml(mockLetterData);

      expect(html).toContain('suspected coronary artery disease');
    });

    it('should not include content preview section when not provided', () => {
      const dataWithoutPreview = { ...mockLetterData, contentPreview: undefined };
      const html = generateLetterEmailHtml(dataWithoutPreview);

      // Should not have the preview block with background color
      expect(html).not.toContain('background-color: #f9fafb; border-left: 4px solid #3b82f6');
    });

    it('should include DictateMED attribution notice', () => {
      const html = generateLetterEmailHtml(mockLetterData);

      expect(html).toContain('DictateMED');
      expect(html).toContain('clinical documentation tool');
    });

    it('should include confidentiality footer', () => {
      const html = generateLetterEmailHtml(mockLetterData);

      expect(html).toContain('CONFIDENTIALITY NOTICE');
      expect(html).toContain('protected health information');
    });

    it('should escape HTML in user data', () => {
      const dataWithHtml: LetterEmailData = {
        ...mockLetterData,
        recipientName: 'Dr. <script>alert("xss")</script>Smith',
      };

      const html = generateLetterEmailHtml(dataWithHtml);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('generateLetterEmailText', () => {
    it('should generate plain text email', () => {
      const text = generateLetterEmailText(mockLetterData);

      expect(text).toContain('Sydney Cardiology');
      expect(text).toContain('Consultation Letter');
    });

    it('should include recipient name', () => {
      const text = generateLetterEmailText(mockLetterData);

      expect(text).toContain('Dear Dr. John Smith');
    });

    it('should include sender name and practice', () => {
      const text = generateLetterEmailText(mockLetterData);

      expect(text).toContain('Dr. Sarah Johnson');
      expect(text).toContain('Sydney Cardiology');
    });

    it('should include content preview when provided', () => {
      const text = generateLetterEmailText(mockLetterData);

      expect(text).toContain('Preview:');
      expect(text).toContain('suspected coronary artery disease');
    });

    it('should not include preview section when not provided', () => {
      const dataWithoutPreview = { ...mockLetterData, contentPreview: undefined };
      const text = generateLetterEmailText(dataWithoutPreview);

      expect(text).not.toContain('Preview:');
    });

    it('should include administrative notice', () => {
      const text = generateLetterEmailText(mockLetterData);

      expect(text).toContain('ADMINISTRATIVE NOTICE');
      expect(text).toContain('DictateMED');
    });

    it('should include confidentiality notice', () => {
      const text = generateLetterEmailText(mockLetterData);

      expect(text).toContain('CONFIDENTIALITY NOTICE');
      expect(text).toContain('protected health information');
    });
  });
});

describe('Resend Client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe('getResendClient', () => {
    it('should throw error when RESEND_API_KEY is not set', async () => {
      vi.stubEnv('RESEND_API_KEY', '');
      vi.stubEnv('RESEND_FROM_EMAIL', '');

      // Dynamic import to pick up mocked env
      const { getResendClient } = await import('@/infrastructure/email/resend.client');

      expect(() => getResendClient()).toThrow('RESEND_API_KEY environment variable is required');
    });

    it('should return Resend client when properly configured', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_123');
      vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@test.com');

      const { getResendClient } = await import('@/infrastructure/email/resend.client');

      const client = getResendClient();
      expect(client).toBeDefined();
    });
  });

  describe('getSenderEmail', () => {
    it('should throw error when RESEND_FROM_EMAIL is not set', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_123');
      vi.stubEnv('RESEND_FROM_EMAIL', '');

      const { getSenderEmail } = await import('@/infrastructure/email/resend.client');

      expect(() => getSenderEmail()).toThrow('RESEND_FROM_EMAIL environment variable is required');
    });

    it('should return sender email when configured', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_123');
      vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@dictatemed.com');

      const { getSenderEmail } = await import('@/infrastructure/email/resend.client');

      expect(getSenderEmail()).toBe('noreply@dictatemed.com');
    });
  });

  describe('isResendConfigured', () => {
    it('should return false when not configured', async () => {
      vi.stubEnv('RESEND_API_KEY', '');
      vi.stubEnv('RESEND_FROM_EMAIL', '');

      const { isResendConfigured } = await import('@/infrastructure/email/resend.client');

      expect(isResendConfigured()).toBe(false);
    });

    it('should return true when fully configured', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_123');
      vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@test.com');

      const { isResendConfigured } = await import('@/infrastructure/email/resend.client');

      expect(isResendConfigured()).toBe(true);
    });

    it('should return false when only API key is set', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_test_123');
      vi.stubEnv('RESEND_FROM_EMAIL', '');

      const { isResendConfigured } = await import('@/infrastructure/email/resend.client');

      expect(isResendConfigured()).toBe(false);
    });

    it('should return false when only from email is set', async () => {
      vi.stubEnv('RESEND_API_KEY', '');
      vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@test.com');

      const { isResendConfigured } = await import('@/infrastructure/email/resend.client');

      expect(isResendConfigured()).toBe(false);
    });
  });
});

describe('Email Data Validation', () => {
  describe('subject line safety', () => {
    it('should use patient identifier not full name in subject', () => {
      const subject = generateLetterEmailSubject({
        letterType: 'Echocardiogram Report',
        patientIdentifier: 'JD', // Initials only
        practiceName: 'CardioClinic',
      });

      // Should contain the patient identifier (initials)
      expect(subject).toContain('Patient JD');
      // The subject format is: "Type - Patient XX | Practice"
      expect(subject).toBe('Echocardiogram Report - Patient JD | CardioClinic');
    });
  });

  describe('HTML escaping', () => {
    it('should escape special characters in all fields', () => {
      const maliciousData: LetterEmailData = {
        recipientName: 'Dr. <script>xss</script>',
        senderName: 'Dr. "Quoted"',
        practiceName: "O'Brien's Clinic",
        patientIdentifier: 'A&B',
        letterType: 'Test <Type>',
        consultationDate: '15/12/2024',
      };

      const html = generateLetterEmailHtml(maliciousData);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&quot;');
      expect(html).toContain('&#39;'); // Escaped single quote
      expect(html).toContain('&amp;');
    });
  });
});
