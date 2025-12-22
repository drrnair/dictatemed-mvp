// src/domains/style/analytics-aggregator.ts
// De-identified analytics aggregation for internal style learning insights
//
// Privacy & Compliance:
// - All aggregated data is de-identified (no clinician IDs, no patient data)
// - Minimum sample size enforced to prevent re-identification
// - Only aggregate statistics are stored (counts, frequencies, patterns)
// - PHI is stripped from all text content before aggregation

import type { Subspecialty } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import {
  parseLetterSections,
} from './diff-analyzer';
import type {
  AggregateAnalyticsInput,
  StyleAnalyticsAggregate,
  AggregatedPattern,
  AggregatedPhrasePattern,
  LetterSectionType,
  SectionOrderPattern,
} from './subspecialty-profile.types';

// ============ Constants ============

/**
 * Minimum number of unique clinicians required for aggregation.
 * This threshold prevents re-identification in small samples.
 */
export const MIN_CLINICIANS_FOR_AGGREGATION = 5;

/**
 * Minimum number of letters required per subspecialty.
 */
export const MIN_LETTERS_FOR_AGGREGATION = 10;

/**
 * Maximum number of patterns to store per category.
 */
export const MAX_PATTERNS_PER_CATEGORY = 50;

/**
 * Minimum frequency threshold for including a pattern.
 */
export const MIN_PATTERN_FREQUENCY = 2;

/**
 * PHI patterns that should be stripped from aggregated text.
 */
const PHI_PATTERNS: RegExp[] = [
  // Names (common patterns)
  /\b(?:Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
  // Dates (various formats)
  /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{2,4}\b/gi,
  // Medicare/health identifiers (Australian format - 10-11 digits)
  /\b\d{10,11}\b/g,
  // Phone numbers - Australian mobile format (04xx-xxx-xxx)
  /\b04\d{2}[-.\s]?\d{3}[-.\s]?\d{3}\b/g,
  // Phone numbers - Australian landline with area code (including parentheses)
  /\(?0[2-9]\)?\s?\d{4}[-.\s]?\d{4}\b/g,
  // Phone numbers - International format (+61 with various spacing)
  /\+61\s?\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{0,3}\b/g,
  // Phone numbers - US/general format
  /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Addresses (street numbers and names)
  /\b\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Court|Ct|Lane|Ln|Boulevard|Blvd)\b/gi,
  // Hospital/clinic names with identifying info
  /\b(?:Hospital|Clinic|Medical Centre|Medical Center|Surgery)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/gi,
  // URN/MRN patterns (more flexible)
  /\b(?:URN|MRN|ID)\s*[:\s]?\s*\d+\b/gi,
];

// ============ PHI Stripping ============

/**
 * Strip PHI from text for safe aggregation.
 * Replaces identifiable information with generic placeholders.
 */
export function stripPHI(text: string): string {
  let result = text;

  // Apply all PHI patterns
  for (const pattern of PHI_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }

  // Collapse multiple consecutive [REDACTED] tags
  result = result.replace(/(\[REDACTED\]\s*)+/g, '[REDACTED] ');

  return result.trim();
}

/**
 * Check if text contains potential PHI.
 */
export function containsPHI(text: string): boolean {
  for (const pattern of PHI_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
  }
  return false;
}

/**
 * Sanitize a phrase for aggregation.
 * Returns null if the phrase should be excluded (too short, contains PHI).
 */
export function sanitizePhrase(phrase: string): string | null {
  // Check for whitespace-only or empty phrases first
  const trimmed = phrase.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Skip very short phrases
  if (trimmed.length < 5) {
    return null;
  }

  // Strip PHI
  const stripped = stripPHI(trimmed);

  // Skip if mostly redacted
  if (stripped.includes('[REDACTED]')) {
    return null;
  }

  // Normalize whitespace and check result
  const normalized = stripped.replace(/\s+/g, ' ').trim();

  // Return null if after normalization it's too short
  if (normalized.length < 5) {
    return null;
  }

  return normalized;
}

