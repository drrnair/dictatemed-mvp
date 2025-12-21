// src/domains/letters/templates/template.service.ts
// Service for managing letter templates and user preferences

import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import type {
  LetterTemplate,
  UserTemplatePreference,
  TemplateWithPreference,
  TemplateRecommendation,
  RecommendationReason,
  Subspecialty,
  TemplateCategory,
  CreateTemplateInput,
  UpdateTemplatePreferenceInput,
  TemplateListQuery,
} from './template.types';
import { SEED_TEMPLATES } from './template.registry';

// ============ Template CRUD ============

/**
 * Get all active templates with optional filtering.
 */
export async function getTemplates(
  query: TemplateListQuery = {}
): Promise<LetterTemplate[]> {
  const where: Record<string, unknown> = {
    isActive: query.includeInactive ? undefined : true,
  };

  if (query.category) {
    where.category = query.category;
  }

  if (query.subspecialty) {
    where.OR = [
      { subspecialties: { has: query.subspecialty } },
      ...(query.includeGeneric !== false ? [{ isGeneric: true }] : []),
    ];
  }

  if (query.parentId !== undefined) {
    where.parentId = query.parentId;
  }

  const templates = await prisma.letterTemplate.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return templates.map(mapTemplate);
}

/**
 * Get a single template by ID.
 */
export async function getTemplateById(id: string): Promise<LetterTemplate | null> {
  const template = await prisma.letterTemplate.findUnique({
    where: { id },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      parent: true,
    },
  });

  return template ? mapTemplate(template) : null;
}

/**
 * Get a template by slug.
 */
