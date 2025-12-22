// src/domains/letters/letter.service.ts
// Letter generation domain service

import { prisma } from '@/infrastructure/db/client';
import { generateTextWithRetry, type ModelId } from '@/infrastructure/bedrock';
import { logger } from '@/lib/logger';
import type { Letter as PrismaLetterModel, Subspecialty } from '@prisma/client';
import type {
  Letter,
  LetterType,
  LetterStatus,
  SourceAnchor,
  ClinicalValue,
  HallucinationFlag,
  ClinicalConcepts,
} from './letter.types';
import type { LetterSources } from './prompts/generation';
import { LETTER_PROMPTS } from './prompts/generation';
import { selectModel } from './model-selection';
import { obfuscatePHI, deobfuscatePHI, validateObfuscation, type PHI } from './phi-obfuscation';
import { parseSourceAnchors, validateClinicalSources, generateSourceSummary } from './source-anchoring';
import { extractClinicalValues, calculateVerificationRate } from './clinical-extraction';
import { detectHallucinations, calculateHallucinationRisk, recommendApproval } from './hallucination-detection';
import { extractClinicalConcepts, getICD10Codes, getMBSItems } from './clinical-concepts';
import { getEffectivePromptTemplate, recordTemplateUsage } from './templates/template.service';
import { buildStyleConditionedPrompt, computeOverallConfidence } from '../style/prompt-conditioner';

export interface GenerateLetterInput {
  patientId: string;
  letterType: LetterType;
  sources: LetterSources;
  phi: PHI;
  userPreference?: 'quality' | 'balanced' | 'cost' | undefined;
  templateId?: string | undefined; // Optional template for enhanced generation
  subspecialty?: Subspecialty | undefined; // Optional subspecialty for style conditioning
}

export interface GenerateLetterResult {
  id: string;
  letterText: string;
  status: LetterStatus;
  modelUsed: string;
  sourceAnchors: SourceAnchor[];
  clinicalValues: ClinicalValue[];
  hallucinationFlags: HallucinationFlag[];
  clinicalConcepts: ClinicalConcepts;
  verificationRate: number;
  hallucinationRisk: number;
  recommendation: {
    shouldApprove: boolean;
    reason: string;
  };
}

/**
 * Generate a letter using AI.
 *
 * This orchestrates the entire letter generation pipeline:
 * 1. Select appropriate model
 * 2. Obfuscate PHI in sources
 * 3. Build prompt
 * 4. Generate letter via Bedrock
 * 5. Deobfuscate PHI in generated text
 * 6. Parse source anchors
 * 7. Extract clinical values
 * 8. Detect hallucinations
 * 9. Extract clinical concepts
 * 10. Save to database
 */
