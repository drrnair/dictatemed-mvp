// src/domains/style/diff-analyzer.ts
// Section-level diff analysis for precise style learning

import type {
  LetterSectionType,
  ParsedSection,
  SectionChange,
  SectionDiff,
  LetterDiffAnalysis,
  AnalyzeDiffInput,
} from './subspecialty-profile.types';

// ============ Section Type Detection ============

/**
 * Patterns used to identify section headers in medical letters.
 * Ordered by specificity (more specific patterns first).
 */
const SECTION_PATTERNS: Array<{ type: LetterSectionType; patterns: RegExp[] }> = [
  {
    type: 'greeting',
    patterns: [
      /^(dear\s+(?:dr\.?|doctor|professor|prof\.?|mr\.?|mrs\.?|ms\.?|miss)\s+[\w\s-]+,?)/i,
      /^(to\s+whom\s+it\s+may\s+concern,?)/i,
      /^(dear\s+colleague[s]?,?)/i,
    ],
  },
  {
    type: 'signoff',
    patterns: [
      /^(yours\s+(?:sincerely|faithfully|truly),?)/i,
      /^(kind\s+regards,?)/i,
      /^(best\s+(?:wishes|regards),?)/i,
      /^(with\s+(?:kind\s+)?regards,?)/i,
      /^(sincerely,?)/i,
      /^(regards,?)/i,
    ],
  },
  {
    type: 'presenting_complaint',
    patterns: [
      /^(?:##?\s*)?(?:presenting\s+complaint|chief\s+complaint|reason\s+for\s+(?:referral|visit|consultation)|pc|cc)[:.]?$/i,
    ],
  },
  {
    type: 'history',
    patterns: [
      /^(?:##?\s*)?(?:history\s+of\s+present(?:ing)?\s+illness|hpi|history|clinical\s+history|background)[:.]?$/i,
    ],
  },
  {
    type: 'past_medical_history',
    patterns: [
      /^(?:##?\s*)?(?:past\s+medical\s+history|pmh|pmhx|medical\s+history|past\s+history)[:.]?$/i,
    ],
  },
  {
    type: 'medications',
    patterns: [
      /^(?:##?\s*)?(?:medications?|current\s+medications?|drug\s+list|medication\s+list|meds)[:.]?$/i,
    ],
  },
  {
    type: 'family_history',
    patterns: [
      /^(?:##?\s*)?(?:family\s+history|fhx|fh)[:.]?$/i,
    ],
  },
  {
    type: 'social_history',
    patterns: [
      /^(?:##?\s*)?(?:social\s+history|shx|sh)[:.]?$/i,
    ],
  },
  {
    type: 'examination',
    patterns: [
      /^(?:##?\s*)?(?:(?:physical\s+)?examination|exam|clinical\s+examination|o\/e|on\s+examination|examination\s+findings?)[:.]?$/i,
    ],
  },
  {
    type: 'investigations',
    patterns: [
      /^(?:##?\s*)?(?:investigations?|results?|test\s+results?|laboratory|labs?|imaging|ecg|echo(?:cardiogram)?|angiography)[:.]?$/i,
    ],
  },
  {
    type: 'impression',
    patterns: [
      /^(?:##?\s*)?(?:impression|diagnosis|diagnoses|assessment|clinical\s+impression|summary)[:.]?$/i,
    ],
  },
  {
    type: 'plan',
    patterns: [
      /^(?:##?\s*)?(?:plan|management\s+plan|treatment\s+plan|recommendations?|management|proposed\s+management)[:.]?$/i,
    ],
  },
  {
    type: 'follow_up',
    patterns: [
      /^(?:##?\s*)?(?:follow[- ]?up|fu|next\s+appointment|review|ongoing\s+care)[:.]?$/i,
    ],
  },
  {
    type: 'introduction',
    patterns: [
      /^(?:##?\s*)?(?:introduction|re:|regarding|referral|thank\s+you\s+for\s+(?:referring|your\s+referral))[:.]?$/i,
    ],
  },
  {
    type: 'closing',
    patterns: [
      /^(?:##?\s*)?(?:closing|conclusion|in\s+summary|please\s+(?:do\s+not\s+hesitate|feel\s+free)|if\s+you\s+have\s+(?:any\s+)?(?:further\s+)?questions?)[:.]?$/i,
    ],
  },
];

/**
 * Detect the section type from a line of text.
 */
export function detectSectionType(line: string): LetterSectionType | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  for (const { type, patterns } of SECTION_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return type;
      }
    }
  }

  return null;
}

/**
 * Check if a line is likely a section header.
 */
export function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Check explicit patterns
  if (detectSectionType(trimmed) !== null) {
    return true;
  }

  // Check for common header formats that might not match specific patterns
  // e.g., "## Heading" or "HEADING:" or "Heading:"
  if (/^##?\s+\w+/.test(trimmed)) return true;
  if (/^[A-Z][A-Z\s]+:$/.test(trimmed)) return true; // ALL CAPS with colon
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*:$/.test(trimmed)) return true; // Title Case with colon

  return false;
}

// ============ Letter Parsing ============

/**
 * Parse a letter into its constituent sections.
 */
export function parseLetterSections(content: string): ParsedSection[] {
  // Handle empty or whitespace-only content
  if (!content.trim()) {
    return [];
  }

  const lines = content.split('\n');
  const sections: ParsedSection[] = [];

  let currentSection: {
    type: LetterSectionType;
    header: string | null;
    startIndex: number;
    lines: string[];
  } | null = null;

  let charIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineLength = line.length + 1; // +1 for newline

    const detectedType = detectSectionType(line);

    if (detectedType !== null || (i === 0 && !currentSection)) {
      // Close previous section
      if (currentSection) {
        sections.push({
          type: currentSection.type,
          header: currentSection.header,
          content: currentSection.lines.join('\n').trim(),
          startIndex: currentSection.startIndex,
          endIndex: charIndex - 1,
        });
      }

      // Start new section
      const newType = detectedType ?? inferInitialSectionType(line);
      const isHeader = isSectionHeader(line);

      currentSection = {
        type: newType,
        header: isHeader ? line.trim() : null,
        startIndex: charIndex,
        lines: isHeader ? [] : [line],
      };
    } else if (currentSection) {
      // Continue current section
      currentSection.lines.push(line);
    } else {
      // No section started yet, start with 'other'
      currentSection = {
        type: 'other',
        header: null,
        startIndex: charIndex,
        lines: [line],
      };
    }

    charIndex += lineLength;
  }

  // Close final section
  if (currentSection) {
    sections.push({
      type: currentSection.type,
      header: currentSection.header,
      content: currentSection.lines.join('\n').trim(),
      startIndex: currentSection.startIndex,
      endIndex: charIndex - 1,
    });
  }

  // Post-process to detect greeting/signoff patterns in content
  return postProcessSections(sections);
}

/**
 * Infer the initial section type when no explicit header is found.
 */
function inferInitialSectionType(firstLine: string): LetterSectionType {
  const trimmed = firstLine.trim().toLowerCase();

  // Check for greeting patterns
  if (/^dear\s+/i.test(trimmed) || /^to\s+whom/i.test(trimmed)) {
    return 'greeting';
  }

  // Check for introduction patterns
  if (/^thank\s+you\s+for\s+(?:referring|seeing)/i.test(trimmed)) {
    return 'introduction';
  }

  // Check for re-referral pattern (common letter opening)
  if (/^re:/i.test(trimmed) || /^regarding:/i.test(trimmed)) {
    return 'introduction';
  }

  return 'other';
}

/**
 * Post-process sections to handle edge cases and improve detection.
 */
function postProcessSections(sections: ParsedSection[]): ParsedSection[] {
  return sections.map((section, index) => {
    // If first section has no type and contains greeting, mark it
    if (index === 0 && section.type === 'other') {
      const firstLine = section.content.split('\n')[0] ?? '';
      const detectedType = detectSectionType(firstLine);
      if (detectedType) {
        return { ...section, type: detectedType };
      }
    }

    // If last section contains signoff pattern, mark it
    if (index === sections.length - 1 && section.type === 'other') {
      for (const line of section.content.split('\n')) {
        const detectedType = detectSectionType(line);
        if (detectedType === 'signoff') {
          return { ...section, type: 'signoff' };
        }
      }
    }

    return section;
  });
}

// ============ Section Alignment ============

/**
 * Align sections between draft and final letters for comparison.
 * Uses section type as the primary matching criterion, with fallback to content similarity.
 */
export function alignSections(
  draftSections: ParsedSection[],
  finalSections: ParsedSection[]
): Array<{ draft: ParsedSection | null; final: ParsedSection | null }> {
  const aligned: Array<{ draft: ParsedSection | null; final: ParsedSection | null }> = [];
  const usedDraftIndices = new Set<number>();
  const usedFinalIndices = new Set<number>();

  // First pass: exact type matches
  for (let fi = 0; fi < finalSections.length; fi++) {
    const finalSection = finalSections[fi];
    if (!finalSection || usedFinalIndices.has(fi)) continue;

    // Find matching draft section by type
    for (let di = 0; di < draftSections.length; di++) {
      if (usedDraftIndices.has(di)) continue;
      const draftSection = draftSections[di];
      if (!draftSection) continue;

      if (draftSection.type === finalSection.type) {
        aligned.push({ draft: draftSection, final: finalSection });
        usedDraftIndices.add(di);
        usedFinalIndices.add(fi);
        break;
      }
    }
  }

  // Second pass: add unmatched sections
  for (let di = 0; di < draftSections.length; di++) {
    if (!usedDraftIndices.has(di)) {
      const draftSection = draftSections[di];
      if (draftSection) {
        aligned.push({ draft: draftSection, final: null });
      }
    }
  }

  for (let fi = 0; fi < finalSections.length; fi++) {
    if (!usedFinalIndices.has(fi)) {
      const finalSection = finalSections[fi];
      if (finalSection) {
        aligned.push({ draft: null, final: finalSection });
      }
    }
  }

  // Sort by original order (prefer draft order, then final order)
  aligned.sort((a, b) => {
    const aIndex = a.draft?.startIndex ?? a.final?.startIndex ?? 0;
    const bIndex = b.draft?.startIndex ?? b.final?.startIndex ?? 0;
    return aIndex - bIndex;
  });

  return aligned;
}

// ============ Diff Computation ============

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Compute the Longest Common Subsequence length between two strings.
 * Used for similarity calculation.
 */
function lcsLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Use space-optimized DP
  let prev = new Array(n + 1).fill(0) as number[];
  let curr = new Array(n + 1).fill(0) as number[];

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = (prev[j - 1] ?? 0) + 1;
      } else {
        curr[j] = Math.max(prev[j] ?? 0, curr[j - 1] ?? 0);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n] ?? 0;
}

/**
 * Calculate text similarity using LCS ratio.
 */
export function textSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const normalizedA = normalizeForComparison(a);
  const normalizedB = normalizeForComparison(b);

  if (normalizedA === normalizedB) return 1;

  const lcs = lcsLength(normalizedA, normalizedB);
  const maxLen = Math.max(normalizedA.length, normalizedB.length);

  return maxLen > 0 ? lcs / maxLen : 0;
}

/**
 * Normalize text for comparison (lowercase, collapse whitespace).
 */
function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Find detailed changes between two text strings.
 * Returns a list of additions, deletions, and modifications.
 */
export function findDetailedChanges(
  original: string,
  modified: string
): SectionChange[] {
  const changes: SectionChange[] = [];

  // Tokenize by sentences for finer granularity
  const originalSentences = tokenizeSentences(original);
  const modifiedSentences = tokenizeSentences(modified);

  // Track which sentences have been matched
  const matchedOriginal = new Set<number>();
  const matchedModified = new Set<number>();

  // First pass: find exact matches
  for (let oi = 0; oi < originalSentences.length; oi++) {
    const origSentence = originalSentences[oi];
    if (!origSentence) continue;
    const normalizedOrig = normalizeForComparison(origSentence.text);

    for (let mi = 0; mi < modifiedSentences.length; mi++) {
      if (matchedModified.has(mi)) continue;
      const modSentence = modifiedSentences[mi];
      if (!modSentence) continue;

      if (normalizeForComparison(modSentence.text) === normalizedOrig) {
        matchedOriginal.add(oi);
        matchedModified.add(mi);
        break;
      }
    }
  }

  // Second pass: find similar sentences (modifications)
  for (let oi = 0; oi < originalSentences.length; oi++) {
    if (matchedOriginal.has(oi)) continue;
    const origSentence = originalSentences[oi];
    if (!origSentence) continue;

    let bestMatch: { index: number; similarity: number } | null = null;

    for (let mi = 0; mi < modifiedSentences.length; mi++) {
      if (matchedModified.has(mi)) continue;
      const modSentence = modifiedSentences[mi];
      if (!modSentence) continue;

      const similarity = textSimilarity(origSentence.text, modSentence.text);
      if (similarity > 0.5 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { index: mi, similarity };
      }
    }

    if (bestMatch) {
      const modSentence = modifiedSentences[bestMatch.index];
      if (modSentence) {
        matchedOriginal.add(oi);
        matchedModified.add(bestMatch.index);

        const origWords = countWords(origSentence.text);
        const modWords = countWords(modSentence.text);
        const charDelta = modSentence.text.length - origSentence.text.length;

        changes.push({
          type: 'modification',
          original: origSentence.text,
          modified: modSentence.text,
          charDelta,
          wordDelta: modWords - origWords,
          position: origSentence.position,
        });
      }
    }
  }

  // Third pass: deletions (unmatched original sentences)
  for (let oi = 0; oi < originalSentences.length; oi++) {
    if (matchedOriginal.has(oi)) continue;
    const origSentence = originalSentences[oi];
    if (!origSentence) continue;

    changes.push({
      type: 'deletion',
      original: origSentence.text,
      modified: null,
      charDelta: -origSentence.text.length,
      wordDelta: -countWords(origSentence.text),
      position: origSentence.position,
    });
  }

  // Fourth pass: additions (unmatched modified sentences)
  for (let mi = 0; mi < modifiedSentences.length; mi++) {
    if (matchedModified.has(mi)) continue;
    const modSentence = modifiedSentences[mi];
    if (!modSentence) continue;

    changes.push({
      type: 'addition',
      original: null,
      modified: modSentence.text,
      charDelta: modSentence.text.length,
      wordDelta: countWords(modSentence.text),
      position: modSentence.position,
    });
  }

  // Sort by position
  changes.sort((a, b) => a.position - b.position);

  return changes;
}

/**
 * Tokenize text into sentences with position information.
 */
function tokenizeSentences(text: string): Array<{ text: string; position: number }> {
  const sentences: Array<{ text: string; position: number }> = [];

  // Split by sentence-ending punctuation, keeping the punctuation
  const parts = text.split(/(?<=[.!?])\s+/);

  let position = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      sentences.push({ text: trimmed, position });
      position += part.length + 1; // +1 for space
    }
  }

  return sentences;
}

/**
 * Compute diff for a single aligned section pair.
 */
export function computeSectionDiff(
  draft: ParsedSection | null,
  final: ParsedSection | null
): SectionDiff {
  // Determine section type from whichever is available
  const sectionType = draft?.type ?? final?.type ?? 'other';

  // Handle removed section
  if (!final) {
    const draftContent = draft?.content ?? '';
    return {
      sectionType,
      draftContent,
      finalContent: null,
      status: 'removed',
      changes: [{
        type: 'deletion',
        original: draftContent,
        modified: null,
        charDelta: -draftContent.length,
        wordDelta: -countWords(draftContent),
        position: 0,
      }],
      totalCharDelta: -draftContent.length,
      totalWordDelta: -countWords(draftContent),
    };
  }

  // Handle added section
  if (!draft) {
    const finalContent = final.content;
    return {
      sectionType,
      draftContent: null,
      finalContent,
      status: 'added',
      changes: [{
        type: 'addition',
        original: null,
        modified: finalContent,
        charDelta: finalContent.length,
        wordDelta: countWords(finalContent),
        position: 0,
      }],
      totalCharDelta: finalContent.length,
      totalWordDelta: countWords(finalContent),
    };
  }

  // Both exist - compute detailed changes
  const draftContent = draft.content;
  const finalContent = final.content;

  // Check if unchanged
  if (normalizeForComparison(draftContent) === normalizeForComparison(finalContent)) {
    return {
      sectionType,
      draftContent,
      finalContent,
      status: 'unchanged',
      changes: [],
      totalCharDelta: 0,
      totalWordDelta: 0,
    };
  }

  // Find detailed changes
  const changes = findDetailedChanges(draftContent, finalContent);

  const totalCharDelta = changes.reduce((sum, c) => sum + c.charDelta, 0);
  const totalWordDelta = changes.reduce((sum, c) => sum + c.wordDelta, 0);

  return {
    sectionType,
    draftContent,
    finalContent,
    status: 'modified',
    changes,
    totalCharDelta,
    totalWordDelta,
  };
}

// ============ Complete Diff Analysis ============

/**
 * Analyze the differences between a draft and final letter.
 * This is the main entry point for diff analysis.
 */
export function analyzeDiff(input: AnalyzeDiffInput): LetterDiffAnalysis {
  const { letterId, draftContent, finalContent, subspecialty } = input;

  // Parse both letters into sections
  const draftSections = parseLetterSections(draftContent);
  const finalSections = parseLetterSections(finalContent);

  // Align sections between draft and final
  const aligned = alignSections(draftSections, finalSections);

  // Compute diffs for each aligned pair
  const sectionDiffs = aligned.map(({ draft, final }) =>
    computeSectionDiff(draft, final)
  );

  // Compute overall statistics
  const overallStats = computeOverallStats(sectionDiffs, draftSections, finalSections);

  return {
    letterId,
    subspecialty: subspecialty ?? null,
    draftSections,
    finalSections,
    sectionDiffs,
    overallStats,
  };
}

/**
 * Compute overall statistics from section diffs.
 */
function computeOverallStats(
  sectionDiffs: SectionDiff[],
  draftSections: ParsedSection[],
  finalSections: ParsedSection[]
): LetterDiffAnalysis['overallStats'] {
  let totalCharAdded = 0;
  let totalCharRemoved = 0;
  let totalWordAdded = 0;
  let totalWordRemoved = 0;
  let sectionsAdded = 0;
  let sectionsRemoved = 0;
  let sectionsModified = 0;

  for (const diff of sectionDiffs) {
    if (diff.status === 'added') {
      sectionsAdded++;
      totalCharAdded += diff.totalCharDelta;
      totalWordAdded += diff.totalWordDelta;
    } else if (diff.status === 'removed') {
      sectionsRemoved++;
      totalCharRemoved += Math.abs(diff.totalCharDelta);
      totalWordRemoved += Math.abs(diff.totalWordDelta);
    } else if (diff.status === 'modified') {
      sectionsModified++;
      for (const change of diff.changes) {
        if (change.charDelta > 0) {
          totalCharAdded += change.charDelta;
        } else {
          totalCharRemoved += Math.abs(change.charDelta);
        }
        if (change.wordDelta > 0) {
          totalWordAdded += change.wordDelta;
        } else {
          totalWordRemoved += Math.abs(change.wordDelta);
        }
      }
    }
  }

  // Check if section order changed
  const sectionOrderChanged = hasSectionOrderChanged(draftSections, finalSections);

  return {
    totalCharAdded,
    totalCharRemoved,
    totalWordAdded,
    totalWordRemoved,
    sectionsAdded,
    sectionsRemoved,
    sectionsModified,
    sectionOrderChanged,
  };
}

/**
 * Determine if section order changed between draft and final.
 */
function hasSectionOrderChanged(
  draftSections: ParsedSection[],
  finalSections: ParsedSection[]
): boolean {
  // Get section type sequences, excluding 'other'
  const draftOrder = draftSections
    .map(s => s.type)
    .filter(t => t !== 'other');

  const finalOrder = finalSections
    .map(s => s.type)
    .filter(t => t !== 'other');

  // Compare sequences
  if (draftOrder.length !== finalOrder.length) {
    return true;
  }

  for (let i = 0; i < draftOrder.length; i++) {
    if (draftOrder[i] !== finalOrder[i]) {
      return true;
    }
  }

  return false;
}

// ============ Phrase Extraction Utilities ============

/**
 * Extract phrases that were added to a section.
 */
export function extractAddedPhrases(diff: SectionDiff): string[] {
  const phrases: string[] = [];

  for (const change of diff.changes) {
    if (change.type === 'addition' && change.modified) {
      // Extract meaningful phrases (2+ words)
      const extracted = extractMeaningfulPhrases(change.modified);
      phrases.push(...extracted);
    } else if (change.type === 'modification' && change.original && change.modified) {
      // Find added parts in modifications
      const added = findAddedText(change.original, change.modified);
      if (added) {
        const extracted = extractMeaningfulPhrases(added);
        phrases.push(...extracted);
      }
    }
  }

  return Array.from(new Set(phrases)); // Deduplicate
}

/**
 * Extract phrases that were removed from a section.
 */
export function extractRemovedPhrases(diff: SectionDiff): string[] {
  const phrases: string[] = [];

  for (const change of diff.changes) {
    if (change.type === 'deletion' && change.original) {
      const extracted = extractMeaningfulPhrases(change.original);
      phrases.push(...extracted);
    } else if (change.type === 'modification' && change.original && change.modified) {
      // Find removed parts in modifications
      const removed = findRemovedText(change.original, change.modified);
      if (removed) {
        const extracted = extractMeaningfulPhrases(removed);
        phrases.push(...extracted);
      }
    }
  }

  return Array.from(new Set(phrases)); // Deduplicate
}

/**
 * Extract meaningful phrases from text.
 * Returns phrases that are 2-8 words long and contain meaningful content.
 */
function extractMeaningfulPhrases(text: string): string[] {
  const phrases: string[] = [];

  // Split by sentence boundaries and extract phrases
  const sentences = text.split(/[.!?;]/);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/);

    // Full sentence if 2-8 words
    if (words.length >= 2 && words.length <= 8) {
      phrases.push(trimmed);
    }

    // Extract common medical phrase patterns
    const medicalPhrases = extractMedicalPhrases(trimmed);
    phrases.push(...medicalPhrases);
  }

  return phrases.filter(p => p.length >= 5); // Min 5 characters
}

/**
 * Extract medical-specific phrases from text.
 */
function extractMedicalPhrases(text: string): string[] {
  const phrases: string[] = [];

  // Common clinical patterns
  const patterns = [
    // Quantitative patterns
    /\b(?:LVEF|EF|BP|HR|RR)\s*(?:of\s*)?\d+%?/gi,
    // Medication patterns
    /\b\w+\s+\d+\s*(?:mg|mcg|g|mL|units?)/gi,
    // Clinical descriptors
    /\b(?:normal|abnormal|elevated|reduced|mild|moderate|severe)\s+\w+/gi,
    // Plan items
    /\b(?:recommend|suggest|advise|plan to|will)\s+[\w\s]+/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      phrases.push(...matches);
    }
  }

  return phrases;
}

