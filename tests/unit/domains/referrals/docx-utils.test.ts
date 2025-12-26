// tests/unit/domains/referrals/docx-utils.test.ts
// Unit tests for Word document text extraction utilities

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mammoth module
const mockExtractRawText = vi.fn();

vi.mock('mammoth', () => ({
  extractRawText: mockExtractRawText,
}));

// Import after mocks
import {
  extractDocxText,
  isDocxMimeType,
  isValidDocxBuffer,
  validateAndExtractDocx,
  DOCX_MIME_TYPES,
  type DocxExtractionResult,
} from '@/domains/referrals/docx-utils';

describe('docx-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constants', () => {
    it('should define DOCX MIME type', () => {
      expect(DOCX_MIME_TYPES).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(DOCX_MIME_TYPES).toHaveLength(1);
    });
  });

  describe('isDocxMimeType', () => {
    it('should return true for .docx MIME type', () => {
      expect(
        isDocxMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).toBe(true);
    });

    it('should return false for .doc MIME type (old format)', () => {
      expect(isDocxMimeType('application/msword')).toBe(false);
    });

    it('should return false for other document types', () => {
      expect(isDocxMimeType('application/pdf')).toBe(false);
      expect(isDocxMimeType('text/plain')).toBe(false);
      expect(isDocxMimeType('text/rtf')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isDocxMimeType('')).toBe(false);
    });

    it('should return false for image types', () => {
      expect(isDocxMimeType('image/jpeg')).toBe(false);
      expect(isDocxMimeType('image/png')).toBe(false);
    });
  });

  describe('isValidDocxBuffer', () => {
    it('should return true for valid ZIP signature (PK header)', () => {
      // Valid ZIP/DOCX signature: PK\x03\x04
      const validBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(isValidDocxBuffer(validBuffer)).toBe(true);
    });

    it('should return false for buffer too short', () => {
      const shortBuffer = Buffer.from([0x50, 0x4b]);
      expect(isValidDocxBuffer(shortBuffer)).toBe(false);
    });

    it('should return false for empty buffer', () => {
      const emptyBuffer = Buffer.from([]);
      expect(isValidDocxBuffer(emptyBuffer)).toBe(false);
    });

    it('should return false for PDF file', () => {
      // PDF starts with %PDF
      const pdfBuffer = Buffer.from('%PDF-1.4');
      expect(isValidDocxBuffer(pdfBuffer)).toBe(false);
    });

    it('should return false for plain text', () => {
      const textBuffer = Buffer.from('Hello, World!');
      expect(isValidDocxBuffer(textBuffer)).toBe(false);
    });

    it('should return false for wrong ZIP variant', () => {
      // Empty archive signature PK\x05\x06 is not a valid docx start
      const emptyZipBuffer = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
      expect(isValidDocxBuffer(emptyZipBuffer)).toBe(false);
    });

    it('should return false for random binary data', () => {
      const randomBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
      expect(isValidDocxBuffer(randomBuffer)).toBe(false);
    });
  });

  describe('extractDocxText', () => {
    const mockBuffer = Buffer.from('mock-docx-content');

    describe('successful extraction', () => {
      it('should extract text with no messages', async () => {
        mockExtractRawText.mockResolvedValue({
          value: 'Extracted document text',
          messages: [],
        });

        const result = await extractDocxText(mockBuffer);

        expect(result).toEqual({
          text: 'Extracted document text',
          success: true,
          messages: [],
          error: undefined,
        });
        expect(mockExtractRawText).toHaveBeenCalledWith({ buffer: mockBuffer });
      });

      it('should trim whitespace from extracted text', async () => {
        mockExtractRawText.mockResolvedValue({
          value: '  Text with whitespace  \n',
          messages: [],
        });

        const result = await extractDocxText(mockBuffer);

        expect(result.text).toBe('Text with whitespace');
      });

      it('should extract text with warnings', async () => {
        mockExtractRawText.mockResolvedValue({
          value: 'Document content',
          messages: [{ type: 'warning', message: 'Unknown style encountered' }],
        });

        const result = await extractDocxText(mockBuffer);

        expect(result.success).toBe(true);
        expect(result.text).toBe('Document content');
        expect(result.messages).toEqual([
          { type: 'warning', message: 'Unknown style encountered' },
        ]);
      });

      it('should handle multiple warnings', async () => {
        mockExtractRawText.mockResolvedValue({
          value: 'Content',
          messages: [
            { type: 'warning', message: 'Warning 1' },
            { type: 'warning', message: 'Warning 2' },
          ],
        });

        const result = await extractDocxText(mockBuffer);

        expect(result.success).toBe(true);
        expect(result.messages).toHaveLength(2);
      });

      it('should handle empty document', async () => {
        mockExtractRawText.mockResolvedValue({
          value: '',
          messages: [],
        });

        const result = await extractDocxText(mockBuffer);

        expect(result.success).toBe(true);
        expect(result.text).toBe('');
      });
    });

    describe('extraction with errors', () => {
      it('should report failure when mammoth returns error messages', async () => {
        mockExtractRawText.mockResolvedValue({
          value: 'Partial content',
          messages: [{ type: 'error', message: 'Failed to parse embedded object' }],
        });

        const result = await extractDocxText(mockBuffer);

        expect(result.success).toBe(false);
        expect(result.text).toBe('Partial content');
        expect(result.error).toBe('Document contains extraction errors');
        expect(result.messages).toEqual([
          { type: 'error', message: 'Failed to parse embedded object' },
        ]);
      });

      it('should report failure with mixed warnings and errors', async () => {
        mockExtractRawText.mockResolvedValue({
          value: 'Some content',
          messages: [
            { type: 'warning', message: 'Style warning' },
            { type: 'error', message: 'Critical error' },
          ],
        });

        const result = await extractDocxText(mockBuffer);

        expect(result.success).toBe(false);
        expect(result.messages).toHaveLength(2);
      });
    });

    describe('exception handling', () => {
      it('should handle mammoth throwing an error', async () => {
        mockExtractRawText.mockRejectedValue(new Error('Invalid DOCX file'));

        const result = await extractDocxText(mockBuffer);

        expect(result).toEqual({
          text: '',
          success: false,
          messages: [],
          error: 'Failed to extract text from Word document: Invalid DOCX file',
        });
      });

      it('should handle non-Error exceptions', async () => {
        mockExtractRawText.mockRejectedValue('String error');

        const result = await extractDocxText(mockBuffer);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown error');
      });

      it('should handle null/undefined errors', async () => {
        mockExtractRawText.mockRejectedValue(null);

        const result = await extractDocxText(mockBuffer);

        expect(result.success).toBe(false);
        expect(result.text).toBe('');
      });
    });
  });

  describe('validateAndExtractDocx', () => {
    describe('with valid buffer structure', () => {
      it('should extract text from valid docx buffer', async () => {
        // Valid ZIP signature
        const validDocxBuffer = Buffer.concat([
          Buffer.from([0x50, 0x4b, 0x03, 0x04]),
          Buffer.from('rest of docx content'),
        ]);

        mockExtractRawText.mockResolvedValue({
          value: 'Document text content',
          messages: [],
        });

        const result = await validateAndExtractDocx(validDocxBuffer);

        expect(result.success).toBe(true);
        expect(result.text).toBe('Document text content');
        expect(mockExtractRawText).toHaveBeenCalled();
      });

      it('should pass through extraction errors', async () => {
        const validDocxBuffer = Buffer.concat([
          Buffer.from([0x50, 0x4b, 0x03, 0x04]),
          Buffer.from('corrupted content'),
        ]);

        mockExtractRawText.mockRejectedValue(new Error('Corrupted archive'));

        const result = await validateAndExtractDocx(validDocxBuffer);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Corrupted archive');
      });
    });

    describe('with invalid buffer structure', () => {
      it('should reject non-ZIP buffer without calling mammoth', async () => {
        const invalidBuffer = Buffer.from('Not a docx file');

        const result = await validateAndExtractDocx(invalidBuffer);

        expect(result).toEqual({
          text: '',
          success: false,
          messages: [],
          error: 'Invalid Word document: File does not have the expected .docx structure',
        });
        expect(mockExtractRawText).not.toHaveBeenCalled();
      });

      it('should reject PDF files', async () => {
        const pdfBuffer = Buffer.from('%PDF-1.4 content here');

        const result = await validateAndExtractDocx(pdfBuffer);

        expect(result.success).toBe(false);
        expect(result.error).toContain('does not have the expected .docx structure');
        expect(mockExtractRawText).not.toHaveBeenCalled();
      });

      it('should reject empty buffer', async () => {
        const emptyBuffer = Buffer.from([]);

        const result = await validateAndExtractDocx(emptyBuffer);

        expect(result.success).toBe(false);
        expect(mockExtractRawText).not.toHaveBeenCalled();
      });

      it('should reject too-short buffer', async () => {
        const shortBuffer = Buffer.from([0x50, 0x4b]);

        const result = await validateAndExtractDocx(shortBuffer);

        expect(result.success).toBe(false);
        expect(mockExtractRawText).not.toHaveBeenCalled();
      });
    });
  });

  describe('type safety', () => {
    it('should correctly narrow MIME type with type guard', () => {
      const mimeType: string = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (isDocxMimeType(mimeType)) {
        // TypeScript should recognize this as DocxMimeType
        const docxType: typeof DOCX_MIME_TYPES[number] = mimeType;
        expect(docxType).toBe(mimeType);
      } else {
        // This should not execute
        expect.fail('Type guard should have returned true');
      }
    });

    it('should return correct result shape', async () => {
      mockExtractRawText.mockResolvedValue({
        value: 'Test',
        messages: [],
      });

      const result: DocxExtractionResult = await extractDocxText(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

      // Verify all required properties exist
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('messages');
      expect(typeof result.text).toBe('string');
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.messages)).toBe(true);
    });
  });
});
