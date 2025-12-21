// src/domains/letters/source-anchoring.ts
// Parse and validate source anchors in generated letters

import type { SourceAnchor } from './letter.types';
import type { LetterSources } from './prompts/generation';
import { logger } from '@/lib/logger';

/**
 * Parse source anchors from generated letter text.
 *
 * Format: {{SOURCE:sourceId:excerpt}}
 *
 * Example:
 * "The patient's LVEF was 45% {{SOURCE:document-echo-123:LVEF 45% by Simpson's biplane}}"
 *
 * This function:
 * 1. Finds all source anchor patterns in the text
 * 2. Extracts source ID and excerpt
 * 3. Determines source type (transcript, document, user-input)
 * 4. Verifies source exists and excerpt matches
 * 5. Returns structured SourceAnchor objects
 */
export function parseSourceAnchors(
  letterText: string,
  sources: LetterSources
): {
  anchors: SourceAnchor[];
  letterWithoutAnchors: string;
  unverifiedAnchors: SourceAnchor[];
} {
  const log = logger.child({ action: 'parseSourceAnchors' });

  const anchorPattern = /\{\{SOURCE:([^:]+):([^}]+)\}\}/g;
  const anchors: SourceAnchor[] = [];
  const unverifiedAnchors: SourceAnchor[] = [];

  let match;
  let anchorIndex = 0;

  while ((match = anchorPattern.exec(letterText)) !== null) {
    const [fullMatch, sourceId, excerpt] = match;

    if (!sourceId || !excerpt) {
      log.warn('Invalid source anchor format', { fullMatch });
      continue;
    }

    // Determine source type and validate
    const { sourceType, verified, confidence } = verifySourceAnchor(
      sourceId,
      excerpt.trim(),
      sources
    );

    const anchor: SourceAnchor = {
      id: `anchor-${anchorIndex++}`,
      segmentText: fullMatch,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
      sourceType,
      sourceId: sourceId.trim(),
      sourceExcerpt: excerpt.trim(),
      confidence,
    };

    if (verified) {
      anchors.push(anchor);
    } else {
      unverifiedAnchors.push(anchor);
    }
  }

  // Remove anchor markers from text (keep only the clinical statement)
  const letterWithoutAnchors = letterText.replace(anchorPattern, '').trim();

  log.info('Source anchors parsed', {
    totalAnchors: anchors.length + unverifiedAnchors.length,
    verifiedAnchors: anchors.length,
    unverifiedAnchors: unverifiedAnchors.length,
  });

  return {
    anchors,
    letterWithoutAnchors,
    unverifiedAnchors,
  };
}

/**
 * Verify that a source anchor references a real source and excerpt.
 *
 * Returns:
 * - sourceType: transcript | document | user-input
 * - verified: true if source exists and excerpt found
 * - confidence: 0-1 score of how well excerpt matches source
 */
