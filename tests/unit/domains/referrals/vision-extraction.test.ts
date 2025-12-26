// tests/unit/domains/referrals/vision-extraction.test.ts
// Unit tests for vision-based text extraction using Claude Vision

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeImage } from '@/infrastructure/ai/vision';

// Mock the AI vision module (unified layer)
vi.mock('@/infrastructure/ai/vision', () => ({
  analyzeImage: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Get the mocked function for use in tests
const mockAnalyzeImage = vi.mocked(analyzeImage);

// Import after mocks
import {
  extractTextFromImageVision,
  extractTextFromImageBufferVision,
  isVisionSupportedMimeType,
  VISION_SUPPORTED_MIME_TYPES,
  REFERRAL_EXTRACTION_PROMPT,
  type VisionExtractionResult,
  type VisionSupportedMimeType,
} from '@/domains/referrals/vision-extraction';

describe('vision-extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constants', () => {
    it('should define supported MIME types for vision extraction', () => {
      expect(VISION_SUPPORTED_MIME_TYPES).toContain('image/jpeg');
      expect(VISION_SUPPORTED_MIME_TYPES).toContain('image/png');
      expect(VISION_SUPPORTED_MIME_TYPES).toContain('image/gif');
      expect(VISION_SUPPORTED_MIME_TYPES).toContain('image/webp');
      expect(VISION_SUPPORTED_MIME_TYPES).toHaveLength(4);
    });

    it('should have a referral extraction prompt', () => {
      expect(REFERRAL_EXTRACTION_PROMPT).toBeDefined();
      expect(REFERRAL_EXTRACTION_PROMPT.length).toBeGreaterThan(100);
      // Should contain key instructions
      expect(REFERRAL_EXTRACTION_PROMPT).toContain('medical');
      expect(REFERRAL_EXTRACTION_PROMPT).toContain('text');
      expect(REFERRAL_EXTRACTION_PROMPT).toContain('[NO_READABLE_TEXT]');
    });
  });

  describe('isVisionSupportedMimeType', () => {
    it('should return true for image/jpeg', () => {
      expect(isVisionSupportedMimeType('image/jpeg')).toBe(true);
    });

    it('should return true for image/png', () => {
      expect(isVisionSupportedMimeType('image/png')).toBe(true);
    });

    it('should return true for image/gif', () => {
      expect(isVisionSupportedMimeType('image/gif')).toBe(true);
    });

    it('should return true for image/webp', () => {
      expect(isVisionSupportedMimeType('image/webp')).toBe(true);
    });

    it('should return false for image/heic', () => {
      // HEIC must be converted to JPEG first
      expect(isVisionSupportedMimeType('image/heic')).toBe(false);
    });

    it('should return false for image/heif', () => {
      expect(isVisionSupportedMimeType('image/heif')).toBe(false);
    });

    it('should return false for PDF', () => {
      expect(isVisionSupportedMimeType('application/pdf')).toBe(false);
    });

    it('should return false for Word documents', () => {
      expect(
        isVisionSupportedMimeType(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isVisionSupportedMimeType('')).toBe(false);
    });

    it('should return false for text files', () => {
      expect(isVisionSupportedMimeType('text/plain')).toBe(false);
    });
  });

  describe('extractTextFromImageVision', () => {
    // Minimal valid 1x1 transparent GIF in base64 format.
    // Used as sample image data for tests - actual content doesn't matter since analyzeImage is mocked.
    const sampleBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    it('should successfully extract text from an image', async () => {
      const mockText = `Dear Dr. Smith,

I am referring Mrs. Jane Doe (DOB: 15/03/1960) for cardiology assessment.

History:
- Chest pain on exertion
- Hypertension for 10 years
- Family history of CAD

Please assess and advise on further management.

Kind regards,
Dr. John Brown
General Practitioner`;

      mockAnalyzeImage.mockResolvedValueOnce({
        content: mockText,
        inputTokens: 1234,
        outputTokens: 567,
        stopReason: 'end_turn',
        provider: 'anthropic',
      });

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(true);
      expect(result.text).toBe(mockText);
      expect(result.inputTokens).toBe(1234);
      expect(result.outputTokens).toBe(567);
      expect(result.error).toBeUndefined();

      // Verify the call was made correctly
      expect(mockAnalyzeImage).toHaveBeenCalledOnce();
      expect(mockAnalyzeImage).toHaveBeenCalledWith({
        imageBase64: sampleBase64,
        mimeType: 'image/jpeg',
        prompt: REFERRAL_EXTRACTION_PROMPT,
        maxTokens: 4096,
        temperature: 0,
      });
    });

    it('should handle "no readable text" response', async () => {
      mockAnalyzeImage.mockResolvedValueOnce({
        content: '[NO_READABLE_TEXT]',
        inputTokens: 100,
        outputTokens: 5,
        stopReason: 'end_turn',
        provider: 'anthropic',
      });

      const result = await extractTextFromImageVision(sampleBase64, 'image/png');

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.error).toContain('No readable text found');
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(5);
    });

    it('should handle "[NO_READABLE_TEXT]" with whitespace', async () => {
      mockAnalyzeImage.mockResolvedValueOnce({
        content: '  [NO_READABLE_TEXT]  ',
        inputTokens: 100,
        outputTokens: 5,
        stopReason: 'end_turn',
        provider: 'anthropic',
      });

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No readable text found');
    });

    it('should handle API errors gracefully', async () => {
      mockAnalyzeImage.mockRejectedValueOnce(new Error('Model not available'));

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.error).toContain('Vision extraction failed');
      expect(result.error).toContain('Model not available');
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });

    it('should mark throttling errors as retryable', async () => {
      mockAnalyzeImage.mockRejectedValueOnce(new Error('ThrottlingException: Rate exceeded'));

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('temporarily unavailable');
      expect(result.error).toContain('Please try again');
    });

    it('should mark service unavailable errors as retryable', async () => {
      mockAnalyzeImage.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await extractTextFromImageVision(sampleBase64, 'image/png');

      expect(result.success).toBe(false);
      expect(result.error).toContain('temporarily unavailable');
    });

    it('should mark timeout errors as retryable', async () => {
      mockAnalyzeImage.mockRejectedValueOnce(new Error('Request timeout'));

      const result = await extractTextFromImageVision(sampleBase64, 'image/webp');

      expect(result.success).toBe(false);
      expect(result.error).toContain('temporarily unavailable');
    });

    it('should mark 429 errors as retryable', async () => {
      mockAnalyzeImage.mockRejectedValueOnce(new Error('Request failed with status 429'));

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('temporarily unavailable');
    });

    it('should mark 503 errors as retryable', async () => {
      mockAnalyzeImage.mockRejectedValueOnce(new Error('Request failed with status 503'));

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('temporarily unavailable');
    });

    it('should not mark validation errors as retryable', async () => {
      mockAnalyzeImage.mockRejectedValueOnce(new Error('ValidationException: Invalid image format'));

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Vision extraction failed');
      expect(result.error).not.toContain('temporarily unavailable');
    });

    it('should handle non-Error exceptions', async () => {
      mockAnalyzeImage.mockRejectedValueOnce('String error');

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown vision extraction error');
    });

    it('should work with all supported MIME types', async () => {
      const mimeTypes: VisionSupportedMimeType[] = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];

      for (const mimeType of mimeTypes) {
        mockAnalyzeImage.mockResolvedValueOnce({
          content: `Text from ${mimeType}`,
          inputTokens: 100,
          outputTokens: 10,
          stopReason: 'end_turn',
          provider: 'anthropic',
        });

        const result = await extractTextFromImageVision(sampleBase64, mimeType);

        expect(result.success).toBe(true);
        expect(result.text).toBe(`Text from ${mimeType}`);
      }
    });

    it('should preserve whitespace and formatting in extracted text', async () => {
      const formattedText = `REFERRAL LETTER

Patient: John Smith
DOB:     01/01/1980
MRN:     12345

Reason for Referral:
  - Chest pain
  - Shortness of breath

    This patient requires urgent assessment.

Signed: Dr. Jane Doe`;

      mockAnalyzeImage.mockResolvedValueOnce({
        content: formattedText,
        inputTokens: 200,
        outputTokens: 100,
        stopReason: 'end_turn',
        provider: 'anthropic',
      });

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(true);
      expect(result.text).toBe(formattedText);
    });

    it('should handle text with [unclear] markers', async () => {
      const textWithUnclear = `Dear Dr. Smith,

Referring patient [unclear: John/Jane] Doe for assessment.
History of [unclear] and hypertension.

Please advise.`;

      mockAnalyzeImage.mockResolvedValueOnce({
        content: textWithUnclear,
        inputTokens: 150,
        outputTokens: 50,
        stopReason: 'end_turn',
        provider: 'anthropic',
      });

      const result = await extractTextFromImageVision(sampleBase64, 'image/jpeg');

      expect(result.success).toBe(true);
      expect(result.text).toContain('[unclear: John/Jane]');
      expect(result.text).toContain('[unclear]');
    });
  });

  describe('extractTextFromImageBufferVision', () => {
    it('should convert buffer to base64 and extract text', async () => {
      const textContent = 'Extracted text from buffer';
      mockAnalyzeImage.mockResolvedValueOnce({
        content: textContent,
        inputTokens: 100,
        outputTokens: 20,
        stopReason: 'end_turn',
        provider: 'anthropic',
      });

      // Create a simple buffer (doesn't need to be a valid image for the mock)
      const imageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

      const result = await extractTextFromImageBufferVision(imageBuffer, 'image/jpeg');

      expect(result.success).toBe(true);
      expect(result.text).toBe(textContent);

      // Verify the base64 conversion
      expect(mockAnalyzeImage).toHaveBeenCalledWith(
        expect.objectContaining({
          imageBase64: imageBuffer.toString('base64'),
          mimeType: 'image/jpeg',
        })
      );
    });

    it('should handle buffer extraction failures', async () => {
      mockAnalyzeImage.mockRejectedValueOnce(new Error('Processing failed'));

      const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header

      const result = await extractTextFromImageBufferVision(imageBuffer, 'image/png');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Processing failed');
    });

    it('should work with empty buffer', async () => {
      mockAnalyzeImage.mockResolvedValueOnce({
        content: '[NO_READABLE_TEXT]',
        inputTokens: 50,
        outputTokens: 5,
        stopReason: 'end_turn',
        provider: 'anthropic',
      });

      const emptyBuffer = Buffer.from([]);

      const result = await extractTextFromImageBufferVision(emptyBuffer, 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No readable text found');
    });
  });

  describe('VisionExtractionResult type', () => {
    it('should allow success result without error field', () => {
      const successResult: VisionExtractionResult = {
        text: 'Some extracted text',
        success: true,
        inputTokens: 100,
        outputTokens: 50,
      };

      expect(successResult.error).toBeUndefined();
      expect(successResult.success).toBe(true);
    });

    it('should allow failure result with error field', () => {
      const failureResult: VisionExtractionResult = {
        text: '',
        success: false,
        error: 'Something went wrong',
        inputTokens: 0,
        outputTokens: 0,
      };

      expect(failureResult.error).toBeDefined();
      expect(failureResult.success).toBe(false);
    });
  });

  describe('token tracking', () => {
    it('should track input and output tokens on success', async () => {
      mockAnalyzeImage.mockResolvedValueOnce({
        content: 'Some text',
        inputTokens: 5000, // Large input for image
        outputTokens: 200, // Text output
        stopReason: 'end_turn',
        provider: 'anthropic',
      });

      const result = await extractTextFromImageVision('base64data', 'image/jpeg');

      expect(result.inputTokens).toBe(5000);
      expect(result.outputTokens).toBe(200);
    });

    it('should return zero tokens on error', async () => {
      mockAnalyzeImage.mockRejectedValueOnce(new Error('API Error'));

      const result = await extractTextFromImageVision('base64data', 'image/jpeg');

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });

    it('should track tokens even when no readable text found', async () => {
      mockAnalyzeImage.mockResolvedValueOnce({
        content: '[NO_READABLE_TEXT]',
        inputTokens: 3000,
        outputTokens: 5,
        stopReason: 'end_turn',
        provider: 'anthropic',
      });

      const result = await extractTextFromImageVision('base64data', 'image/png');

      expect(result.success).toBe(false);
      expect(result.inputTokens).toBe(3000);
      expect(result.outputTokens).toBe(5);
    });
  });
});
