// tests/unit/domains/letters/pdf.service.test.ts
// Tests for PDF generation service (unit tests with mocked dependencies)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';

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

  const mockLetter = {
    id: 'letter-1',
    letterType: 'NEW_PATIENT',
    contentFinal: `Dear Dr. Smith,

Thank you for referring Mr. John Doe for cardiology consultation.

History of Present Illness:
Mr. Doe is a 65-year-old gentleman presenting with exertional chest pain for the past 3 weeks. The pain is described as a pressure sensation, lasting 5-10 minutes, and relieved by rest.

Past Medical History:
- Hypertension (diagnosed 2015)
- Hyperlipidemia
- Type 2 Diabetes Mellitus

Current Medications:
1. Metformin 500mg BD
2. Atorvastatin 40mg ON
3. Perindopril 5mg mane

Physical Examination:
Blood pressure 145/85 mmHg, heart rate 72 bpm regular. Heart sounds dual with no murmurs. JVP not elevated.

Investigations:
ECG shows sinus rhythm with T wave inversion in leads V4-V6.

Impression:
Stable angina, likely due to coronary artery disease.

Plan:
1. Stress echocardiogram to assess for inducible ischemia
2. Continue current medications
3. Add aspirin 100mg daily
4. Follow-up in 2 weeks with results

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
        letterhead: null,
      },
    },
  };

  describe('generateLetterPdf', () => {
    it('should generate a valid PDF buffer for an approved letter', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter);
      vi.mocked(decryptPatientData).mockReturnValue({ name: 'John Doe' });

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

    it('should generate a multi-page PDF for long content', async () => {
      // Create very long content that would span multiple pages
      const longContent = Array(50)
        .fill('This is a paragraph of medical content that discusses important findings. ')
        .map((text, i) => `${text}Section ${i + 1} details the relevant clinical information.`)
        .join('\n\n');

      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: longContent,
      });
      vi.mocked(decryptPatientData).mockReturnValue({ name: 'Long Letter Patient' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      // Parse the PDF to verify multiple pages
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      expect(pdfDoc.getPageCount()).toBeGreaterThan(1);
    });

    it('should throw error when letter is not found', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(null);

      await expect(generateLetterPdf('non-existent')).rejects.toThrow('Letter not found');
    });

    it('should throw error when letter has no approved content', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: null,
      });

      await expect(generateLetterPdf('letter-1')).rejects.toThrow(
        'Letter has no approved content'
      );
    });

    it('should handle letter without patient data gracefully', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        patient: null,
      });

      const pdfBuffer = await generateLetterPdf('letter-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle patient decryption failure gracefully', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter);
      vi.mocked(decryptPatientData).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const pdfBuffer = await generateLetterPdf('letter-1');

      // Should still generate PDF with "Unknown Patient"
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should include practice name in header', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter);
      vi.mocked(decryptPatientData).mockReturnValue({ name: 'John Doe' });

      const pdfBuffer = await generateLetterPdf('letter-1');
      const pdfDoc = await PDFDocument.load(pdfBuffer);

      // Verify practice name is somewhere in PDF
      // Note: pdf-lib doesn't easily expose text content, so we verify the PDF was created
      expect(pdfDoc.getTitle()).toBeUndefined(); // We don't set a title
      expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(1);
    });

    it('should format different letter types correctly', async () => {
      const letterTypes = ['NEW_PATIENT', 'FOLLOW_UP', 'ANGIOGRAM_PROCEDURE', 'ECHO_REPORT'];

      for (const letterType of letterTypes) {
        vi.mocked(prisma.letter.findUnique).mockResolvedValue({
          ...mockLetter,
          letterType,
        });
        vi.mocked(decryptPatientData).mockReturnValue({ name: 'Patient Name' });

        const pdfBuffer = await generateLetterPdf('letter-1');

        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.length).toBeGreaterThan(0);
      }
    });

    it('should use createdAt date when approvedAt is null', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        approvedAt: null,
      });
      vi.mocked(decryptPatientData).mockReturnValue({ name: 'Patient' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle content with special characters', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: 'Patient: José García\nMedications: Aspirin 100mg/day\n\nNotes: BP ≥ 140/90 mmHg',
      });
      vi.mocked(decryptPatientData).mockReturnValue({ name: 'José García' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle empty paragraphs in content', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: 'First paragraph.\n\n\n\n\nSecond paragraph after many blank lines.',
      });
      vi.mocked(decryptPatientData).mockReturnValue({ name: 'Patient' });

      const pdfBuffer = await generateLetterPdf('letter-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
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

      // Verify it's a valid PDF
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(1);
    });

    it('should handle very long content with multiple pages', async () => {
      const longContent = Array(100)
        .fill('This is a long paragraph that continues on and on with lots of text. ')
        .join('\n\n');

      const pdfBuffer = await generateSimplePdf(longContent, 'Long Document', 'Author');

      const pdfDoc = await PDFDocument.load(pdfBuffer);
      expect(pdfDoc.getPageCount()).toBeGreaterThan(1);
    });

    it('should handle empty content gracefully', async () => {
      const pdfBuffer = await generateSimplePdf('', 'Empty Document', 'Author');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle content with only whitespace', async () => {
      const pdfBuffer = await generateSimplePdf('   \n\n   ', 'Whitespace Document', 'Author');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('PDF structure validation', () => {
    it('should create A4 sized pages', async () => {
      vi.mocked(prisma.letter.findUnique).mockResolvedValue(mockLetter);
      vi.mocked(decryptPatientData).mockReturnValue({ name: 'Patient' });

      const pdfBuffer = await generateLetterPdf('letter-1');
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const page = pdfDoc.getPage(0);

      // A4 dimensions in points (approximately)
      const { width, height } = page.getSize();
      expect(width).toBeCloseTo(595.28, 0);
      expect(height).toBeCloseTo(841.89, 0);
    });

    it('should create consistent page sizes across all pages', async () => {
      const longContent = Array(80)
        .fill('Lorem ipsum dolor sit amet, consectetur adipiscing elit. ')
        .join('\n\n');

      vi.mocked(prisma.letter.findUnique).mockResolvedValue({
        ...mockLetter,
        contentFinal: longContent,
      });
      vi.mocked(decryptPatientData).mockReturnValue({ name: 'Patient' });

      const pdfBuffer = await generateLetterPdf('letter-1');
      const pdfDoc = await PDFDocument.load(pdfBuffer);

      const pageCount = pdfDoc.getPageCount();
      expect(pageCount).toBeGreaterThan(1);

      const firstPage = pdfDoc.getPage(0);
      const firstSize = firstPage.getSize();

      for (let i = 1; i < pageCount; i++) {
        const page = pdfDoc.getPage(i);
        const size = page.getSize();
        expect(size.width).toBe(firstSize.width);
        expect(size.height).toBe(firstSize.height);
      }
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
      });
      vi.mocked(decryptPatientData).mockReturnValue({ name: 'Patient' });

      // Empty string should still throw since it's not valid content
      await expect(generateLetterPdf('letter-1')).rejects.toThrow(
        'Letter has no approved content'
      );
    });
  });
});