function verifySourceAnchor(
  sourceId: string,
  excerpt: string,
  sources: LetterSources
): {
  sourceType: 'transcript' | 'document' | 'user-input';
  verified: boolean;
  confidence: number;
} {
  const log = logger.child({ action: 'verifySourceAnchor', sourceId });

  // Check if sourceId indicates a transcript
  if (
    sources.transcript &&
    (sourceId === sources.transcript.id ||
      sourceId.startsWith('transcript') ||
      sourceId.startsWith('recording'))
  ) {
    const transcriptText = sources.transcript.text.toLowerCase();
    const excerptLower = excerpt.toLowerCase();

    // Check for exact match
    if (transcriptText.includes(excerptLower)) {
      return { sourceType: 'transcript', verified: true, confidence: 1.0 };
    }

    // Check for fuzzy match (allow minor variations)
    const similarity = calculateSimilarity(transcriptText, excerptLower);
    if (similarity > 0.7) {
      return { sourceType: 'transcript', verified: true, confidence: similarity };
    }

    // Check speaker segments
    if (sources.transcript.speakers) {
      for (const segment of sources.transcript.speakers) {
        const segmentText = segment.text.toLowerCase();
        if (segmentText.includes(excerptLower)) {
          return { sourceType: 'transcript', verified: true, confidence: 1.0 };
        }

        const segmentSimilarity = calculateSimilarity(segmentText, excerptLower);
        if (segmentSimilarity > 0.7) {
          return { sourceType: 'transcript', verified: true, confidence: segmentSimilarity };
        }
      }
    }

    log.warn('Transcript source anchor not verified', { sourceId, excerpt: excerpt.slice(0, 50) });
    return { sourceType: 'transcript', verified: false, confidence: 0 };
  }

  // Check if sourceId indicates a document
  if (sources.documents && (sourceId.startsWith('document') || sourceId.startsWith('doc'))) {
    for (const doc of sources.documents) {
      if (doc.id === sourceId || sourceId.includes(doc.id)) {
        // Check extracted data (as JSON string)
        const extractedDataStr = JSON.stringify(doc.extractedData).toLowerCase();
        const excerptLower = excerpt.toLowerCase();

        if (extractedDataStr.includes(excerptLower)) {
          return { sourceType: 'document', verified: true, confidence: 1.0 };
        }

        // Check raw text
        if (doc.rawText) {
          const rawTextLower = doc.rawText.toLowerCase();
          if (rawTextLower.includes(excerptLower)) {
            return { sourceType: 'document', verified: true, confidence: 1.0 };
          }

          const rawTextSimilarity = calculateSimilarity(rawTextLower, excerptLower);
          if (rawTextSimilarity > 0.7) {
            return { sourceType: 'document', verified: true, confidence: rawTextSimilarity };
          }
        }

        log.warn('Document source anchor not verified', {
          sourceId,
          docId: doc.id,
          excerpt: excerpt.slice(0, 50),
        });
        return { sourceType: 'document', verified: false, confidence: 0 };
      }
    }

    log.warn('Document source not found', { sourceId });
    return { sourceType: 'document', verified: false, confidence: 0 };
  }

  // Check if sourceId indicates user input
  if (sources.userInput && (sourceId === sources.userInput.id || sourceId.startsWith('user'))) {
    const userInputText = sources.userInput.text.toLowerCase();
    const excerptLower = excerpt.toLowerCase();

    if (userInputText.includes(excerptLower)) {
      return { sourceType: 'user-input', verified: true, confidence: 1.0 };
    }

    const similarity = calculateSimilarity(userInputText, excerptLower);
    if (similarity > 0.7) {
      return { sourceType: 'user-input', verified: true, confidence: similarity };
    }

    log.warn('User input source anchor not verified', { sourceId, excerpt: excerpt.slice(0, 50) });
    return { sourceType: 'user-input', verified: false, confidence: 0 };
  }

  // Unknown source type
  log.warn('Unknown source type', { sourceId });
  return { sourceType: 'document', verified: false, confidence: 0 };
}

/**
 * Calculate text similarity using Levenshtein-like algorithm.
 * Returns a score between 0 (no match) and 1 (perfect match).
 *
 * Simplified implementation for excerpt matching.
 */
function calculateSimilarity(fullText: string, excerpt: string): number {
  // Check if excerpt appears as substring (most common case)
  if (fullText.includes(excerpt)) {
    return 1.0;
  }

  // Check for partial matches with word-level fuzzy matching
  const excerptWords = excerpt.split(/\s+/).filter((w) => w.length > 3); // Ignore short words
  if (excerptWords.length === 0) {
    return 0;
  }

  let matchedWords = 0;
  for (const word of excerptWords) {
    if (fullText.includes(word)) {
      matchedWords++;
    }
  }

  return matchedWords / excerptWords.length;
}

/**
 * Count source anchors by type.
 */
