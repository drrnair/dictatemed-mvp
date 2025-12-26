// tests/unit/domains/referrals/image-utils.test.ts
// Unit tests for image processing utilities

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock sharp module
const mockSharpInstance = {
  jpeg: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(),
  metadata: vi.fn(),
};
const mockSharp = vi.fn(() => mockSharpInstance);

vi.mock('sharp', () => ({
  default: mockSharp,
}));

// Mock heic-convert module
const mockHeicConvert = vi.fn();

vi.mock('heic-convert', () => ({
  default: mockHeicConvert,
}));

// Import after mocks
import {
  convertToJpeg,
  validateImage,
  validateHeicImage,
  validateImageByType,
  isImageMimeType,
  isHeicMimeType,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_PIXELS,
  JPEG_QUALITY,
} from '@/domains/referrals/image-utils';

describe('image-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constants', () => {
    it('should define supported image MIME types', () => {
      expect(IMAGE_MIME_TYPES).toContain('image/jpeg');
      expect(IMAGE_MIME_TYPES).toContain('image/png');
      expect(IMAGE_MIME_TYPES).toContain('image/heic');
      expect(IMAGE_MIME_TYPES).toContain('image/heif');
      expect(IMAGE_MIME_TYPES).toHaveLength(4);
    });

    it('should define max image pixels at 50MP', () => {
      expect(MAX_IMAGE_PIXELS).toBe(50_000_000);
    });

    it('should define JPEG quality at 90', () => {
      expect(JPEG_QUALITY).toBe(90);
    });
  });

  describe('isImageMimeType', () => {
    it('should return true for supported image types', () => {
      expect(isImageMimeType('image/jpeg')).toBe(true);
      expect(isImageMimeType('image/png')).toBe(true);
      expect(isImageMimeType('image/heic')).toBe(true);
      expect(isImageMimeType('image/heif')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(isImageMimeType('application/pdf')).toBe(false);
      expect(isImageMimeType('text/plain')).toBe(false);
      expect(isImageMimeType('image/gif')).toBe(false);
      expect(isImageMimeType('image/webp')).toBe(false);
      expect(isImageMimeType('')).toBe(false);
    });
  });

  describe('isHeicMimeType', () => {
    it('should return true for HEIC/HEIF types', () => {
      expect(isHeicMimeType('image/heic')).toBe(true);
      expect(isHeicMimeType('image/heif')).toBe(true);
    });

    it('should return false for other image types', () => {
      expect(isHeicMimeType('image/jpeg')).toBe(false);
      expect(isHeicMimeType('image/png')).toBe(false);
      expect(isHeicMimeType('application/pdf')).toBe(false);
    });
  });

  describe('convertToJpeg', () => {
    const mockInputBuffer = Buffer.from('mock-image-data');
    const mockOutputBuffer = Buffer.from('mock-jpeg-data');

    describe('with JPEG input', () => {
      it('should convert JPEG using sharp', async () => {
        mockSharpInstance.toBuffer.mockResolvedValue(mockOutputBuffer);

        const result = await convertToJpeg(mockInputBuffer, 'image/jpeg');

        expect(mockSharp).toHaveBeenCalledWith(mockInputBuffer);
        expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: JPEG_QUALITY });
        expect(mockSharpInstance.toBuffer).toHaveBeenCalled();
        expect(result).toEqual({
          buffer: mockOutputBuffer,
          mimeType: 'image/jpeg',
          originalFormat: 'image/jpeg',
        });
      });
    });

    describe('with PNG input', () => {
      it('should convert PNG to JPEG using sharp', async () => {
        mockSharpInstance.toBuffer.mockResolvedValue(mockOutputBuffer);

        const result = await convertToJpeg(mockInputBuffer, 'image/png');

        expect(mockSharp).toHaveBeenCalledWith(mockInputBuffer);
        expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: JPEG_QUALITY });
        expect(result.mimeType).toBe('image/jpeg');
        expect(result.originalFormat).toBe('image/png');
      });
    });

    describe('with HEIC input', () => {
      it('should convert HEIC to JPEG using heic-convert', async () => {
        const mockHeicOutput = new Uint8Array([1, 2, 3, 4]);
        mockHeicConvert.mockResolvedValue(mockHeicOutput);

        const result = await convertToJpeg(mockInputBuffer, 'image/heic');

        expect(mockHeicConvert).toHaveBeenCalledWith({
          buffer: mockInputBuffer,
          format: 'JPEG',
          quality: JPEG_QUALITY / 100,
        });
        expect(mockSharp).not.toHaveBeenCalled();
        expect(result).toEqual({
          buffer: Buffer.from(mockHeicOutput),
          mimeType: 'image/jpeg',
          originalFormat: 'image/heic',
        });
      });

      it('should convert HEIF to JPEG using heic-convert', async () => {
        const mockHeicOutput = new Uint8Array([1, 2, 3, 4]);
        mockHeicConvert.mockResolvedValue(mockHeicOutput);

        const result = await convertToJpeg(mockInputBuffer, 'image/heif');

        expect(mockHeicConvert).toHaveBeenCalledWith({
          buffer: mockInputBuffer,
          format: 'JPEG',
          quality: JPEG_QUALITY / 100,
        });
        expect(result.originalFormat).toBe('image/heif');
      });

      it('should throw error when HEIC conversion fails', async () => {
        mockHeicConvert.mockRejectedValue(new Error('Invalid HEIC data'));

        await expect(convertToJpeg(mockInputBuffer, 'image/heic')).rejects.toThrow(
          'Invalid HEIC data'
        );
      });
    });

    describe('error handling', () => {
      it('should propagate sharp errors', async () => {
        mockSharpInstance.toBuffer.mockRejectedValue(new Error('Sharp processing failed'));

        await expect(convertToJpeg(mockInputBuffer, 'image/jpeg')).rejects.toThrow(
          'Sharp processing failed'
        );
      });
    });
  });

  describe('validateImage', () => {
    const mockBuffer = Buffer.from('mock-image-data');

    describe('with valid image', () => {
      it('should return valid result with metadata', async () => {
        mockSharpInstance.metadata.mockResolvedValue({
          width: 1920,
          height: 1080,
          format: 'jpeg',
        });

        const result = await validateImage(mockBuffer);

        expect(result).toEqual({
          valid: true,
          width: 1920,
          height: 1080,
          format: 'jpeg',
        });
      });

      it('should accept images at the pixel limit', async () => {
        // 50MP image (e.g., 10000x5000)
        mockSharpInstance.metadata.mockResolvedValue({
          width: 10000,
          height: 5000,
          format: 'jpeg',
        });

        const result = await validateImage(mockBuffer);

        expect(result.valid).toBe(true);
      });

      it('should default format to unknown when metadata.format is undefined', async () => {
        mockSharpInstance.metadata.mockResolvedValue({
          width: 1920,
          height: 1080,
          // format intentionally omitted
        });

        const result = await validateImage(mockBuffer);

        expect(result.valid).toBe(true);
        expect(result.format).toBe('unknown');
      });
    });

    describe('with invalid image', () => {
      it('should reject when dimensions are missing', async () => {
        mockSharpInstance.metadata.mockResolvedValue({
          format: 'jpeg',
        });

        const result = await validateImage(mockBuffer);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Could not read image dimensions');
      });

      it('should reject when width is zero', async () => {
        mockSharpInstance.metadata.mockResolvedValue({
          width: 0,
          height: 1080,
          format: 'jpeg',
        });

        const result = await validateImage(mockBuffer);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Could not read image dimensions');
      });

      it('should reject image exceeding pixel limit', async () => {
        // 51MP image (exceeds 50MP limit)
        mockSharpInstance.metadata.mockResolvedValue({
          width: 10000,
          height: 5100,
          format: 'jpeg',
        });

        const result = await validateImage(mockBuffer);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Image too large');
        expect(result.error).toContain('51MP');
        expect(result.error).toContain('50MP');
      });

      it('should handle corrupted images gracefully', async () => {
        mockSharpInstance.metadata.mockRejectedValue(new Error('Input buffer is corrupt'));

        const result = await validateImage(mockBuffer);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid image file');
        expect(result.error).toContain('Input buffer is corrupt');
      });

      it('should handle unknown errors gracefully', async () => {
        mockSharpInstance.metadata.mockRejectedValue('Non-error rejection');

        const result = await validateImage(mockBuffer);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unknown error');
      });
    });

    describe('format detection', () => {
      it('should detect PNG format', async () => {
        mockSharpInstance.metadata.mockResolvedValue({
          width: 800,
          height: 600,
          format: 'png',
        });

        const result = await validateImage(mockBuffer);

        expect(result.format).toBe('png');
      });

      it('should handle missing format', async () => {
        mockSharpInstance.metadata.mockResolvedValue({
          width: 800,
          height: 600,
        });

        const result = await validateImage(mockBuffer);

        expect(result.format).toBe('unknown');
      });
    });
  });

  describe('validateHeicImage', () => {
    const mockBuffer = Buffer.from('mock-heic-data');

    it('should convert HEIC and validate result', async () => {
      const mockJpegOutput = new Uint8Array([1, 2, 3, 4]);
      mockHeicConvert.mockResolvedValue(mockJpegOutput);
      mockSharpInstance.metadata.mockResolvedValue({
        width: 4032,
        height: 3024,
        format: 'jpeg',
      });

      const result = await validateHeicImage(mockBuffer);

      expect(mockHeicConvert).toHaveBeenCalled();
      expect(result.valid).toBe(true);
      expect(result.width).toBe(4032);
      expect(result.height).toBe(3024);
    });

    it('should return invalid when HEIC conversion fails', async () => {
      mockHeicConvert.mockRejectedValue(new Error('Not a valid HEIC file'));

      const result = await validateHeicImage(mockBuffer);

      expect(result.valid).toBe(false);
      expect(result.format).toBe('heic');
      expect(result.error).toContain('Invalid HEIC file');
      expect(result.error).toContain('Not a valid HEIC file');
    });

    it('should return invalid when converted JPEG is too large', async () => {
      const mockJpegOutput = new Uint8Array([1, 2, 3, 4]);
      mockHeicConvert.mockResolvedValue(mockJpegOutput);
      mockSharpInstance.metadata.mockResolvedValue({
        width: 20000,
        height: 10000, // 200MP - way over limit
        format: 'jpeg',
      });

      const result = await validateHeicImage(mockBuffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Image too large');
    });
  });

  describe('validateImageByType', () => {
    const mockBuffer = Buffer.from('mock-image-data');

    it('should route HEIC to validateHeicImage', async () => {
      const mockJpegOutput = new Uint8Array([1, 2, 3, 4]);
      mockHeicConvert.mockResolvedValue(mockJpegOutput);
      mockSharpInstance.metadata.mockResolvedValue({
        width: 4032,
        height: 3024,
        format: 'jpeg',
      });

      const result = await validateImageByType(mockBuffer, 'image/heic');

      expect(mockHeicConvert).toHaveBeenCalled();
      expect(result.valid).toBe(true);
    });

    it('should route HEIF to validateHeicImage', async () => {
      const mockJpegOutput = new Uint8Array([1, 2, 3, 4]);
      mockHeicConvert.mockResolvedValue(mockJpegOutput);
      mockSharpInstance.metadata.mockResolvedValue({
        width: 4032,
        height: 3024,
        format: 'jpeg',
      });

      const result = await validateImageByType(mockBuffer, 'image/heif');

      expect(mockHeicConvert).toHaveBeenCalled();
      expect(result.valid).toBe(true);
    });

    it('should route JPEG to validateImage', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
      });

      const result = await validateImageByType(mockBuffer, 'image/jpeg');

      expect(mockHeicConvert).not.toHaveBeenCalled();
      expect(mockSharp).toHaveBeenCalledWith(mockBuffer);
      expect(result.valid).toBe(true);
    });

    it('should route PNG to validateImage', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'png',
      });

      const result = await validateImageByType(mockBuffer, 'image/png');

      expect(mockHeicConvert).not.toHaveBeenCalled();
      expect(result.valid).toBe(true);
      expect(result.format).toBe('png');
    });
  });
});
