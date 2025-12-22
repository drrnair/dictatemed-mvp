// tests/unit/domains/style/analytics-aggregator.test.ts
// Unit tests for analytics aggregator

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  stripPHI,
  containsPHI,
  sanitizePhrase,
  MIN_CLINICIANS_FOR_AGGREGATION,
  MIN_LETTERS_FOR_AGGREGATION,
  MAX_PATTERNS_PER_CATEGORY,
  MIN_PATTERN_FREQUENCY,
} from '@/domains/style/analytics-aggregator';

// ============ PHI Stripping Tests ============

describe('stripPHI', () => {
  it('should strip patient names with titles', () => {
    const text = 'Thank you for referring Mr. John Smith for evaluation.';
    const result = stripPHI(text);
    expect(result).toBe('Thank you for referring [REDACTED] for evaluation.');
  });

  it('should strip Dr. names', () => {
    const text = 'I reviewed the patient with Dr. Jane Williams.';
    const result = stripPHI(text);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('Jane Williams');
  });

  it('should strip dates in various formats', () => {
    expect(stripPHI('The appointment is on 12/25/2024')).toBe('The appointment is on [REDACTED]');
    expect(stripPHI('Seen on 25-12-2024')).toBe('Seen on [REDACTED]');
    expect(stripPHI('Reviewed on 25th December 2024')).toBe('Reviewed on [REDACTED]');
  });

  it('should strip Medicare/health identifiers', () => {
    const text = 'Medicare number: 1234567890';
    const result = stripPHI(text);
    expect(result).toBe('Medicare number: [REDACTED]');
  });

  it('should strip phone numbers', () => {
    // Australian mobile format
    expect(stripPHI('Call 0412345678')).toBe('Call [REDACTED]');
    expect(stripPHI('Call 0412 345 678')).toBe('Call [REDACTED]');
    // Australian landline with area code
    expect(stripPHI('Phone: (02) 98765432')).toBe('Phone: [REDACTED]');
    expect(stripPHI('Phone: 02 9876 5432')).toBe('Phone: [REDACTED]');
    // International format
    expect(stripPHI('Contact +61 412 345 678')).toBe('Contact [REDACTED]');
  });

  it('should strip email addresses', () => {
    const text = 'Email at john.doe@hospital.com.au';
    const result = stripPHI(text);
    expect(result).toBe('Email at [REDACTED]');
  });

  it('should strip addresses', () => {
    const text = 'Located at 123 Main Street';
    const result = stripPHI(text);
    expect(result).toBe('Located at [REDACTED]');
  });

  it('should strip URN/MRN identifiers', () => {
    expect(stripPHI('URN: 12345678')).toContain('[REDACTED]');
    expect(stripPHI('URN: 12345678')).not.toContain('12345678');
    expect(stripPHI('MRN:87654321')).toContain('[REDACTED]');
    expect(stripPHI('MRN:87654321')).not.toContain('87654321');
  });

  it('should collapse multiple consecutive redactions', () => {
    const text = 'Dear Mr. John Smith, seen on 12/25/2024';
    const result = stripPHI(text);
    expect(result).not.toContain('[REDACTED][REDACTED]');
    expect(result).not.toContain('[REDACTED]  [REDACTED]');
  });

  it('should preserve clinical content without PHI', () => {
    const text = 'LVEF was 55%. No significant coronary artery disease.';
    const result = stripPHI(text);
    expect(result).toBe('LVEF was 55%. No significant coronary artery disease.');
  });

  it('should handle empty strings', () => {
    expect(stripPHI('')).toBe('');
  });

  it('should handle text with only whitespace', () => {
    expect(stripPHI('   ')).toBe('');
  });
});

