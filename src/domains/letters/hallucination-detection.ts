// src/domains/letters/hallucination-detection.ts
// Detect potential hallucinations in generated letters

import type { HallucinationFlag, ClinicalValue, SourceAnchor } from './letter.types';
import type { LetterSources } from './prompts/generation';
import { logger } from '@/lib/logger';

/**
 * Detect potential hallucinations in generated letter.
 *
 * Hallucination indicators:
 * 1. Clinical values without source anchors
 * 2. Specific details that don't appear in sources
 * 3. Names of referring doctors not in sources
 * 4. Exact dates/times not in sources
 * 5. Procedural details not mentioned
 * 6. Fabricated measurements or test results
 */
export function detectHallucinations(
  letterText: string,
  sources: LetterSources,
  sourceAnchors: SourceAnchor[],
  clinicalValues: ClinicalValue[]
): HallucinationFlag[] {
  const log = logger.child({ action: 'detectHallucinations' });

  const flags: HallucinationFlag[] = [];
  let flagIndex = 0;

  // Check 1: Clinical values without source anchors
  const unsourcedValues = clinicalValues.filter((v) => !v.sourceAnchorId);
  for (const value of unsourcedValues) {
    // Find position in letter text
    const valueText = `${value.name} ${value.value}${value.unit ?? ''}`;
    const position = letterText.indexOf(valueText);

    if (position !== -1) {
      flags.push({
        id: `hallucination-${flagIndex++}`,
        segmentText: valueText,
        startIndex: position,
        endIndex: position + valueText.length,
        reason: `Clinical ${value.type} lacks source citation`,
        severity: value.type === 'measurement' ? 'critical' : 'warning',
        dismissed: false,
      });
    }
  }

  // Check 2: Referring doctor names not in sources
  const referringDoctorPattern = /(?:dear|from)\s+dr\.?\s+([a-z]+)/gi;
  let match;
  while ((match = referringDoctorPattern.exec(letterText)) !== null) {
    const doctorName = match[1] ?? '';
    const appearsInSources = checkDoctorInSources(doctorName, sources);

    if (!appearsInSources) {
      flags.push({
        id: `hallucination-${flagIndex++}`,
        segmentText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        reason: `Referring doctor name "${doctorName}" not found in sources`,
        severity: 'warning',
        dismissed: false,
      });
    }
  }

  // Check 3: Specific dates not in sources (excluding consultation date)
  const datePattern = /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})\b/gi;
  while ((match = datePattern.exec(letterText)) !== null) {
    const date = match[1] ?? '';
    const appearsInSources = checkTextInSources(date, sources);

    if (!appearsInSources) {
      // Check if it's near a source anchor (likely consultation date)
      const nearAnchor = sourceAnchors.some(
        (anchor) => Math.abs(anchor.startIndex - match.index) < 100
      );

      if (!nearAnchor) {
        flags.push({
          id: `hallucination-${flagIndex++}`,
          segmentText: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          reason: `Specific date "${date}" not found in sources`,
          severity: 'warning',
          dismissed: false,
        });
      }
    }
  }

  // Check 4: Vessel-specific findings in angiogram reports
  const vesselFindingPattern = /(LMCA|LAD|LCx|RCA|D1|D2|OM1|OM2)\s+[^.]+(\d+%)/gi;
  while ((match = vesselFindingPattern.exec(letterText)) !== null) {
    const vessel = match[1] ?? '';
    const finding = match[0];

    // Check if this vessel finding has a nearby source anchor
    const hasAnchor = sourceAnchors.some(
      (anchor) =>
        Math.abs(anchor.startIndex - match.index) < 200 &&
        anchor.sourceExcerpt.toLowerCase().includes(vessel.toLowerCase())
    );

    if (!hasAnchor) {
      flags.push({
        id: `hallucination-${flagIndex++}`,
        segmentText: finding,
        startIndex: match.index,
        endIndex: match.index + finding.length,
        reason: `Vessel finding for ${vessel} lacks source citation`,
        severity: 'critical',
        dismissed: false,
      });
    }
  }

  // Check 5: Medication changes not in sources
  const medicationChangePattern = /(?:started|commenced|increased|decreased|ceased)\s+([a-z]+)\s+(\d+\.?\d*\s*mg)/gi;
  while ((match = medicationChangePattern.exec(letterText)) !== null) {
    const medication = match[1] ?? '';
    const dose = match[2] ?? '';

    const appearsInSources =
      checkTextInSources(medication, sources) && checkTextInSources(dose, sources);

    if (!appearsInSources) {
      flags.push({
        id: `hallucination-${flagIndex++}`,
        segmentText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        reason: `Medication change "${medication} ${dose}" not found in sources`,
        severity: 'critical',
        dismissed: false,
      });
    }
  }

  // Check 6: Exact procedural details (stent sizes, etc.)
  const stentDetailPattern = /(\d+\.?\d*)\s*(?:x|×)\s*(\d+)\s*mm\s+stent/gi;
  while ((match = stentDetailPattern.exec(letterText)) !== null) {
    const stentSize = match[0];

    const hasAnchor = sourceAnchors.some(
      (anchor) =>
        Math.abs(anchor.startIndex - match.index) < 200 &&
        (anchor.sourceExcerpt.includes(match[1] ?? '') ||
          anchor.sourceExcerpt.includes(match[2] ?? ''))
    );

    if (!hasAnchor) {
      flags.push({
        id: `hallucination-${flagIndex++}`,
        segmentText: stentSize,
        startIndex: match.index,
        endIndex: match.index + stentSize.length,
        reason: `Stent size specification lacks source citation`,
        severity: 'critical',
        dismissed: false,
      });
    }
  }

  // Check 7: Patient history details not in sources
  const historyPattern = /(?:history of|previous|prior)\s+([^.,]{10,50})/gi;
  while ((match = historyPattern.exec(letterText)) !== null) {
    const historyDetail = match[1]?.trim() ?? '';

    // Skip if it's a common phrase or near a source anchor
    if (historyDetail.length < 15) continue;

    const nearAnchor = sourceAnchors.some(
      (anchor) => Math.abs(anchor.startIndex - match.index) < 150
    );

    if (!nearAnchor) {
      const appearsInSources = checkTextInSources(historyDetail, sources);

      if (!appearsInSources) {
        flags.push({
          id: `hallucination-${flagIndex++}`,
          segmentText: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          reason: `Patient history detail lacks source citation`,
          severity: 'warning',
          dismissed: false,
        });
      }
    }
  }

  log.info('Hallucination detection complete', {
    totalFlags: flags.length,
    criticalFlags: flags.filter((f) => f.severity === 'critical').length,
    warningFlags: flags.filter((f) => f.severity === 'warning').length,
  });

  return flags;
}

