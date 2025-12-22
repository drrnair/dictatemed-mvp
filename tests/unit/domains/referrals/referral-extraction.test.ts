// tests/unit/domains/referrals/referral-extraction.test.ts
// Tests for referral extraction (prompt parser and extraction service)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReferralDocumentStatus } from '@/domains/referrals/referral.types';

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    referralDocument: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock Bedrock text generation
vi.mock('@/infrastructure/bedrock/text-generation', () => ({
  generateTextWithRetry: vi.fn(),
  MODELS: {
    SONNET: 'anthropic.claude-sonnet-4-20250514-v1:0',
    OPUS: 'anthropic.claude-opus-4-20250514-v1:0',
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
  parseReferralExtraction,
  ReferralExtractionError,
  hasLowConfidence,
  getLowConfidenceSections,
} from '@/domains/referrals/extractors/referral-letter';
import { extractStructuredData } from '@/domains/referrals/referral-extraction.service';
import { prisma } from '@/infrastructure/db/client';
import { generateTextWithRetry, MODELS } from '@/infrastructure/bedrock/text-generation';

describe('referral-letter extractor', () => {
  describe('parseReferralExtraction', () => {
    it('should parse complete valid JSON response', () => {
      const validJson = JSON.stringify({
        patient: {
          fullName: 'John Michael Smith',
          dateOfBirth: '1965-03-15',
          sex: 'male',
          medicare: '2345 67890 1',
          address: '123 Main St, Sydney NSW 2000',
          phone: '0412 345 678',
          confidence: 0.95,
        },
        gp: {
          fullName: 'Dr. Sarah Chen',
          practiceName: 'Harbour Medical Centre',
          address: '45 Harbour St, Sydney NSW 2000',
          phone: '(02) 9876 5432',
          confidence: 0.92,
        },
        referrer: null,
        referralContext: {
          reasonForReferral: 'Assessment of chest pain and shortness of breath on exertion.',
          keyProblems: ['Chest pain', 'Dyspnea on exertion', 'Hypertension'],
          investigationsMentioned: ['Stress test'],
          medicationsMentioned: ['Metoprolol', 'Aspirin'],
          urgency: 'routine',
          confidence: 0.88,
        },
        overallConfidence: 0.91,
      });

      const result = parseReferralExtraction(validJson, MODELS.SONNET);

      expect(result.patient.fullName).toBe('John Michael Smith');
      expect(result.patient.dateOfBirth).toBe('1965-03-15');
      expect(result.patient.sex).toBe('male');
      expect(result.patient.confidence).toBe(0.95);
      expect(result.gp.fullName).toBe('Dr. Sarah Chen');
      expect(result.gp.practiceName).toBe('Harbour Medical Centre');
      expect(result.referrer).toBeUndefined();
      expect(result.referralContext.keyProblems).toHaveLength(3);
      expect(result.referralContext.urgency).toBe('routine');
      expect(result.overallConfidence).toBe(0.91);
      expect(result.modelUsed).toBe(MODELS.SONNET);
    });

    it('should handle JSON wrapped in markdown code blocks', () => {
      const wrappedJson = '```json\n{"patient": {"fullName": "Jane Doe", "confidence": 0.8}, "gp": {"confidence": 0.7}, "referralContext": {"confidence": 0.6}, "overallConfidence": 0.7}\n```';

      const result = parseReferralExtraction(wrappedJson, MODELS.SONNET);

      expect(result.patient.fullName).toBe('Jane Doe');
      expect(result.overallConfidence).toBe(0.7);
    });

    it('should extract JSON from response with extra text', () => {
      const responseWithText = `Here is the extracted data:
      {"patient": {"fullName": "Bob Wilson", "confidence": 0.9}, "gp": {"confidence": 0.8}, "referralContext": {"confidence": 0.7}, "overallConfidence": 0.85}
      I hope this is helpful!`;

      const result = parseReferralExtraction(responseWithText, MODELS.SONNET);

      expect(result.patient.fullName).toBe('Bob Wilson');
    });

    it('should throw ReferralExtractionError for invalid JSON', () => {
      const invalidJson = 'This is not JSON at all';

      expect(() => parseReferralExtraction(invalidJson, MODELS.SONNET))
        .toThrow(ReferralExtractionError);
      expect(() => parseReferralExtraction(invalidJson, MODELS.SONNET))
        .toThrow('No valid JSON found in LLM response');
    });

    it('should handle arrays by returning empty sections with zero confidence', () => {
      // Arrays are technically objects in JS, so the parser handles them gracefully
      // with default empty sections (since no valid properties exist)
      const arrayJson = '["this", "is", "an", "array"]';

      const result = parseReferralExtraction(arrayJson, MODELS.SONNET);

      // Should return valid data with zero confidence since no real data was extracted
      expect(result.patient.confidence).toBe(0);
      expect(result.gp.confidence).toBe(0);
      expect(result.referralContext.confidence).toBe(0);
      expect(result.overallConfidence).toBe(0);
    });

    it('should handle missing optional fields with defaults', () => {
      const minimalJson = JSON.stringify({
        patient: { fullName: 'Test', confidence: 0.5 },
        gp: { confidence: 0.5 },
        referralContext: { confidence: 0.5 },
      });

      const result = parseReferralExtraction(minimalJson, MODELS.SONNET);

      expect(result.patient.dateOfBirth).toBeUndefined();
      expect(result.patient.medicare).toBeUndefined();
      expect(result.gp.fullName).toBeUndefined();
      expect(result.referrer).toBeUndefined();
      expect(result.referralContext.keyProblems).toBeUndefined();
      // Should calculate confidence from sections
      expect(result.overallConfidence).toBeCloseTo(0.5, 1);
    });

    it('should parse date strings in DD/MM/YYYY format', () => {
      const jsonWithAusDate = JSON.stringify({
        patient: { fullName: 'Test', dateOfBirth: '15/03/1965', confidence: 0.9 },
        gp: { confidence: 0.9 },
        referralContext: { referralDate: '20/12/2024', confidence: 0.9 },
        overallConfidence: 0.9,
      });

      const result = parseReferralExtraction(jsonWithAusDate, MODELS.SONNET);

      expect(result.patient.dateOfBirth).toBe('1965-03-15');
      expect(result.referralContext.referralDate).toBe('2024-12-20');
    });

    it('should parse sex values with various formats', () => {
      // Test 'male'
      const maleJson = JSON.stringify({
        patient: { fullName: 'Test', sex: 'male', confidence: 0.9 },
        gp: { confidence: 0.9 },
        referralContext: { confidence: 0.9 },
      });
      expect(parseReferralExtraction(maleJson, MODELS.SONNET).patient.sex).toBe('male');

      // Test 'M'
      const mShortJson = JSON.stringify({
        patient: { fullName: 'Test', sex: 'M', confidence: 0.9 },
        gp: { confidence: 0.9 },
        referralContext: { confidence: 0.9 },
      });
      expect(parseReferralExtraction(mShortJson, MODELS.SONNET).patient.sex).toBe('male');

      // Test 'Female'
      const femaleJson = JSON.stringify({
        patient: { fullName: 'Test', sex: 'Female', confidence: 0.9 },
        gp: { confidence: 0.9 },
        referralContext: { confidence: 0.9 },
      });
      expect(parseReferralExtraction(femaleJson, MODELS.SONNET).patient.sex).toBe('female');
    });

    it('should parse referrer when different from GP', () => {
      const jsonWithReferrer = JSON.stringify({
        patient: { fullName: 'Test', confidence: 0.9 },
        gp: { fullName: 'Dr. GP', confidence: 0.9 },
        referrer: {
          fullName: 'Dr. Specialist',
          specialty: 'Cardiology',
          organisation: 'Heart Centre',
          confidence: 0.85,
        },
        referralContext: { confidence: 0.9 },
        overallConfidence: 0.88,
      });

      const result = parseReferralExtraction(jsonWithReferrer, MODELS.SONNET);

      expect(result.referrer).toBeDefined();
      expect(result.referrer?.fullName).toBe('Dr. Specialist');
      expect(result.referrer?.specialty).toBe('Cardiology');
      expect(result.referrer?.organisation).toBe('Heart Centre');
      expect(result.referrer?.confidence).toBe(0.85);
    });

    it('should clamp confidence values to 0-1 range', () => {
      const jsonWithBadConfidence = JSON.stringify({
        patient: { fullName: 'Test', confidence: 1.5 },
        gp: { confidence: -0.2 },
        referralContext: { confidence: 0.5 },
        overallConfidence: 2.0,
      });

      const result = parseReferralExtraction(jsonWithBadConfidence, MODELS.SONNET);

      expect(result.patient.confidence).toBe(1.0);
      expect(result.gp.confidence).toBe(0);
      expect(result.overallConfidence).toBe(1.0);
    });

    it('should filter empty strings from arrays', () => {
      const jsonWithEmptyStrings = JSON.stringify({
        patient: { fullName: 'Test', confidence: 0.9 },
        gp: { confidence: 0.9 },
        referralContext: {
          keyProblems: ['Chest pain', '', 'Dyspnea', null],
          medicationsMentioned: ['', '', ''],
          confidence: 0.9,
        },
      });

      const result = parseReferralExtraction(jsonWithEmptyStrings, MODELS.SONNET);

      expect(result.referralContext.keyProblems).toEqual(['Chest pain', 'Dyspnea']);
      expect(result.referralContext.medicationsMentioned).toBeUndefined();
    });

    it('should set extractedAt timestamp', () => {
      const beforeTime = new Date().toISOString();

      const result = parseReferralExtraction(
        JSON.stringify({
          patient: { confidence: 0.5 },
          gp: { confidence: 0.5 },
          referralContext: { confidence: 0.5 },
        }),
        MODELS.SONNET
      );

      const afterTime = new Date().toISOString();

      expect(result.extractedAt).toBeDefined();
      expect(result.extractedAt >= beforeTime).toBe(true);
      expect(result.extractedAt <= afterTime).toBe(true);
    });
  });

  describe('hasLowConfidence', () => {
    it('should return true when overall confidence is below threshold', () => {
      const lowConfidenceData = {
        patient: { confidence: 0.2 },
        gp: { confidence: 0.3 },
        referralContext: { confidence: 0.2 },
        overallConfidence: 0.25,
        extractedAt: new Date().toISOString(),
        modelUsed: MODELS.SONNET,
      };

      expect(hasLowConfidence(lowConfidenceData, 0.3)).toBe(true);
    });

    it('should return false when overall confidence meets threshold', () => {
      const goodConfidenceData = {
        patient: { confidence: 0.8 },
        gp: { confidence: 0.9 },
        referralContext: { confidence: 0.85 },
        overallConfidence: 0.85,
        extractedAt: new Date().toISOString(),
        modelUsed: MODELS.SONNET,
      };

      expect(hasLowConfidence(goodConfidenceData, 0.3)).toBe(false);
    });
  });

  describe('getLowConfidenceSections', () => {
    it('should return all sections with confidence below threshold', () => {
      const mixedConfidenceData = {
        patient: { confidence: 0.5 },
        gp: { confidence: 0.8 },
        referrer: { confidence: 0.4 },
        referralContext: { confidence: 0.9 },
        overallConfidence: 0.65,
        extractedAt: new Date().toISOString(),
        modelUsed: MODELS.SONNET,
      };

      const lowSections = getLowConfidenceSections(mixedConfidenceData, 0.7);

      expect(lowSections).toContain('patient');
      expect(lowSections).toContain('referrer');
      expect(lowSections).not.toContain('gp');
      expect(lowSections).not.toContain('referralContext');
    });

    it('should skip referrer when not present', () => {
      const dataWithoutReferrer = {
        patient: { confidence: 0.5 },
        gp: { confidence: 0.8 },
        referralContext: { confidence: 0.9 },
        overallConfidence: 0.73,
        extractedAt: new Date().toISOString(),
        modelUsed: MODELS.SONNET,
      };

      const lowSections = getLowConfidenceSections(dataWithoutReferrer, 0.7);

      expect(lowSections).toContain('patient');
      expect(lowSections).not.toContain('referrer');
    });
  });
});

describe('referral-extraction.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockReferralDocument = {
    id: 'ref-doc-1',
    userId: 'user-1',
    practiceId: 'practice-1',
    patientId: null,
    consultationId: null,
    filename: 'referral-letter.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 102400,
    s3Key: 'referrals/practice-1/2024/01/ref-doc-1.pdf',
    status: 'TEXT_EXTRACTED' as ReferralDocumentStatus,
    contentText: `
      Dr. Sarah Chen
      Harbour Medical Centre
      45 Harbour St, Sydney NSW 2000

      Dear Specialist,

      Re: John Michael Smith
      DOB: 15/03/1965
      Medicare: 2345 67890 1

      I am referring this patient for assessment of chest pain.
    `,
    extractedData: null,
    processingError: null,
    processedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockLLMResponse = {
    content: JSON.stringify({
      patient: {
        fullName: 'John Michael Smith',
        dateOfBirth: '1965-03-15',
        medicare: '2345 67890 1',
        confidence: 0.95,
      },
      gp: {
        fullName: 'Dr. Sarah Chen',
        practiceName: 'Harbour Medical Centre',
        address: '45 Harbour St, Sydney NSW 2000',
        confidence: 0.92,
      },
      referrer: null,
      referralContext: {
        reasonForReferral: 'Assessment of chest pain.',
        keyProblems: ['Chest pain'],
        confidence: 0.88,
      },
      overallConfidence: 0.91,
    }),
    inputTokens: 500,
    outputTokens: 200,
    stopReason: 'end_turn',
    modelId: MODELS.SONNET,
  };

  describe('extractStructuredData', () => {
    it('should extract structured data successfully', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(mockReferralDocument);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockLLMResponse);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await extractStructuredData('user-1', 'ref-doc-1');

      expect(result.status).toBe('EXTRACTED');
      expect(result.extractedData.patient.fullName).toBe('John Michael Smith');
      expect(result.extractedData.gp.fullName).toBe('Dr. Sarah Chen');
      expect(result.extractedData.overallConfidence).toBe(0.91);
    });

    it('should call LLM with correct parameters', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(mockReferralDocument);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockLLMResponse);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await extractStructuredData('user-1', 'ref-doc-1');

      expect(generateTextWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: MODELS.SONNET,
          maxTokens: 4096,
          temperature: 0,
          systemPrompt: expect.stringContaining('medical document parser'),
          prompt: expect.stringContaining('REFERRAL LETTER TEXT'),
        }),
        expect.objectContaining({
          maxRetries: 3,
        })
      );
    });

    it('should throw error when document not found', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(null);

      await expect(extractStructuredData('user-1', 'non-existent'))
        .rejects.toThrow('Referral document not found');
    });

    it('should throw error when document status is not TEXT_EXTRACTED', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({
        ...mockReferralDocument,
        status: 'UPLOADED' as ReferralDocumentStatus,
      });

      await expect(extractStructuredData('user-1', 'ref-doc-1'))
        .rejects.toThrow('Cannot extract structured data from document with status: UPLOADED');
    });

    it('should throw error when document has no text content', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue({
        ...mockReferralDocument,
        contentText: '',
      });

      await expect(extractStructuredData('user-1', 'ref-doc-1'))
        .rejects.toThrow('Document has no extracted text content');
    });

    it('should update document status to EXTRACTED on success', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(mockReferralDocument);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockLLMResponse);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await extractStructuredData('user-1', 'ref-doc-1');

      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          status: 'EXTRACTED',
          extractedData: expect.any(Object),
          processedAt: expect.any(Date),
        }),
      });
    });

    it('should update document status to FAILED on error', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(mockReferralDocument);
      vi.mocked(generateTextWithRetry).mockRejectedValue(new Error('LLM timeout'));
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'FAILED' as ReferralDocumentStatus,
      });

      await expect(extractStructuredData('user-1', 'ref-doc-1'))
        .rejects.toThrow('LLM timeout');

      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          processingError: expect.stringContaining('LLM timeout'),
        }),
      });
    });

    it('should create audit log on success', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(mockReferralDocument);
      vi.mocked(generateTextWithRetry).mockResolvedValue(mockLLMResponse);
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'EXTRACTED' as ReferralDocumentStatus,
      });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await extractStructuredData('user-1', 'ref-doc-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'referral.extract_structured',
          resourceType: 'referral_document',
          resourceId: 'ref-doc-1',
          metadata: expect.objectContaining({
            model: MODELS.SONNET,
            inputTokens: 500,
            outputTokens: 200,
            overallConfidence: 0.91,
          }),
        }),
      });
    });

    it('should handle malformed LLM response', async () => {
      vi.mocked(prisma.referralDocument.findUnique).mockResolvedValue(mockReferralDocument);
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        ...mockLLMResponse,
        content: 'This is not valid JSON response',
      });
      vi.mocked(prisma.referralDocument.update).mockResolvedValue({
        ...mockReferralDocument,
        status: 'FAILED' as ReferralDocumentStatus,
      });

      await expect(extractStructuredData('user-1', 'ref-doc-1'))
        .rejects.toThrow('No valid JSON found in LLM response');

      expect(prisma.referralDocument.update).toHaveBeenCalledWith({
        where: { id: 'ref-doc-1' },
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      });
    });
  });
});
