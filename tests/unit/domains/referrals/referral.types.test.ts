// tests/unit/domains/referrals/referral.types.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BASE_REFERRAL_MIME_TYPES,
  EXTENDED_REFERRAL_MIME_TYPES,
  ALLOWED_REFERRAL_MIME_TYPES,
  ACCEPTED_REFERRAL_EXTENSIONS,
  BASE_ACCEPTED_EXTENSIONS,
  isExtendedUploadTypesEnabled,
  isBaseMimeType,
  isExtendedMimeType,
  isAllowedMimeType,
  getAllowedMimeTypes,
  getAcceptedExtensions,
  isFileSizeValid,
  formatFileSize,
  MAX_REFERRAL_FILE_SIZE,
  normalizePatientName,
  normalizeDob,
  detectPatientConflicts,
  type FastExtractedData,
} from '@/domains/referrals/referral.types';

describe('referral.types', () => {
  describe('MIME type constants', () => {
    it('should have correct base MIME types', () => {
      expect(BASE_REFERRAL_MIME_TYPES).toEqual(['application/pdf', 'text/plain']);
    });

    it('should have correct extended MIME types', () => {
      expect(EXTENDED_REFERRAL_MIME_TYPES).toContain('image/jpeg');
      expect(EXTENDED_REFERRAL_MIME_TYPES).toContain('image/png');
      expect(EXTENDED_REFERRAL_MIME_TYPES).toContain('image/heic');
      expect(EXTENDED_REFERRAL_MIME_TYPES).toContain('image/heif');
      expect(EXTENDED_REFERRAL_MIME_TYPES).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(EXTENDED_REFERRAL_MIME_TYPES).toContain('application/rtf');
      expect(EXTENDED_REFERRAL_MIME_TYPES).toContain('text/rtf');
      expect(EXTENDED_REFERRAL_MIME_TYPES).toHaveLength(7);
    });

    it('should combine base and extended MIME types correctly', () => {
      expect(ALLOWED_REFERRAL_MIME_TYPES).toHaveLength(9);
      expect(ALLOWED_REFERRAL_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_REFERRAL_MIME_TYPES).toContain('text/plain');
      expect(ALLOWED_REFERRAL_MIME_TYPES).toContain('image/jpeg');
    });
  });

  describe('extension constants', () => {
    it('should have correct accepted extensions (extended)', () => {
      expect(ACCEPTED_REFERRAL_EXTENSIONS).toBe(
        '.pdf, .txt, .jpg, .jpeg, .png, .heic, .heif, .docx, .rtf'
      );
    });

    it('should have correct base accepted extensions', () => {
      expect(BASE_ACCEPTED_EXTENSIONS).toBe('.pdf, .txt');
    });
  });

  describe('isExtendedUploadTypesEnabled', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return true when NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES is "true"', () => {
      process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = 'true';
      expect(isExtendedUploadTypesEnabled()).toBe(true);
    });

    it('should return false when NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES is "false"', () => {
      process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = 'false';
      expect(isExtendedUploadTypesEnabled()).toBe(false);
    });

    it('should return false when NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES is undefined', () => {
      delete process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES;
      expect(isExtendedUploadTypesEnabled()).toBe(false);
    });

    it('should return false when NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES is empty string', () => {
      process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = '';
      expect(isExtendedUploadTypesEnabled()).toBe(false);
    });

    it('should return false when NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES is "TRUE" (case sensitive)', () => {
      process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = 'TRUE';
      expect(isExtendedUploadTypesEnabled()).toBe(false);
    });
  });

  describe('isBaseMimeType', () => {
    it('should return true for PDF', () => {
      expect(isBaseMimeType('application/pdf')).toBe(true);
    });

    it('should return true for text/plain', () => {
      expect(isBaseMimeType('text/plain')).toBe(true);
    });

    it('should return false for image/jpeg', () => {
      expect(isBaseMimeType('image/jpeg')).toBe(false);
    });

    it('should return false for DOCX', () => {
      expect(
        isBaseMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isBaseMimeType('')).toBe(false);
    });

    it('should return false for invalid MIME type', () => {
      expect(isBaseMimeType('invalid/type')).toBe(false);
    });
  });

  describe('isExtendedMimeType', () => {
    it('should return true for image/jpeg', () => {
      expect(isExtendedMimeType('image/jpeg')).toBe(true);
    });

    it('should return true for image/png', () => {
      expect(isExtendedMimeType('image/png')).toBe(true);
    });

    it('should return true for image/heic', () => {
      expect(isExtendedMimeType('image/heic')).toBe(true);
    });

    it('should return true for image/heif', () => {
      expect(isExtendedMimeType('image/heif')).toBe(true);
    });

    it('should return true for DOCX', () => {
      expect(
        isExtendedMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).toBe(true);
    });

    it('should return true for application/rtf', () => {
      expect(isExtendedMimeType('application/rtf')).toBe(true);
    });

    it('should return true for text/rtf', () => {
      expect(isExtendedMimeType('text/rtf')).toBe(true);
    });

    it('should return false for PDF', () => {
      expect(isExtendedMimeType('application/pdf')).toBe(false);
    });

    it('should return false for text/plain', () => {
      expect(isExtendedMimeType('text/plain')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isExtendedMimeType('')).toBe(false);
    });
  });

  describe('isAllowedMimeType', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('with feature flag disabled', () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = 'false';
      });

      it('should allow PDF', () => {
        expect(isAllowedMimeType('application/pdf')).toBe(true);
      });

      it('should allow text/plain', () => {
        expect(isAllowedMimeType('text/plain')).toBe(true);
      });

      it('should NOT allow image/jpeg', () => {
        expect(isAllowedMimeType('image/jpeg')).toBe(false);
      });

      it('should NOT allow image/heic', () => {
        expect(isAllowedMimeType('image/heic')).toBe(false);
      });

      it('should NOT allow DOCX', () => {
        expect(
          isAllowedMimeType(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          )
        ).toBe(false);
      });
    });

    describe('with feature flag enabled', () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = 'true';
      });

      it('should allow PDF', () => {
        expect(isAllowedMimeType('application/pdf')).toBe(true);
      });

      it('should allow text/plain', () => {
        expect(isAllowedMimeType('text/plain')).toBe(true);
      });

      it('should allow image/jpeg', () => {
        expect(isAllowedMimeType('image/jpeg')).toBe(true);
      });

      it('should allow image/png', () => {
        expect(isAllowedMimeType('image/png')).toBe(true);
      });

      it('should allow image/heic', () => {
        expect(isAllowedMimeType('image/heic')).toBe(true);
      });

      it('should allow image/heif', () => {
        expect(isAllowedMimeType('image/heif')).toBe(true);
      });

      it('should allow DOCX', () => {
        expect(
          isAllowedMimeType(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          )
        ).toBe(true);
      });

      it('should allow application/rtf', () => {
        expect(isAllowedMimeType('application/rtf')).toBe(true);
      });

      it('should allow text/rtf', () => {
        expect(isAllowedMimeType('text/rtf')).toBe(true);
      });
    });

    describe('invalid MIME types (any flag state)', () => {
      it('should NOT allow video/mp4', () => {
        expect(isAllowedMimeType('video/mp4')).toBe(false);
      });

      it('should NOT allow empty string', () => {
        expect(isAllowedMimeType('')).toBe(false);
      });

      it('should NOT allow invalid format', () => {
        expect(isAllowedMimeType('not-a-mime-type')).toBe(false);
      });

      it('should NOT allow application/octet-stream', () => {
        expect(isAllowedMimeType('application/octet-stream')).toBe(false);
      });
    });
  });

  describe('getAllowedMimeTypes', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return only base types when feature flag is disabled', () => {
      process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = 'false';
      const allowed = getAllowedMimeTypes();
      expect(allowed).toHaveLength(2);
      expect(allowed).toContain('application/pdf');
      expect(allowed).toContain('text/plain');
      expect(allowed).not.toContain('image/jpeg');
    });

    it('should return all types when feature flag is enabled', () => {
      process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = 'true';
      const allowed = getAllowedMimeTypes();
      expect(allowed).toHaveLength(9);
      expect(allowed).toContain('application/pdf');
      expect(allowed).toContain('image/jpeg');
      expect(allowed).toContain('image/heic');
    });
  });

  describe('getAcceptedExtensions', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return base extensions when feature flag is disabled', () => {
      process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = 'false';
      expect(getAcceptedExtensions()).toBe('.pdf, .txt');
    });

    it('should return all extensions when feature flag is enabled', () => {
      process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES = 'true';
      expect(getAcceptedExtensions()).toBe('.pdf, .txt, .jpg, .jpeg, .png, .heic, .heif, .docx, .rtf');
    });
  });

  describe('isFileSizeValid', () => {
    it('should return true for valid file sizes', () => {
      expect(isFileSizeValid(1)).toBe(true);
      expect(isFileSizeValid(1000)).toBe(true);
      expect(isFileSizeValid(MAX_REFERRAL_FILE_SIZE)).toBe(true);
    });

    it('should return false for 0 bytes', () => {
      expect(isFileSizeValid(0)).toBe(false);
    });

    it('should return false for negative bytes', () => {
      expect(isFileSizeValid(-1)).toBe(false);
    });

    it('should return false for files over the limit', () => {
      expect(isFileSizeValid(MAX_REFERRAL_FILE_SIZE + 1)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1023)).toBe('1023 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1023)).toBe('1023.0 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(1024 * 1024 * 5.5)).toBe('5.5 MB');
      expect(formatFileSize(MAX_REFERRAL_FILE_SIZE)).toBe('20.0 MB');
    });
  });

  describe('MAX_REFERRAL_FILE_SIZE', () => {
    it('should be 20 MB', () => {
      // Updated from 10 MB to 20 MB to support larger scanned documents and photos
      expect(MAX_REFERRAL_FILE_SIZE).toBe(20 * 1024 * 1024);
    });
  });

  describe('normalizePatientName', () => {
    it('should handle null and undefined', () => {
      expect(normalizePatientName(null)).toBe('');
      expect(normalizePatientName(undefined)).toBe('');
      expect(normalizePatientName('')).toBe('');
    });

    it('should lowercase and trim', () => {
      expect(normalizePatientName('  John Smith  ')).toBe('john smith');
      expect(normalizePatientName('JOHN SMITH')).toBe('john smith');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizePatientName('John   Smith')).toBe('john smith');
    });

    it('should remove common title prefixes', () => {
      expect(normalizePatientName('Mr. John Smith')).toBe('john smith');
      expect(normalizePatientName('Mrs. Jane Smith')).toBe('jane smith');
      expect(normalizePatientName('Ms Jane Smith')).toBe('jane smith');
      expect(normalizePatientName('Dr. John Smith')).toBe('john smith');
      expect(normalizePatientName('Prof. John Smith')).toBe('john smith');
    });

    it('should remove common suffixes', () => {
      expect(normalizePatientName('John Smith Jr')).toBe('john smith');
      expect(normalizePatientName('John Smith Sr.')).toBe('john smith');
      expect(normalizePatientName('John Smith III')).toBe('john smith');
    });
  });

  describe('normalizeDob', () => {
    it('should handle null and undefined', () => {
      expect(normalizeDob(null)).toBe('');
      expect(normalizeDob(undefined)).toBe('');
      expect(normalizeDob('')).toBe('');
    });

    it('should pass through YYYY-MM-DD format', () => {
      expect(normalizeDob('1990-05-15')).toBe('1990-05-15');
    });

    it('should convert DD/MM/YYYY to YYYY-MM-DD', () => {
      expect(normalizeDob('15/05/1990')).toBe('1990-05-15');
      expect(normalizeDob('1/5/1990')).toBe('1990-05-01');
    });

    it('should handle dot and dash separators', () => {
      expect(normalizeDob('15.05.1990')).toBe('1990-05-15');
      expect(normalizeDob('15-05-1990')).toBe('1990-05-15');
    });

    it('should trim whitespace', () => {
      expect(normalizeDob('  1990-05-15  ')).toBe('1990-05-15');
    });
  });

  describe('detectPatientConflicts', () => {
    // Helper to create FastExtractedData
    function createExtractedData(
      name: string | null,
      dob: string | null,
      overallConfidence = 0.85
    ): FastExtractedData {
      return {
        patientName: { value: name, confidence: 0.85, level: 'high' },
        dateOfBirth: { value: dob, confidence: 0.85, level: 'high' },
        mrn: { value: null, confidence: 0, level: 'low' },
        overallConfidence,
        extractedAt: new Date().toISOString(),
        modelUsed: 'claude-sonnet-4-20250514',
        processingTimeMs: 2500,
      };
    }

    it('should return no conflict for empty array', () => {
      const result = detectPatientConflicts([]);
      expect(result.hasConflict).toBe(false);
      expect(result.uniqueNames).toHaveLength(0);
      expect(result.uniqueDobs).toHaveLength(0);
    });

    it('should return no conflict for single document', () => {
      const data = createExtractedData('John Smith', '1990-05-15');
      const result = detectPatientConflicts([data]);
      expect(result.hasConflict).toBe(false);
      expect(result.uniqueNames).toEqual(['John Smith']);
      expect(result.uniqueDobs).toEqual(['1990-05-15']);
    });

    it('should return no conflict when all documents have same patient', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15');
      const data2 = createExtractedData('John Smith', '1990-05-15');
      const result = detectPatientConflicts([data1, data2]);
      expect(result.hasConflict).toBe(false);
    });

    it('should return no conflict for case differences', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15');
      const data2 = createExtractedData('JOHN SMITH', '1990-05-15');
      const result = detectPatientConflicts([data1, data2]);
      expect(result.hasConflict).toBe(false);
    });

    it('should return no conflict for title differences', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15');
      const data2 = createExtractedData('Mr. John Smith', '1990-05-15');
      const result = detectPatientConflicts([data1, data2]);
      expect(result.hasConflict).toBe(false);
    });

    it('should detect name conflict', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15');
      const data2 = createExtractedData('Jane Doe', '1990-05-15');
      const result = detectPatientConflicts([data1, data2]);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('name');
      expect(result.uniqueNames).toHaveLength(2);
      expect(result.uniqueNames).toContain('John Smith');
      expect(result.uniqueNames).toContain('Jane Doe');
    });

    it('should detect DOB conflict', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15');
      const data2 = createExtractedData('John Smith', '1985-03-20');
      const result = detectPatientConflicts([data1, data2]);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('dob');
      expect(result.uniqueDobs).toHaveLength(2);
    });

    it('should detect both name and DOB conflict', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15');
      const data2 = createExtractedData('Jane Doe', '1985-03-20');
      const result = detectPatientConflicts([data1, data2]);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('both');
    });

    it('should normalize DOB formats when comparing', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15');
      const data2 = createExtractedData('John Smith', '15/05/1990');
      const result = detectPatientConflicts([data1, data2]);
      expect(result.hasConflict).toBe(false);
    });

    it('should skip null/undefined extraction data', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15');
      const result = detectPatientConflicts([null, data1, undefined]);
      expect(result.hasConflict).toBe(false);
      expect(result.uniqueNames).toEqual(['John Smith']);
    });

    it('should return suggested patient with highest confidence', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15', 0.75);
      const data2 = createExtractedData('Jane Doe', '1985-03-20', 0.95);
      const result = detectPatientConflicts([data1, data2]);
      expect(result.suggestedPatient).toBeDefined();
      expect(result.suggestedPatient?.name).toBe('Jane Doe');
      expect(result.suggestedPatient?.confidence).toBe(0.95);
    });

    it('should include conflict description', () => {
      const data1 = createExtractedData('John Smith', '1990-05-15');
      const data2 = createExtractedData('Jane Doe', '1990-05-15');
      const result = detectPatientConflicts([data1, data2]);
      expect(result.conflictDescription).toBeDefined();
      expect(result.conflictDescription).toContain('John Smith');
      expect(result.conflictDescription).toContain('Jane Doe');
    });
  });
});
