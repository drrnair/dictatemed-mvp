// src/domains/style/style.service.ts
// Service for managing physician writing style learning and application

import type { Subspecialty } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import { analyzeEditsForStyle, mergeStyleAnalysis, analyzeLettersForStyle } from './style-analyzer';
import type {
  StyleProfile,
  StyleEdit,
  StyleAnalysisResult,
  StyleHints,
  AnalyzeStyleRequest,
} from './style.types';

/**
 * Record an edit made by a physician for style learning.
 * Stores the before/after text and computes metadata for analysis.
 *
 * This is the legacy global style recording function. For per-subspecialty
 * style learning, use `recordSubspecialtyEdits` from `learning-pipeline.ts`
 * which is automatically called during letter approval.
 *
 * The optional `subspecialty` parameter allows associating edits with a
 * specific subspecialty for the new per-subspecialty learning system.
 */
export async function recordEdit(
  userId: string,
  letterId: string,
  beforeText: string,
  afterText: string,
  sectionType?: 'greeting' | 'history' | 'examination' | 'impression' | 'plan' | 'closing' | 'other',
  subspecialty?: Subspecialty
): Promise<StyleEdit> {
  const log = logger.child({ action: 'recordEdit', userId, letterId });

  // Compute edit metadata
  const editType = determineEditType(beforeText, afterText);
  const characterChanges = Math.abs(afterText.length - beforeText.length);
  const wordChanges = Math.abs(
    afterText.split(/\s+/).length - beforeText.split(/\s+/).length
  );

  // Store edit in database
  const styleEdit = await prisma.styleEdit.create({
    data: {
      userId,
      letterId,
      beforeText,
      afterText,
      editType,
      sectionType: sectionType ?? 'other',
      characterChanges,
      wordChanges,
      subspecialty: subspecialty ?? null,
    },
  });

  log.info('Style edit recorded', {
    editId: styleEdit.id,
    editType,
    characterChanges,
    wordChanges,
    subspecialty: subspecialty ?? null,
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'style.edit_recorded',
      resourceType: 'style_edit',
      resourceId: styleEdit.id,
      metadata: {
        letterId,
        editType,
        characterChanges,
        wordChanges,
        subspecialty: subspecialty ?? null,
      },
    },
  });

  return mapStyleEdit(styleEdit);
}

/**
 * Analyze all edits for a user to update their style profile.
 * Uses Claude to detect patterns and preferences.
 */
export async function analyzeStyle(
  request: AnalyzeStyleRequest
): Promise<StyleProfile> {
  const log = logger.child({ action: 'analyzeStyle', userId: request.userId });

  const minEdits = request.minEdits ?? 5;
  const maxEdits = request.maxEdits ?? 50;

  // Fetch recent edits for analysis
  const edits = await prisma.styleEdit.findMany({
    where: { userId: request.userId },
    orderBy: { createdAt: 'desc' },
    take: maxEdits,
  });

  if (edits.length < minEdits) {
    log.warn('Insufficient edits for style analysis', {
      editCount: edits.length,
      minRequired: minEdits,
    });
    throw new Error(
      `Insufficient edits for analysis. Need at least ${minEdits}, found ${edits.length}.`
    );
  }

  log.info('Starting style analysis', { editCount: edits.length });

  // Analyze edits with Claude
  const analysis = await analyzeEditsForStyle(edits.map(mapStyleEdit));

  // Get existing style profile
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { styleProfile: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Parse existing profile
  const existingProfile = user.styleProfile as Record<string, unknown>;
  const existingAnalysis = existingProfile.lastAnalysis as StyleAnalysisResult | null;

  // Merge with existing analysis if present
  const mergedAnalysis = existingAnalysis
    ? mergeStyleAnalysis(existingAnalysis, analysis)
    : analysis;

  // Convert analysis to style profile
  const styleProfile = analysisToProfile(mergedAnalysis);

  // Update user's style profile
  await prisma.user.update({
    where: { id: request.userId },
    data: {
      styleProfile: {
        ...styleProfile,
        lastAnalysis: mergedAnalysis, // Store raw analysis for future merging
      } as never,
    },
  });

  log.info('Style profile updated', {
    totalEditsAnalyzed: styleProfile.totalEditsAnalyzed,
    confidenceScores: styleProfile.confidence,
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: request.userId,
      action: 'style.profile_updated',
      resourceType: 'user',
      resourceId: request.userId,
      metadata: {
        editsAnalyzed: analysis.editsAnalyzed,
        totalEditsAnalyzed: styleProfile.totalEditsAnalyzed,
        confidence: styleProfile.confidence,
      },
    },
  });

  return styleProfile;
}

