// tests/unit/domains/style/diff-analyzer.test.ts
// Tests for the section-level diff analyzer

import { describe, it, expect } from 'vitest';
import {
  detectSectionType,
  isSectionHeader,
  parseLetterSections,
  alignSections,
  countWords,
  textSimilarity,
  findDetailedChanges,
  computeSectionDiff,
  analyzeDiff,
  extractAddedPhrases,
  extractRemovedPhrases,
  extractVocabularySubstitutions,
} from '@/domains/style/diff-analyzer';
import type { ParsedSection, SectionDiff } from '@/domains/style/subspecialty-profile.types';

describe('diff-analyzer', () => {
  describe('detectSectionType', () => {
    it('should detect greeting sections', () => {
      expect(detectSectionType('Dear Dr. Smith,')).toBe('greeting');
      expect(detectSectionType('Dear Professor Jones,')).toBe('greeting');
      expect(detectSectionType('To Whom It May Concern,')).toBe('greeting');
      expect(detectSectionType('Dear Colleague,')).toBe('greeting');
    });

    it('should detect signoff sections', () => {
      expect(detectSectionType('Yours sincerely,')).toBe('signoff');
      expect(detectSectionType('Kind regards,')).toBe('signoff');
      expect(detectSectionType('Best wishes,')).toBe('signoff');
      expect(detectSectionType('With regards,')).toBe('signoff');
    });

    it('should detect clinical sections', () => {
      expect(detectSectionType('History of Presenting Illness:')).toBe('history');
      expect(detectSectionType('## HPI')).toBe('history');
      expect(detectSectionType('Past Medical History:')).toBe('past_medical_history');
      expect(detectSectionType('PMHx:')).toBe('past_medical_history');
      expect(detectSectionType('Medications:')).toBe('medications');
      expect(detectSectionType('Current Medications:')).toBe('medications');
    });

    it('should detect examination and investigation sections', () => {
      expect(detectSectionType('Physical Examination:')).toBe('examination');
      expect(detectSectionType('On Examination:')).toBe('examination');
      expect(detectSectionType('Investigations:')).toBe('investigations');
      expect(detectSectionType('Test Results:')).toBe('investigations');
      expect(detectSectionType('ECG:')).toBe('investigations');
    });

    it('should detect impression and plan sections', () => {
      expect(detectSectionType('Impression:')).toBe('impression');
      expect(detectSectionType('Diagnosis:')).toBe('impression');
      expect(detectSectionType('Assessment:')).toBe('impression');
      expect(detectSectionType('Plan:')).toBe('plan');
      expect(detectSectionType('Management Plan:')).toBe('plan');
      expect(detectSectionType('Recommendations:')).toBe('plan');
    });

    it('should detect follow-up sections', () => {
      expect(detectSectionType('Follow-up:')).toBe('follow_up');
      expect(detectSectionType('Follow up:')).toBe('follow_up');
      expect(detectSectionType('Next Appointment:')).toBe('follow_up');
    });

    it('should return null for non-section content', () => {
      expect(detectSectionType('The patient presented with chest pain.')).toBeNull();
      expect(detectSectionType('')).toBeNull();
      expect(detectSectionType('   ')).toBeNull();
    });
  });

  describe('isSectionHeader', () => {
    it('should recognize explicit section headers', () => {
      expect(isSectionHeader('History:')).toBe(true);
      expect(isSectionHeader('## Examination')).toBe(true);
      expect(isSectionHeader('MEDICATIONS:')).toBe(true);
    });

    it('should recognize markdown-style headers', () => {
      expect(isSectionHeader('## Clinical History')).toBe(true);
      expect(isSectionHeader('# Plan')).toBe(true);
    });

    it('should not treat regular text as headers', () => {
      expect(isSectionHeader('The patient is doing well.')).toBe(false);
      expect(isSectionHeader('Continue current medications.')).toBe(false);
    });
  });

  describe('parseLetterSections', () => {
    it('should parse a simple letter with greeting and signoff', () => {
      const letter = `Dear Dr. Smith,

Thank you for referring Mr. Jones for cardiac evaluation.

Yours sincerely,
Dr. Brown`;

      const sections = parseLetterSections(letter);

      expect(sections.length).toBeGreaterThanOrEqual(2);
      expect(sections[0]?.type).toBe('greeting');
      expect(sections[sections.length - 1]?.type).toBe('signoff');
    });

    it('should parse sections with headers', () => {
      const letter = `Dear Dr. Smith,

History:
The patient presents with chest pain of 2 weeks duration.

Examination:
Heart rate 72, blood pressure 130/80.

Plan:
1. ECG
2. Echo

Yours sincerely,
Dr. Brown`;

      const sections = parseLetterSections(letter);

      const types = sections.map(s => s.type);
      expect(types).toContain('greeting');
      expect(types).toContain('history');
      expect(types).toContain('examination');
      expect(types).toContain('plan');
      expect(types).toContain('signoff');
    });

    it('should handle markdown-style headers', () => {
      const letter = `## History
Patient with known CAD.

## Investigations
LVEF 45%

## Plan
Optimize medications.`;

      const sections = parseLetterSections(letter);

      expect(sections.some(s => s.type === 'history')).toBe(true);
      expect(sections.some(s => s.type === 'investigations')).toBe(true);
      expect(sections.some(s => s.type === 'plan')).toBe(true);
    });

    it('should include section content correctly', () => {
      const letter = `Medications:
1. Aspirin 100mg daily
2. Metoprolol 50mg twice daily`;

      const sections = parseLetterSections(letter);

      const medSection = sections.find(s => s.type === 'medications');
      expect(medSection).toBeDefined();
      expect(medSection?.content).toContain('Aspirin');
      expect(medSection?.content).toContain('Metoprolol');
    });
  });

  describe('alignSections', () => {
    it('should align sections with matching types', () => {
      const draft: ParsedSection[] = [
        { type: 'greeting', header: null, content: 'Dear Dr. Smith,', startIndex: 0, endIndex: 15 },
        { type: 'history', header: 'History:', content: 'Chest pain', startIndex: 16, endIndex: 30 },
        { type: 'plan', header: 'Plan:', content: 'Echo', startIndex: 31, endIndex: 40 },
      ];

      const final: ParsedSection[] = [
        { type: 'greeting', header: null, content: 'Dear Dr. Smith,', startIndex: 0, endIndex: 15 },
        { type: 'history', header: 'History:', content: 'Chest pain for 2 weeks', startIndex: 16, endIndex: 40 },
        { type: 'plan', header: 'Plan:', content: 'Echo and stress test', startIndex: 41, endIndex: 60 },
      ];

      const aligned = alignSections(draft, final);

      expect(aligned.length).toBe(3);
      expect(aligned[0]?.draft?.type).toBe('greeting');
      expect(aligned[0]?.final?.type).toBe('greeting');
    });

    it('should handle added sections', () => {
      const draft: ParsedSection[] = [
        { type: 'greeting', header: null, content: 'Dear Dr. Smith,', startIndex: 0, endIndex: 15 },
      ];

      const final: ParsedSection[] = [
        { type: 'greeting', header: null, content: 'Dear Dr. Smith,', startIndex: 0, endIndex: 15 },
        { type: 'plan', header: 'Plan:', content: 'Echo', startIndex: 16, endIndex: 25 },
      ];

      const aligned = alignSections(draft, final);

      const addedSection = aligned.find(a => a.draft === null && a.final?.type === 'plan');
      expect(addedSection).toBeDefined();
    });

    it('should handle removed sections', () => {
      const draft: ParsedSection[] = [
        { type: 'greeting', header: null, content: 'Dear Dr. Smith,', startIndex: 0, endIndex: 15 },
        { type: 'history', header: 'History:', content: 'Chest pain', startIndex: 16, endIndex: 30 },
      ];

      const final: ParsedSection[] = [
        { type: 'greeting', header: null, content: 'Dear Dr. Smith,', startIndex: 0, endIndex: 15 },
      ];

      const aligned = alignSections(draft, final);

      const removedSection = aligned.find(a => a.draft?.type === 'history' && a.final === null);
      expect(removedSection).toBeDefined();
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(countWords('hello world')).toBe(2);
      expect(countWords('one two three four')).toBe(4);
      expect(countWords('  spaced   out  ')).toBe(2);
      expect(countWords('')).toBe(0);
    });
  });

  describe('textSimilarity', () => {
    it('should return 1 for identical texts', () => {
      expect(textSimilarity('hello world', 'hello world')).toBe(1);
      expect(textSimilarity('test', 'test')).toBe(1);
    });

    it('should return 1 for texts differing only in case/whitespace', () => {
      expect(textSimilarity('Hello World', 'hello world')).toBe(1);
      expect(textSimilarity('  hello   world  ', 'hello world')).toBe(1);
    });

    it('should return 0 for completely different texts', () => {
      expect(textSimilarity('abc', 'xyz')).toBe(0);
    });

    it('should return partial similarity for similar texts', () => {
      const similarity = textSimilarity('the quick brown fox', 'the quick red fox');
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle empty strings', () => {
      expect(textSimilarity('', '')).toBe(1);
      expect(textSimilarity('hello', '')).toBe(0);
      expect(textSimilarity('', 'world')).toBe(0);
    });
  });

  describe('findDetailedChanges', () => {
    it('should detect sentence additions', () => {
      const original = 'The patient is stable.';
      const modified = 'The patient is stable. Blood pressure normal.';

      const changes = findDetailedChanges(original, modified);

      const additions = changes.filter(c => c.type === 'addition');
      expect(additions.length).toBeGreaterThan(0);
    });

    it('should detect sentence deletions', () => {
      const original = 'The patient is stable. Will follow up.';
      const modified = 'The patient is stable.';

      const changes = findDetailedChanges(original, modified);

      const deletions = changes.filter(c => c.type === 'deletion');
      expect(deletions.length).toBeGreaterThan(0);
    });

    it('should detect sentence modifications', () => {
      const original = 'LVEF is 55%.';
      const modified = 'LVEF is 60%.';

      const changes = findDetailedChanges(original, modified);

      const modifications = changes.filter(c => c.type === 'modification');
      expect(modifications.length).toBeGreaterThan(0);
    });

    it('should return empty array for identical texts', () => {
      const text = 'The patient is doing well.';
      const changes = findDetailedChanges(text, text);

      expect(changes.length).toBe(0);
    });
  });

  describe('computeSectionDiff', () => {
    it('should mark removed sections correctly', () => {
      const draft: ParsedSection = {
        type: 'history',
        header: 'History:',
        content: 'Patient with chest pain.',
        startIndex: 0,
        endIndex: 30,
      };

      const diff = computeSectionDiff(draft, null);

      expect(diff.status).toBe('removed');
      expect(diff.sectionType).toBe('history');
      expect(diff.totalCharDelta).toBeLessThan(0);
    });

    it('should mark added sections correctly', () => {
      const final: ParsedSection = {
        type: 'plan',
        header: 'Plan:',
        content: 'Order echo and follow up.',
        startIndex: 0,
        endIndex: 30,
      };

      const diff = computeSectionDiff(null, final);

      expect(diff.status).toBe('added');
      expect(diff.sectionType).toBe('plan');
      expect(diff.totalCharDelta).toBeGreaterThan(0);
    });

    it('should mark unchanged sections correctly', () => {
      const section: ParsedSection = {
        type: 'greeting',
        header: null,
        content: 'Dear Dr. Smith,',
        startIndex: 0,
        endIndex: 15,
      };

      const diff = computeSectionDiff(section, section);

      expect(diff.status).toBe('unchanged');
      expect(diff.totalCharDelta).toBe(0);
    });

    it('should mark modified sections correctly', () => {
      const draft: ParsedSection = {
        type: 'history',
        header: 'History:',
        content: 'Chest pain for 1 week.',
        startIndex: 0,
        endIndex: 25,
      };

      const final: ParsedSection = {
        type: 'history',
        header: 'History:',
        content: 'Chest pain for 2 weeks with exertion.',
        startIndex: 0,
        endIndex: 40,
      };

      const diff = computeSectionDiff(draft, final);

      expect(diff.status).toBe('modified');
      expect(diff.changes.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeDiff', () => {
    it('should analyze a complete letter diff', () => {
      const draft = `Dear Dr. Smith,

History:
Chest pain.

Plan:
ECG.

Yours sincerely,
Dr. Brown`;

      const final = `Dear Dr. Smith,

History:
Chest pain for 2 weeks, worse with exertion.

Examination:
Heart sounds normal.

Plan:
1. ECG
2. Echo

Yours sincerely,
Dr. Brown`;

      const analysis = analyzeDiff({
        letterId: 'test-123',
        draftContent: draft,
        finalContent: final,
      });

      expect(analysis.letterId).toBe('test-123');
      expect(analysis.draftSections.length).toBeGreaterThan(0);
      expect(analysis.finalSections.length).toBeGreaterThan(0);
      expect(analysis.sectionDiffs.length).toBeGreaterThan(0);

      // Should have an added examination section
      expect(analysis.overallStats.sectionsAdded).toBeGreaterThan(0);

      // Should have modified sections
      expect(analysis.overallStats.sectionsModified).toBeGreaterThan(0);
    });

    it('should detect section order changes', () => {
      const draft = `History:
Chest pain.

Examination:
Normal.`;

      const final = `Examination:
Normal.

History:
Chest pain.`;

      const analysis = analyzeDiff({
        letterId: 'test-456',
        draftContent: draft,
        finalContent: final,
      });

      expect(analysis.overallStats.sectionOrderChanged).toBe(true);
    });

    it('should include subspecialty when provided', () => {
      const analysis = analyzeDiff({
        letterId: 'test-789',
        draftContent: 'Test content.',
        finalContent: 'Test content.',
        subspecialty: 'HEART_FAILURE',
      });

      expect(analysis.subspecialty).toBe('HEART_FAILURE');
    });
  });

  describe('extractAddedPhrases', () => {
    it('should extract phrases from additions', () => {
      const diff: SectionDiff = {
        sectionType: 'plan',
        draftContent: 'Order ECG.',
        finalContent: 'Order ECG. Recommend cardiac rehabilitation program.',
        status: 'modified',
        changes: [
          {
            type: 'addition',
            original: null,
            modified: 'Recommend cardiac rehabilitation program.',
            charDelta: 40,
            wordDelta: 4,
            position: 10,
          },
        ],
        totalCharDelta: 40,
        totalWordDelta: 4,
      };

      const phrases = extractAddedPhrases(diff);

      expect(phrases.length).toBeGreaterThan(0);
      expect(phrases.some(p => p.toLowerCase().includes('cardiac'))).toBe(true);
    });
  });

  describe('extractRemovedPhrases', () => {
    it('should extract phrases from deletions', () => {
      const diff: SectionDiff = {
        sectionType: 'plan',
        draftContent: 'Order ECG. Consider CT angiography if symptoms persist.',
        finalContent: 'Order ECG.',
        status: 'modified',
        changes: [
          {
            type: 'deletion',
            original: 'Consider CT angiography if symptoms persist.',
            modified: null,
            charDelta: -45,
            wordDelta: -6,
            position: 10,
          },
        ],
        totalCharDelta: -45,
        totalWordDelta: -6,
      };

      const phrases = extractRemovedPhrases(diff);

      expect(phrases.length).toBeGreaterThan(0);
    });
  });

  describe('extractVocabularySubstitutions', () => {
    it('should extract word substitutions from modifications', () => {
      const diff: SectionDiff = {
        sectionType: 'history',
        draftContent: 'The patient utilizes a walking frame.',
        finalContent: 'The patient uses a walking frame.',
        status: 'modified',
        changes: [
          {
            type: 'modification',
            original: 'The patient utilizes a walking frame.',
            modified: 'The patient uses a walking frame.',
            charDelta: -3,
            wordDelta: 0,
            position: 0,
          },
        ],
        totalCharDelta: -3,
        totalWordDelta: 0,
      };

      const subs = extractVocabularySubstitutions(diff);

      expect(subs.some(s => s.original === 'utilizes' && s.replacement === 'uses')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty letters', () => {
      const analysis = analyzeDiff({
        letterId: 'empty-test',
        draftContent: '',
        finalContent: '',
      });

      expect(analysis.sectionDiffs.length).toBe(0);
      expect(analysis.overallStats.totalCharAdded).toBe(0);
      expect(analysis.overallStats.totalCharRemoved).toBe(0);
    });

    it('should handle letters with only whitespace', () => {
      const analysis = analyzeDiff({
        letterId: 'whitespace-test',
        draftContent: '   \n\n   ',
        finalContent: '   \n\n   ',
      });

      expect(analysis.overallStats.sectionsModified).toBe(0);
    });

    it('should handle very long letters', () => {
      const longContent = 'History:\n' + 'Patient presents with chest pain. '.repeat(100);
      const modifiedContent = 'History:\n' + 'Patient presents with chest discomfort. '.repeat(100);

      const analysis = analyzeDiff({
        letterId: 'long-test',
        draftContent: longContent,
        finalContent: modifiedContent,
      });

      expect(analysis.sectionDiffs.length).toBeGreaterThan(0);
    });

    it('should handle special characters in content', () => {
      const draft = 'Plan:\n- β-blockers\n- ACE inhibitors';
      const final = 'Plan:\n- β-blockers (Metoprolol)\n- ACE inhibitors';

      const analysis = analyzeDiff({
        letterId: 'special-chars',
        draftContent: draft,
        finalContent: final,
      });

      expect(analysis.sectionDiffs.length).toBeGreaterThan(0);
    });
  });
});