// ============ Aggregation Logic ============

/**
 * Aggregate style analytics for a subspecialty over a time period.
 * Returns de-identified patterns suitable for internal analysis.
 */
export async function aggregateStyleAnalytics(
  input: AggregateAnalyticsInput
): Promise<StyleAnalyticsAggregate | null> {
  const log = logger.child({
    action: 'aggregateStyleAnalytics',
    subspecialty: input.subspecialty,
  });

  const minSampleSize = input.minSampleSize ?? MIN_LETTERS_FOR_AGGREGATION;

  // Fetch style edits for the period
  const edits = await prisma.styleEdit.findMany({
    where: {
      subspecialty: input.subspecialty,
      createdAt: {
        gte: input.periodStart,
        lte: input.periodEnd,
      },
    },
    select: {
      userId: true,
      beforeText: true,
      afterText: true,
      sectionType: true,
      editType: true,
    },
  });

  // Count unique clinicians
  const uniqueClinicians = new Set(edits.map(e => e.userId));

  log.info('Aggregation data fetched', {
    editCount: edits.length,
    uniqueClinicians: uniqueClinicians.size,
  });

  // Check minimum thresholds for anonymity
  if (uniqueClinicians.size < MIN_CLINICIANS_FOR_AGGREGATION) {
    log.info('Insufficient clinicians for anonymity', {
      required: MIN_CLINICIANS_FOR_AGGREGATION,
      found: uniqueClinicians.size,
    });
    return null;
  }

  if (edits.length < minSampleSize) {
    log.info('Insufficient sample size', {
      required: minSampleSize,
      found: edits.length,
    });
    return null;
  }

  // Aggregate patterns
  const commonAdditions = aggregateAdditionPatterns(edits);
  const commonDeletions = aggregateDeletionPatterns(edits);
  const sectionOrderPatterns = aggregateSectionOrderPatterns(edits);
  const phrasingPatterns = aggregatePhrasingPatterns(edits, uniqueClinicians.size);

  // Generate period identifier (e.g., "2024-W01" for week 1 of 2024)
  const period = formatPeriod(input.periodStart);

  // Create or update the aggregate record
  const aggregate = await prisma.styleAnalyticsAggregate.upsert({
    where: {
      subspecialty_period: {
        subspecialty: input.subspecialty,
        period,
      },
    },
    create: {
      subspecialty: input.subspecialty,
      period,
      commonAdditions: commonAdditions as unknown as object,
      commonDeletions: commonDeletions as unknown as object,
      sectionOrderPatterns: sectionOrderPatterns as unknown as object,
      phrasingPatterns: phrasingPatterns as unknown as object,
      sampleSize: edits.length,
    },
    update: {
      commonAdditions: commonAdditions as unknown as object,
      commonDeletions: commonDeletions as unknown as object,
      sectionOrderPatterns: sectionOrderPatterns as unknown as object,
      phrasingPatterns: phrasingPatterns as unknown as object,
      sampleSize: edits.length,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      action: 'analytics.style_aggregated',
      resourceType: 'style_analytics',
      resourceId: aggregate.id,
      metadata: {
        subspecialty: input.subspecialty,
        period,
        sampleSize: edits.length,
        uniqueClinicians: uniqueClinicians.size,
        patternsFound: {
          additions: commonAdditions.length,
          deletions: commonDeletions.length,
          sectionOrder: sectionOrderPatterns.length,
          phrasing: phrasingPatterns.length,
        },
      },
    },
  });

  log.info('Style analytics aggregated', {
    aggregateId: aggregate.id,
    period,
    sampleSize: edits.length,
  });

  return {
    id: aggregate.id,
    subspecialty: aggregate.subspecialty,
    period: aggregate.period,
    commonAdditions,
    commonDeletions,
    sectionOrderPatterns,
    phrasingPatterns,
    sampleSize: aggregate.sampleSize,
    createdAt: aggregate.createdAt,
  };
}

/**
 * Aggregate patterns of content additions across edits.
 */
