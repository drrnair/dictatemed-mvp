// src/domains/letters/model-selection.ts
// Intelligent model selection for letter generation

import { MODELS, type ModelId, estimateCost, estimateTokenCount } from '@/infrastructure/bedrock';
import type { LetterType } from './letter.types';
import type { LetterSources } from './prompts/generation';
import { logger } from '@/lib/logger';
import {
  LETTER_COMPLEXITY,
  LETTER_OUTPUT_TOKENS,
  AI_MODEL,
  TOKEN_ESTIMATION,
} from '@/lib/constants';

export interface ModelSelectionInput {
  letterType: LetterType;
  sources: LetterSources;
  userPreference?: 'quality' | 'balanced' | 'cost' | undefined;
}

export interface ModelSelectionResult {
  modelId: ModelId;
  reason: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
  maxTokens: number;
  temperature: number;
}

/**
 * Complexity score for different letter types.
 * Higher score = more complex = prefer Opus.
 * Values come from LETTER_COMPLEXITY constants.
 */
const LETTER_COMPLEXITY_SCORES: Record<LetterType, number> = {
  NEW_PATIENT: LETTER_COMPLEXITY.NEW_PATIENT,
  ANGIOGRAM_PROCEDURE: LETTER_COMPLEXITY.ANGIOGRAM_PROCEDURE,
  ECHO_REPORT: LETTER_COMPLEXITY.ECHO_REPORT,
  FOLLOW_UP: LETTER_COMPLEXITY.FOLLOW_UP,
};

/**
 * Estimated output tokens for each letter type.
 * Values come from LETTER_OUTPUT_TOKENS constants.
 */
const ESTIMATED_OUTPUT_TOKENS: Record<LetterType, number> = {
  NEW_PATIENT: LETTER_OUTPUT_TOKENS.NEW_PATIENT,
  ANGIOGRAM_PROCEDURE: LETTER_OUTPUT_TOKENS.ANGIOGRAM_PROCEDURE,
  ECHO_REPORT: LETTER_OUTPUT_TOKENS.ECHO_REPORT,
  FOLLOW_UP: LETTER_OUTPUT_TOKENS.FOLLOW_UP,
};

/**
 * Select the most appropriate model for letter generation.
 *
 * Decision factors:
 * 1. Letter type complexity
 * 2. Source richness (more sources = more complexity)
 * 3. User preference (quality vs cost)
 * 4. Estimated token count (long prompts may need more context)
 */
export function selectModel(input: ModelSelectionInput): ModelSelectionResult {
  const log = logger.child({ action: 'selectModel', letterType: input.letterType });

  // Base complexity from letter type
  let complexityScore = LETTER_COMPLEXITY_SCORES[input.letterType] ?? 5;

  // Adjust for source richness
  const sourceCount =
    (input.sources.transcript ? 1 : 0) +
    (input.sources.documents?.length ?? 0) +
    (input.sources.userInput ? 1 : 0);

  if (sourceCount >= 3) {
    complexityScore += LETTER_COMPLEXITY.MULTIPLE_SOURCES_BONUS; // Multiple sources = more integration needed
  } else if (sourceCount === 0) {
    complexityScore -= LETTER_COMPLEXITY.NO_SOURCES_REDUCTION; // No sources = simpler (shouldn't happen in practice)
  }

  // Check if sources contain complex data
  if (input.sources.documents && input.sources.documents.length > 0) {
    const hasComplexDoc = input.sources.documents.some(
      (doc) => doc.type === 'ANGIOGRAM_REPORT' || doc.type === 'ECHO_REPORT'
    );
    if (hasComplexDoc) {
      complexityScore += LETTER_COMPLEXITY.COMPLEX_DOCUMENT_BONUS; // Structured medical data requires precision
    }
  }

  // Estimate input tokens from sources
  const estimatedInputTokens = estimateSourceTokens(input.sources);
  const estimatedOutputTokens = ESTIMATED_OUTPUT_TOKENS[input.letterType] ?? 2000;

  // Apply user preference
  let selectedModel: ModelId;
  let reason: string;

  if (input.userPreference === 'quality') {
    // Always use Opus for maximum quality
    selectedModel = MODELS.OPUS;
    reason = 'User preference: quality (Opus)';
  } else if (input.userPreference === 'cost') {
    // Always use Sonnet for cost savings
    selectedModel = MODELS.SONNET;
    reason = 'User preference: cost (Sonnet)';
  } else {
    // Intelligent selection based on complexity
    // Threshold: complexity score >= OPUS_THRESHOLD → Opus, otherwise → Sonnet
    if (complexityScore >= LETTER_COMPLEXITY.OPUS_THRESHOLD) {
      selectedModel = MODELS.OPUS;
      reason = `High complexity (score: ${complexityScore}): ${input.letterType} with ${sourceCount} source(s)`;
    } else {
      selectedModel = MODELS.SONNET;
      reason = `Moderate complexity (score: ${complexityScore}): ${input.letterType} with ${sourceCount} source(s)`;
    }

    // Override for user preference 'balanced' if provided
    if (input.userPreference === 'balanced') {
      // Use Sonnet unless complexity is very high (>= BALANCED_MODE_THRESHOLD)
      if (complexityScore >= LETTER_COMPLEXITY.BALANCED_MODE_THRESHOLD) {
        selectedModel = MODELS.OPUS;
        reason += ' (balanced mode, high complexity detected)';
      } else {
        selectedModel = MODELS.SONNET;
        reason += ' (balanced mode)';
      }
    }
  }

  // Calculate cost estimate
  const costEstimate = estimateCost(selectedModel, estimatedInputTokens, estimatedOutputTokens);

  // Set max tokens based on letter type
  const maxTokens = estimatedOutputTokens + LETTER_OUTPUT_TOKENS.TOKEN_BUFFER; // Add buffer

  // Temperature: Lower for medical letters (need precision)
  const temperature = AI_MODEL.LETTER_TEMPERATURE;

  log.info('Model selected', {
    letterType: input.letterType,
    modelId: selectedModel,
    complexityScore,
    sourceCount,
    estimatedCostUSD: costEstimate.totalCost,
  });

  return {
    modelId: selectedModel,
    reason,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUSD: costEstimate.totalCost,
    maxTokens,
    temperature,
  };
}