/**
 * Check if a doctor name appears in any source.
 */
function checkDoctorInSources(doctorName: string, sources: LetterSources): boolean {
  const nameLower = doctorName.toLowerCase();

  // Check transcript
  if (sources.transcript && sources.transcript.text.toLowerCase().includes(nameLower)) {
    return true;
  }

  // Check documents
  if (sources.documents) {
    for (const doc of sources.documents) {
      const dataStr = JSON.stringify(doc.extractedData).toLowerCase();
      if (dataStr.includes(nameLower)) {
        return true;
      }

      if (doc.rawText && doc.rawText.toLowerCase().includes(nameLower)) {
        return true;
      }
    }
  }

  // Check user input
  if (sources.userInput && sources.userInput.text.toLowerCase().includes(nameLower)) {
    return true;
  }

  return false;
}

/**
 * Check if text appears in any source.
 */
function checkTextInSources(text: string, sources: LetterSources): boolean {
  const textLower = text.toLowerCase();

  // Check transcript
  if (sources.transcript) {
    if (sources.transcript.text.toLowerCase().includes(textLower)) {
      return true;
    }

    // Check speaker segments
    if (sources.transcript.speakers) {
      for (const segment of sources.transcript.speakers) {
        if (segment.text.toLowerCase().includes(textLower)) {
          return true;
        }
      }
    }
  }

  // Check documents
  if (sources.documents) {
    for (const doc of sources.documents) {
      const dataStr = JSON.stringify(doc.extractedData).toLowerCase();
      if (dataStr.includes(textLower)) {
        return true;
      }

      if (doc.rawText && doc.rawText.toLowerCase().includes(textLower)) {
        return true;
      }
    }
  }

  // Check user input
  if (sources.userInput && sources.userInput.text.toLowerCase().includes(textLower)) {
    return true;
  }

  return false;
}