export async function generateLetter(
  userId: string,
  input: GenerateLetterInput
): Promise<GenerateLetterResult> {
  const log = logger.child({ userId, action: 'generateLetter', letterType: input.letterType });

  // Step 1: Select model
  const modelSelection = selectModel({
    letterType: input.letterType,
    sources: input.sources,
    userPreference: input.userPreference,
  });

  log.info('Model selected', {
    modelId: modelSelection.modelId,
    reason: modelSelection.reason,
    estimatedCost: modelSelection.estimatedCostUSD,
  });

  // Step 2: Obfuscate PHI in sources
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const obfuscatedSources = obfuscateSourcesPHI(input.sources, input.phi, sessionId);

  // Validate obfuscation
  const transcriptValidation = input.sources.transcript
    ? validateObfuscation(obfuscatedSources.transcript?.text ?? '', input.phi)
    : { isSafe: true, leakedPHI: [] };

  if (!transcriptValidation.isSafe) {
    log.error('PHI obfuscation failed', { leakedPHI: transcriptValidation.leakedPHI });
    throw new Error(`PHI obfuscation failed: ${transcriptValidation.leakedPHI.join(', ')}`);
  }

  // Step 3: Build prompt (with optional template and style enhancements)
  const promptBuilder = LETTER_PROMPTS[input.letterType];
  if (!promptBuilder) {
    throw new Error(`No prompt builder for letter type: ${input.letterType}`);
  }

  // Get template prompt if templateId is provided
  let templateContext: string | null = null;
  let templateSubspecialty: Subspecialty | null = null;
  if (input.templateId) {
    const templateData = await getEffectivePromptTemplate(userId, input.templateId);
    if (templateData) {
      templateContext = templateData.promptTemplate;
      // Check if template has subspecialties for style profile inference
      const template = await prisma.letterTemplate.findUnique({
        where: { id: input.templateId },
        select: { subspecialties: true },
      });
      if (template?.subspecialties && template.subspecialties.length > 0) {
        templateSubspecialty = template.subspecialties[0] ?? null;
      }
      log.info('Using template', { templateId: input.templateId, templateSubspecialty });
    } else {
      log.warn('Template not found, proceeding without template context', {
        templateId: input.templateId,
      });
    }
  }

  // Determine effective subspecialty for style conditioning
  // Priority: explicit input → template subspecialty → null (falls back to global profile)
  const effectiveSubspecialty = input.subspecialty ?? templateSubspecialty ?? undefined;

  // Build base prompt (pass null for styleContext - we'll apply style via prompt conditioner)
  let prompt = promptBuilder(
    obfuscatedSources,
    {
      nameToken: obfuscatedSources.deobfuscationMap.tokens.nameToken,
      dobToken: obfuscatedSources.deobfuscationMap.tokens.dobToken,
      medicareToken: obfuscatedSources.deobfuscationMap.tokens.medicareToken,
      genderToken: obfuscatedSources.deobfuscationMap.tokens.genderToken,
    },
    null // No legacy style context - we use subspecialty profiles and prompt conditioner
  );

  // Append template-specific instructions if available
  if (templateContext) {
    prompt = `${prompt}\n\n# TEMPLATE-SPECIFIC INSTRUCTIONS\n\n${templateContext}`;
  }

  // Apply subspecialty-aware style conditioning
  // This uses the fallback chain: subspecialty profile → global profile → default
  const { enhancedPrompt, config: styleConfig } = await buildStyleConditionedPrompt({
    basePrompt: prompt,
    userId,
    subspecialty: effectiveSubspecialty,
    letterType: input.letterType,
  });

  prompt = enhancedPrompt;

  // Calculate style confidence from the profile used for conditioning
  const styleConfidenceValue = styleConfig.profile
    ? computeOverallConfidence(styleConfig.profile)
    : undefined;

  log.info('Prompt built', {
    promptLength: prompt.length,
    estimatedTokens: modelSelection.estimatedInputTokens,
    styleSource: styleConfig.source,
    styleConfidence: styleConfidenceValue,
    subspecialty: effectiveSubspecialty ?? null,
  });

  // Step 4: Generate letter via Bedrock
  const startTime = Date.now();
  const response = await generateTextWithRetry({
    prompt,
    modelId: modelSelection.modelId,
    maxTokens: modelSelection.maxTokens,
    temperature: modelSelection.temperature,
  });

  const generationDuration = Date.now() - startTime;

  log.info('Letter generated', {
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    durationMs: generationDuration,
  });

  // Step 5: Deobfuscate PHI in generated letter
  const letterWithPHI = deobfuscatePHI(response.content, obfuscatedSources.deobfuscationMap);

  // Step 6: Parse source anchors
  const { anchors, letterWithoutAnchors, unverifiedAnchors } = parseSourceAnchors(
    letterWithPHI,
    input.sources
  );

  if (unverifiedAnchors.length > 0) {
    log.warn('Unverified source anchors detected', { count: unverifiedAnchors.length });
  }

  // Step 7: Extract clinical values
  const clinicalValues = extractClinicalValues(letterWithPHI, anchors);
  const verificationRate = calculateVerificationRate(clinicalValues);

  // Step 8: Detect hallucinations
  const hallucinationFlags = detectHallucinations(
    letterWithPHI,
    input.sources,
    anchors,
    clinicalValues
  );
  const hallucinationRisk = calculateHallucinationRisk(hallucinationFlags);
  const approvalRecommendation = recommendApproval(hallucinationFlags);

  // Step 9: Extract clinical concepts
  const clinicalConcepts = extractClinicalConcepts(letterWithPHI);

  // Step 10: Validate clinical sources
  const sourceValidation = validateClinicalSources(letterWithPHI, anchors);
  if (!sourceValidation.isValid) {
    log.warn('Clinical source validation failed', {
      coverage: sourceValidation.coverage,
      unsourcedCount: sourceValidation.unsourcedStatements.length,
    });
  }

  // Step 11: Save to database (using Prisma field names)
  const letter = await prisma.letter.create({
    data: {
      userId,
      patientId: input.patientId,
      templateId: input.templateId, // Link to template if used
      letterType: input.letterType,
      subspecialty: effectiveSubspecialty ?? null, // Store subspecialty for style learning
      status: 'DRAFT',
      contentDraft: letterWithoutAnchors, // Prisma uses contentDraft, not draftContent
      sourceAnchors: anchors as never[],
      extractedValues: clinicalValues as never[], // Prisma uses extractedValues, not clinicalValues
      hallucinationFlags: hallucinationFlags as never[],
      clinicalConcepts: clinicalConcepts as never,
      primaryModel: response.modelId, // Prisma uses primaryModel, not modelUsed
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      generationDurationMs: generationDuration,
      verificationRate: verificationRate.rate,
      hallucinationRiskScore: hallucinationRisk.score,
      styleConfidence: styleConfidenceValue ?? null, // Style profile confidence used for conditioning
      generatedAt: new Date(),
    },
  });

  // Record template usage for recommendations
  if (input.templateId) {
    await recordTemplateUsage(userId, input.templateId);
  }

  log.info('Letter saved', {
    letterId: letter.id,
    status: letter.status,
    verificationRate: verificationRate.rate,
    hallucinationRisk: hallucinationRisk.score,
    subspecialty: effectiveSubspecialty ?? null,
    styleSource: styleConfig.source,
    styleConfidence: styleConfidenceValue ?? null,
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'letter.generate',
      resourceType: 'letter',
      resourceId: letter.id,
      metadata: {
        letterType: input.letterType,
        subspecialty: effectiveSubspecialty ?? null,
        modelUsed: response.modelId,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        hallucinationRisk: hallucinationRisk.level,
        styleSource: styleConfig.source,
        styleConfidence: styleConfidenceValue ?? null,
      },
    },
  });

  return {
    id: letter.id,
    letterText: letterWithoutAnchors,
    status: 'DRAFT',
    modelUsed: response.modelId,
    sourceAnchors: anchors,
    clinicalValues,
    hallucinationFlags,
    clinicalConcepts,
    verificationRate: verificationRate.rate,
    hallucinationRisk: hallucinationRisk.score,
    recommendation: {
      shouldApprove: approvalRecommendation.shouldApprove,
      reason: approvalRecommendation.reason,
    },
  };
}

