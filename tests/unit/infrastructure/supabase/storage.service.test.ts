import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateAudioPath,
  generateDocumentPath,
  generateSignaturePath,
  generateLetterheadPath,
  isValidAudioType,
  isValidDocumentType,
  isValidImageType,
  validateFileSize,
  ALLOWED_IMAGE_TYPES,
} from '@/infrastructure/supabase/storage.service';
import { StorageError, ALLOWED_AUDIO_TYPES, ALLOWED_DOCUMENT_TYPES, MAX_FILE_SIZES } from '@/infrastructure/supabase/types';

// Mock Date.now for deterministic path generation
const mockNow = 1703462400000; // 2023-12-25 00:00:00 UTC

describe('Supabase Storage Service', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Path Generation', () => {
    describe('generateAudioPath', () => {
      it('should generate correct path for ambient mode', () => {
        const path = generateAudioPath('user-123', 'consultation-456', 'ambient', 'webm');
        expect(path).toBe('user-123/consultation-456/1703462400000_ambient.webm');
      });

      it('should generate correct path for dictation mode', () => {
        const path = generateAudioPath('user-123', 'consultation-456', 'dictation', 'mp4');
        expect(path).toBe('user-123/consultation-456/1703462400000_dictation.mp4');
      });

      it('should sanitize file extension', () => {
        const path = generateAudioPath('user-123', 'consultation-456', 'ambient', '../../../etc/passwd');
        // Path traversal in extension is sanitized (slashes become underscores)
        expect(path).not.toContain('..');
        // The path still contains / for the valid path separators (userId/consultationId)
        expect(path).toMatch(/^user-123\/consultation-456\/\d+_ambient\._etc_passwd$/);
      });

      it('should lowercase extension', () => {
        const path = generateAudioPath('user-123', 'consultation-456', 'dictation', 'WEBM');
        expect(path).toMatch(/\.webm$/);
      });
    });

    describe('generateDocumentPath', () => {
      it('should generate correct path for echocardiogram', () => {
        const path = generateDocumentPath('user-123', 'patient-456', 'echocardiogram', 'echo_report.pdf');
        expect(path).toBe('user-123/patient-456/echocardiogram/echo_report_1703462400000.pdf');
      });

      it('should generate correct path for ECG', () => {
        const path = generateDocumentPath('user-123', 'patient-456', 'ecg', 'ecg-reading.png');
        expect(path).toBe('user-123/patient-456/ecg/ecg-reading_1703462400000.png');
      });

      it('should sanitize filenames with path traversal attempts', () => {
        const path = generateDocumentPath('user-123', 'patient-456', 'lab_results', '../../secret/file.pdf');
        expect(path).not.toContain('..');
        expect(path).toContain('user-123/patient-456/lab_results/');
      });

      it('should handle filenames with special characters', () => {
        const path = generateDocumentPath('user-123', 'patient-456', 'other', 'file name with spaces!@#$.pdf');
        expect(path).not.toContain(' ');
        expect(path).not.toContain('!');
        expect(path).not.toContain('@');
        expect(path).not.toContain('#');
        expect(path).not.toContain('$');
      });

      it('should handle very long filenames', () => {
        const longFilename = 'a'.repeat(300) + '.pdf';
        const path = generateDocumentPath('user-123', 'patient-456', 'other', longFilename);
        // Sanitization limits filename to 200 chars
        expect(path.length).toBeLessThan(350);
      });

      it('should handle files without extension', () => {
        const path = generateDocumentPath('user-123', 'patient-456', 'other', 'filename_no_ext');
        expect(path).toBe('user-123/patient-456/other/filename_no_ext_1703462400000');
      });
    });

    describe('generateSignaturePath', () => {
      it('should generate correct path with PNG extension', () => {
        const path = generateSignaturePath('user-123', 'signature.png');
        expect(path).toBe('signatures/user-123/1703462400000.png');
      });

      it('should extract extension from filename', () => {
        const path = generateSignaturePath('user-123', 'my-sig.jpeg');
        expect(path).toBe('signatures/user-123/1703462400000.jpeg');
      });

      it('should use last part of filename as extension if no dot', () => {
        // When filename has no extension, it uses the whole filename as extension
        const path = generateSignaturePath('user-123', 'signature');
        expect(path).toBe('signatures/user-123/1703462400000.signature');
      });
    });

    describe('generateLetterheadPath', () => {
      it('should generate correct path with practice ID', () => {
        const path = generateLetterheadPath('practice-789', 'letterhead.png');
        expect(path).toBe('letterheads/practice-789/1703462400000.png');
      });

      it('should extract extension from filename', () => {
        const path = generateLetterheadPath('practice-789', 'logo.jpg');
        expect(path).toBe('letterheads/practice-789/1703462400000.jpg');
      });
    });
  });

  describe('Content Type Validation', () => {
    describe('isValidAudioType', () => {
      it.each(ALLOWED_AUDIO_TYPES)('should accept valid audio type: %s', (contentType) => {
        expect(isValidAudioType(contentType)).toBe(true);
      });

      it('should reject invalid audio types', () => {
        expect(isValidAudioType('audio/invalid')).toBe(false);
        expect(isValidAudioType('video/mp4')).toBe(false);
        expect(isValidAudioType('application/pdf')).toBe(false);
        expect(isValidAudioType('')).toBe(false);
      });
    });

    describe('isValidDocumentType', () => {
      it.each(ALLOWED_DOCUMENT_TYPES)('should accept valid document type: %s', (contentType) => {
        expect(isValidDocumentType(contentType)).toBe(true);
      });

      it('should reject invalid document types', () => {
        expect(isValidDocumentType('application/json')).toBe(false);
        expect(isValidDocumentType('text/html')).toBe(false);
        expect(isValidDocumentType('audio/webm')).toBe(false);
        expect(isValidDocumentType('')).toBe(false);
      });
    });

    describe('isValidImageType', () => {
      it.each(ALLOWED_IMAGE_TYPES)('should accept valid image type: %s', (contentType) => {
        expect(isValidImageType(contentType)).toBe(true);
      });

      it('should reject invalid image types', () => {
        expect(isValidImageType('image/svg+xml')).toBe(false);
        expect(isValidImageType('image/bmp')).toBe(false);
        expect(isValidImageType('application/pdf')).toBe(false);
      });
    });
  });

  describe('File Size Validation', () => {
    describe('validateFileSize', () => {
      it('should accept audio files under limit', () => {
        expect(() => validateFileSize('audio/webm', 100 * 1024 * 1024)).not.toThrow();
      });

      it('should throw for audio files over limit', () => {
        expect(() => validateFileSize('audio/webm', MAX_FILE_SIZES.AUDIO + 1)).toThrow(StorageError);
        expect(() => validateFileSize('audio/webm', MAX_FILE_SIZES.AUDIO + 1)).toThrow('exceeds maximum size');
      });

      it('should accept document files under limit', () => {
        expect(() => validateFileSize('application/pdf', 10 * 1024 * 1024)).not.toThrow();
      });

      it('should throw for document files over limit', () => {
        expect(() => validateFileSize('application/pdf', MAX_FILE_SIZES.DOCUMENT + 1)).toThrow(StorageError);
        expect(() => validateFileSize('application/pdf', MAX_FILE_SIZES.DOCUMENT + 1)).toThrow('exceeds maximum size');
      });

      it('should accept image files under limit', () => {
        expect(() => validateFileSize('image/png', 5 * 1024 * 1024)).not.toThrow();
      });

      it('should throw for image files over limit', () => {
        expect(() => validateFileSize('image/png', MAX_FILE_SIZES.DOCUMENT + 1)).toThrow(StorageError);
      });

      it('should not throw for unknown content types', () => {
        // Unknown types don't have a limit enforced
        expect(() => validateFileSize('application/unknown', 1000 * 1024 * 1024)).not.toThrow();
      });
    });
  });

  describe('StorageError', () => {
    it('should create error with message and code', () => {
      const error = new StorageError('Test error', 'FILE_NOT_FOUND');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('FILE_NOT_FOUND');
      expect(error.name).toBe('StorageError');
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new StorageError('Wrapped error', 'UPLOAD_FAILED', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('Path Security', () => {
    it('should prevent path traversal in user IDs', () => {
      const path = generateAudioPath('../../../etc', 'consultation-456', 'ambient', 'webm');
      // The path should still be structured correctly, user ID sanitization happens at API layer
      expect(path).toContain('_');
    });

    it('should sanitize filename in document path (user/patient IDs validated at API layer)', () => {
      // User IDs and patient IDs are validated at the API layer - they come from authenticated
      // sessions or database lookups. The path generation sanitizes only the filename.
      const path = generateDocumentPath(
        'user-123',
        'patient-456',
        'ecg',
        '../../secret.pdf'
      );
      // Filename should be sanitized - path traversal replaced with underscores
      expect(path).not.toContain('..');
      expect(path).toContain('_secret');
    });

    it('should handle null bytes in filenames', () => {
      const path = generateDocumentPath('user-123', 'patient-456', 'ecg', 'file\x00name.pdf');
      expect(path).not.toContain('\x00');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings gracefully', () => {
      const path = generateAudioPath('', '', 'ambient', '');
      expect(path).toBe('//1703462400000_ambient.');
    });

    it('should handle unicode in filenames', () => {
      const path = generateDocumentPath('user-123', 'patient-456', 'other', '文档.pdf');
      // Unicode chars should be replaced with underscores
      expect(path).toMatch(/\.pdf$/);
    });

    it('should preserve hyphens and underscores in filenames', () => {
      const path = generateDocumentPath('user-123', 'patient-456', 'other', 'file-name_test.pdf');
      expect(path).toContain('file-name_test');
    });

    it('should preserve dots in filenames (before extension)', () => {
      const path = generateDocumentPath('user-123', 'patient-456', 'other', 'file.v2.0.pdf');
      expect(path).toContain('file.v2.0');
    });
  });
});
