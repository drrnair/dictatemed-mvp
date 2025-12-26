// src/domains/literature/orchestration.service.ts
// Literature orchestration service - coordinates multi-source searches and AI synthesis

import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import { unifiedAnthropicService } from '@/infrastructure/anthropic';
import { getPubMedService } from '@/infrastructure/pubmed';
import { getUpToDateService } from '@/infrastructure/uptodate';
import { getUserLibraryService } from './user-library.service';
import type {
  LiteratureSearchParams,
  LiteratureSearchResult,
  SourceResult,
  Citation,
  ConfidenceLevel,
  LiteratureSourceType,
  SubscriptionTier,
} from './types';
import { TIER_LIMITS } from './types';
import type { PubMedArticleResult } from '@/infrastructure/pubmed';
import type { UserLibraryChunkResult } from './types';

/**
 * System prompt for clinical literature synthesis.
 */
const LITERATURE_SYSTEM_PROMPT = `You are a clinical literature assistant for DictateMED, helping physicians find evidence-based answers to clinical questions.

Your role:
1. Synthesize information from multiple clinical sources (UpToDate, PubMed, user's personal library)
2. Provide clear, actionable clinical recommendations
3. Cite sources with proper attribution
4. Note any conflicting information between sources
5. Highlight important warnings, contraindications, or dosing information

Guidelines:
- Prioritize evidence from systematic reviews and clinical guidelines
- Be specific about dosing when discussing medications
- Always mention important contraindications and drug interactions
- Note the level of evidence (high/medium/low) for recommendations
- If information is insufficient or conflicting, clearly state this
- Keep responses concise but comprehensive

Output format:
1. Direct answer to the clinical question
2. Key recommendations (bulleted)
3. Dosing information (if applicable)
4. Warnings and contraindications (if applicable)
5. References to source materials`;

/**
 * Literature Orchestration Service.
 *
 * Coordinates searches across multiple sources and synthesizes results:
 * - PubMed (free, always available)
 * - UpToDate (requires OAuth connection)
 * - User Library (user's uploaded documents)
 *
 * Uses Anthropic Claude to synthesize findings into actionable clinical guidance.
 */
class LiteratureOrchestrationService {
  /**
   * Get PubMed service instance (lazy loaded for testability).
   */
  private get pubmedService() {
    return getPubMedService();
  }

  /**
   * Get UpToDate service instance (lazy loaded for testability).
   */
  private get upToDateService() {
    return getUpToDateService();
  }

  /**
   * Get User Library service instance (lazy loaded for testability).
   */
  private get userLibraryService() {
    return getUserLibraryService();
  }