export async function getTemplateBySlug(slug: string): Promise<LetterTemplate | null> {
  const template = await prisma.letterTemplate.findUnique({
    where: { slug },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return template ? mapTemplate(template) : null;
}

/**
 * Create a new template (admin only).
 */
export async function createTemplate(
  input: CreateTemplateInput
): Promise<LetterTemplate> {
  const log = logger.child({ action: 'createTemplate', slug: input.slug });

  const template = await prisma.letterTemplate.create({
    data: {
      name: input.name,
      description: input.description,
      slug: input.slug,
      category: input.category,
      subspecialties: input.subspecialties,
      isGeneric: input.isGeneric ?? false,
      parentId: input.parentId,
      promptTemplate: input.promptTemplate,
      sectionOrder: input.sectionOrder,
      requiredSections: input.requiredSections,
      optionalSections: input.optionalSections ?? [],
      sampleContent: input.sampleContent,
      sortOrder: input.sortOrder ?? 0,
    },
  });

  log.info('Template created', { templateId: template.id });

  return mapTemplate(template);
}

/**
 * Seed templates from registry if database is empty.
 */
export async function seedTemplates(): Promise<{ created: number; skipped: number }> {
  const log = logger.child({ action: 'seedTemplates' });

  const existingCount = await prisma.letterTemplate.count();

  if (existingCount > 0) {
    log.info('Templates already exist, skipping seed', { existingCount });
    return { created: 0, skipped: SEED_TEMPLATES.length };
  }

  let created = 0;

  for (const templateInput of SEED_TEMPLATES) {
    try {
      await prisma.letterTemplate.create({
        data: {
          name: templateInput.name,
          description: templateInput.description,
          slug: templateInput.slug,
          category: templateInput.category,
          subspecialties: templateInput.subspecialties,
          isGeneric: templateInput.isGeneric ?? false,
          parentId: templateInput.parentId,
          promptTemplate: templateInput.promptTemplate,
          sectionOrder: templateInput.sectionOrder,
          requiredSections: templateInput.requiredSections,
          optionalSections: templateInput.optionalSections ?? [],
          sampleContent: templateInput.sampleContent,
          sortOrder: templateInput.sortOrder ?? 0,
        },
      });
      created++;
    } catch (error) {
      log.error('Failed to create template', { slug: templateInput.slug }, error instanceof Error ? error : undefined);
    }
  }

  log.info('Templates seeded', { created });

  return { created, skipped: 0 };
}

// ============ User Preferences ============

/**
 * Get templates with user preference data.
 */
export async function getTemplatesWithPreferences(
  userId: string,
  query: TemplateListQuery = {}
): Promise<TemplateWithPreference[]> {
  // Use dedicated favorites query if favoritesOnly is true
  if (query.favoritesOnly) {
    return getFavoriteTemplates(userId);
  }

  const templates = await getTemplates(query);

  const preferences = await prisma.userTemplatePreference.findMany({
    where: {
      userId,
      templateId: { in: templates.map((t) => t.id) },
    },
  });

  const prefMap = new Map(preferences.map((p) => [p.templateId, p]));

  return templates.map((template) => ({
    ...template,
    userPreference: prefMap.has(template.id)
      ? mapPreference(prefMap.get(template.id)!)
      : undefined,
  }));
}

/**
 * Get user's favorite templates.
 */
export async function getFavoriteTemplates(
  userId: string
): Promise<TemplateWithPreference[]> {
  const preferences = await prisma.userTemplatePreference.findMany({
    where: {
      userId,
      isFavorite: true,
    },
    include: {
      template: {
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return preferences
    .filter((p) => p.template.isActive)
    .map((p) => ({
      ...mapTemplate(p.template),
      userPreference: mapPreference(p),
    }));
}

/**
 * Toggle favorite status for a template.
 */
export async function toggleFavorite(
  userId: string,
  templateId: string
): Promise<UserTemplatePreference> {
  const log = logger.child({ action: 'toggleFavorite', userId, templateId });

  const existing = await prisma.userTemplatePreference.findUnique({
    where: {
      userId_templateId: { userId, templateId },
    },
  });

  let preference;

  if (existing) {
    preference = await prisma.userTemplatePreference.update({
      where: { id: existing.id },
      data: { isFavorite: !existing.isFavorite },
    });
  } else {
    preference = await prisma.userTemplatePreference.create({
      data: {
        userId,
        templateId,
        isFavorite: true,
      },
    });
  }

  log.info('Favorite toggled', {
    preferenceId: preference.id,
    isFavorite: preference.isFavorite,
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: preference.isFavorite ? 'template.favorited' : 'template.unfavorited',
      resourceType: 'letter_template',
      resourceId: templateId,
    },
  });

  return mapPreference(preference);
}

/**
 * Update template preference (style overrides).
 */
export async function updateTemplatePreference(
  userId: string,
  templateId: string,
  input: UpdateTemplatePreferenceInput
): Promise<UserTemplatePreference> {
  const log = logger.child({ action: 'updateTemplatePreference', userId, templateId });

  const preference = await prisma.userTemplatePreference.upsert({
    where: {
      userId_templateId: { userId, templateId },
    },
    create: {
      userId,
      templateId,
      isFavorite: input.isFavorite ?? false,
      styleOverrides: input.styleOverrides ?? {},
    },
    update: {
      ...(input.isFavorite !== undefined && { isFavorite: input.isFavorite }),
      ...(input.styleOverrides && { styleOverrides: input.styleOverrides }),
    },
  });

  log.info('Template preference updated', { preferenceId: preference.id });

  return mapPreference(preference);
}

/**
 * Record template usage (for recommendations).
 */
export async function recordTemplateUsage(
  userId: string,
  templateId: string
): Promise<void> {
  await prisma.userTemplatePreference.upsert({
    where: {
      userId_templateId: { userId, templateId },
    },
    create: {
      userId,
      templateId,
      usageCount: 1,
      lastUsedAt: new Date(),
    },
    update: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}

// ============ Recommendations ============

/**
 * Get recommended templates for a user based on subspecialties, usage, and favorites.
 */
export async function getRecommendedTemplates(
  userId: string,
  limit: number = 6
): Promise<TemplateRecommendation[]> {
  // Get user's subspecialty interests
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subspecialties: true },
  });

  const userSubspecialties = (user?.subspecialties ?? []) as Subspecialty[];

  // Get all active templates
  const templates = await prisma.letterTemplate.findMany({
    where: { isActive: true, parentId: null }, // Only top-level templates
    include: {
      variants: {
        where: { isActive: true },
      },
    },
  });

  // Get user preferences
  const preferences = await prisma.userTemplatePreference.findMany({
    where: { userId },
  });

  const prefMap = new Map(preferences.map((p) => [p.templateId, p]));

  // Score each template
  const scored: TemplateRecommendation[] = templates.map((template) => {
    const pref = prefMap.get(template.id);
    const reasons: RecommendationReason[] = [];
    let score = 0;

    // Favorite bonus (+50)
    if (pref?.isFavorite) {
      score += 50;
      reasons.push({ type: 'favorite' });
    }

    // Subspecialty match (+30 per match)
    const subspecialtyMatches = (template.subspecialties as Subspecialty[]).filter(
      (s) => userSubspecialties.includes(s)
    );
    if (subspecialtyMatches.length > 0) {
      score += subspecialtyMatches.length * 30;
      subspecialtyMatches.forEach((s) =>
        reasons.push({ type: 'subspecialty_match', subspecialty: s })
      );
    }

    // Generic template base score (+5)
    if (template.isGeneric) {
      score += 5;
      reasons.push({ type: 'generic' });
    }

    // Recent usage bonus (+20 if used in last 7 days)
    if (pref?.lastUsedAt) {
      const daysSinceUse = (Date.now() - pref.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUse <= 7) {
        score += 20;
        reasons.push({ type: 'recently_used', lastUsedAt: pref.lastUsedAt });
      }
    }

    // Frequent usage bonus (+1 per use, max +15)
    if (pref?.usageCount && pref.usageCount > 0) {
      const usageBonus = Math.min(pref.usageCount, 15);
      score += usageBonus;
      if (pref.usageCount >= 3) {
        reasons.push({ type: 'frequently_used', usageCount: pref.usageCount });
      }
    }

    return {
      template: mapTemplate(template),
      score,
      reasons,
    };
  });

  // Sort by score and return top N
  return scored
    .filter((r) => r.score > 0) // Only include templates with some relevance
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ============ Subspecialty Management ============

/**
 * Get user's subspecialty interests.
 */
export async function getUserSubspecialties(userId: string): Promise<Subspecialty[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subspecialties: true },
  });

  return (user?.subspecialties ?? []) as Subspecialty[];
}

/**
 * Update user's subspecialty interests.
 */
export async function updateUserSubspecialties(
  userId: string,
  subspecialties: Subspecialty[]
): Promise<Subspecialty[]> {
  const log = logger.child({ action: 'updateUserSubspecialties', userId });

  await prisma.user.update({
    where: { id: userId },
    data: { subspecialties },
  });

  log.info('User subspecialties updated', { subspecialties });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'user.subspecialties_updated',
      resourceType: 'user',
      resourceId: userId,
      metadata: { subspecialties },
    },
  });

  return subspecialties;
}

