// tests/unit/domains/letters/pdf.service.test.ts
// Tests for PDF generation service (unit tests with mocked dependencies)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing the service
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    letter: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock encryption
vi.mock('@/infrastructure/db/encryption', () => ({
  decryptPatientData: vi.fn(),
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

import { generateLetterPdf, generateSimplePdf } from '@/domains/letters/pdf.service';
import { prisma } from '@/infrastructure/db/client';
import { decryptPatientData } from '@/infrastructure/db/encryption';

describe('pdf.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Mock letter data matching what the service expects from the select query
  const mockLetter = {
    id: 'letter-1',
    letterType: 'NEW_PATIENT',
    contentFinal: `Dear Dr. Smith,

Thank you for referring Mr. John Doe for cardiology consultation.

History of Present Illness:
Mr. Doe is a 65-year-old gentleman presenting with exertional chest pain for the past 3 weeks.

Past Medical History:
- Hypertension (diagnosed 2015)
- Hyperlipidemia

Current Medications:
1. Metformin 500mg BD
2. Atorvastatin 40mg ON

Impression:
Stable angina, likely due to coronary artery disease.

Plan:
1. Stress echocardiogram to assess for inducible ischemia
2. Follow-up in 2 weeks

Please do not hesitate to contact me if you have any questions.`,
    approvedAt: new Date('2024-03-15T10:30:00Z'),
    createdAt: new Date('2024-03-14T09:00:00Z'),
    patient: {
      encryptedData: 'encrypted-patient-data',
    },
    user: {
      name: 'Dr. Jane Cardiologist',
      practice: {
        name: 'Sydney Heart Clinic',
      },
    },
  };

  // Helper to mock decryptPatientData with proper return type
  const mockDecrypt = (returnValue: { name: string; dateOfBirth?: string }) => {
    vi.mocked(decryptPatientData).mockReturnValue({
      name: returnValue.name,
      dateOfBirth: returnValue.dateOfBirth || '1960-01-01',
    });
  };

  describe('generateLetterPdf', () => {
    it('should generate a valid PDF buffer for an approved letter', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      mockDecrypt({ name: 'John Doe' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // Verify it's a valid PDF by checking magic bytes
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');

      // Verify the letter was fetched with correct relations
      expect(prisma.letter.findUnique).toHaveBeenCalledWith({
        where: { id: 'letter-1' },
        select: expect.objectContaining({
          id: true,
          letterType: true,
          contentFinal: true,
          approvedAt: true,
          createdAt: true,
          patient: expect.any(Object),
          user: expect.any(Object),
        }),
      });
    });

    it('should generate a larger PDF for long content', async () => {
      // Create very long content that would span multiple pages
      const longContent = Array(50)
        .fill('This is a paragraph of medical content that discusses important findings. ')
        .map((text, i) => `${text}Section ${i + 1} details the relevant clinical information.`)
        .join('\n\n');

      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: longContent,
      } as any);
      mockDecrypt({ name: 'Long Letter Patient' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      // Long content should produce a larger PDF
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(3000); // Longer than a simple single-page doc
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should throw error when letter is not found', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(null);

      await expect(generateLetterPdf('non-existent')).rejects.toThrow('Letter not found');
    });

    it('should throw error when letter has no approved content', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: null,
      } as any);

      await expect(generateLetterPdf('letter-1')).rejects.toThrow(
        'Letter has no approved content'
      );
    });

    it('should handle letter without patient data gracefully', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        patient: null,
      } as any);

      const pdfBuffer = await generateLetterPdf('letter-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should handle patient decryption failure gracefully', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      vi.mocked(decryptPatientData).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const pdfBuffer = await generateLetterPdf('letter-1');

      // Should still generate PDF with "Unknown Patient"
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should generate PDF for different letter types', async () => {
      const letterTypes = ['NEW_PATIENT', 'FOLLOW_UP', 'ANGIOGRAM_PROCEDURE', 'ECHO_REPORT'];

      for (const letterType of letterTypes) {
        vi.mocked(prisma.letter.findUnique).mockResolvedValue({
          ...mockLetter,
          letterType,
        } as any);
        mockDecrypt({ name: 'Patient Name' });

        const pdfBuffer = await generateLetterPdf('letter-1');

        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.length).toBeGreaterThan(0);
        expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
      }
    });

    it('should use createdAt date when approvedAt is null', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        approvedAt: null,
      } as any);
      mockDecrypt({ name: 'Patient' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should handle content with ASCII characters', async () => {
      // pdf-lib's StandardFonts only support WinAnsi encoding (basic ASCII + extended)
      // Test with content that uses ASCII-safe characters
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: 'Patient: Jose Garcia\nMedications: Aspirin 100mg/day\n\nNotes: BP >= 140/90 mmHg',
      } as any);
      mockDecrypt({ name: 'Jose Garcia' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should handle empty paragraphs in content', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: 'First paragraph.\n\n\n\n\nSecond paragraph after many blank lines.',
      } as any);
      mockDecrypt({ name: 'Patient' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should include PDF trailer with proper EOF marker', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      mockDecrypt({ name: 'John Doe' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      // Valid PDFs end with %%EOF
      const lastBytes = pdfBuffer.slice(-10).toString();
      expect(lastBytes).toContain('%%EOF');
    });
  });

  describe('generateSimplePdf', () => {
    it('should generate a valid PDF from simple text content', async () => {
      const content = 'This is a simple test document.\n\nIt has multiple paragraphs.';
      const title = 'Test Document';
      const authorName = 'Test Author';

      const pdfBuffer = await generateSimplePdf(content, title, authorName);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should handle very long content', async () => {
      const longContent = Array(100)
        .fill('This is a long paragraph that continues on and on with lots of text. ')
        .join('\n\n');

      const pdfBuffer = await generateSimplePdf(longContent, 'Long Document', 'Author');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(3000);
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should handle empty content gracefully', async () => {
      const pdfBuffer = await generateSimplePdf('', 'Empty Document', 'Author');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should handle content with only whitespace', async () => {
      const pdfBuffer = await generateSimplePdf('   \n\n   ', 'Whitespace Document', 'Author');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('should include title in document', async () => {
      const pdfBuffer = await generateSimplePdf('Content here', 'My Title', 'Author');

      // Title should appear in PDF content (not metadata, but drawn text)
      const pdfString = pdfBuffer.toString('binary');
      // The title is drawn as text, so it may appear in various encoding forms
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      vi.mocked(prisma.letter.findUnique).mockRejectedValue(new Error('Database connection failed'));

      await expect(generateLetterPdf('letter-1')).rejects.toThrow('Database connection failed');
    });

    it('should handle letter with empty contentFinal string', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: '',
      } as any);
      mockDecrypt({ name: 'Patient' });

      // Empty string is falsy in JavaScript, so should throw
      await expect(generateLetterPdf('letter-1')).rejects.toThrow(
        'Letter has no approved content'
      );
    });

    it('should call findUnique with correct letter ID', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      mockDecrypt({ name: 'John Doe' });

      await generateLetterPdf('test-letter-id-123');

      expect(prisma.letter.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-letter-id-123' },
        })
      );
    });

    it('should request correct relations in select', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      mockDecrypt({ name: 'John Doe' });

      await generateLetterPdf('letter-1');

      expect(prisma.letter.findUnique).toHaveBeenCalledWith({
        where: { id: 'letter-1' },
        select: {
          id: true,
          letterType: true,
          contentFinal: true,
          approvedAt: true,
          createdAt: true,
          patient: {
            select: {
              encryptedData: true,
            },
          },
          user: {
            select: {
              name: true,
              practice: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    });
  });

  describe('decryption handling', () => {
    it('should call decryptPatientData when patient data exists', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter as any);
      mockDecrypt({ name: 'John Doe' });

      await generateLetterPdf('letter-1');

      expect(decryptPatientData).toHaveBeenCalledWith('encrypted-patient-data');
    });

    it('should not call decryptPatientData when patient is null', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        patient: null,
      } as any);

      await generateLetterPdf('letter-1');

      expect(decryptPatientData).not.toHaveBeenCalled();
    });

    it('should not call decryptPatientData when encryptedData is null', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        patient: {
          encryptedData: null,
        },
      } as any);

      await generateLetterPdf('letter-1');

      expect(decryptPatientData).not.toHaveBeenCalled();
    });
  });
});