function aggregateAdditionPatterns(
  edits: Array<{
    userId: string;
    beforeText: string;
    afterText: string;
    sectionType: string | null;
  }>
): AggregatedPattern[] {
  const patternCounts: Map<string, { count: number; clinicians: Set<string>; section: string | null }> = new Map();

  for (const edit of edits) {
    if (!edit.afterText || edit.afterText === edit.beforeText) {
      continue;
    }

    // Parse sections and compute diff
    const draftSections = parseLetterSections(edit.beforeText || '');
    const finalSections = parseLetterSections(edit.afterText);

    for (const section of finalSections) {
      // Find matching draft section
      const draftSection = draftSections.find(s => s.type === section.type);

      if (!draftSection) {
        // Entire section was added - extract key phrases
        const phrases = extractKeyPhrases(section.content);
        for (const phrase of phrases) {
          const sanitized = sanitizePhrase(phrase);
          if (sanitized) {
            const key = `${section.type}:${sanitized.toLowerCase()}`;
            const existing = patternCounts.get(key);
            if (existing) {
              existing.count++;
              existing.clinicians.add(edit.userId);
            } else {
              patternCounts.set(key, {
                count: 1,
                clinicians: new Set([edit.userId]),
                section: section.type,
              });
            }
          }
        }
      } else if (section.content !== draftSection.content) {
        // Section was modified - find added phrases
        const addedPhrases = findAddedContent(draftSection.content, section.content);
        for (const phrase of addedPhrases) {
          const sanitized = sanitizePhrase(phrase);
          if (sanitized) {
            const key = `${section.type}:${sanitized.toLowerCase()}`;
            const existing = patternCounts.get(key);
            if (existing) {
              existing.count++;
              existing.clinicians.add(edit.userId);
            } else {
              patternCounts.set(key, {
                count: 1,
                clinicians: new Set([edit.userId]),
                section: section.type,
              });
            }
          }
        }
      }
    }
  }

  // Convert to array and filter by minimum frequency
  return Array.from(patternCounts.entries())
    .filter(([, data]) => data.count >= MIN_PATTERN_FREQUENCY)
    .map(([key, data]) => {
      const [section, pattern] = key.split(':', 2);
      const clinicianCount = data.clinicians.size;
      return {
        pattern: pattern ?? key,
        sectionType: (section as LetterSectionType) ?? null,
        frequency: data.count,
        clinicianCount,
        percentageOfClinicians: 0, // Will be calculated when total is known
      };
    })
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, MAX_PATTERNS_PER_CATEGORY);
}

/**
 * Aggregate patterns of content deletions across edits.
 */
function aggregateDeletionPatterns(
  edits: Array<{
    userId: string;
    beforeText: string;
    afterText: string;
    sectionType: string | null;
  }>
): AggregatedPattern[] {
  const patternCounts: Map<string, { count: number; clinicians: Set<string>; section: string | null }> = new Map();

  for (const edit of edits) {
    if (!edit.beforeText || edit.afterText === edit.beforeText) {
      continue;
    }

    // Parse sections
    const draftSections = parseLetterSections(edit.beforeText);
    const finalSections = parseLetterSections(edit.afterText || '');

    for (const section of draftSections) {
      // Find matching final section
      const finalSection = finalSections.find(s => s.type === section.type);

      if (!finalSection) {
        // Entire section was removed - extract key phrases
        const phrases = extractKeyPhrases(section.content);
        for (const phrase of phrases) {
          const sanitized = sanitizePhrase(phrase);
          if (sanitized) {
            const key = `${section.type}:${sanitized.toLowerCase()}`;
            const existing = patternCounts.get(key);
            if (existing) {
              existing.count++;
              existing.clinicians.add(edit.userId);
            } else {
              patternCounts.set(key, {
                count: 1,
                clinicians: new Set([edit.userId]),
                section: section.type,
              });
            }
          }
        }
      } else if (section.content !== finalSection.content) {
        // Section was modified - find removed phrases
        const removedPhrases = findRemovedContent(section.content, finalSection.content);
        for (const phrase of removedPhrases) {
          const sanitized = sanitizePhrase(phrase);
          if (sanitized) {
            const key = `${section.type}:${sanitized.toLowerCase()}`;
            const existing = patternCounts.get(key);
            if (existing) {
              existing.count++;
              existing.clinicians.add(edit.userId);
            } else {
              patternCounts.set(key, {
                count: 1,
                clinicians: new Set([edit.userId]),
                section: section.type,
              });
            }
          }
        }
      }
    }
  }

  // Convert to array and filter by minimum frequency
  return Array.from(patternCounts.entries())
    .filter(([, data]) => data.count >= MIN_PATTERN_FREQUENCY)
    .map(([key, data]) => {
      const [section, pattern] = key.split(':', 2);
      const clinicianCount = data.clinicians.size;
      return {
        pattern: pattern ?? key,
        sectionType: (section as LetterSectionType) ?? null,
        frequency: data.count,
        clinicianCount,
        percentageOfClinicians: 0,
      };
    })
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, MAX_PATTERNS_PER_CATEGORY);
}