describe('containsPHI', () => {
  it('should detect names with titles', () => {
    expect(containsPHI('Dr. Smith performed the procedure')).toBe(true);
    expect(containsPHI('Referred by Mrs. Jane Doe')).toBe(true);
  });

  it('should detect dates', () => {
    expect(containsPHI('Appointment on 12/25/2024')).toBe(true);
    expect(containsPHI('Seen on 25th January 2024')).toBe(true);
  });

  it('should detect Medicare numbers', () => {
    expect(containsPHI('Medicare: 1234567890')).toBe(true);
  });

  it('should detect email addresses', () => {
    expect(containsPHI('Contact patient@email.com')).toBe(true);
  });

  it('should return false for clean clinical text', () => {
    expect(containsPHI('LVEF 55%, no wall motion abnormalities')).toBe(false);
    expect(containsPHI('Recommend continued aspirin therapy')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(containsPHI('')).toBe(false);
    expect(containsPHI('   ')).toBe(false);
  });
});

describe('sanitizePhrase', () => {
  it('should return null for very short phrases', () => {
    expect(sanitizePhrase('hi')).toBeNull();
    expect(sanitizePhrase('test')).toBeNull();
  });

  it('should return null if phrase contains PHI', () => {
    expect(sanitizePhrase('Dear Mr. John Smith')).toBeNull();
    expect(sanitizePhrase('Seen on 12/25/2024')).toBeNull();
  });

  it('should sanitize valid clinical phrases', () => {
    const phrase = 'recommend continued aspirin therapy';
    expect(sanitizePhrase(phrase)).toBe(phrase);
  });

  it('should normalize whitespace', () => {
    const phrase = 'recommend   continued    aspirin';
    expect(sanitizePhrase(phrase)).toBe('recommend continued aspirin');
  });

  it('should trim whitespace', () => {
    const phrase = '  recommend aspirin  ';
    expect(sanitizePhrase(phrase)).toBe('recommend aspirin');
  });

  it('should handle medical abbreviations safely', () => {
    expect(sanitizePhrase('LVEF 55%')).toBe('LVEF 55%');
    expect(sanitizePhrase('HR 72 bpm')).toBe('HR 72 bpm');
  });
});

// ============ Constants Tests ============

describe('Analytics Constants', () => {
  it('should have reasonable minimum clinician threshold', () => {
    expect(MIN_CLINICIANS_FOR_AGGREGATION).toBeGreaterThanOrEqual(5);
    expect(MIN_CLINICIANS_FOR_AGGREGATION).toBeLessThanOrEqual(10);
  });

  it('should have reasonable minimum letter threshold', () => {
    expect(MIN_LETTERS_FOR_AGGREGATION).toBeGreaterThanOrEqual(10);
    expect(MIN_LETTERS_FOR_AGGREGATION).toBeLessThanOrEqual(50);
  });

  it('should have reasonable pattern category limit', () => {
    expect(MAX_PATTERNS_PER_CATEGORY).toBeGreaterThanOrEqual(20);
    expect(MAX_PATTERNS_PER_CATEGORY).toBeLessThanOrEqual(100);
  });

  it('should require minimum pattern frequency of at least 2', () => {
    expect(MIN_PATTERN_FREQUENCY).toBeGreaterThanOrEqual(2);
  });
});

// ============ Aggregation Function Tests (with mocks) ============

// Mock Prisma client
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    styleEdit: {
      findMany: vi.fn(),
    },
    styleAnalyticsAggregate: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

import { prisma } from '@/infrastructure/db/client';
import {
  aggregateStyleAnalytics,
  getStyleAnalytics,
  getAnalyticsSummary,
} from '@/domains/style/analytics-aggregator';

// Helper to create mock style edit with required fields
function createMockEdit(overrides: {
  userId: string;
  beforeText: string;
  afterText: string;
  sectionType: string;
  editType: string;
}) {
  return {
    id: 'edit-' + Math.random().toString(36).substring(7),
    userId: overrides.userId,
    letterId: 'letter-1',
    beforeText: overrides.beforeText,
    afterText: overrides.afterText,
    sectionType: overrides.sectionType,
    editType: overrides.editType,
    subspecialty: 'GENERAL_CARDIOLOGY' as const,
    characterChanges: 10,
    wordChanges: 2,
    createdAt: new Date(),
  };
}

describe('aggregateStyleAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null if not enough unique clinicians', async () => {
    vi.mocked(prisma.styleEdit.findMany).mockResolvedValue([
      createMockEdit({ userId: 'user-1', beforeText: 'before', afterText: 'after', sectionType: 'plan', editType: 'modified' }),
      createMockEdit({ userId: 'user-1', beforeText: 'before', afterText: 'after', sectionType: 'plan', editType: 'modified' }),
      createMockEdit({ userId: 'user-2', beforeText: 'before', afterText: 'after', sectionType: 'plan', editType: 'modified' }),
    ]);

    const result = await aggregateStyleAnalytics({
      subspecialty: 'GENERAL_CARDIOLOGY',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-07'),
    });

    expect(result).toBeNull();
  });

  it('should return null if not enough edits', async () => {
    vi.mocked(prisma.styleEdit.findMany).mockResolvedValue([
      createMockEdit({ userId: 'user-1', beforeText: 'before', afterText: 'after', sectionType: 'plan', editType: 'modified' }),
      createMockEdit({ userId: 'user-2', beforeText: 'before', afterText: 'after', sectionType: 'plan', editType: 'modified' }),
      createMockEdit({ userId: 'user-3', beforeText: 'before', afterText: 'after', sectionType: 'plan', editType: 'modified' }),
      createMockEdit({ userId: 'user-4', beforeText: 'before', afterText: 'after', sectionType: 'plan', editType: 'modified' }),
      createMockEdit({ userId: 'user-5', beforeText: 'before', afterText: 'after', sectionType: 'plan', editType: 'modified' }),
    ]);

    const result = await aggregateStyleAnalytics({
      subspecialty: 'GENERAL_CARDIOLOGY',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-07'),
      minSampleSize: 20, // Require more edits than we have
    });

    expect(result).toBeNull();
  });

  it('should aggregate successfully with sufficient data', async () => {
    // Create enough edits from enough clinicians
    const mockEdits = [];
    for (let i = 0; i < 20; i++) {
      mockEdits.push(createMockEdit({
        userId: `user-${(i % 6) + 1}`, // 6 unique users
        beforeText: 'The patient has stable angina. Recommend continued therapy.',
        afterText: 'The patient has stable angina. I recommend continuing current therapy.',
        sectionType: 'plan',
        editType: 'modified',
      }));
    }

    vi.mocked(prisma.styleEdit.findMany).mockResolvedValue(mockEdits);
    vi.mocked(prisma.styleAnalyticsAggregate.upsert).mockResolvedValue({
      id: 'agg-1',
      subspecialty: 'GENERAL_CARDIOLOGY' as const,
      period: '2024-W01',
      commonAdditions: [],
      commonDeletions: [],
      sectionOrderPatterns: [],
      phrasingPatterns: [],
      sampleSize: 20,
      createdAt: new Date(),
    });
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const result = await aggregateStyleAnalytics({
      subspecialty: 'GENERAL_CARDIOLOGY',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-07'),
    });

    expect(result).not.toBeNull();
    expect(result?.subspecialty).toBe('GENERAL_CARDIOLOGY');
    expect(result?.sampleSize).toBe(20);
    expect(prisma.styleAnalyticsAggregate.upsert).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe('getStyleAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return analytics for subspecialty', async () => {
    const mockAggregates = [
      {
        id: 'agg-1',
        subspecialty: 'GENERAL_CARDIOLOGY' as const,
        period: '2024-W02',
        commonAdditions: [{ pattern: 'recommend aspirin', frequency: 10 }],
        commonDeletions: [],
        sectionOrderPatterns: [],
        phrasingPatterns: [],
        sampleSize: 50,
        createdAt: new Date('2024-01-14'),
      },
      {
        id: 'agg-2',
        subspecialty: 'GENERAL_CARDIOLOGY' as const,
        period: '2024-W01',
        commonAdditions: [],
        commonDeletions: [],
        sectionOrderPatterns: [],
        phrasingPatterns: [],
        sampleSize: 40,
        createdAt: new Date('2024-01-07'),
      },
    ];

    vi.mocked(prisma.styleAnalyticsAggregate.findMany).mockResolvedValue(mockAggregates);

    const result = await getStyleAnalytics('GENERAL_CARDIOLOGY');

    expect(result).toHaveLength(2);
    expect(result[0]?.period).toBe('2024-W02');
    expect(result[1]?.period).toBe('2024-W01');
  });

  it('should respect limit parameter', async () => {
    vi.mocked(prisma.styleAnalyticsAggregate.findMany).mockResolvedValue([]);

    await getStyleAnalytics('GENERAL_CARDIOLOGY', { limit: 5 });

    expect(prisma.styleAnalyticsAggregate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});

describe('getAnalyticsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return summary across subspecialties', async () => {
    const mockAggregates = [
      {
        id: 'agg-1',
        subspecialty: 'GENERAL_CARDIOLOGY' as const,
        period: '2024-W02',
        commonAdditions: [{ pattern: 'recommend aspirin', frequency: 10 }],
        commonDeletions: [{ pattern: 'consider', frequency: 5 }],
        sectionOrderPatterns: [],
        phrasingPatterns: [],
        sampleSize: 50,
        createdAt: new Date('2024-01-14'),
      },
      {
        id: 'agg-2',
        subspecialty: 'INTERVENTIONAL' as const,
        period: '2024-W02',
        commonAdditions: [],
        commonDeletions: [],
        sectionOrderPatterns: [],
        phrasingPatterns: [],
        sampleSize: 30,
        createdAt: new Date('2024-01-13'),
      },
    ];

    vi.mocked(prisma.styleAnalyticsAggregate.findMany).mockResolvedValue(mockAggregates);

    const result = await getAnalyticsSummary();

    expect(result.subspecialties).toHaveLength(2);
    expect(result.subspecialties[0]?.subspecialty).toBe('GENERAL_CARDIOLOGY');
    expect(result.subspecialties[0]?.topAdditions).toContain('recommend aspirin');
    expect(result.lastUpdated).toEqual(new Date('2024-01-14'));
  });

  it('should handle empty data', async () => {
    vi.mocked(prisma.styleAnalyticsAggregate.findMany).mockResolvedValue([]);

    const result = await getAnalyticsSummary();

    expect(result.subspecialties).toHaveLength(0);
    expect(result.lastUpdated).toBeNull();
  });
});

// ============ Edge Cases ============

describe('PHI Edge Cases', () => {
  it('should handle text with multiple PHI types', () => {
    const text = 'Mr. John Smith (DOB: 12/25/1960) called at 0412345678 about appointment';
    const result = stripPHI(text);
    expect(result).not.toContain('John Smith');
    expect(result).not.toContain('12/25/1960');
    expect(result).not.toContain('0412345678');
  });

  it('should not over-strip clinical terms that look like PHI', () => {
    // LVEF percentages should not be stripped
    const text = 'LVEF was 55% on echo';
    const result = stripPHI(text);
    expect(result).toBe('LVEF was 55% on echo');
  });

  it('should handle special characters', () => {
    const text = 'Patient presented with chest pain (typical).';
    const result = stripPHI(text);
    expect(result).toBe('Patient presented with chest pain (typical).');
  });

  it('should handle newlines', () => {
    const text = 'Plan:\n1. Continue aspirin\n2. Repeat echo';
    const result = stripPHI(text);
    expect(result).toBe('Plan:\n1. Continue aspirin\n2. Repeat echo');
  });

  it('should handle unicode characters', () => {
    const text = 'Patient reports pain level 8/10 \u2013 severe';
    const result = stripPHI(text);
    expect(result).toContain('severe');
  });
});

describe('Sanitize Phrase Edge Cases', () => {
  it('should handle phrases at minimum length boundary', () => {
    expect(sanitizePhrase('abcd')).toBeNull(); // 4 chars - too short
    expect(sanitizePhrase('abcde')).toBe('abcde'); // 5 chars - OK
  });

  it('should handle all-whitespace phrases', () => {
    expect(sanitizePhrase('     ')).toBeNull();
  });

  it('should handle mixed valid and PHI content', () => {
    // If PHI is detected after stripping, return null
    expect(sanitizePhrase('Contact Dr. Smith for follow-up')).toBeNull();
  });

  it('should preserve medical terminology', () => {
    expect(sanitizePhrase('severe aortic stenosis')).toBe('severe aortic stenosis');
    expect(sanitizePhrase('moderate LV systolic dysfunction')).toBe('moderate LV systolic dysfunction');
  });
});