  /**
   * Search clinical literature and synthesize results.
   */
  async search(params: LiteratureSearchParams): Promise<LiteratureSearchResult> {
    const log = logger.child({
      action: 'literatureSearch',
      userId: params.userId,
      letterId: params.letterId,
    });
    const startTime = Date.now();

    log.info('Starting literature search', {
      query: params.query.substring(0, 100),
      sources: params.sources,
      specialty: params.specialty,
    });

    try {
      // Step 1: Get user's tier configuration
      const tierConfig = await this.getUserTierConfig(params.userId);

      // Step 2: Check query limits
      await this.checkQueryLimits(params.userId, tierConfig);

      // Step 3: Determine which sources to search
      const sourcesToSearch = this.determineSources(params.sources, tierConfig);

      // Step 4: Execute parallel searches
      const sourceResults = await this.executeSearches(params, sourcesToSearch);

      // Step 5: Synthesize results with AI
      const synthesized = await this.synthesizeResults(params, sourceResults);

      const responseTimeMs = Date.now() - startTime;

      // Step 6: Record the query
      await this.recordQuery(params.userId, params, synthesized, responseTimeMs);

      log.info('Literature search complete', {
        query: params.query.substring(0, 100),
        sourceCount: sourceResults.length,
        citationCount: synthesized.citations.length,
        responseTimeMs,
      });

      return {
        ...synthesized,
        responseTimeMs,
      };
    } catch (error) {
      log.error(
        'Literature search failed',
        { query: params.query.substring(0, 100) },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Determine which sources to search based on configuration and tier.
   */
  private determineSources(
    requestedSources: LiteratureSourceType[] | undefined,
    tierConfig: { pubMedEnabled: boolean; upToDateEnabled: boolean }
  ): LiteratureSourceType[] {
    const defaultSources: LiteratureSourceType[] = ['pubmed', 'user_library'];

    // Add UpToDate if enabled
    if (tierConfig.upToDateEnabled) {
      defaultSources.push('uptodate');
    }

    // If specific sources requested, filter to available ones
    if (requestedSources && requestedSources.length > 0) {
      return requestedSources.filter((source) => {
        if (source === 'pubmed') return tierConfig.pubMedEnabled;
        if (source === 'uptodate') return tierConfig.upToDateEnabled;
        if (source === 'user_library') return true;
        return false;
      });
    }

    return defaultSources;
  }

  /**
   * Execute searches across multiple sources in parallel.
   */
  private async executeSearches(
    params: LiteratureSearchParams,
    sources: LiteratureSourceType[]
  ): Promise<SourceResult[]> {
    const log = logger.child({ action: 'executeSearches', userId: params.userId });
    const results: SourceResult[] = [];

    const searchPromises: Promise<void>[] = [];

    // PubMed search
    if (sources.includes('pubmed')) {
      searchPromises.push(
        this.searchPubMed(params.query)
          .then((pubmedResults) => {
            results.push(...pubmedResults);
          })
          .catch((error) => {
            log.warn('PubMed search failed', { error: error instanceof Error ? error.message : 'Unknown' });
          })
      );
    }

    // UpToDate search
    if (sources.includes('uptodate')) {
      searchPromises.push(
        this.searchUpToDate(params.userId, params.query, params.specialty)
          .then((upToDateResults) => {
            results.push(...upToDateResults);
          })
          .catch((error) => {
            log.warn('UpToDate search failed', { error: error instanceof Error ? error.message : 'Unknown' });
          })
      );
    }

    // User library search
    if (sources.includes('user_library')) {
      searchPromises.push(
        this.searchUserLibrary(params.userId, params.query)
          .then((libraryResults) => {
            results.push(...libraryResults);
          })
          .catch((error) => {
            log.warn('User library search failed', { error: error instanceof Error ? error.message : 'Unknown' });
          })
      );
    }

    await Promise.all(searchPromises);

    log.info('Searches complete', {
      sourceCount: results.length,
      sources: Array.from(new Set(results.map((r) => r.type))),
    });

    return results;
  }

  /**
   * Search PubMed and format results.
   */
  private async searchPubMed(query: string): Promise<SourceResult[]> {
    const result = await this.pubmedService.search({
      query,
      maxResults: 10,
      freeFullTextOnly: false,
      sort: 'relevance',
    });

    return result.results.map((article: PubMedArticleResult) => ({
      type: 'pubmed' as const,
      title: article.title,
      content: article.abstract || 'No abstract available.',
      url: article.url,
      year: article.year,
      authors: article.authors,
      metadata: {
        pmid: article.pmid,
        doi: article.doi,
        journal: article.journal,
        freeFullText: article.freeFullText,
        publicationType: article.publicationType,
      },
    }));
  }

  /**
   * Search UpToDate and format results.
   */
  private async searchUpToDate(
    userId: string,
    query: string,
    specialty?: string
  ): Promise<SourceResult[]> {
    const result = await this.upToDateService.search({
      userId,
      query,
      specialty,
      maxResults: 5,
    });

    // UpToDate returns structured topic results
    return result.results.map((topic) => ({
      type: 'uptodate' as const,
      title: topic.title,
      content: topic.summary || '',
      url: topic.url,
      metadata: {
        topicId: topic.topicId,
        section: topic.section,
        lastUpdated: topic.lastUpdated,
      },
    }));
  }

  /**
   * Search user's personal library and format results.
   */
  private async searchUserLibrary(userId: string, query: string): Promise<SourceResult[]> {
    const result = await this.userLibraryService.search({
      userId,
      query,
      limit: 5,
      minSimilarity: 0.7,
    });

    return result.results.map((chunk: UserLibraryChunkResult) => ({
      type: 'user_library' as const,
      title: chunk.documentTitle,
      content: chunk.content,
      metadata: {
        documentId: chunk.documentId,
        category: chunk.category,
        chunkIndex: chunk.chunkIndex,
        similarity: chunk.similarity,
      },
    }));
  }

  /**
   * Synthesize search results using AI.
   */
  private async synthesizeResults(
    params: LiteratureSearchParams,
    sourceResults: SourceResult[]
  ): Promise<Omit<LiteratureSearchResult, 'responseTimeMs'>> {
    const log = logger.child({ action: 'synthesizeResults', userId: params.userId });

    // If no results, return empty response
    if (sourceResults.length === 0) {
      return {
        answer: 'No relevant clinical literature was found for your query. Please try rephrasing your question or check your search terms.',
        recommendations: [],
        citations: [],
        confidence: 'low',
      };
    }

    // Build context from source results
    const context = this.buildContext(sourceResults);

    // Build user prompt
    let userPrompt = `Clinical Question: ${params.query}`;
    if (params.context) {
      userPrompt += `\n\nLetter Context: ${params.context}`;
    }
    if (params.specialty) {
      userPrompt += `\n\nPhysician Specialty: ${params.specialty}`;
    }
    userPrompt += `\n\nSource Materials:\n${context}`;
    userPrompt += `\n\nPlease synthesize the above information to answer the clinical question. Include specific citations to the source materials.`;

    log.debug('Sending synthesis request to AI', {
      contextLength: context.length,
      sourceCount: sourceResults.length,
    });

    // Call Anthropic for synthesis
    const response = await unifiedAnthropicService.generateText({
      systemPrompt: LITERATURE_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2048,
      temperature: 0.3,
      cacheSystemPrompt: true,
    });

    // Parse the AI response
    const parsed = this.parseAIResponse(response.content, sourceResults);

    log.info('Synthesis complete', {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      citationCount: parsed.citations.length,
    });

    return parsed;
  }

  /**
   * Build context string from source results.
   */
  private buildContext(sourceResults: SourceResult[]): string {
    const sections: string[] = [];

    // Group by source type
    const byType = new Map<string, SourceResult[]>();
    for (const result of sourceResults) {
      const existing = byType.get(result.type) || [];
      existing.push(result);
      byType.set(result.type, existing);
    }

    // UpToDate first (if available)
    const upToDateResults = byType.get('uptodate');
    if (upToDateResults && upToDateResults.length > 0) {
      sections.push('## UpToDate Clinical Information');
      for (const result of upToDateResults) {
        sections.push(`### ${result.title}`);
        sections.push(result.content);
        sections.push('');
      }
    }

    // User Library second
    const libraryResults = byType.get('user_library');
    if (libraryResults && libraryResults.length > 0) {
      sections.push('## Personal Library Documents');
      for (const result of libraryResults) {
        sections.push(`### ${result.title}`);
        sections.push(result.content);
        sections.push('');
      }
    }

    // PubMed articles last
    const pubmedResults = byType.get('pubmed');
    if (pubmedResults && pubmedResults.length > 0) {
      sections.push('## PubMed Articles');
      for (const result of pubmedResults) {
        const year = result.year ? ` (${result.year})` : '';
        const authors = result.authors ? ` - ${result.authors}` : '';
        sections.push(`### ${result.title}${year}${authors}`);
        sections.push(result.content);
        sections.push('');
      }
    }

    return sections.join('\n');
  }

  /**
   * Parse AI response into structured result.
   */
  private parseAIResponse(
    content: string,
    sourceResults: SourceResult[]
  ): Omit<LiteratureSearchResult, 'responseTimeMs'> {
    // Extract recommendations (bulleted items)
    const recommendations: string[] = [];
    const bulletMatches = content.match(/^[\-\*]\s+(.+)$/gm);
    if (bulletMatches) {
      for (const match of bulletMatches) {
        const text = match.replace(/^[\-\*]\s+/, '').trim();
        if (text && !text.toLowerCase().includes('citation') && !text.toLowerCase().includes('reference')) {
          recommendations.push(text);
        }
      }
    }

    // Extract dosing information
    let dosing: string | undefined;
    const dosingMatch = content.match(/(?:dosing|dose|dosage)[:\s]+([^.\n]+(?:\.[^.\n]+)?)/i);
    if (dosingMatch?.[1]) {
      dosing = dosingMatch[1].trim();
    }

    // Extract warnings
    const warnings: string[] = [];
    const warningPatterns = [
      /(?:warning|caution|contraindication|adverse|side effect)[:\s]+([^.\n]+)/gi,
      /(?:do not|avoid|should not)[^.\n]+/gi,
    ];
    for (const pattern of warningPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const warning = match.trim();
          if (!warnings.includes(warning)) {
            warnings.push(warning);
          }
        }
      }
    }

    // Build citations from source results
    const citations = this.buildCitations(sourceResults);

    // Determine confidence level
    const confidence = this.determineConfidence(sourceResults, content);

    return {
      answer: content,
      recommendations: recommendations.slice(0, 5), // Limit to 5 recommendations
      dosing,
      warnings: warnings.length > 0 ? warnings.slice(0, 3) : undefined,
      citations,
      confidence,
    };
  }

  /**
   * Build citations from source results.
   */
  private buildCitations(sourceResults: SourceResult[]): Citation[] {
    return sourceResults.map((result) => {
      const citation: Citation = {
        source: result.type,
        title: result.title,
        confidence: this.getSourceConfidence(result.type),
      };

      if (result.authors) citation.authors = result.authors;
      if (result.year) citation.year = result.year;
      if (result.url) citation.url = result.url;

      // Add source-specific IDs
      const metadata = result.metadata as Record<string, unknown> | undefined;
      if (metadata) {
        if (result.type === 'pubmed' && metadata.pmid) {
          citation.pmid = String(metadata.pmid);
        }
        if (result.type === 'uptodate' && metadata.topicId) {
          citation.uptodateTopicId = String(metadata.topicId);
        }
        if (result.type === 'user_library' && metadata.documentId) {
          citation.documentId = String(metadata.documentId);
        }
      }

      return citation;
    });
  }

  /**
   * Get confidence level for a source type.
   */
  private getSourceConfidence(sourceType: LiteratureSourceType): ConfidenceLevel {
    switch (sourceType) {
      case 'uptodate':
        return 'high'; // UpToDate is peer-reviewed clinical guidance
      case 'pubmed':
        return 'medium'; // PubMed varies by study type
      case 'user_library':
        return 'medium'; // User-uploaded, unknown provenance
      default:
        return 'low';
    }
  }

  /**
   * Determine overall confidence level.
   */
  private determineConfidence(
    sourceResults: SourceResult[],
    _content: string
  ): ConfidenceLevel {
    // High confidence if we have UpToDate results
    if (sourceResults.some((r) => r.type === 'uptodate')) {
      return 'high';
    }

    // Medium confidence if we have multiple PubMed sources or library documents
    if (sourceResults.length >= 3) {
      return 'medium';
    }

    // Low confidence for sparse results
    return sourceResults.length > 0 ? 'medium' : 'low';
  }

  /**
   * Get user's tier configuration.
   * Currently hardcoded to Professional tier.
   */
  private async getUserTierConfig(_userId: string): Promise<{
    tier: SubscriptionTier;
    queriesPerMonth: number;
    pubMedEnabled: boolean;
    upToDateEnabled: boolean;
  }> {
    // TODO: Fetch from subscription system when implemented
    const tier: SubscriptionTier = 'professional';
    const config = TIER_LIMITS[tier];

    return {
      tier,
      queriesPerMonth: config.queriesPerMonth,
      pubMedEnabled: config.pubMedEnabled,
      upToDateEnabled: config.upToDateEnabled,
    };
  }

  /**
   * Check if user has remaining queries.
   */
  private async checkQueryLimits(
    userId: string,
    tierConfig: { queriesPerMonth: number }
  ): Promise<void> {
    // Get queries this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const queryCount = await prisma.literatureQuery.count({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
    });

    if (queryCount >= tierConfig.queriesPerMonth) {
      throw new Error(
        `Monthly query limit (${tierConfig.queriesPerMonth}) reached. Upgrade your plan for more queries.`
      );
    }
  }

  /**
   * Record a query for usage tracking.
   */
  private async recordQuery(
    userId: string,
    params: LiteratureSearchParams,
    result: Omit<LiteratureSearchResult, 'responseTimeMs'>,
    responseTimeMs: number
  ): Promise<void> {
    await prisma.literatureQuery.create({
      data: {
        userId,
        query: params.query,
        context: params.context,
        letterId: params.letterId,
        sources: params.sources || ['pubmed', 'user_library', 'uptodate'],
        confidence: result.confidence,
        responseTimeMs,
        cachedResponse: JSON.parse(JSON.stringify(result)),
        cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour cache
      },
    });
  }
}

// Singleton instance
let orchestrationService: LiteratureOrchestrationService | null = null;

/**
 * Get the literature orchestration service singleton.
 */
export function getLiteratureOrchestrationService(): LiteratureOrchestrationService {
  if (!orchestrationService) {
    orchestrationService = new LiteratureOrchestrationService();
  }
  return orchestrationService;
}

// Export class for testing
export { LiteratureOrchestrationService };