/**
 * Obfuscate PHI in all sources.
 */
function obfuscateSourcesPHI(
  sources: LetterSources,
  phi: PHI,
  sessionId: string
): LetterSources & { deobfuscationMap: { tokens: { nameToken: string; dobToken: string; medicareToken: string; genderToken: string }; phi: PHI } } {
  const obfuscatedSources: LetterSources = {};
  let deobfuscationMap: { tokens: { nameToken: string; dobToken: string; medicareToken: string; genderToken: string }; phi: PHI } | null = null;

  // Obfuscate transcript
  if (sources.transcript) {
    const obfuscated = obfuscatePHI(sources.transcript.text, phi, sessionId);
    deobfuscationMap = obfuscated.deobfuscationMap;

    obfuscatedSources.transcript = {
      ...sources.transcript,
      text: obfuscated.obfuscatedText,
      // Also obfuscate speaker segments if present
      speakers: sources.transcript.speakers?.map((segment) => ({
        ...segment,
        text: obfuscatePHI(segment.text, phi, sessionId).obfuscatedText,
      })),
    };
  }

  // Obfuscate documents (raw text only, extracted data should already be obfuscated)
  if (sources.documents) {
    obfuscatedSources.documents = sources.documents.map((doc) => ({
      ...doc,
      rawText: doc.rawText ? obfuscatePHI(doc.rawText, phi, sessionId).obfuscatedText : undefined,
    }));
  }

  // Obfuscate user input
  if (sources.userInput) {
    const obfuscated = obfuscatePHI(sources.userInput.text, phi, sessionId);
    if (!deobfuscationMap) {
      deobfuscationMap = obfuscated.deobfuscationMap;
    }

    obfuscatedSources.userInput = {
      ...sources.userInput,
      text: obfuscated.obfuscatedText,
    };
  }

  // Ensure we have a deobfuscation map
  if (!deobfuscationMap) {
    const fallback = obfuscatePHI('', phi, sessionId);
    deobfuscationMap = fallback.deobfuscationMap;
  }

  return {
    ...obfuscatedSources,
    deobfuscationMap,
  };
}

