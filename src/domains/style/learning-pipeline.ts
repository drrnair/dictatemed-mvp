// src/domains/style/learning-pipeline.ts
// Background learning pipeline for per-subspecialty style learning

import type { Subspecialty } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { generateTextWithRetry, MODELS } from '@/infrastructure/bedrock';
import { logger } from '@/lib/logger';
import {
  analyzeDiff,
} from './diff-analyzer';
import {
  getStyleProfile,
  updateStyleProfile,
} from './subspecialty-profile.service';
import type {
  RecordSubspecialtyEditsInput,
  AnalyzeStyleInput,
  SubspecialtyStyleAnalysisResult,
  SubspecialtyStyleProfile,
  UpdateSubspecialtyProfileInput,
  SectionInclusionMap,
  SectionPhrasingMap,
  VocabularyMap,
  SubspecialtyConfidenceScores,
  LetterSectionType,
  FormalityLevel,
  StyleCategory,
  ParagraphStructure,
  TerminologyLevel,
  PhrasePattern,
  SectionOrderPattern,
  LetterDiffAnalysis,
} from './subspecialty-profile.types';

// ============ Constants ============

/**
 * Minimum number of edits before triggering style analysis.
 */
export const MIN_EDITS_FOR_ANALYSIS = 5;

/**
 * Number of edits between analyses (after initial).
 */
export const ANALYSIS_INTERVAL = 10;

/**
 * Maximum number of edits to include in a single analysis batch.
 */
export const MAX_EDITS_PER_ANALYSIS = 50;

/**
 * Minimum confidence threshold for applying preferences.
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.5;

// ============ Edit Recording ============

/**
 * Record edits made during letter approval for a specific subspecialty.
 * This is the entry point for the learning pipeline, called when a letter is approved.
 */
export async function recordSubspecialtyEdits(
  input: RecordSubspecialtyEditsInput
): Promise<{ editCount: number; diffAnalysis: LetterDiffAnalysis }> {
  const log = logger.child({
    action: 'recordSubspecialtyEdits',
    userId: input.userId,
    letterId: input.letterId,
    subspecialty: input.subspecialty,
  });

  // Compute section-level diff
  const diffAnalysis = analyzeDiff({
    letterId: input.letterId,
    draftContent: input.draftContent,
    finalContent: input.finalContent,
    subspecialty: input.subspecialty,
  });

  log.info('Diff analysis completed', {
    sectionsModified: diffAnalysis.overallStats.sectionsModified,
    sectionsAdded: diffAnalysis.overallStats.sectionsAdded,
    sectionsRemoved: diffAnalysis.overallStats.sectionsRemoved,
  });

  // Record individual edits for each modified section
  let editCount = 0;

  for (const sectionDiff of diffAnalysis.sectionDiffs) {
    if (sectionDiff.status === 'unchanged') {
      continue;
    }

    // Record this section's changes as a style edit
    await prisma.styleEdit.create({
      data: {
        userId: input.userId,
        letterId: input.letterId,
        subspecialty: input.subspecialty,
        beforeText: sectionDiff.draftContent ?? '',
        afterText: sectionDiff.finalContent ?? '',
        editType: sectionDiff.status,
        sectionType: sectionDiff.sectionType,
        characterChanges: Math.abs(sectionDiff.totalCharDelta),
        wordChanges: Math.abs(sectionDiff.totalWordDelta),
      },
    });

    editCount++;
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: 'style.subspecialty_edits_recorded',
      resourceType: 'letter',
      resourceId: input.letterId,
      metadata: {
        subspecialty: input.subspecialty,
        editCount,
        sectionsModified: diffAnalysis.overallStats.sectionsModified,
        sectionsAdded: diffAnalysis.overallStats.sectionsAdded,
        sectionsRemoved: diffAnalysis.overallStats.sectionsRemoved,
      },
    },
  });

  log.info('Subspecialty edits recorded', { editCount });

  return { editCount, diffAnalysis };
}

// ============ Analysis Triggering ============

/**
 * Check if analysis should be triggered based on edit count.
 */
