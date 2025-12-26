// tests/unit/domains/referrals/fast-patient-extraction.test.ts
// Tests for fast patient extraction prompt parser and service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MODELS } from '@/infrastructure/ai';

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    referralDocument: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock AI text generation (unified layer)
vi.mock('@/infrastructure/ai', () => ({
  generateTextWithRetry: vi.fn(),
  MODELS: {
    SONNET: 'sonnet',
    OPUS: 'opus',
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  parseFastExtraction,
  FastExtractionError,
  hasFastExtractionData,
  hasMinimumFastExtractionData,
  getFastExtractionSummary,
  FAST_PATIENT_EXTRACTION_PROMPT,
} from '@/domains/referrals/extractors/fast-patient-extraction';
import {
  extractFastPatientData,
  getFastExtractionData,
  isFastExtractionComplete,
} from '@/domains/referrals/referral-fast-extraction.service';
import { prisma } from '@/infrastructure/db/client';
import { generateTextWithRetry } from '@/infrastructure/ai';

describe('fast-patient-extraction parser', () => {
  describe('parseFastExtraction', () => {
    it('should parse complete valid JSON response', () => {
      const validJson = JSON.stringify({
        name: 'John Michael Smith',
        dob: '1965-03-15',
        mrn: 'MRN12345678',
        nameConfidence: 0.95,
        dobConfidence: 0.92,
        mrnConfidence: 0.88,
      });

      const result = parseFastExtraction(validJson, MODELS.SONNET, 1500);

      expect(result.patientName.value).toBe('John Michael Smith');
      expect(result.patientName.confidence).toBe(0.95);
      expect(result.patientName.level).toBe('high');

      expect(result.dateOfBirth.value).toBe('1965-03-15');
      expect(result.dateOfBirth.confidence).toBe(0.92);
      expect(result.dateOfBirth.level).toBe('high');

      expect(result.mrn.value).toBe('MRN12345678');
      expect(result.mrn.confidence).toBe(0.88);
      expect(result.mrn.level).toBe('high');

      expect(result.modelUsed).toBe(MODELS.SONNET);
      expect(result.processingTimeMs).toBe(1500);
      expect(result.extractedAt).toBeDefined();
    });

    it('should handle JSON wrapped in markdown code blocks', () => {
      const wrappedJson = '```json\n{"name": "Jane Doe", "dob": "1980-01-15", "mrn": null, "nameConfidence": 0.9, "dobConfidence": 0.85, "mrnConfidence": 0}\n```';

      const result = parseFastExtraction(wrappedJson, MODELS.SONNET, 1000);

      expect(result.patientName.value).toBe('Jane Doe');
      expect(result.dateOfBirth.value).toBe('1980-01-15');
      expect(result.mrn.value).toBeNull();
    });

    it('should extract JSON from response with extra text', () => {
      const responseWithText = `Here is the extracted data:
      {"name": "Bob Wilson", "dob": "1975-06-20", "mrn": "URN999", "nameConfidence": 0.85, "dobConfidence": 0.8, "mrnConfidence": 0.75}
      I hope this helps!`;

      const result = parseFastExtraction(responseWithText, MODELS.SONNET, 2000);

      expect(result.patientName.value).toBe('Bob Wilson');
      expect(result.mrn.value).toBe('URN999');
    });

    it('should throw FastExtractionError for invalid JSON', () => {
      const invalidJson = 'This is not JSON at all';

      expect(() => parseFastExtraction(invalidJson, MODELS.SONNET, 100))
        .toThrow(FastExtractionError);
      expect(() => parseFastExtraction(invalidJson, MODELS.SONNET, 100))
        .toThrow('No valid JSON found in response');
    });

    it('should throw FastExtractionError for arrays', () => {
      const arrayJson = '["this", "is", "an", "array"]';

      expect(() => parseFastExtraction(arrayJson, MODELS.SONNET, 100))
        .toThrow(FastExtractionError);
      expect(() => parseFastExtraction(arrayJson, MODELS.SONNET, 100))
        .toThrow('Response is not a valid JSON object');
    });

    it('should handle null values', () => {
      const jsonWithNulls = JSON.stringify({
        name: 'Test Patient',
        dob: null,
        mrn: null,
        nameConfidence: 0.9,
        dobConfidence: 0,
        mrnConfidence: 0,
      });

      const result = parseFastExtraction(jsonWithNulls, MODELS.SONNET, 500);

      expect(result.patientName.value).toBe('Test Patient');
      expect(result.dateOfBirth.value).toBeNull();
      expect(result.mrn.value).toBeNull();
    });

    it('should handle missing fields with defaults', () => {
      const minimalJson = JSON.stringify({
        name: 'Test',
      });

      const result = parseFastExtraction(minimalJson, MODELS.SONNET, 500);

      expect(result.patientName.value).toBe('Test');
      expect(result.patientName.confidence).toBe(0);
      expect(result.dateOfBirth.value).toBeNull();
      expect(result.mrn.value).toBeNull();
    });

    it('should normalize DD/MM/YYYY date format', () => {
      const jsonWithAusDate = JSON.stringify({
        name: 'Test',
        dob: '15/03/1965',
        mrn: null,
        nameConfidence: 0.9,
        dobConfidence: 0.9,
        mrnConfidence: 0,
      });

      const result = parseFastExtraction(jsonWithAusDate, MODELS.SONNET, 500);

      expect(result.dateOfBirth.value).toBe('1965-03-15');
    });

    it('should normalize DD-MM-YYYY date format', () => {
      const jsonWithDashDate = JSON.stringify({
        name: 'Test',
        dob: '25-12-1990',
        mrn: null,
        nameConfidence: 0.9,
        dobConfidence: 0.9,
        mrnConfidence: 0,
      });

      const result = parseFastExtraction(jsonWithDashDate, MODELS.SONNET, 500);

      expect(result.dateOfBirth.value).toBe('1990-12-25');
    });

    it('should normalize DD.MM.YYYY date format', () => {
      const jsonWithDotDate = JSON.stringify({
        name: 'Test',
        dob: '01.06.2000',
        mrn: null,
        nameConfidence: 0.9,
        dobConfidence: 0.9,
        mrnConfidence: 0,
      });

      const result = parseFastExtraction(jsonWithDotDate, MODELS.SONNET, 500);

      expect(result.dateOfBirth.value).toBe('2000-06-01');
    });

    it('should clamp confidence values to 0-1 range', () => {
      const jsonWithBadConfidence = JSON.stringify({
        name: 'Test',
        dob: '1980-01-01',
        mrn: 'MRN123',
        nameConfidence: 1.5,
        dobConfidence: -0.2,
        mrnConfidence: 2.0,
      });

      const result = parseFastExtraction(jsonWithBadConfidence, MODELS.SONNET, 500);

      expect(result.patientName.confidence).toBe(1.0);
      expect(result.dateOfBirth.confidence).toBe(0);
      expect(result.mrn.confidence).toBe(1.0);
    });

    it('should assign correct confidence levels', () => {
      const jsonWithVaryingConfidence = JSON.stringify({
        name: 'High Confidence',
        dob: '1990-01-01',
        mrn: 'MRN123',
        nameConfidence: 0.95, // high (>= 0.85)
        dobConfidence: 0.75, // medium (>= 0.7)
        mrnConfidence: 0.5, // low (< 0.7)
      });

      const result = parseFastExtraction(jsonWithVaryingConfidence, MODELS.SONNET, 500);

      expect(result.patientName.level).toBe('high');
      expect(result.dateOfBirth.level).toBe('medium');
      expect(result.mrn.level).toBe('low');
    });

    it('should calculate overall confidence correctly', () => {
      // With all fields present, weights are: name 40%, dob 35%, mrn 25%
      const jsonAllFields = JSON.stringify({
        name: 'Test',
        dob: '1990-01-01',
        mrn: 'MRN123',
        nameConfidence: 1.0,
        dobConfidence: 0.8,
        mrnConfidence: 0.6,
      });

      const result = parseFastExtraction(jsonAllFields, MODELS.SONNET, 500);

      // Expected: (1.0 * 0.4 + 0.8 * 0.35 + 0.6 * 0.25) / 1.0 = 0.4 + 0.28 + 0.15 = 0.83
      expect(result.overallConfidence).toBeCloseTo(0.83, 2);
    });

    it('should calculate overall confidence with missing fields', () => {
      // With only name, entire weight goes to name
      const jsonNameOnly = JSON.stringify({
        name: 'Test',
        dob: null,
        mrn: null,
        nameConfidence: 0.8,
        dobConfidence: 0,
        mrnConfidence: 0,
      });

      const result = parseFastExtraction(jsonNameOnly, MODELS.SONNET, 500);

      // Only name present, so confidence = 0.8 (normalized)
      expect(result.overallConfidence).toBeCloseTo(0.8, 2);
    });

    it('should return 0 overall confidence when no data extracted', () => {
      const jsonNoData = JSON.stringify({
        name: null,
        dob: null,
        mrn: null,
        nameConfidence: 0,
        dobConfidence: 0,
        mrnConfidence: 0,
      });

      const result = parseFastExtraction(jsonNoData, MODELS.SONNET, 500);

      expect(result.overallConfidence).toBe(0);
    });

    it('should set processing time and timestamp', () => {
      const beforeTime = new Date().toISOString();

      const result = parseFastExtraction(
        JSON.stringify({
          name: 'Test',
          dob: null,
          mrn: null,
          nameConfidence: 0.9,
          dobConfidence: 0,
          mrnConfidence: 0,
        }),
        MODELS.SONNET,
        1234
      );

      const afterTime = new Date().toISOString();

      expect(result.processingTimeMs).toBe(1234);
      expect(result.extractedAt).toBeDefined();
      expect(result.extractedAt >= beforeTime).toBe(true);
      expect(result.extractedAt <= afterTime).toBe(true);
    });
  });

  describe('hasFastExtractionData', () => {
    it('should return true when name is present', () => {
      const data = parseFastExtraction(
        JSON.stringify({
          name: 'Test',
          dob: null,
          mrn: null,
          nameConfidence: 0.9,
          dobConfidence: 0,
          mrnConfidence: 0,
        }),
        MODELS.SONNET,
        500
      );

      expect(hasFastExtractionData(data)).toBe(true);
    });

    it('should return true when only DOB is present', () => {
      const data = parseFastExtraction(
        JSON.stringify({
          name: null,
          dob: '1990-01-01',
          mrn: null,
          nameConfidence: 0,
          dobConfidence: 0.9,
          mrnConfidence: 0,
        }),
        MODELS.SONNET,
        500
      );

      expect(hasFastExtractionData(data)).toBe(true);
    });

    it('should return true when only MRN is present', () => {
      const data = parseFastExtraction(
        JSON.stringify({
          name: null,
          dob: null,
          mrn: 'MRN123',
          nameConfidence: 0,
          dobConfidence: 0,
          mrnConfidence: 0.9,
        }),
        MODELS.SONNET,
        500
      );

      expect(hasFastExtractionData(data)).toBe(true);
    });

    it('should return false when no data is present', () => {
      const data = parseFastExtraction(
        JSON.stringify({
          name: null,
          dob: null,
          mrn: null,
          nameConfidence: 0,
          dobConfidence: 0,
          mrnConfidence: 0,
        }),
        MODELS.SONNET,
        500
      );

      expect(hasFastExtractionData(data)).toBe(false);
    });
  });

  describe('hasMinimumFastExtractionData', () => {
    it('should return true when name is present', () => {
      const data = parseFastExtraction(
        JSON.stringify({
          name: 'Test',
          dob: null,
          mrn: null,
          nameConfidence: 0.9,
          dobConfidence: 0,
          mrnConfidence: 0,
        }),
        MODELS.SONNET,
        500
      );

      expect(hasMinimumFastExtractionData(data)).toBe(true);
    });

    it('should return false when name is missing', () => {
      const data = parseFastExtraction(
        JSON.stringify({
          name: null,
          dob: '1990-01-01',
          mrn: 'MRN123',
          nameConfidence: 0,
          dobConfidence: 0.9,
          mrnConfidence: 0.9,
        }),
        MODELS.SONNET,
        500
      );

      expect(hasMinimumFastExtractionData(data)).toBe(false);
    });
  });

  describe('getFastExtractionSummary', () => {
    it('should return summary with all fields', () => {
      const data = parseFastExtraction(
        JSON.stringify({
          name: 'John Smith',
          dob: '1990-01-15',
          mrn: 'MRN123',
          nameConfidence: 0.9,
          dobConfidence: 0.9,
          mrnConfidence: 0.9,
        }),
        MODELS.SONNET,
        500
      );

      const summary = getFastExtractionSummary(data);

      expect(summary).toContain('Name: John Smith');
      expect(summary).toContain('DOB: 1990-01-15');
      expect(summary).toContain('MRN: MRN123');
    });

    it('should return summary with partial fields', () => {
      const data = parseFastExtraction(
        JSON.stringify({
          name: 'Jane Doe',
          dob: null,
          mrn: null,
          nameConfidence: 0.9,
          dobConfidence: 0,
          mrnConfidence: 0,
        }),
        MODELS.SONNET,
        500
      );

      const summary = getFastExtractionSummary(data);

      expect(summary).toBe('Name: Jane Doe');
      expect(summary).not.toContain('DOB');
      expect(summary).not.toContain('MRN');
    });

    it('should return default message when no data', () => {
      const data = parseFastExtraction(
        JSON.stringify({
          name: null,
          dob: null,
          mrn: null,
          nameConfidence: 0,
          dobConfidence: 0,
          mrnConfidence: 0,
        }),
        MODELS.SONNET,
        500
      );

      const summary = getFastExtractionSummary(data);

      expect(summary).toBe('No patient identifiers extracted');
    });
  });

  describe('FAST_PATIENT_EXTRACTION_PROMPT', () => {
    it('should include required JSON fields', () => {
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('"name"');
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('"dob"');
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('"mrn"');
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('nameConfidence');
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('dobConfidence');
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('mrnConfidence');
    });

    it('should specify YYYY-MM-DD date format', () => {
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('YYYY-MM-DD');
    });

    it('should mention MRN alternatives', () => {
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('MRN');
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('URN');
    });

    it('should request JSON only output', () => {
      expect(FAST_PATIENT_EXTRACTION_PROMPT).toContain('Return ONLY the JSON object');
    });
  });
});

describe('referral-fast-extraction.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockReferralDocument = {
    id: 'ref-doc-1',
    userId: 'user-1',
    practiceId: 'practice-1',
    contentText: `
      Dr. Sarah Chen
      Harbour Medical Centre

      Re: John Michael Smith
      DOB: 15/03/1965
      MRN: MRN12345678

      I am referring this patient for assessment.
    `,
    status: 'TEXT_EXTRACTED' as const,
    fastExtractionStatus: 'PENDING' as const,
    fastExtractionData: null,
  };

  const mockLLMResponse = {
    content: JSON.stringify({
      name: 'John Michael Smith',
      dob: '1965-03-15',
      mrn: 'MRN12345678',
      nameConfidence: 0.95,
      dobConfidence: 0.92,
      mrnConfidence: 0.88,
    }),
    inputTokens: 200,
    outputTokens: 50,
    stopReason: 'end_turn',
    modelId: MODELS.SONNET,
  };

  describe('extractFastPatientData', () => {
    it('should extract patient data successfully', async () => {
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument as any);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockLLMResponse);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        fastExtractionStatus: 'COMPLETE',
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await extractFastPatientData('user-1', 'practice-1', 'ref-doc-1');

      expect(result.status).toBe('COMPLETE');
      expect(result.data?.patientName.value).toBe('John Michael Smith');
      expect(result.data?.dateOfBirth.value).toBe('1965-03-15');
      expect(result.data?.mrn.value).toBe('MRN12345678');
    });

    it('should call LLM with correct parameters', async () => {
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument as any);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockLLMResponse);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await extractFastPatientData('user-1', 'practice-1', 'ref-doc-1');

      expect(generateTextWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: MODELS.SONNET,
          maxTokens: 256,
          temperature: 0,
          prompt: expect.stringContaining('DOCUMENT:'),
        }),
        expect.objectContaining({
          maxRetries: 2,
          initialDelayMs: 500,
        })
      );
    });

    it('should return error when document not found', async () => {
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({} as any);
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(null);

      const result = await extractFastPatientData('user-1', 'practice-1', 'non-existent');

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Referral document not found');
    });

    it('should return error when document has no text', async () => {
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({} as any);
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue({
        ...mockReferralDocument,
        contentText: '',
      } as any);

      const result = await extractFastPatientData('user-1', 'practice-1', 'ref-doc-1');

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('no extracted text content');
    });

    it('should use optimistic locking when acquiring PROCESSING status', async () => {
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument as any);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockLLMResponse);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await extractFastPatientData('user-1', 'practice-1', 'ref-doc-1');

      // Should use updateMany with status check for optimistic locking
      expect(prisma.referralDocument.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'ref-doc-1',
            fastExtractionStatus: { in: ['PENDING', 'FAILED'] },
          }),
          data: expect.objectContaining({
            fastExtractionStatus: 'PROCESSING',
          }),
        })
      );
    });

    it('should skip extraction if already in progress', async () => {
      // Mock updateMany returning 0 count (lock not acquired)
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 0 });

      const result = await extractFastPatientData('user-1', 'practice-1', 'ref-doc-1');

      expect(result.status).toBe('PROCESSING');
      expect(result.error).toContain('already in progress');
      // Should not have called findFirst or generateText since lock wasn't acquired
      expect(prisma.referralDocument.findFirst).not.toHaveBeenCalled();
      expect(generateTextWithRetry).not.toHaveBeenCalled();
    });

    it('should update status to COMPLETE on success', async () => {
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument as any);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockLLMResponse);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await extractFastPatientData('user-1', 'practice-1', 'ref-doc-1');

      // Should use update for COMPLETE status
      expect(prisma.referralDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fastExtractionStatus: 'COMPLETE',
            fastExtractionData: expect.any(Object),
            fastExtractionCompletedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should update status to FAILED on error', async () => {
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({} as any);
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument as any);
      vi.mocked(generateTextWithRetry).mockRejectedValue(new Error('LLM timeout'));

      const result = await extractFastPatientData('user-1', 'practice-1', 'ref-doc-1');

      expect(result.status).toBe('FAILED');
      expect(prisma.referralDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fastExtractionStatus: 'FAILED',
            fastExtractionError: expect.stringContaining('LLM timeout'),
          }),
        })
      );
    });

    it('should create audit log on success', async () => {
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument as any);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockLLMResponse);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await extractFastPatientData('user-1', 'practice-1', 'ref-doc-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'referral.extract_fast',
          resourceType: 'referral_document',
          resourceId: 'ref-doc-1',
          metadata: expect.objectContaining({
            model: MODELS.SONNET,
            hasName: true,
            hasDob: true,
            hasMrn: true,
          }),
        }),
      });
    });

    it('should handle malformed LLM response', async () => {
      vi.mocked(prisma.referralDocument.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({} as any);
      vi.mocked(prisma.referralDocument.findFirst).mockResolvedValue(mockReferralDocument as any);
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        ...mockLLMResponse,
        content: 'Not valid JSON response',
      });

      const result = await extractFastPatientData('user-1', 'practice-1', 'ref-doc-1');

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('No valid JSON found');
    });
  });

  describe('getFastExtractionData', () => {
    it('should return data when complete', async () => {
      const mockData = {
        patientName: { value: 'Test', confidence: 0.9, level: 'high' },
        dateOfBirth: { value: '1990-01-01', confidence: 0.9, level: 'high' },
        mrn: { value: null, confidence: 0, level: 'low' },
        overallConfidence: 0.9,
        extractedAt: '2024-01-01T00:00:00Z',
        modelUsed: MODELS.SONNET,
        processingTimeMs: 1000,
      };

      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({
        fastExtractionStatus: 'COMPLETE',
        fastExtractionData: mockData,
      } as any);

      const result = await getFastExtractionData('ref-doc-1');

      expect(result).toEqual(mockData);
    });

    it('should return null when not complete', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({
        fastExtractionStatus: 'PENDING',
        fastExtractionData: null,
      } as any);

      const result = await getFastExtractionData('ref-doc-1');

      expect(result).toBeNull();
    });

    it('should return null when document not found', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(null);

      const result = await getFastExtractionData('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('isFastExtractionComplete', () => {
    it('should return true when status is COMPLETE', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({
        fastExtractionStatus: 'COMPLETE',
      } as any);

      const result = await isFastExtractionComplete('ref-doc-1');

      expect(result).toBe(true);
    });

    it('should return false when status is not COMPLETE', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({
        fastExtractionStatus: 'PROCESSING',
      } as any);

      const result = await isFastExtractionComplete('ref-doc-1');

      expect(result).toBe(false);
    });

    it('should return false when document not found', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(null);

      const result = await isFastExtractionComplete('non-existent');

      expect(result).toBe(false);
    });
  });
});