/**
 * Analyze historical letters uploaded by a physician to bootstrap their style profile.
 * This allows style learning without requiring edit-based learning first.
 */
export async function analyzeHistoricalLetters(
  userId: string,
  letterTexts: string[]
): Promise<{ profileUpdated: boolean; profile: StyleProfile | null }> {
  const log = logger.child({ action: 'analyzeHistoricalLetters', userId });

  if (letterTexts.length === 0) {
    throw new Error('No letters provided for analysis');
  }

  log.info('Starting historical letter analysis', { letterCount: letterTexts.length });

  // Analyze letters with Claude
  const analysis = await analyzeLettersForStyle(letterTexts);

  // Get existing style profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { styleProfile: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Parse existing profile
  const existingProfile = user.styleProfile as Record<string, unknown>;
  const existingAnalysis = existingProfile?.lastAnalysis as StyleAnalysisResult | null;

  // Merge with existing analysis if present
  const mergedAnalysis = existingAnalysis
    ? mergeStyleAnalysis(existingAnalysis, analysis)
    : analysis;

  // Convert analysis to style profile
  const styleProfile = analysisToProfile(mergedAnalysis);

  // Update user's style profile
  await prisma.user.update({
    where: { id: userId },
    data: {
      styleProfile: {
        ...styleProfile,
        lastAnalysis: mergedAnalysis,
        historicalLettersAnalyzed: letterTexts.length,
      } as never,
    },
  });

  log.info('Historical letter analysis completed', {
    lettersAnalyzed: letterTexts.length,
    totalEditsAnalyzed: styleProfile.totalEditsAnalyzed,
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'style.historical_letters_analyzed',
      resourceType: 'user',
      resourceId: userId,
      metadata: {
        lettersAnalyzed: letterTexts.length,
        confidence: styleProfile.confidence,
      },
    },
  });

  return {
    profileUpdated: true,
    profile: styleProfile,
  };
}

/**
 * Get the current style profile for a user.
 */
export async function getStyleProfile(userId: string): Promise<StyleProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { styleProfile: true },
  });

  if (!user) {
    return null;
  }

  const profileData = user.styleProfile as Record<string, unknown>;

  // Check if profile exists and has been analyzed
  if (!profileData.lastAnalyzedAt) {
    return null;
  }

  return profileData as unknown as StyleProfile;
}

/**
 * Generate style hints to augment letter generation prompts.
 * Converts the learned style profile into actionable guidance.
 */
export async function applyStyleHints(
  userId: string,
  prompt: string
): Promise<{ enhancedPrompt: string; hints: StyleHints }> {
  const profile = await getStyleProfile(userId);

  if (!profile) {
    // No style profile yet, return original prompt
    return {
      enhancedPrompt: prompt,
      hints: {},
    };
  }

  // Build style hints from profile
  const hints = buildStyleHints(profile);

  // Enhance prompt with style guidance
  const styleGuidance = formatStyleGuidance(hints);
  const enhancedPrompt = `${prompt}\n\n# PHYSICIAN STYLE PREFERENCES\n\n${styleGuidance}`;

  logger.info('Style hints applied', {
    userId,
    hintsApplied: Object.keys(hints).filter((k) => hints[k as keyof StyleHints]).length,
  });

  return {
    enhancedPrompt,
    hints,
  };
}

/**
 * Get edit statistics for a user.
 */