export function countAnchorsByType(anchors: SourceAnchor[]): {
  transcript: number;
  document: number;
  userInput: number;
  total: number;
} {
  const counts = {
    transcript: 0,
    document: 0,
    userInput: 0,
  };

  for (const anchor of anchors) {
    if (anchor.sourceType === 'transcript') {
      counts.transcript++;
    } else if (anchor.sourceType === 'document') {
      counts.document++;
    } else if (anchor.sourceType === 'user-input') {
      counts.userInput++;
    }
  }

  return {
    ...counts,
    total: anchors.length,
  };
}

/**
 * Validate that critical clinical statements have source anchors.
 *
 * Returns list of unsourced clinical statements that should have anchors.
 */
export function validateClinicalSources(letterText: string, anchors: SourceAnchor[]): {
  isValid: boolean;
  unsourcedStatements: string[];
  coverage: number; // Percentage of clinical statements with sources
} {
  const log = logger.child({ action: 'validateClinicalSources' });

  // Patterns that indicate clinical statements requiring sources
  const clinicalPatterns = [
    /LVEF\s+(?:was\s+)?(\d+%)/gi, // LVEF measurements
    /BP\s+(\d+\/\d+)/gi, // Blood pressure
    /HR\s+(\d+)/gi, // Heart rate
    /stenosis\s+of\s+(\d+%)/gi, // Stenosis percentages
    /gradient\s+(?:of\s+)?(\d+\s*mmHg)/gi, // Pressure gradients
    /medications?:\s*([^\n]+)/gi, // Medication lists
    /(?:presented|presenting)\s+with\s+([^.]+)/gi, // Presenting complaints
  ];

  const unsourcedStatements: string[] = [];
  let totalStatements = 0;
  let sourcedStatements = 0;

  for (const pattern of clinicalPatterns) {
    let match;
    while ((match = pattern.exec(letterText)) !== null) {
      totalStatements++;
      const statementStart = match.index;
      const statementEnd = match.index + match[0].length;

      // Check if this statement is within range of any source anchor
      const hasAnchor = anchors.some((anchor) => {
        // Check if anchor is within ±200 characters of this statement
        return (
          Math.abs(anchor.startIndex - statementStart) < 200 ||
          Math.abs(anchor.endIndex - statementEnd) < 200
        );
      });

      if (hasAnchor) {
        sourcedStatements++;
      } else {
        unsourcedStatements.push(match[0]);
      }
    }
  }

  const coverage = totalStatements > 0 ? (sourcedStatements / totalStatements) * 100 : 100;

  log.info('Clinical source validation complete', {
    totalStatements,
    sourcedStatements,
    unsourcedStatements: unsourcedStatements.length,
    coverage: coverage.toFixed(1),
  });

  return {
    isValid: coverage >= 80, // Require 80% coverage
    unsourcedStatements,
    coverage,
  };
}

/**
 * Extract source anchors for a specific section of the letter.
 *
 * Useful for highlighting sources when physician reviews a section.
 */
export function getAnchorsForSection(
  sectionText: string,
  allAnchors: SourceAnchor[]
): SourceAnchor[] {
  return allAnchors.filter((anchor) => {
    return sectionText.includes(anchor.segmentText);
  });
}

/**
 * Generate a source citation summary for the letter.
 *
 * Useful for displaying "Sources used: Transcript (5 citations), Echo Report (3 citations)"
 */
export function generateSourceSummary(anchors: SourceAnchor[]): string {
  const counts = countAnchorsByType(anchors);

  const parts: string[] = [];

  if (counts.transcript > 0) {
    parts.push(`Transcript (${counts.transcript} citation${counts.transcript > 1 ? 's' : ''})`);
  }

  if (counts.document > 0) {
    parts.push(`Documents (${counts.document} citation${counts.document > 1 ? 's' : ''})`);
  }

  if (counts.userInput > 0) {
    parts.push(`User Input (${counts.userInput} citation${counts.userInput > 1 ? 's' : ''})`);
  }

  if (parts.length === 0) {
    return 'No sources cited';
  }

  return `Sources used: ${parts.join(', ')}`;
}
