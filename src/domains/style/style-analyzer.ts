// src/domains/style/style-analyzer.ts
// Claude-powered style analyzer for learning physician writing preferences

import { generateTextWithRetry, MODELS } from '@/infrastructure/bedrock';
import { logger } from '@/lib/logger';
import type { StyleEdit, StyleAnalysisResult } from './style.types';

/**
 * Analyze a collection of edits to detect writing style patterns.
 * Uses Claude to identify:
 * - Greeting and closing preferences
 * - Paragraph structure
 * - Medication and clinical value formatting
 * - Vocabulary choices
 * - Overall formality level
 */
export async function analyzeEditsForStyle(
  edits: StyleEdit[]
): Promise<StyleAnalysisResult> {
  const log = logger.child({ action: 'analyzeEditsForStyle', editCount: edits.length });

  if (edits.length === 0) {
    throw new Error('No edits provided for analysis');
  }

  // Build analysis prompt
  const prompt = buildStyleAnalysisPrompt(edits);

  log.info('Starting style analysis', {
    editCount: edits.length,
    promptLength: prompt.length,
  });

  try {
    // Use Sonnet for cost efficiency (style analysis is not life-critical)
    const response = await generateTextWithRetry({
      prompt,
      modelId: MODELS.SONNET,
      maxTokens: 4096,
      temperature: 0.2, // Lower temperature for more consistent analysis
      systemPrompt: SYSTEM_PROMPT,
    });

    log.info('Style analysis complete', {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    // Parse Claude's response
    const analysis = parseStyleAnalysisResponse(response.content, edits.length, response.modelId);

    return analysis;
  } catch (error) {
    log.error('Style analysis failed', {}, error instanceof Error ? error : undefined);
    throw error;
  }
}

/**
 * Build the prompt for style analysis.
 */
function buildStyleAnalysisPrompt(edits: StyleEdit[]): string {
  // Group edits by section type for better analysis
  const editsBySection: Record<string, Array<{ before: string; after: string }>> = {};

  for (const edit of edits) {
    const section = edit.sectionType ?? 'other';
    if (!editsBySection[section]) {
      editsBySection[section] = [];
    }
    editsBySection[section].push({
      before: edit.beforeText,
      after: edit.afterText,
    });
  }

  let prompt = `I need you to analyze a physician's editing patterns to learn their writing style preferences.

Below are ${edits.length} examples of text edits the physician made to AI-generated medical letters. Each edit shows the BEFORE (AI-generated) and AFTER (physician-edited) versions.

Your task is to identify consistent patterns in how the physician writes, including:
1. Greeting style (formal vs casual)
2. Closing style (formal vs casual)
3. Paragraph structure (long vs short paragraphs)
4. Medication formatting (generic names, brand names, or both)
5. Clinical value formatting (concise "LVEF 55%" vs verbose "LVEF of 55%")
6. Overall formality level
7. Sentence complexity preferences
8. Vocabulary preferences (words they consistently change)
9. Section ordering preferences

# EDIT EXAMPLES

`;

  // Add edits grouped by section
  for (const [section, sectionEdits] of Object.entries(editsBySection)) {
    prompt += `## ${section.toUpperCase()} SECTION\n\n`;

    for (let i = 0; i < sectionEdits.length; i++) {
      const edit = sectionEdits[i];
      if (edit) {
        prompt += `### Edit ${i + 1}\n`;
        prompt += `BEFORE:\n${edit.before}\n\n`;
        prompt += `AFTER:\n${edit.after}\n\n`;
        prompt += `---\n\n`;
      }
    }
  }

  prompt += `
# YOUR ANALYSIS

Please provide your analysis in the following JSON format:

\`\`\`json
{
  "detectedPreferences": {
    "greetingStyle": "formal" | "casual" | "mixed" | null,
    "closingStyle": "formal" | "casual" | "mixed" | null,
    "paragraphStructure": "long" | "short" | "mixed" | null,
    "medicationFormat": "generic" | "brand" | "both" | null,
    "clinicalValueFormat": "concise" | "verbose" | "mixed" | null,
    "formalityLevel": "very-formal" | "formal" | "neutral" | "casual" | null,
    "sentenceComplexity": "simple" | "moderate" | "complex" | null
  },
  "examples": {
    "greeting": [{ "before": "...", "after": "...", "pattern": "Uses formal greeting with title" }],
    "closing": [{ "before": "...", "after": "...", "pattern": "Prefers 'Yours sincerely'" }],
    "medication": [{ "before": "...", "after": "...", "pattern": "Uses generic names only" }],
    "clinicalValue": [{ "before": "...", "after": "...", "pattern": "Prefers concise format" }],
    "vocabulary": [{ "before": "utilize", "after": "use", "reason": "Prefers simpler words" }]
  },
  "confidence": {
    "greetingStyle": 0.0-1.0,
    "closingStyle": 0.0-1.0,
    "paragraphStructure": 0.0-1.0,
    "medicationFormat": 0.0-1.0,
    "clinicalValueFormat": 0.0-1.0,
    "formalityLevel": 0.0-1.0,
    "sentenceComplexity": 0.0-1.0
  },
  "insights": [
    "The physician consistently uses formal greetings...",
    "Prefers short, concise paragraphs...",
    "..."
  ],
  "vocabularyMap": {
    "utilize": "use",
    "commence": "start",
    "...": "..."
  },
  "preferredSectionOrder": ["History", "Examination", "Impression", "Plan"]
}
\`\`\`

Guidelines for confidence scores:
- 0.9-1.0: Very consistent pattern across all edits
- 0.7-0.9: Consistent pattern with minor variations
- 0.5-0.7: Moderate pattern, some variation
- 0.3-0.5: Weak pattern, significant variation
- 0.0-0.3: No clear pattern detected

Only include fields where you detected a pattern. Use null for fields with no clear preference.
`;

  return prompt;
}

/**
 * System prompt for style analysis.
 */
const SYSTEM_PROMPT = `You are an expert medical writing analyst specializing in identifying physician writing style preferences.

Your role is to analyze edits made by physicians to AI-generated medical letters and identify consistent patterns in their writing style.

Focus on:
- Concrete, observable patterns (not subjective interpretations)
- Consistency across multiple examples
- Medical writing conventions and terminology
- Australian medical practice standards

Be conservative with confidence scores - only assign high confidence when patterns are clearly consistent across multiple examples.

Provide specific examples to support each detected preference.`;

/**
 * Parse Claude's analysis response into structured data.
 */
function parseStyleAnalysisResponse(
  content: string,
  editsAnalyzed: number,
  modelUsed: string
): StyleAnalysisResult {
  const log = logger.child({ action: 'parseStyleAnalysisResponse' });

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const jsonContent = jsonMatch[1];
    if (!jsonContent) {
      throw new Error('Empty JSON content in Claude response');
    }
    const parsed = JSON.parse(jsonContent);

    // Validate and transform to StyleAnalysisResult
    const result: StyleAnalysisResult = {
      detectedPreferences: parsed.detectedPreferences ?? {},
      examples: parsed.examples ?? {},
      confidence: {
        greetingStyle: parsed.confidence?.greetingStyle ?? 0,
        closingStyle: parsed.confidence?.closingStyle ?? 0,
        paragraphStructure: parsed.confidence?.paragraphStructure ?? 0,
        medicationFormat: parsed.confidence?.medicationFormat ?? 0,
        clinicalValueFormat: parsed.confidence?.clinicalValueFormat ?? 0,
        formalityLevel: parsed.confidence?.formalityLevel ?? 0,
        sentenceComplexity: parsed.confidence?.sentenceComplexity ?? 0,
      },
      insights: parsed.insights ?? [],
      vocabularyMap: parsed.vocabularyMap ?? {},
      preferredSectionOrder: parsed.preferredSectionOrder,
      editsAnalyzed,
      analysisTimestamp: new Date(),
      modelUsed,
    };

    log.info('Style analysis parsed successfully', {
      preferencesDetected: Object.keys(result.detectedPreferences).length,
      insightsCount: result.insights.length,
    });

    return result;
  } catch (error) {
    log.error('Failed to parse style analysis response', { content }, error instanceof Error ? error : undefined);
    throw new Error(`Failed to parse style analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze complete historical letters to detect writing style patterns.
 * Unlike edit-based analysis, this looks at the overall style of finished letters.
 */
export async function analyzeLettersForStyle(
  letters: string[]
): Promise<StyleAnalysisResult> {
  const log = logger.child({ action: 'analyzeLettersForStyle', letterCount: letters.length });

  if (letters.length === 0) {
    throw new Error('No letters provided for analysis');
  }

  // Build analysis prompt for complete letters
  const prompt = buildLetterAnalysisPrompt(letters);

  log.info('Starting historical letter analysis', {
    letterCount: letters.length,
    promptLength: prompt.length,
  });

  try {
    // Use Sonnet for cost efficiency
    const response = await generateTextWithRetry({
      prompt,
      modelId: MODELS.SONNET,
      maxTokens: 4096,
      temperature: 0.2,
      systemPrompt: LETTER_ANALYSIS_SYSTEM_PROMPT,
    });

    log.info('Historical letter analysis complete', {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    // Parse Claude's response
    const analysis = parseStyleAnalysisResponse(response.content, letters.length, response.modelId);

    return analysis;
  } catch (error) {
    log.error('Historical letter analysis failed', {}, error instanceof Error ? error : undefined);
    throw error;
  }
}

/**
 * Build prompt for analyzing complete historical letters.
 */
function buildLetterAnalysisPrompt(letters: string[]): string {
  let prompt = `I need you to analyze a physician's writing style from their historical medical letters.

Below are ${letters.length} complete medical letters written by this physician. Analyze these letters to identify their consistent writing style preferences.

Your task is to identify patterns in:
1. Greeting style (formal vs casual)
2. Closing style (formal vs casual)
3. Paragraph structure (long vs short paragraphs)
4. Medication formatting (generic names, brand names, or both)
5. Clinical value formatting (concise "LVEF 55%" vs verbose "LVEF of 55%")
6. Overall formality level
7. Sentence complexity preferences
8. Vocabulary choices and preferences
9. Section ordering patterns

# HISTORICAL LETTERS

`;

  // Add each letter
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    if (letter) {
      // Truncate very long letters to avoid context limits
      const truncatedLetter = letter.length > 3000 ? letter.slice(0, 3000) + '\n[... truncated ...]' : letter;
      prompt += `## Letter ${i + 1}\n\n${truncatedLetter}\n\n---\n\n`;
    }
  }

  prompt += `
# YOUR ANALYSIS

Please provide your analysis in the following JSON format:

\`\`\`json
{
  "detectedPreferences": {
    "greetingStyle": "formal" | "casual" | "mixed" | null,
    "closingStyle": "formal" | "casual" | "mixed" | null,
    "paragraphStructure": "long" | "short" | "mixed" | null,
    "medicationFormat": "generic" | "brand" | "both" | null,
    "clinicalValueFormat": "concise" | "verbose" | "mixed" | null,
    "formalityLevel": "very-formal" | "formal" | "neutral" | "casual" | null,
    "sentenceComplexity": "simple" | "moderate" | "complex" | null
  },
  "examples": {
    "greeting": [{ "before": "N/A", "after": "Dear Dr. Smith,", "pattern": "Uses formal greeting with title" }],
    "closing": [{ "before": "N/A", "after": "Yours sincerely,", "pattern": "Formal sign-off" }],
    "medication": [{ "before": "N/A", "after": "metformin 500mg", "pattern": "Uses generic medication names" }],
    "clinicalValue": [{ "before": "N/A", "after": "HbA1c 7.2%", "pattern": "Concise clinical values" }],
    "vocabulary": [{ "before": "N/A", "after": "patient reports", "reason": "Standard clinical phrasing" }]
  },
  "confidence": {
    "greetingStyle": 0.0-1.0,
    "closingStyle": 0.0-1.0,
    "paragraphStructure": 0.0-1.0,
    "medicationFormat": 0.0-1.0,
    "clinicalValueFormat": 0.0-1.0,
    "formalityLevel": 0.0-1.0,
    "sentenceComplexity": 0.0-1.0
  },
  "insights": [
    "The physician uses formal greetings with professional titles...",
    "Paragraphs are typically 3-4 sentences...",
    "..."
  ],
  "vocabularyMap": {
    "example_formal_term": "simpler_alternative"
  },
  "preferredSectionOrder": ["History", "Examination", "Impression", "Plan"]
}
\`\`\`

Guidelines for confidence scores:
- 0.9-1.0: Very consistent pattern across all letters
- 0.7-0.9: Consistent pattern with minor variations
- 0.5-0.7: Moderate pattern, some variation
- 0.3-0.5: Weak pattern, significant variation
- 0.0-0.3: No clear pattern detected

For the "examples" field, since these are complete letters (not before/after edits), use "N/A" for the "before" field and extract actual examples from the letters for the "after" field.
`;

  return prompt;
}

/**
 * System prompt for historical letter analysis.
 */
const LETTER_ANALYSIS_SYSTEM_PROMPT = `You are an expert medical writing analyst specializing in identifying physician writing style preferences.

Your role is to analyze complete medical letters written by a physician to identify their consistent writing style patterns.

Focus on:
- Concrete, observable patterns (not subjective interpretations)
- Consistency across multiple letters
- Medical writing conventions and terminology
- Australian medical practice standards (if evident)

Be conservative with confidence scores - only assign high confidence when patterns are clearly consistent across multiple letters.

Extract specific examples from the letters to support each detected preference.`;

/**
 * Merge new analysis results with existing style profile.
 * Uses weighted averaging based on confidence and sample size.
 */
export function mergeStyleAnalysis(
  existing: StyleAnalysisResult | null,
  newAnalysis: StyleAnalysisResult
): StyleAnalysisResult {
  // If no existing analysis, return new one
  if (!existing) {
    return newAnalysis;
  }

  // Weight based on number of edits analyzed
  const existingWeight = existing.editsAnalyzed;
  const newWeight = newAnalysis.editsAnalyzed;
  const totalWeight = existingWeight + newWeight;

  // Merge confidence scores with weighted average
  const mergedConfidence: StyleAnalysisResult['confidence'] = {
    greetingStyle:
      (existing.confidence.greetingStyle * existingWeight +
        newAnalysis.confidence.greetingStyle * newWeight) /
      totalWeight,
    closingStyle:
      (existing.confidence.closingStyle * existingWeight +
        newAnalysis.confidence.closingStyle * newWeight) /
      totalWeight,
    paragraphStructure:
      (existing.confidence.paragraphStructure * existingWeight +
        newAnalysis.confidence.paragraphStructure * newWeight) /
      totalWeight,
    medicationFormat:
      (existing.confidence.medicationFormat * existingWeight +
        newAnalysis.confidence.medicationFormat * newWeight) /
      totalWeight,
    clinicalValueFormat:
      (existing.confidence.clinicalValueFormat * existingWeight +
        newAnalysis.confidence.clinicalValueFormat * newWeight) /
      totalWeight,
    formalityLevel:
      (existing.confidence.formalityLevel * existingWeight +
        newAnalysis.confidence.formalityLevel * newWeight) /
      totalWeight,
    sentenceComplexity:
      (existing.confidence.sentenceComplexity * existingWeight +
        newAnalysis.confidence.sentenceComplexity * newWeight) /
      totalWeight,
  };

  // Prefer new preferences if confidence is higher
  const mergedPreferences: StyleAnalysisResult['detectedPreferences'] = {
    greetingStyle: newAnalysis.confidence.greetingStyle > existing.confidence.greetingStyle
      ? newAnalysis.detectedPreferences.greetingStyle
      : existing.detectedPreferences.greetingStyle,
    closingStyle: newAnalysis.confidence.closingStyle > existing.confidence.closingStyle
      ? newAnalysis.detectedPreferences.closingStyle
      : existing.detectedPreferences.closingStyle,
    paragraphStructure: newAnalysis.confidence.paragraphStructure > existing.confidence.paragraphStructure
      ? newAnalysis.detectedPreferences.paragraphStructure
      : existing.detectedPreferences.paragraphStructure,
    medicationFormat: newAnalysis.confidence.medicationFormat > existing.confidence.medicationFormat
      ? newAnalysis.detectedPreferences.medicationFormat
      : existing.detectedPreferences.medicationFormat,
    clinicalValueFormat: newAnalysis.confidence.clinicalValueFormat > existing.confidence.clinicalValueFormat
      ? newAnalysis.detectedPreferences.clinicalValueFormat
      : existing.detectedPreferences.clinicalValueFormat,
    formalityLevel: newAnalysis.confidence.formalityLevel > existing.confidence.formalityLevel
      ? newAnalysis.detectedPreferences.formalityLevel
      : existing.detectedPreferences.formalityLevel,
    sentenceComplexity: newAnalysis.confidence.sentenceComplexity > existing.confidence.sentenceComplexity
      ? newAnalysis.detectedPreferences.sentenceComplexity
      : existing.detectedPreferences.sentenceComplexity,
  };

  // Merge vocabulary maps (new entries override)
  const mergedVocabulary = {
    ...existing.vocabularyMap,
    ...newAnalysis.vocabularyMap,
  };

  // Merge examples (keep most recent, limit to 5 per category)
  const mergedExamples: StyleAnalysisResult['examples'] = {
    greeting: [...(newAnalysis.examples.greeting ?? []), ...(existing.examples.greeting ?? [])].slice(0, 5),
    closing: [...(newAnalysis.examples.closing ?? []), ...(existing.examples.closing ?? [])].slice(0, 5),
    medication: [...(newAnalysis.examples.medication ?? []), ...(existing.examples.medication ?? [])].slice(0, 5),
    clinicalValue: [...(newAnalysis.examples.clinicalValue ?? []), ...(existing.examples.clinicalValue ?? [])].slice(0, 5),
    vocabulary: [...(newAnalysis.examples.vocabulary ?? []), ...(existing.examples.vocabulary ?? [])].slice(0, 10),
  };

  // Merge insights (keep most recent)
  const mergedInsights = [...newAnalysis.insights, ...existing.insights].slice(0, 10);

  return {
    detectedPreferences: mergedPreferences,
    examples: mergedExamples,
    confidence: mergedConfidence,
    insights: mergedInsights,
    vocabularyMap: mergedVocabulary,
    preferredSectionOrder: newAnalysis.preferredSectionOrder ?? existing.preferredSectionOrder,
    editsAnalyzed: existing.editsAnalyzed + newAnalysis.editsAnalyzed,
    analysisTimestamp: newAnalysis.analysisTimestamp,
    modelUsed: newAnalysis.modelUsed,
  };
}