/**
 * Aggregate section ordering patterns.
 */
function aggregateSectionOrderPatterns(
  edits: Array<{
    userId: string;
    afterText: string;
    sectionType: string | null;
  }>
): SectionOrderPattern[] {
  const orderCounts: Map<string, number> = new Map();

  for (const edit of edits) {
    if (!edit.afterText) continue;

    const sections = parseLetterSections(edit.afterText);
    const order = sections
      .map(s => s.type)
      .filter(t => t !== 'other');

    if (order.length >= 2) {
      const key = order.join('→');
      orderCounts.set(key, (orderCounts.get(key) ?? 0) + 1);
    }
  }

  // Convert to array and filter
  return Array.from(orderCounts.entries())
    .filter(([, count]) => count >= MIN_PATTERN_FREQUENCY)
    .map(([key, frequency]) => ({
      order: key.split('→'),
      frequency,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20);
}

/**
 * Aggregate phrasing patterns across all edits.
 */
function aggregatePhrasingPatterns(
  edits: Array<{
    userId: string;
    beforeText: string;
    afterText: string;
    sectionType: string | null;
  }>,
  totalClinicians: number
): AggregatedPhrasePattern[] {
  const patterns: Map<string, { count: number; clinicians: Set<string>; section: LetterSectionType; action: 'added' | 'removed' | 'modified' }> = new Map();

  for (const edit of edits) {
    const draftSections = parseLetterSections(edit.beforeText || '');
    const finalSections = parseLetterSections(edit.afterText || '');

    // Process each final section
    for (const section of finalSections) {
      const draftSection = draftSections.find(s => s.type === section.type);

      if (!draftSection) {
        // New section - all phrases are "added"
        const phrases = extractKeyPhrases(section.content);
        for (const phrase of phrases) {
          const sanitized = sanitizePhrase(phrase);
          if (sanitized && sanitized.length >= 10) {
            const key = `add:${section.type}:${sanitized.toLowerCase()}`;
            updatePatternMap(patterns, key, edit.userId, section.type, 'added');
          }
        }
      } else if (section.content !== draftSection.content) {
        // Modified section
        const added = findAddedContent(draftSection.content, section.content);
        const removed = findRemovedContent(draftSection.content, section.content);

        for (const phrase of added) {
          const sanitized = sanitizePhrase(phrase);
          if (sanitized && sanitized.length >= 10) {
            const key = `add:${section.type}:${sanitized.toLowerCase()}`;
            updatePatternMap(patterns, key, edit.userId, section.type, 'added');
          }
        }

        for (const phrase of removed) {
          const sanitized = sanitizePhrase(phrase);
          if (sanitized && sanitized.length >= 10) {
            const key = `rem:${section.type}:${sanitized.toLowerCase()}`;
            updatePatternMap(patterns, key, edit.userId, section.type, 'removed');
          }
        }
      }
    }

    // Check for removed sections
    for (const section of draftSections) {
      const finalSection = finalSections.find(s => s.type === section.type);
      if (!finalSection) {
        const phrases = extractKeyPhrases(section.content);
        for (const phrase of phrases) {
          const sanitized = sanitizePhrase(phrase);
          if (sanitized && sanitized.length >= 10) {
            const key = `rem:${section.type}:${sanitized.toLowerCase()}`;
            updatePatternMap(patterns, key, edit.userId, section.type, 'removed');
          }
        }
      }
    }
  }

  // Convert to array
  return Array.from(patterns.entries())
    .filter(([, data]) => data.count >= MIN_PATTERN_FREQUENCY)
    .map(([key, data]) => {
      const parts = key.split(':');
      const phrase = parts.slice(2).join(':');
      return {
        phrase: phrase,
        sectionType: data.section,
        action: data.action,
        frequency: data.count,
        clinicianCount: data.clinicians.size,
      };
    })
    .map(p => ({
      ...p,
      percentageOfClinicians: Math.round((p.clinicianCount / totalClinicians) * 100),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, MAX_PATTERNS_PER_CATEGORY);
}

/**
 * Helper to update pattern map.
 */
function updatePatternMap(
  map: Map<string, { count: number; clinicians: Set<string>; section: LetterSectionType; action: 'added' | 'removed' | 'modified' }>,
  key: string,
  userId: string,
  section: LetterSectionType,
  action: 'added' | 'removed' | 'modified'
): void {
  const existing = map.get(key);
  if (existing) {
    existing.count++;
    existing.clinicians.add(userId);
  } else {
    map.set(key, {
      count: 1,
      clinicians: new Set([userId]),
      section,
      action,
    });
  }
}

// ============ Text Processing Helpers ============

/**
 * Extract key phrases from text for pattern analysis.
 */
function extractKeyPhrases(text: string): string[] {
  const phrases: string[] = [];

  // Split by sentence boundaries
  const sentences = text.split(/[.!?;]/).filter(s => s.trim().length > 0);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const words = trimmed.split(/\s+/);

    // Extract 3-8 word phrases
    if (words.length >= 3 && words.length <= 8) {
      phrases.push(trimmed);
    }

    // Extract significant sub-phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 4).join(' ');
      if (phrase.length >= 15) {
        phrases.push(phrase);
      }
    }
  }

  return Array.from(new Set(phrases));
}

/**
 * Find content added in the modification (simple word-based diff).
 */
function findAddedContent(original: string, modified: string): string[] {
  const origWords = new Set(original.toLowerCase().split(/\s+/));
  const modWords = modified.split(/\s+/);

  // Find sequences of new words
  const added: string[] = [];
  let currentSequence: string[] = [];

  for (const word of modWords) {
    if (!origWords.has(word.toLowerCase()) && word.length > 2) {
      currentSequence.push(word);
    } else if (currentSequence.length > 0) {
      if (currentSequence.length >= 2) {
        added.push(currentSequence.join(' '));
      }
      currentSequence = [];
    }
  }

  if (currentSequence.length >= 2) {
    added.push(currentSequence.join(' '));
  }

  return added;
}

/**
 * Find content removed in the modification.
 */
function findRemovedContent(original: string, modified: string): string[] {
  const modWords = new Set(modified.toLowerCase().split(/\s+/));
  const origWords = original.split(/\s+/);

  const removed: string[] = [];
  let currentSequence: string[] = [];

  for (const word of origWords) {
    if (!modWords.has(word.toLowerCase()) && word.length > 2) {
      currentSequence.push(word);
    } else if (currentSequence.length > 0) {
      if (currentSequence.length >= 2) {
        removed.push(currentSequence.join(' '));
      }
      currentSequence = [];
    }
  }

  if (currentSequence.length >= 2) {
    removed.push(currentSequence.join(' '));
  }

  return removed;
}

// ============ Period Formatting ============

/**
 * Format a date as a period identifier (e.g., "2024-W01").
 */
function formatPeriod(date: Date): string {
  const year = date.getFullYear();
  const weekNumber = getWeekNumber(date);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Get ISO week number for a date.
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNum;
}

// ============ Retrieval Functions ============

/**
 * Get aggregated analytics for a subspecialty.
 * Returns null if no data is available.
 */
export async function getStyleAnalytics(
  subspecialty: Subspecialty,
  options?: { limit?: number }
): Promise<StyleAnalyticsAggregate[]> {
  const aggregates = await prisma.styleAnalyticsAggregate.findMany({
    where: { subspecialty },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 10,
  });

  return aggregates.map(a => ({
    id: a.id,
    subspecialty: a.subspecialty,
    period: a.period,
    commonAdditions: (a.commonAdditions as unknown as AggregatedPattern[]) ?? [],
    commonDeletions: (a.commonDeletions as unknown as AggregatedPattern[]) ?? [],
    sectionOrderPatterns: (a.sectionOrderPatterns as unknown as SectionOrderPattern[]) ?? [],
    phrasingPatterns: (a.phrasingPatterns as unknown as AggregatedPhrasePattern[]) ?? [],
    sampleSize: a.sampleSize,
    createdAt: a.createdAt,
  }));
}

/**
 * Get analytics summary across all subspecialties.
 */
export async function getAnalyticsSummary(): Promise<{
  subspecialties: Array<{
    subspecialty: Subspecialty;
    latestPeriod: string;
    totalSamples: number;
    topAdditions: string[];
    topDeletions: string[];
  }>;
  lastUpdated: Date | null;
}> {
  // Get latest aggregate for each subspecialty
  const latestBySubspecialty = await prisma.styleAnalyticsAggregate.findMany({
    orderBy: { createdAt: 'desc' },
    distinct: ['subspecialty'],
  });

  const subspecialties = latestBySubspecialty.map(a => {
    const additions = (a.commonAdditions as unknown as AggregatedPattern[]) ?? [];
    const deletions = (a.commonDeletions as unknown as AggregatedPattern[]) ?? [];

    return {
      subspecialty: a.subspecialty,
      latestPeriod: a.period,
      totalSamples: a.sampleSize,
      topAdditions: additions.slice(0, 5).map(p => p.pattern),
      topDeletions: deletions.slice(0, 5).map(p => p.pattern),
    };
  });

  const lastUpdated = latestBySubspecialty.length > 0
    ? latestBySubspecialty.reduce((latest, a) =>
        a.createdAt > latest ? a.createdAt : latest,
        latestBySubspecialty[0]?.createdAt ?? new Date(0)
      )
    : null;

  return {
    subspecialties,
    lastUpdated,
  };
}

/**
 * Run aggregation for all subspecialties for the past week.
 * Typically run as a scheduled job.
 */
export async function runWeeklyAggregation(): Promise<{
  processed: Subspecialty[];
  skipped: Subspecialty[];
}> {
  const log = logger.child({ action: 'runWeeklyAggregation' });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const allSubspecialties: Subspecialty[] = [
    'GENERAL_CARDIOLOGY',
    'INTERVENTIONAL',
    'STRUCTURAL',
    'ELECTROPHYSIOLOGY',
    'IMAGING',
    'HEART_FAILURE',
    'CARDIAC_SURGERY',
  ];

  const processed: Subspecialty[] = [];
  const skipped: Subspecialty[] = [];

  for (const subspecialty of allSubspecialties) {
    try {
      const result = await aggregateStyleAnalytics({
        subspecialty,
        periodStart: weekAgo,
        periodEnd: now,
      });

      if (result) {
        processed.push(subspecialty);
        log.info('Subspecialty aggregated', { subspecialty, sampleSize: result.sampleSize });
      } else {
        skipped.push(subspecialty);
        log.info('Subspecialty skipped (insufficient data)', { subspecialty });
      }
    } catch (error) {
      log.error('Aggregation failed for subspecialty', { subspecialty }, error instanceof Error ? error : undefined);
      skipped.push(subspecialty);
    }
  }

  return { processed, skipped };
}