/**
 * Estimate token count for sources.
 */
function estimateSourceTokens(sources: LetterSources): number {
  let totalChars = 0;

  // Transcript
  if (sources.transcript) {
    totalChars += sources.transcript.text.length;

    // Add speaker segments if available
    if (sources.transcript.speakers) {
      for (const segment of sources.transcript.speakers) {
        totalChars += segment.text.length + 50; // +50 for formatting
      }
    }
  }

  // Documents
  if (sources.documents) {
    for (const doc of sources.documents) {
      // Extracted data
      const extractedDataStr = JSON.stringify(doc.extractedData);
      totalChars += extractedDataStr.length;

      // Raw text (if available, capped at 500 chars as per generation.ts)
      if (doc.rawText) {
        totalChars += Math.min(doc.rawText.length, 500);
      }

      totalChars += 200; // Overhead for document metadata
    }
  }

  // User input
  if (sources.userInput) {
    totalChars += sources.userInput.text.length;
  }

  // Add prompt overhead (base prompt + letter-specific instructions)
  totalChars += 3000; // Approximate size of prompt template

  // Direct calculation: 1 token ≈ 3.5 characters for medical text
  // This is more efficient than creating a large string just to estimate
  return Math.ceil(totalChars / 3.5);
}

/**
 * Get recommended model for a letter type without full sources.
 * Useful for UI hints before letter generation.
 */
export function getRecommendedModel(letterType: LetterType): {
  modelId: ModelId;
  reason: string;
} {
  const complexity = LETTER_COMPLEXITY_SCORES[letterType] ?? 5;

  if (complexity >= 7) {
    return {
      modelId: MODELS.OPUS,
      reason: `${letterType} letters are complex and benefit from Opus quality`,
    };
  }

  return {
    modelId: MODELS.SONNET,
    reason: `${letterType} letters are routine and work well with Sonnet`,
  };
}

/**
 * Compare cost between models for a given letter.
 * Useful for showing users the cost difference.
 */
export function compareCosts(input: ModelSelectionInput): {
  opus: { costUSD: number; quality: string };
  sonnet: { costUSD: number; quality: string };
  recommendation: ModelId;
  savingsPercent?: number | undefined;
} {
  const estimatedInputTokens = estimateSourceTokens(input.sources);
  const estimatedOutputTokens = ESTIMATED_OUTPUT_TOKENS[input.letterType] ?? 2000;

  const opusCost = estimateCost(MODELS.OPUS, estimatedInputTokens, estimatedOutputTokens);
  const sonnetCost = estimateCost(MODELS.SONNET, estimatedInputTokens, estimatedOutputTokens);

  const selection = selectModel(input);

  const savingsPercent =
    selection.modelId === MODELS.SONNET
      ? ((opusCost.totalCost - sonnetCost.totalCost) / opusCost.totalCost) * 100
      : undefined;

  return {
    opus: {
      costUSD: opusCost.totalCost,
      quality: 'Highest quality, most comprehensive',
    },
    sonnet: {
      costUSD: sonnetCost.totalCost,
      quality: 'High quality, cost-effective',
    },
    recommendation: selection.modelId,
    savingsPercent,
  };
}