/**
 * Group hallucination flags by severity.
 */
export function groupFlagsBySeverity(flags: HallucinationFlag[]): {
  critical: HallucinationFlag[];
  warning: HallucinationFlag[];
} {
  return {
    critical: flags.filter((f) => f.severity === 'critical' && !f.dismissed),
    warning: flags.filter((f) => f.severity === 'warning' && !f.dismissed),
  };
}

/**
 * Calculate hallucination risk score (0-100).
 * Higher score = more likely to contain hallucinations.
 */
export function calculateHallucinationRisk(flags: HallucinationFlag[]): {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  flagCount: number;
  criticalCount: number;
} {
  const grouped = groupFlagsBySeverity(flags);
  const criticalCount = grouped.critical.length;
  const warningCount = grouped.warning.length;

  // Score calculation:
  // - Each critical flag: +30 points
  // - Each warning flag: +10 points
  const score = Math.min(criticalCount * 30 + warningCount * 10, 100);

  let level: 'low' | 'medium' | 'high' | 'critical';
  if (score >= 60 || criticalCount >= 3) {
    level = 'critical';
  } else if (score >= 40 || criticalCount >= 2) {
    level = 'high';
  } else if (score >= 20 || criticalCount >= 1) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    score,
    level,
    flagCount: flags.length,
    criticalCount,
  };
}

/**
 * Generate a human-readable hallucination report.
 */
export function generateHallucinationReport(flags: HallucinationFlag[]): string {
  if (flags.length === 0) {
    return 'No potential hallucinations detected. All clinical statements are sourced.';
  }

  const risk = calculateHallucinationRisk(flags);
  const grouped = groupFlagsBySeverity(flags);

  let report = `Hallucination Risk: ${risk.level.toUpperCase()} (score: ${risk.score}/100)\n\n`;

  if (grouped.critical.length > 0) {
    report += `Critical Flags (${grouped.critical.length}):\n`;
    for (const flag of grouped.critical) {
      report += `- ${flag.reason}: "${flag.segmentText.slice(0, 50)}..."\n`;
    }
    report += '\n';
  }

  if (grouped.warning.length > 0) {
    report += `Warnings (${grouped.warning.length}):\n`;
    for (const flag of grouped.warning) {
      report += `- ${flag.reason}: "${flag.segmentText.slice(0, 50)}..."\n`;
    }
  }

  return report;
}

/**
 * Recommend whether letter is safe to approve based on hallucination risk.
 */
export function recommendApproval(flags: HallucinationFlag[]): {
  shouldApprove: boolean;
  reason: string;
  actionRequired: string;
} {
  const risk = calculateHallucinationRisk(flags);

  if (risk.level === 'critical') {
    return {
      shouldApprove: false,
      reason: `${risk.criticalCount} critical hallucination(s) detected`,
      actionRequired: 'Review and correct all critical flags before approval',
    };
  }

  if (risk.level === 'high') {
    return {
      shouldApprove: false,
      reason: `High hallucination risk (score: ${risk.score})`,
      actionRequired: 'Review all flagged sections and verify against sources',
    };
  }

  if (risk.level === 'medium') {
    return {
      shouldApprove: true,
      reason: 'Moderate hallucination risk - manual review recommended',
      actionRequired: 'Review flagged sections before final approval',
    };
  }

  return {
    shouldApprove: true,
    reason: 'Low hallucination risk',
    actionRequired: 'Perform standard review',
  };
}