/**
 * Find text that was added when comparing original to modified.
 */
function findAddedText(original: string, modified: string): string | null {
  const origWords = new Set(original.toLowerCase().split(/\s+/));
  const modWords = modified.toLowerCase().split(/\s+/);

  const added = modWords.filter(w => !origWords.has(w));

  return added.length > 0 ? added.join(' ') : null;
}

/**
 * Find text that was removed when comparing original to modified.
 */
function findRemovedText(original: string, modified: string): string | null {
  const modWords = new Set(modified.toLowerCase().split(/\s+/));
  const origWords = original.toLowerCase().split(/\s+/);

  const removed = origWords.filter(w => !modWords.has(w));

  return removed.length > 0 ? removed.join(' ') : null;
}

/**
 * Extract vocabulary substitutions from modifications.
 * Returns pairs of [original, replacement].
 */
export function extractVocabularySubstitutions(
  diff: SectionDiff
): Array<{ original: string; replacement: string }> {
  const substitutions: Array<{ original: string; replacement: string }> = [];

  for (const change of diff.changes) {
    if (change.type === 'modification' && change.original && change.modified) {
      // Find word-level substitutions
      const subs = findWordSubstitutions(change.original, change.modified);
      substitutions.push(...subs);
    }
  }

  return substitutions;
}