// ============ Template for Letter Generation ============

/**
 * Get the effective prompt template for letter generation.
 * Combines the base template with any user style overrides.
 */
export async function getEffectivePromptTemplate(
  userId: string,
  templateId: string
): Promise<{
  promptTemplate: string;
  sectionOrder: string[];
  styleOverrides: Record<string, unknown>;
} | null> {
  const template = await prisma.letterTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    return null;
  }

  const preference = await prisma.userTemplatePreference.findUnique({
    where: {
      userId_templateId: { userId, templateId },
    },
  });

  return {
    promptTemplate: template.promptTemplate,
    sectionOrder: template.sectionOrder,
    styleOverrides: (preference?.styleOverrides as Record<string, unknown>) ?? {},
  };
}

// ============ Mappers ============

function mapTemplate(
  dbTemplate: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    category: string;
    subspecialties: string[];
    isGeneric: boolean;
    parentId: string | null;
    promptTemplate: string;
    sectionOrder: string[];
    requiredSections: string[];
    optionalSections: string[];
    sampleContent: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    variants?: unknown[];
  }
): LetterTemplate {
  return {
    id: dbTemplate.id,
    name: dbTemplate.name,
    description: dbTemplate.description ?? undefined,
    slug: dbTemplate.slug,
    category: dbTemplate.category as TemplateCategory,
    subspecialties: dbTemplate.subspecialties as Subspecialty[],
    isGeneric: dbTemplate.isGeneric,
    parentId: dbTemplate.parentId ?? undefined,
    variants: dbTemplate.variants
      ? (dbTemplate.variants as Array<{
          id: string;
          name: string;
          description: string | null;
          slug: string;
          category: string;
          subspecialties: string[];
          isGeneric: boolean;
          parentId: string | null;
          promptTemplate: string;
          sectionOrder: string[];
          requiredSections: string[];
          optionalSections: string[];
          sampleContent: string | null;
          isActive: boolean;
          sortOrder: number;
          createdAt: Date;
          updatedAt: Date;
        }>).map(mapTemplate)
      : undefined,
    promptTemplate: dbTemplate.promptTemplate,
    sectionOrder: dbTemplate.sectionOrder,
    requiredSections: dbTemplate.requiredSections,
    optionalSections: dbTemplate.optionalSections,
    sampleContent: dbTemplate.sampleContent ?? undefined,
    isActive: dbTemplate.isActive,
    sortOrder: dbTemplate.sortOrder,
    createdAt: dbTemplate.createdAt,
    updatedAt: dbTemplate.updatedAt,
  };
}

function mapPreference(
  dbPref: {
    id: string;
    userId: string;
    templateId: string;
    isFavorite: boolean;
    usageCount: number;
    styleOverrides: unknown;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }
): UserTemplatePreference {
  return {
    id: dbPref.id,
    userId: dbPref.userId,
    templateId: dbPref.templateId,
    isFavorite: dbPref.isFavorite,
    usageCount: dbPref.usageCount,
    styleOverrides: dbPref.styleOverrides as Record<string, unknown>,
    lastUsedAt: dbPref.lastUsedAt ?? undefined,
    createdAt: dbPref.createdAt,
    updatedAt: dbPref.updatedAt,
  };
}