export async function shouldTriggerAnalysis(
  userId: string,
  subspecialty: Subspecialty
): Promise<{ shouldAnalyze: boolean; editCount: number; reason: string }> {
  const profile = await getStyleProfile(userId, subspecialty);

  // Count edits for this subspecialty
  const totalEdits = await prisma.styleEdit.count({
    where: { userId, subspecialty },
  });

  // No profile yet - trigger analysis if we have enough edits
  if (!profile) {
    if (totalEdits >= MIN_EDITS_FOR_ANALYSIS) {
      return {
        shouldAnalyze: true,
        editCount: totalEdits,
        reason: 'Initial profile creation (minimum edits reached)',
      };
    }
    return {
      shouldAnalyze: false,
      editCount: totalEdits,
      reason: `Need ${MIN_EDITS_FOR_ANALYSIS - totalEdits} more edits for initial analysis`,
    };
  }

  // Profile exists - trigger if we have enough new edits since last analysis
  const editsSinceLastAnalysis = totalEdits - profile.totalEditsAnalyzed;

  if (editsSinceLastAnalysis >= ANALYSIS_INTERVAL) {
    return {
      shouldAnalyze: true,
      editCount: totalEdits,
      reason: `${editsSinceLastAnalysis} new edits since last analysis`,
    };
  }

  return {
    shouldAnalyze: false,
    editCount: totalEdits,
    reason: `Need ${ANALYSIS_INTERVAL - editsSinceLastAnalysis} more edits for next analysis`,
  };
}

/**
 * Queue a style analysis job for background processing.
 * In production, this would push to a job queue (e.g., BullMQ, SQS).
 * For now, we execute synchronously but could be made async.
 */