/**
 * Get a letter by ID.
 */
export async function getLetter(userId: string, letterId: string): Promise<Letter | null> {
  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId },
  });

  if (!letter) {
    return null;
  }

  return mapPrismaLetter(letter);
}

/**
 * List letters for a patient.
 */
export async function listLetters(
  userId: string,
  patientId: string
): Promise<Letter[]> {
  const letters = await prisma.letter.findMany({
    where: { userId, patientId },
    orderBy: { createdAt: 'desc' },
  });

  return letters.map(mapPrismaLetter);
}

/**
 * Update letter content (after physician edits).
 */
export async function updateLetterContent(
  userId: string,
  letterId: string,
  content: string
): Promise<Letter> {
  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId },
  });

  if (!letter) {
    throw new Error('Letter not found');
  }

  if (letter.status === 'APPROVED') {
    throw new Error('Cannot edit approved letter');
  }

  const updated = await prisma.letter.update({
    where: { id: letterId },
    data: {
      contentDraft: content, // Prisma uses contentDraft
      status: 'IN_REVIEW',   // Prisma uses IN_REVIEW (not REVIEWING)
      reviewStartedAt: letter.reviewStartedAt ?? new Date(), // Track first review start
    },
  });

  logger.info('Letter content updated', { letterId, userId });

  return mapPrismaLetter(updated);
}

/**
 * Approve a letter for sending.
 *
 * @deprecated Use approveLetter from approval.service.ts for full workflow with provenance
 */
export async function approveLetter(
  userId: string,
  letterId: string
): Promise<Letter> {
  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId },
  });

  if (!letter) {
    throw new Error('Letter not found');
  }

  if (letter.status === 'APPROVED') {
    throw new Error('Letter already approved');
  }

  const updated = await prisma.letter.update({
    where: { id: letterId },
    data: {
      status: 'APPROVED',
      contentFinal: letter.contentDraft, // Prisma uses contentFinal (not approvedContent)
      approvedAt: new Date(),
      approvedBy: userId,
    },
  });

  logger.info('Letter approved', { letterId, userId });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'letter.approve',
      resourceType: 'letter',
      resourceId: letterId,
      metadata: {
        letterType: letter.letterType,
      },
    },
  });

  return mapPrismaLetter(updated);
}

/**
 * Map Prisma model to domain type.
 * Uses Prisma's generated types for type safety.
 */
function mapPrismaLetter(record: PrismaLetterModel): Letter {
  // Cast JSON fields through unknown to avoid type mismatch with Prisma's JsonValue
  const sourceAnchors = record.sourceAnchors as unknown as SourceAnchor[] | null;
  const extractedValues = record.extractedValues as unknown as ClinicalValue[] | null;
  const hallucinationFlags = record.hallucinationFlags as unknown as HallucinationFlag[] | null;
  const clinicalConcepts = record.clinicalConcepts as unknown as ClinicalConcepts | null;

  return {
    id: record.id,
    userId: record.userId,
    patientId: record.patientId ?? undefined,
    recordingId: record.recordingId ?? undefined,
    letterType: record.letterType as LetterType,
    subspecialty: record.subspecialty ?? undefined,
    status: record.status as LetterStatus,
    contentDraft: record.contentDraft ?? undefined,
    contentFinal: record.contentFinal ?? undefined,
    sourceAnchors: sourceAnchors ?? [],
    extractedValues: extractedValues ?? [],
    hallucinationFlags: hallucinationFlags ?? [],
    clinicalConcepts: clinicalConcepts ?? {
      diagnoses: [],
      procedures: [],
      medications: [],
      findings: [],
      riskFactors: [],
    },
    verificationRate: record.verificationRate ?? undefined,
    hallucinationRiskScore: record.hallucinationRiskScore ?? undefined,
    primaryModel: record.primaryModel ?? undefined,
    criticModel: record.criticModel ?? undefined,
    styleConfidence: record.styleConfidence ?? undefined,
    inputTokens: record.inputTokens ?? undefined,
    outputTokens: record.outputTokens ?? undefined,
    generationDurationMs: record.generationDurationMs ?? undefined,
    generatedAt: record.generatedAt ?? undefined,
    reviewStartedAt: record.reviewStartedAt ?? undefined,
    approvedAt: record.approvedAt ?? undefined,
    approvedBy: record.approvedBy ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