export async function getEditStatistics(userId: string): Promise<{
  totalEdits: number;
  editsLast7Days: number;
  editsLast30Days: number;
  lastEditDate: Date | null;
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalEdits, editsLast7Days, editsLast30Days, lastEdit] = await Promise.all([
    prisma.styleEdit.count({
      where: { userId },
    }),
    prisma.styleEdit.count({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.styleEdit.count({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.styleEdit.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    totalEdits,
    editsLast7Days,
    editsLast30Days,
    lastEditDate: lastEdit?.createdAt ?? null,
  };
}

// ============ Helper Functions ============

/**
 * Determine the type of edit based on before/after text.
 */
function determineEditType(
  before: string,
  after: string
): 'addition' | 'deletion' | 'modification' | 'formatting' {
  if (!before && after) return 'addition';
  if (before && !after) return 'deletion';

  const beforeNorm = before.trim().replace(/\s+/g, ' ');
  const afterNorm = after.trim().replace(/\s+/g, ' ');

  // Check if only whitespace/formatting changed
  if (beforeNorm.replace(/\s/g, '') === afterNorm.replace(/\s/g, '')) {
    return 'formatting';
  }

  return 'modification';
}

/**
 * Map Prisma StyleEdit to domain type.
 */
function mapStyleEdit(edit: {
  id: string;
  userId: string;
  letterId: string;
  beforeText: string;
  afterText: string;
  editType: string;
  sectionType: string | null;
  characterChanges: number;
  wordChanges: number;
  createdAt: Date;
}): StyleEdit {
  return {
    id: edit.id,
    userId: edit.userId,
    letterId: edit.letterId,
    beforeText: edit.beforeText,
    afterText: edit.afterText,
    editType: edit.editType as StyleEdit['editType'],
    sectionType: edit.sectionType as StyleEdit['sectionType'],
    characterChanges: edit.characterChanges,
    wordChanges: edit.wordChanges,
    createdAt: edit.createdAt,
  };
}

/**
 * Convert StyleAnalysisResult to StyleProfile.
 */
function analysisToProfile(analysis: StyleAnalysisResult): StyleProfile {
  return {
    greetingStyle: analysis.detectedPreferences.greetingStyle ?? null,
    greetingExamples: analysis.examples.greeting?.map((e) => e.after),
    closingStyle: analysis.detectedPreferences.closingStyle ?? null,
    closingExamples: analysis.examples.closing?.map((e) => e.after),
    paragraphStructure: analysis.detectedPreferences.paragraphStructure ?? null,
    medicationFormat: analysis.detectedPreferences.medicationFormat ?? null,
    medicationExamples: analysis.examples.medication?.map((e) => ({
      before: e.before,
      after: e.after,
    })),
    clinicalValueFormat: analysis.detectedPreferences.clinicalValueFormat ?? null,
    clinicalValueExamples: analysis.examples.clinicalValue?.map((e) => ({
      before: e.before,
      after: e.after,
    })),
    formalityLevel: analysis.detectedPreferences.formalityLevel ?? null,
    sentenceComplexity: analysis.detectedPreferences.sentenceComplexity ?? null,
    vocabularyPreferences: analysis.vocabularyMap,
    sectionOrder: analysis.preferredSectionOrder,
    confidence: analysis.confidence,
    totalEditsAnalyzed: analysis.editsAnalyzed,
    lastAnalyzedAt: analysis.analysisTimestamp,
    lastUpdatedAt: new Date(),
  };
}

/**
 * Build style hints from a style profile.
 * Only includes preferences with confidence >= 0.6
 */
function buildStyleHints(profile: StyleProfile): StyleHints {
  const hints: StyleHints = {};

  // Greeting style
  if (profile.greetingStyle && profile.confidence.greetingStyle >= 0.6) {
    const examples = profile.greetingExamples?.slice(0, 2).join(' or ') ?? '';
    hints.greeting = `Use a ${profile.greetingStyle} greeting${examples ? ` like: ${examples}` : ''}`;
  }

  // Closing style
  if (profile.closingStyle && profile.confidence.closingStyle >= 0.6) {
    const examples = profile.closingExamples?.slice(0, 2).join(' or ') ?? '';
    hints.closing = `Use a ${profile.closingStyle} closing${examples ? ` like: ${examples}` : ''}`;
  }

  // Paragraph structure
  if (profile.paragraphStructure && profile.confidence.paragraphStructure >= 0.6) {
    if (profile.paragraphStructure === 'short') {
      hints.paragraphLength = 'Keep paragraphs concise (2-3 sentences each)';
    } else if (profile.paragraphStructure === 'long') {
      hints.paragraphLength = 'Use longer, more detailed paragraphs';
    }
  }

  // Medication format
  if (profile.medicationFormat && profile.confidence.medicationFormat >= 0.6) {
    if (profile.medicationFormat === 'generic') {
      hints.medicationFormat = 'Use generic medication names only (e.g., "atorvastatin" not "Lipitor")';
    } else if (profile.medicationFormat === 'brand') {
      hints.medicationFormat = 'Use brand medication names where appropriate';
    } else {
      hints.medicationFormat = 'Use both generic and brand medication names';
    }
  }

  // Clinical value format
  if (profile.clinicalValueFormat && profile.confidence.clinicalValueFormat >= 0.6) {
    if (profile.clinicalValueFormat === 'concise') {
      hints.clinicalValueFormat = 'Use concise clinical value format (e.g., "LVEF 55%" not "LVEF of 55%")';
    } else {
      hints.clinicalValueFormat = 'Use verbose clinical value format with connecting words';
    }
  }

  // Formality level
  if (profile.formalityLevel && profile.confidence.formalityLevel >= 0.6) {
    hints.formality = `Maintain a ${profile.formalityLevel.replace('-', ' ')} tone throughout`;
  }

  // Vocabulary preferences
  if (profile.vocabularyPreferences && Object.keys(profile.vocabularyPreferences).length > 0) {
    const vocabExamples = Object.entries(profile.vocabularyPreferences)
      .slice(0, 5)
      .map(([from, to]) => `"${to}" instead of "${from}"`)
      .join(', ');
    hints.vocabulary = `Vocabulary preferences: use ${vocabExamples}`;
  }

  // Section order
  if (profile.sectionOrder && profile.sectionOrder.length > 0) {
    hints.sectionOrder = `Follow this section order: ${profile.sectionOrder.join(', ')}`;
  }

  // General guidance
  const avgConfidence = Object.values(profile.confidence).reduce((a, b) => a + b, 0) / Object.values(profile.confidence).length;
  if (avgConfidence >= 0.7) {
    hints.generalGuidance = `This physician has a well-established writing style (${profile.totalEditsAnalyzed} edits analyzed). Follow the above preferences closely.`;
  } else if (avgConfidence >= 0.5) {
    hints.generalGuidance = `Writing style preferences are emerging (${profile.totalEditsAnalyzed} edits analyzed). Follow the above preferences where clear.`;
  }

  return hints;
}

/**
 * Format style hints as a string for prompt enhancement.
 */
function formatStyleGuidance(hints: StyleHints): string {
  const sections: string[] = [];

  if (hints.greeting) sections.push(`• ${hints.greeting}`);
  if (hints.closing) sections.push(`• ${hints.closing}`);
  if (hints.paragraphLength) sections.push(`• ${hints.paragraphLength}`);
  if (hints.medicationFormat) sections.push(`• ${hints.medicationFormat}`);
  if (hints.clinicalValueFormat) sections.push(`• ${hints.clinicalValueFormat}`);
  if (hints.formality) sections.push(`• ${hints.formality}`);
  if (hints.vocabulary) sections.push(`• ${hints.vocabulary}`);
  if (hints.sectionOrder) sections.push(`• ${hints.sectionOrder}`);
  if (hints.generalGuidance) sections.push(`\n${hints.generalGuidance}`);

  return sections.join('\n');
}