/**
 * Find word-level substitutions between two similar texts.
 */
function findWordSubstitutions(
  original: string,
  modified: string
): Array<{ original: string; replacement: string }> {
  const substitutions: Array<{ original: string; replacement: string }> = [];

  const origWords = original.split(/\s+/).filter(Boolean);
  const modWords = modified.split(/\s+/).filter(Boolean);

  // Compare word by word when lengths are the same (clear substitution case)
  if (origWords.length === modWords.length) {
    for (let i = 0; i < origWords.length; i++) {
      const origWord = origWords[i];
      const modWord = modWords[i];

      if (origWord && modWord) {
        const origLower = origWord.toLowerCase().replace(/[.,;:!?]/g, '');
        const modLower = modWord.toLowerCase().replace(/[.,;:!?]/g, '');

        // Different words at same position
        if (origLower !== modLower && origLower.length >= 3 && modLower.length >= 3) {
          substitutions.push({
            original: origLower,
            replacement: modLower,
          });
        }
      }
    }
  } else if (Math.abs(origWords.length - modWords.length) <= 2) {
    // Slightly different lengths - try to find matching context words
    // Build sets for quick lookup
    const origSet = new Set(origWords.map(w => w.toLowerCase().replace(/[.,;:!?]/g, '')));
    const modSet = new Set(modWords.map(w => w.toLowerCase().replace(/[.,;:!?]/g, '')));

    // Words in original but not in modified (potential source words)
    const removedWords = origWords
      .map(w => w.toLowerCase().replace(/[.,;:!?]/g, ''))
      .filter(w => w.length >= 3 && !modSet.has(w));

    // Words in modified but not in original (potential replacement words)
    const addedWords = modWords
      .map(w => w.toLowerCase().replace(/[.,;:!?]/g, ''))
      .filter(w => w.length >= 3 && !origSet.has(w));

    // Match by similar length (simple heuristic for substitution)
    for (const removed of removedWords) {
      for (const added of addedWords) {
        if (Math.abs(removed.length - added.length) <= 4) {
          substitutions.push({
            original: removed,
            replacement: added,
          });
          break; // One match per removed word
        }
      }
    }
  }

  return substitutions;
}