export async function queueStyleAnalysis(
  userId: string,
  subspecialty: Subspecialty,
  options?: { forceAnalysis?: boolean }
): Promise<{ queued: boolean; reason: string }> {
  const log = logger.child({ action: 'queueStyleAnalysis', userId, subspecialty });

  // Check if analysis is needed
  if (!options?.forceAnalysis) {
    const { shouldAnalyze, reason } = await shouldTriggerAnalysis(userId, subspecialty);
    if (!shouldAnalyze) {
      log.info('Analysis not triggered', { reason });
      return { queued: false, reason };
    }
  }

  // In production, this would queue a job. For now, we run synchronously.
  log.info('Queueing style analysis');

  // Schedule the analysis (could be async in production)
  try {
    await runStyleAnalysis({ userId, subspecialty, forceAnalysis: options?.forceAnalysis });
    return { queued: true, reason: 'Analysis completed' };
  } catch (error) {
    log.error('Style analysis failed', {}, error instanceof Error ? error : undefined);
    return { queued: false, reason: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// ============ Style Analysis ============

/**
 * Run style analysis using Claude to detect patterns in edits.
 */
export async function runStyleAnalysis(
  input: AnalyzeStyleInput
): Promise<SubspecialtyStyleAnalysisResult> {
  const log = logger.child({
    action: 'runStyleAnalysis',
    userId: input.userId,
    subspecialty: input.subspecialty,
  });

  const minEdits = input.minEdits ?? MIN_EDITS_FOR_ANALYSIS;
  const maxEdits = input.maxEdits ?? MAX_EDITS_PER_ANALYSIS;

  // Fetch recent edits for this subspecialty
  const edits = await prisma.styleEdit.findMany({
    where: {
      userId: input.userId,
      subspecialty: input.subspecialty,
    },
    orderBy: { createdAt: 'desc' },
    take: maxEdits,
  });

  if (edits.length < minEdits && !input.forceAnalysis) {
    throw new Error(
      `Insufficient edits for analysis. Need at least ${minEdits}, found ${edits.length}.`
    );
  }

  log.info('Starting subspecialty style analysis', {
    editCount: edits.length,
    subspecialty: input.subspecialty,
  });

  // Build analysis prompt
  const prompt = buildSubspecialtyAnalysisPrompt(edits, input.subspecialty);

  // Run Claude analysis
  const response = await generateTextWithRetry({
    prompt,
    modelId: MODELS.SONNET, // Use Sonnet for cost efficiency
    maxTokens: 4096,
    temperature: 0.2, // Lower temperature for consistent analysis
    systemPrompt: SUBSPECIALTY_ANALYSIS_SYSTEM_PROMPT,
  });

  log.info('Claude analysis complete', {
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  // Parse Claude's response
  const analysis = parseSubspecialtyAnalysisResponse(
    response.content,
    input.userId,
    input.subspecialty,
    edits.length,
    response.modelId
  );

  // Get existing profile
  const existingProfile = await getStyleProfile(input.userId, input.subspecialty);

  // Merge with existing profile
  const mergedProfile = mergeProfileAnalysis(existingProfile, analysis);

  // Update the profile in the database
  await updateStyleProfile(input.userId, input.subspecialty, {
    ...mergedProfile,
    totalEditsAnalyzed: (existingProfile?.totalEditsAnalyzed ?? 0) + edits.length,
    lastAnalyzedAt: new Date(),
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: 'style.subspecialty_analysis_completed',
      resourceType: 'style_profile',
      resourceId: `${input.userId}:${input.subspecialty}`,
      metadata: {
        subspecialty: input.subspecialty,
        editsAnalyzed: edits.length,
        modelUsed: response.modelId,
      },
    },
  });

  log.info('Style profile updated with new analysis', {
    totalEditsAnalyzed: (existingProfile?.totalEditsAnalyzed ?? 0) + edits.length,
  });

  return analysis;
}

/**
 * Build the analysis prompt for subspecialty-specific style learning.
 */
function buildSubspecialtyAnalysisPrompt(
  edits: Array<{
    beforeText: string;
    afterText: string;
    sectionType: string | null;
    editType: string;
  }>,
  subspecialty: Subspecialty
): string {
  // Group edits by section type
  const editsBySection: Record<string, Array<{ before: string; after: string; editType: string }>> = {};

  for (const edit of edits) {
    const section = edit.sectionType ?? 'other';
    if (!editsBySection[section]) {
      editsBySection[section] = [];
    }
    editsBySection[section].push({
      before: edit.beforeText,
      after: edit.afterText,
      editType: edit.editType,
    });
  }

  let prompt = `Analyze these physician edits for ${subspecialty} letters to learn their writing style preferences.

Below are ${edits.length} examples of text edits the physician made to AI-generated medical letters for ${subspecialty}. Each edit shows the BEFORE (AI-generated) and AFTER (physician-edited) versions.

Your task is to identify consistent patterns in how the physician writes for ${subspecialty} letters, including:
1. Section ordering preferences
2. Section inclusion/exclusion patterns
3. Section-specific verbosity (brief vs detailed)
4. Phrasing preferences per section
5. Phrases consistently deleted or avoided
6. Vocabulary substitutions
7. Terminology level (specialist vs lay terms)
8. Greeting and closing styles
9. Sign-off preferences
10. Overall formality level
11. Paragraph structure

# EDIT EXAMPLES

`;

  // Add edits grouped by section
  for (const [section, sectionEdits] of Object.entries(editsBySection)) {
    prompt += `## ${section.toUpperCase()} SECTION\n\n`;

    for (let i = 0; i < Math.min(sectionEdits.length, 10); i++) {
      const edit = sectionEdits[i];
      if (edit) {
        prompt += `### Edit ${i + 1} (${edit.editType})\n`;
        prompt += `BEFORE:\n${truncateText(edit.before, 500)}\n\n`;
        prompt += `AFTER:\n${truncateText(edit.after, 500)}\n\n`;
        prompt += `---\n\n`;
      }
    }
  }

  prompt += `
# YOUR ANALYSIS

Provide your analysis in the following JSON format:

\`\`\`json
{
  "detectedSectionOrder": ["greeting", "history", "examination", "impression", "plan", "closing", "signoff"],
  "detectedSectionInclusion": {
    "history": 0.95,
    "medications": 0.7,
    "family_history": 0.3
  },
  "detectedSectionVerbosity": {
    "history": "detailed",
    "plan": "brief",
    "impression": "normal"
  },
  "detectedPhrasing": {
    "impression": ["I was pleased to review", "assessment demonstrates"],
    "plan": ["will arrange", "recommend proceeding with"]
  },
  "detectedAvoidedPhrases": {
    "impression": ["It is felt that", "The patient appears to"],
    "plan": ["Consider if appropriate"]
  },
  "detectedVocabulary": {
    "utilize": "use",
    "commence": "start",
    "prior to": "before"
  },
  "detectedTerminologyLevel": "specialist" | "lay" | "mixed" | null,
  "detectedGreetingStyle": "formal" | "casual" | "mixed" | null,
  "detectedClosingStyle": "formal" | "casual" | "mixed" | null,
  "detectedSignoff": "Yours sincerely," | null,
  "detectedFormalityLevel": "very-formal" | "formal" | "neutral" | "casual" | null,
  "detectedParagraphStructure": "long" | "short" | "mixed" | null,
  "confidence": {
    "sectionOrder": 0.0-1.0,
    "sectionInclusion": 0.0-1.0,
    "sectionVerbosity": 0.0-1.0,
    "phrasingPreferences": 0.0-1.0,
    "avoidedPhrases": 0.0-1.0,
    "vocabularyMap": 0.0-1.0,
    "terminologyLevel": 0.0-1.0,
    "greetingStyle": 0.0-1.0,
    "closingStyle": 0.0-1.0,
    "signoffTemplate": 0.0-1.0,
    "formalityLevel": 0.0-1.0,
    "paragraphStructure": 0.0-1.0
  },
  "phrasePatterns": [
    {
      "phrase": "recommend proceeding with",
      "sectionType": "plan",
      "frequency": 5,
      "action": "preferred"
    }
  ],
  "sectionOrderPatterns": [
    {
      "order": ["history", "examination", "impression", "plan"],
      "frequency": 8
    }
  ],
  "insights": [
    "The physician prefers formal greetings...",
    "Consistently uses brief plan sections...",
    "..."
  ]
}
\`\`\`

Guidelines for confidence scores:
- 0.9-1.0: Very consistent pattern across all edits
- 0.7-0.9: Consistent pattern with minor variations
- 0.5-0.7: Moderate pattern, some variation
- 0.3-0.5: Weak pattern, significant variation
- 0.0-0.3: No clear pattern detected

Only include fields where you detected a pattern. Use null for fields with no clear preference.
For arrays/objects, use empty [] or {} if no patterns detected.
`;

  return prompt;
}

/**
 * System prompt for subspecialty style analysis.
 */
const SUBSPECIALTY_ANALYSIS_SYSTEM_PROMPT = `You are an expert medical writing analyst specializing in identifying physician writing style preferences for specific medical subspecialties.

Your role is to analyze edits made by physicians to AI-generated medical letters and identify consistent patterns in their writing style specific to their subspecialty.

Focus on:
- Concrete, observable patterns (not subjective interpretations)
- Consistency across multiple examples
- Medical writing conventions and terminology specific to the subspecialty
- Australian medical practice standards (if evident)
- Section-level preferences (ordering, inclusion, verbosity)
- Phrase-level preferences (preferred phrases, avoided phrases)
- Word-level preferences (vocabulary substitutions)

Be conservative with confidence scores - only assign high confidence when patterns are clearly consistent across multiple examples.

Provide specific examples to support each detected preference.`;

/**
 * Parse Claude's analysis response into structured data.
 */
function parseSubspecialtyAnalysisResponse(
  content: string,
  userId: string,
  subspecialty: Subspecialty,
  editsAnalyzed: number,
  modelUsed: string
): SubspecialtyStyleAnalysisResult {
  const log = logger.child({ action: 'parseSubspecialtyAnalysisResponse' });

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch?.[1]) {
      throw new Error('No JSON found in Claude response');
    }

    const parsed = JSON.parse(jsonMatch[1]);

    // Build the result with proper type casting
    const result: SubspecialtyStyleAnalysisResult = {
      userId,
      subspecialty,

      // Detected preferences
      detectedSectionOrder: parsed.detectedSectionOrder ?? null,
      detectedSectionInclusion: (parsed.detectedSectionInclusion ?? {}) as SectionInclusionMap,
      detectedSectionVerbosity: (parsed.detectedSectionVerbosity ?? {}) as Record<string, string>,
      detectedPhrasing: (parsed.detectedPhrasing ?? {}) as SectionPhrasingMap,
      detectedAvoidedPhrases: (parsed.detectedAvoidedPhrases ?? {}) as SectionPhrasingMap,
      detectedVocabulary: (parsed.detectedVocabulary ?? {}) as VocabularyMap,
      detectedTerminologyLevel: parsed.detectedTerminologyLevel as TerminologyLevel ?? null,
      detectedGreetingStyle: parsed.detectedGreetingStyle as StyleCategory ?? null,
      detectedClosingStyle: parsed.detectedClosingStyle as StyleCategory ?? null,
      detectedSignoff: parsed.detectedSignoff ?? null,
      detectedFormalityLevel: parsed.detectedFormalityLevel as FormalityLevel ?? null,
      detectedParagraphStructure: parsed.detectedParagraphStructure as ParagraphStructure ?? null,

      // Confidence scores
      confidence: {
        sectionOrder: parsed.confidence?.sectionOrder ?? 0,
        sectionInclusion: parsed.confidence?.sectionInclusion ?? 0,
        sectionVerbosity: parsed.confidence?.sectionVerbosity ?? 0,
        phrasingPreferences: parsed.confidence?.phrasingPreferences ?? 0,
        avoidedPhrases: parsed.confidence?.avoidedPhrases ?? 0,
        vocabularyMap: parsed.confidence?.vocabularyMap ?? 0,
        terminologyLevel: parsed.confidence?.terminologyLevel ?? 0,
        greetingStyle: parsed.confidence?.greetingStyle ?? 0,
        closingStyle: parsed.confidence?.closingStyle ?? 0,
        signoffTemplate: parsed.confidence?.signoffTemplate ?? 0,
        formalityLevel: parsed.confidence?.formalityLevel ?? 0,
        paragraphStructure: parsed.confidence?.paragraphStructure ?? 0,
      },

      // Supporting evidence
      phrasePatterns: (parsed.phrasePatterns ?? []).map((p: {
        phrase: string;
        sectionType: string;
        frequency: number;
        action: string;
      }) => ({
        phrase: p.phrase,
        sectionType: p.sectionType as LetterSectionType,
        frequency: p.frequency,
        action: p.action as 'preferred' | 'avoided',
        examples: [],
      })) as PhrasePattern[],
      sectionOrderPatterns: (parsed.sectionOrderPatterns ?? []) as SectionOrderPattern[],

      // Insights
      insights: parsed.insights ?? [],

      // Metadata
      editsAnalyzed,
      analysisTimestamp: new Date(),
      modelUsed,
    };

    log.info('Subspecialty analysis parsed successfully', {
      sectionOrderDetected: !!result.detectedSectionOrder,
      phrasePatternsCount: result.phrasePatterns.length,
      insightsCount: result.insights.length,
    });

    return result;
  } catch (error) {
    log.error('Failed to parse subspecialty analysis response', { content }, error instanceof Error ? error : undefined);
    throw new Error(`Failed to parse subspecialty analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============ Profile Merging ============

/**
 * Merge new analysis results with an existing profile.
 * Uses weighted averaging based on confidence and sample size.
 */
export function mergeProfileAnalysis(
  existing: SubspecialtyStyleProfile | null,
  analysis: SubspecialtyStyleAnalysisResult
): UpdateSubspecialtyProfileInput {
  // If no existing profile, convert analysis directly to profile input
  if (!existing) {
    return analysisToProfileInput(analysis);
  }

  // Weight based on number of edits analyzed
  const existingWeight = existing.totalEditsAnalyzed;
  const newWeight = analysis.editsAnalyzed;
  const totalWeight = existingWeight + newWeight;

  // Merge confidence scores with weighted average
  const mergedConfidence = mergeConfidenceScores(
    existing.confidence,
    analysis.confidence,
    existingWeight,
    newWeight,
    totalWeight
  );

  // Merge section order (prefer new if higher confidence)
  const newSectionOrderConf = analysis.confidence.sectionOrder ?? 0;
  const existingSectionOrderConf = existing.confidence.sectionOrder ?? 0;
  const mergedSectionOrder =
    newSectionOrderConf > existingSectionOrderConf
      ? analysis.detectedSectionOrder ?? existing.sectionOrder
      : existing.sectionOrder;

  // Merge section inclusion (weighted average for probabilities)
  const mergedSectionInclusion = mergeSectionMaps(
    existing.sectionInclusion,
    analysis.detectedSectionInclusion,
    existingWeight,
    newWeight
  );

  // Merge section verbosity (prefer new if higher confidence)
  const newVerbosityConf = analysis.confidence.sectionVerbosity ?? 0;
  const existingVerbosityConf = existing.confidence.sectionVerbosity ?? 0;
  const mergedSectionVerbosity =
    newVerbosityConf > existingVerbosityConf
      ? { ...existing.sectionVerbosity, ...analysis.detectedSectionVerbosity }
      : existing.sectionVerbosity;

  // Merge phrasing preferences (combine and deduplicate)
  const mergedPhrasing = mergePhrasingMaps(
    existing.phrasingPreferences,
    analysis.detectedPhrasing
  );

  // Merge avoided phrases (combine and deduplicate)
  const mergedAvoidedPhrases = mergePhrasingMaps(
    existing.avoidedPhrases,
    analysis.detectedAvoidedPhrases
  );

  // Merge vocabulary map (new entries override)
  const mergedVocabulary = {
    ...existing.vocabularyMap,
    ...analysis.detectedVocabulary,
  };

  // Merge style indicators (prefer new if higher confidence)
  const newTermConf = analysis.confidence.terminologyLevel ?? 0;
  const existingTermConf = existing.confidence.terminologyLevel ?? 0;
  const mergedTerminologyLevel =
    newTermConf > existingTermConf
      ? analysis.detectedTerminologyLevel
      : existing.terminologyLevel;

  const newGreetConf = analysis.confidence.greetingStyle ?? 0;
  const existingGreetConf = existing.confidence.greetingStyle ?? 0;
  const mergedGreetingStyle =
    newGreetConf > existingGreetConf
      ? analysis.detectedGreetingStyle
      : existing.greetingStyle;

  const newCloseConf = analysis.confidence.closingStyle ?? 0;
  const existingCloseConf = existing.confidence.closingStyle ?? 0;
  const mergedClosingStyle =
    newCloseConf > existingCloseConf
      ? analysis.detectedClosingStyle
      : existing.closingStyle;

  const newSignConf = analysis.confidence.signoffTemplate ?? 0;
  const existingSignConf = existing.confidence.signoffTemplate ?? 0;
  const mergedSignoff =
    newSignConf > existingSignConf
      ? analysis.detectedSignoff
      : existing.signoffTemplate;

  const newFormalConf = analysis.confidence.formalityLevel ?? 0;
  const existingFormalConf = existing.confidence.formalityLevel ?? 0;
  const mergedFormalityLevel =
    newFormalConf > existingFormalConf
      ? analysis.detectedFormalityLevel
      : existing.formalityLevel;

  const newParaConf = analysis.confidence.paragraphStructure ?? 0;
  const existingParaConf = existing.confidence.paragraphStructure ?? 0;
  const mergedParagraphStructure =
    newParaConf > existingParaConf
      ? analysis.detectedParagraphStructure
      : existing.paragraphStructure;

  return {
    sectionOrder: mergedSectionOrder,
    sectionInclusion: mergedSectionInclusion,
    sectionVerbosity: mergedSectionVerbosity,
    phrasingPreferences: mergedPhrasing,
    avoidedPhrases: mergedAvoidedPhrases,
    vocabularyMap: mergedVocabulary,
    terminologyLevel: mergedTerminologyLevel,
    greetingStyle: mergedGreetingStyle,
    closingStyle: mergedClosingStyle,
    signoffTemplate: mergedSignoff,
    formalityLevel: mergedFormalityLevel,
    paragraphStructure: mergedParagraphStructure,
    confidence: mergedConfidence,
  };
}

/**
 * Convert analysis result to profile input (for new profiles).
 */
function analysisToProfileInput(
  analysis: SubspecialtyStyleAnalysisResult
): UpdateSubspecialtyProfileInput {
  return {
    sectionOrder: analysis.detectedSectionOrder ?? [],
    sectionInclusion: analysis.detectedSectionInclusion,
    sectionVerbosity: analysis.detectedSectionVerbosity,
    phrasingPreferences: analysis.detectedPhrasing,
    avoidedPhrases: analysis.detectedAvoidedPhrases,
    vocabularyMap: analysis.detectedVocabulary,
    terminologyLevel: analysis.detectedTerminologyLevel,
    greetingStyle: analysis.detectedGreetingStyle,
    closingStyle: analysis.detectedClosingStyle,
    signoffTemplate: analysis.detectedSignoff,
    formalityLevel: analysis.detectedFormalityLevel,
    paragraphStructure: analysis.detectedParagraphStructure,
    confidence: analysis.confidence,
  };
}

/**
 * Merge confidence scores with weighted averaging.
 */
function mergeConfidenceScores(
  existing: Partial<SubspecialtyConfidenceScores>,
  newScores: Partial<SubspecialtyConfidenceScores>,
  existingWeight: number,
  newWeight: number,
  totalWeight: number
): Partial<SubspecialtyConfidenceScores> {
  const fields: (keyof SubspecialtyConfidenceScores)[] = [
    'sectionOrder',
    'sectionInclusion',
    'sectionVerbosity',
    'phrasingPreferences',
    'avoidedPhrases',
    'vocabularyMap',
    'terminologyLevel',
    'greetingStyle',
    'closingStyle',
    'signoffTemplate',
    'formalityLevel',
    'paragraphStructure',
  ];

  const merged: Partial<SubspecialtyConfidenceScores> = {};

  for (const field of fields) {
    const existingValue = existing[field] ?? 0;
    const newValue = newScores[field] ?? 0;
    merged[field] = (existingValue * existingWeight + newValue * newWeight) / totalWeight;
  }

  return merged;
}

/**
 * Merge section inclusion maps with weighted averaging.
 */
function mergeSectionMaps(
  existing: SectionInclusionMap,
  newMap: SectionInclusionMap,
  existingWeight: number,
  newWeight: number
): SectionInclusionMap {
  const merged: SectionInclusionMap = { ...existing };
  const totalWeight = existingWeight + newWeight;

  for (const [key, value] of Object.entries(newMap)) {
    const sectionKey = key as LetterSectionType;
    const existingValue = existing[sectionKey] ?? 0;
    merged[sectionKey] = (existingValue * existingWeight + value * newWeight) / totalWeight;
  }

  return merged;
}

/**
 * Merge phrasing maps (combine and deduplicate).
 */
function mergePhrasingMaps(
  existing: SectionPhrasingMap,
  newMap: SectionPhrasingMap
): SectionPhrasingMap {
  const merged: SectionPhrasingMap = {};

  // Get all section keys
  const allKeysSet = new Set([
    ...Object.keys(existing),
    ...Object.keys(newMap),
  ]);
  const allKeys = Array.from(allKeysSet);

  for (const key of allKeys) {
    const sectionKey = key as LetterSectionType;
    const existingPhrases = existing[sectionKey] ?? [];
    const newPhrases = newMap[sectionKey] ?? [];

    // Combine and deduplicate, keeping most recent (new) first
    const combined = [...newPhrases, ...existingPhrases];
    const unique = Array.from(new Set(combined));

    // Limit to 20 phrases per section
    merged[sectionKey] = unique.slice(0, 20);
  }

  return merged;
}

// ============ Learning Strength ============

/**
 * Apply learning strength modifier to a profile.
 * Learning strength controls how aggressively preferences are applied:
 * - 0.0 = disabled (no personalization)
 * - 0.5 = moderate (balanced personalization)
 * - 1.0 = full (strong personalization)
 */
export function applyLearningStrength(
  profile: SubspecialtyStyleProfile
): SubspecialtyStyleProfile {
  const strength = profile.learningStrength;

  // If strength is 1.0, return profile unchanged
  if (strength >= 1.0) {
    return profile;
  }

  // If strength is 0.0, return a nearly empty profile
  if (strength <= 0) {
    return {
      ...profile,
      sectionOrder: [],
      sectionInclusion: {},
      sectionVerbosity: {},
      phrasingPreferences: {},
      avoidedPhrases: {},
      vocabularyMap: {},
      confidence: {},
    };
  }

  // Scale down confidence scores by learning strength
  const scaledConfidence: Partial<SubspecialtyConfidenceScores> = {};
  for (const [key, value] of Object.entries(profile.confidence)) {
    if (typeof value === 'number') {
      scaledConfidence[key as keyof SubspecialtyConfidenceScores] = value * strength;
    }
  }

  // Scale section inclusion probabilities towards 0.5 (neutral)
  const scaledSectionInclusion: SectionInclusionMap = {};
  for (const [key, value] of Object.entries(profile.sectionInclusion)) {
    const sectionKey = key as LetterSectionType;
    // Interpolate between 0.5 (neutral) and the learned value
    scaledSectionInclusion[sectionKey] = 0.5 + (value - 0.5) * strength;
  }

  // Limit phrasing preferences based on strength
  const scaledPhrasing: SectionPhrasingMap = {};
  for (const [key, phrases] of Object.entries(profile.phrasingPreferences)) {
    const sectionKey = key as LetterSectionType;
    const limit = Math.max(1, Math.floor(phrases.length * strength));
    scaledPhrasing[sectionKey] = phrases.slice(0, limit);
  }

  // Limit avoided phrases based on strength
  const scaledAvoidedPhrases: SectionPhrasingMap = {};
  for (const [key, phrases] of Object.entries(profile.avoidedPhrases)) {
    const sectionKey = key as LetterSectionType;
    const limit = Math.max(1, Math.floor(phrases.length * strength));
    scaledAvoidedPhrases[sectionKey] = phrases.slice(0, limit);
  }

  // Limit vocabulary map based on strength
  const vocabEntries = Object.entries(profile.vocabularyMap);
  const vocabLimit = Math.max(1, Math.floor(vocabEntries.length * strength));
  const scaledVocabulary: VocabularyMap = {};
  for (let i = 0; i < vocabLimit && i < vocabEntries.length; i++) {
    const entry = vocabEntries[i];
    if (entry) {
      scaledVocabulary[entry[0]] = entry[1];
    }
  }

  return {
    ...profile,
    confidence: scaledConfidence,
    sectionInclusion: scaledSectionInclusion,
    phrasingPreferences: scaledPhrasing,
    avoidedPhrases: scaledAvoidedPhrases,
    vocabularyMap: scaledVocabulary,
  };
}

// ============ Seed Letter Analysis ============

/**
 * Analyze seed letters to bootstrap a style profile.
 * Similar to historical letter analysis but for subspecialty-specific seeding.
 */
export async function analyzeSeedLetters(
  userId: string,
  subspecialty: Subspecialty
): Promise<SubspecialtyStyleAnalysisResult | null> {
  const log = logger.child({ action: 'analyzeSeedLetters', userId, subspecialty });

  // Fetch unanalyzed seed letters
  const seedLetters = await prisma.styleSeedLetter.findMany({
    where: {
      userId,
      subspecialty,
      analyzedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    take: 10, // Limit to 10 seed letters
  });

  if (seedLetters.length === 0) {
    log.info('No seed letters to analyze');
    return null;
  }

  log.info('Analyzing seed letters', { count: seedLetters.length });

  // Build analysis prompt
  const prompt = buildSeedLetterAnalysisPrompt(
    seedLetters.map(sl => sl.letterText),
    subspecialty
  );

  // Run Claude analysis
  const response = await generateTextWithRetry({
    prompt,
    modelId: MODELS.SONNET,
    maxTokens: 4096,
    temperature: 0.2,
    systemPrompt: SEED_LETTER_ANALYSIS_SYSTEM_PROMPT,
  });

  log.info('Seed letter analysis complete', {
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  // Parse response
  const analysis = parseSubspecialtyAnalysisResponse(
    response.content,
    userId,
    subspecialty,
    seedLetters.length,
    response.modelId
  );

  // Mark seed letters as analyzed
  await prisma.styleSeedLetter.updateMany({
    where: {
      id: { in: seedLetters.map(sl => sl.id) },
    },
    data: {
      analyzedAt: new Date(),
    },
  });

  // Get existing profile and merge
  const existingProfile = await getStyleProfile(userId, subspecialty);
  const mergedProfile = mergeProfileAnalysis(existingProfile, analysis);

  // Update profile
  await updateStyleProfile(userId, subspecialty, {
    ...mergedProfile,
    totalEditsAnalyzed: (existingProfile?.totalEditsAnalyzed ?? 0) + seedLetters.length,
    lastAnalyzedAt: new Date(),
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'style.seed_letters_analyzed',
      resourceType: 'style_profile',
      resourceId: `${userId}:${subspecialty}`,
      metadata: {
        subspecialty,
        seedLettersAnalyzed: seedLetters.length,
        modelUsed: response.modelId,
      },
    },
  });

  log.info('Seed letters analyzed and profile updated');

  return analysis;
}

/**
 * Build prompt for seed letter analysis.
 */
function buildSeedLetterAnalysisPrompt(letters: string[], subspecialty: Subspecialty): string {
  let prompt = `Analyze these ${subspecialty} medical letters to learn the physician's writing style.

Below are ${letters.length} complete medical letters written by this physician for ${subspecialty}. Analyze these letters to identify their consistent writing style preferences.

# SAMPLE LETTERS

`;

  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    if (letter) {
      const truncated = truncateText(letter, 2000);
      prompt += `## Letter ${i + 1}\n\n${truncated}\n\n---\n\n`;
    }
  }

  prompt += `
# YOUR ANALYSIS

Provide your analysis in the same JSON format as for edit-based analysis:

\`\`\`json
{
  "detectedSectionOrder": [...],
  "detectedSectionInclusion": {...},
  "detectedSectionVerbosity": {...},
  "detectedPhrasing": {...},
  "detectedAvoidedPhrases": {...},
  "detectedVocabulary": {...},
  "detectedTerminologyLevel": "specialist" | "lay" | "mixed" | null,
  "detectedGreetingStyle": "formal" | "casual" | "mixed" | null,
  "detectedClosingStyle": "formal" | "casual" | "mixed" | null,
  "detectedSignoff": "..." | null,
  "detectedFormalityLevel": "very-formal" | "formal" | "neutral" | "casual" | null,
  "detectedParagraphStructure": "long" | "short" | "mixed" | null,
  "confidence": {...},
  "phrasePatterns": [...],
  "sectionOrderPatterns": [...],
  "insights": [...]
}
\`\`\`

Since these are complete letters (not before/after edits), focus on:
- Consistent structural patterns
- Recurring phrases and terminology
- Section ordering and inclusion
- Sign-off patterns
- Overall tone and formality

Be conservative with confidence scores - they should be lower than edit-based analysis since we're inferring from examples rather than seeing explicit changes.
`;

  return prompt;
}

/**
 * System prompt for seed letter analysis.
 */
const SEED_LETTER_ANALYSIS_SYSTEM_PROMPT = `You are an expert medical writing analyst specializing in identifying physician writing style preferences from their historical letters.

Your role is to analyze complete medical letters written by a physician to identify their consistent writing style patterns.

Focus on:
- Concrete, observable patterns (not subjective interpretations)
- Consistency across multiple letters
- Medical writing conventions and terminology
- Section structure and ordering
- Phrase patterns and vocabulary
- Sign-off and formality conventions

Be conservative with confidence scores since you're inferring from examples rather than seeing explicit editing preferences. Only assign high confidence when patterns are clearly consistent across multiple letters.`;

// ============ Helper Functions ============

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Get the count of edits since the last analysis.
 */
export async function getEditCountSinceLastAnalysis(
  userId: string,
  subspecialty: Subspecialty
): Promise<number> {
  const profile = await getStyleProfile(userId, subspecialty);

  if (!profile) {
    // No profile yet - count all edits
    return prisma.styleEdit.count({
      where: { userId, subspecialty },
    });
  }

  // Count edits since last analysis
  const lastAnalyzedAt = profile.lastAnalyzedAt;

  if (!lastAnalyzedAt) {
    return prisma.styleEdit.count({
      where: { userId, subspecialty },
    });
  }

  return prisma.styleEdit.count({
    where: {
      userId,
      subspecialty,
      createdAt: { gt: lastAnalyzedAt },
    },
  });
}
