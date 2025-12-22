// src/domains/style/subspecialty-profile.service.ts
// Service for managing per-clinician, per-subspecialty style profiles

import type { Subspecialty } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { logger } from '@/lib/logger';
import type {
  SubspecialtyStyleProfile,
  CreateSubspecialtyProfileInput,
  UpdateSubspecialtyProfileInput,
  ListProfilesResponse,
  ProfileOperationResponse,
  SubspecialtyConfidenceScores,
  SectionInclusionMap,
  SectionVerbosityMap,
  SectionPhrasingMap,
  VocabularyMap,
  StyleSeedLetter,
  CreateSeedLetterInput,
} from './subspecialty-profile.types';

// ============ In-Memory Cache ============

/**
 * Simple in-memory cache for style profiles.
 * Keyed by `${userId}:${subspecialty}`.
 */
const profileCache = new Map<string, { profile: SubspecialtyStyleProfile; cachedAt: number }>();

/**
 * Cache TTL in milliseconds (5 minutes).
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get cache key for a user + subspecialty combination.
 */
function getCacheKey(userId: string, subspecialty: Subspecialty): string {
  return `${userId}:${subspecialty}`;
}

/**
 * Get cached profile if still valid.
 */
function getCachedProfile(userId: string, subspecialty: Subspecialty): SubspecialtyStyleProfile | null {
  const key = getCacheKey(userId, subspecialty);
  const entry = profileCache.get(key);

  if (!entry) return null;

  const isExpired = Date.now() - entry.cachedAt > CACHE_TTL_MS;
  if (isExpired) {
    profileCache.delete(key);
    return null;
  }

  return entry.profile;
}

/**
 * Set cached profile.
 */
function setCachedProfile(userId: string, subspecialty: Subspecialty, profile: SubspecialtyStyleProfile): void {
  const key = getCacheKey(userId, subspecialty);
  profileCache.set(key, { profile, cachedAt: Date.now() });
}

/**
 * Invalidate cached profile.
 */
function invalidateCachedProfile(userId: string, subspecialty: Subspecialty): void {
  const key = getCacheKey(userId, subspecialty);
  profileCache.delete(key);
}

/**
 * Invalidate all cached profiles for a user.
 */
function invalidateUserCache(userId: string): void {
  const keysToDelete: string[] = [];
  profileCache.forEach((_, key) => {
    if (key.startsWith(`${userId}:`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => profileCache.delete(key));
}

// ============ Profile CRUD Operations ============

/**
 * Create a new subspecialty style profile.
 * If a profile already exists for this user+subspecialty, it will be updated instead.
 */
export async function createStyleProfile(
  input: CreateSubspecialtyProfileInput
): Promise<SubspecialtyStyleProfile> {
  const log = logger.child({ action: 'createStyleProfile', userId: input.userId, subspecialty: input.subspecialty });

  // Check if profile already exists
  const existing = await prisma.styleProfile.findUnique({
    where: {
      userId_subspecialty: {
        userId: input.userId,
        subspecialty: input.subspecialty,
      },
    },
  });

  if (existing) {
    log.info('Profile exists, updating instead');
    return updateStyleProfile(input.userId, input.subspecialty, {
      sectionOrder: input.sectionOrder,
      sectionInclusion: input.sectionInclusion,
      sectionVerbosity: input.sectionVerbosity,
      phrasingPreferences: input.phrasingPreferences,
      avoidedPhrases: input.avoidedPhrases,
      vocabularyMap: input.vocabularyMap,
      terminologyLevel: input.terminologyLevel,
      greetingStyle: input.greetingStyle,
      closingStyle: input.closingStyle,
      signoffTemplate: input.signoffTemplate,
      formalityLevel: input.formalityLevel,
      paragraphStructure: input.paragraphStructure,
      learningStrength: input.learningStrength,
    });
  }

  // Create new profile
  const profile = await prisma.styleProfile.create({
    data: {
      userId: input.userId,
      subspecialty: input.subspecialty,
      sectionOrder: input.sectionOrder ?? [],
      sectionInclusion: (input.sectionInclusion ?? {}) as never,
      sectionVerbosity: (input.sectionVerbosity ?? {}) as never,
      phrasingPreferences: (input.phrasingPreferences ?? {}) as never,
      avoidedPhrases: (input.avoidedPhrases ?? {}) as never,
      vocabularyMap: (input.vocabularyMap ?? {}) as never,
      terminologyLevel: input.terminologyLevel ?? null,
      greetingStyle: input.greetingStyle ?? null,
      closingStyle: input.closingStyle ?? null,
      signoffTemplate: input.signoffTemplate ?? null,
      formalityLevel: input.formalityLevel ?? null,
      paragraphStructure: input.paragraphStructure ?? null,
      confidence: {} as never,
      learningStrength: input.learningStrength ?? 1.0,
      totalEditsAnalyzed: 0,
      lastAnalyzedAt: null,
    },
  });

  const mapped = mapPrismaProfileToDomain(profile);

  // Cache the new profile
  setCachedProfile(input.userId, input.subspecialty, mapped);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: 'style.subspecialty_profile_created',
      resourceType: 'style_profile',
      resourceId: profile.id,
      metadata: {
        subspecialty: input.subspecialty,
      },
    },
  });

  log.info('Style profile created', { profileId: profile.id });

  return mapped;
}

/**
 * Get a subspecialty style profile for a user.
 * Returns null if no profile exists.
 */
export async function getStyleProfile(
  userId: string,
  subspecialty: Subspecialty
): Promise<SubspecialtyStyleProfile | null> {
  // Check cache first
  const cached = getCachedProfile(userId, subspecialty);
  if (cached) {
    return cached;
  }

  const profile = await prisma.styleProfile.findUnique({
    where: {
      userId_subspecialty: {
        userId,
        subspecialty,
      },
    },
  });

  if (!profile) {
    return null;
  }

  const mapped = mapPrismaProfileToDomain(profile);

  // Cache the profile
  setCachedProfile(userId, subspecialty, mapped);

  return mapped;
}

/**
 * List all subspecialty style profiles for a user.
 */
export async function listStyleProfiles(userId: string): Promise<ListProfilesResponse> {
  const profiles = await prisma.styleProfile.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  const mapped = profiles.map(mapPrismaProfileToDomain);

  // Update cache with all fetched profiles
  for (const profile of mapped) {
    setCachedProfile(userId, profile.subspecialty, profile);
  }

  return {
    profiles: mapped,
    totalCount: mapped.length,
  };
}

/**
 * Update an existing subspecialty style profile.
 * Creates the profile if it doesn't exist.
 */
export async function updateStyleProfile(
  userId: string,
  subspecialty: Subspecialty,
  updates: UpdateSubspecialtyProfileInput
): Promise<SubspecialtyStyleProfile> {
  const log = logger.child({ action: 'updateStyleProfile', userId, subspecialty });

  // Use upsert to handle both create and update
  const profile = await prisma.styleProfile.upsert({
    where: {
      userId_subspecialty: {
        userId,
        subspecialty,
      },
    },
    create: {
      userId,
      subspecialty,
      sectionOrder: updates.sectionOrder ?? [],
      sectionInclusion: (updates.sectionInclusion ?? {}) as never,
      sectionVerbosity: (updates.sectionVerbosity ?? {}) as never,
      phrasingPreferences: (updates.phrasingPreferences ?? {}) as never,
      avoidedPhrases: (updates.avoidedPhrases ?? {}) as never,
      vocabularyMap: (updates.vocabularyMap ?? {}) as never,
      terminologyLevel: updates.terminologyLevel ?? null,
      greetingStyle: updates.greetingStyle ?? null,
      closingStyle: updates.closingStyle ?? null,
      signoffTemplate: updates.signoffTemplate ?? null,
      formalityLevel: updates.formalityLevel ?? null,
      paragraphStructure: updates.paragraphStructure ?? null,
      confidence: (updates.confidence ?? {}) as never,
      learningStrength: updates.learningStrength ?? 1.0,
      totalEditsAnalyzed: updates.totalEditsAnalyzed ?? 0,
      lastAnalyzedAt: updates.lastAnalyzedAt ?? null,
    },
    update: buildUpdateData(updates),
  });

  const mapped = mapPrismaProfileToDomain(profile);

  // Update cache (overwrites any existing entry)
  setCachedProfile(userId, subspecialty, mapped);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'style.subspecialty_profile_updated',
      resourceType: 'style_profile',
      resourceId: profile.id,
      metadata: {
        subspecialty,
        updatedFields: Object.keys(updates),
      },
    },
  });

  log.info('Style profile updated', { profileId: profile.id });

  return mapped;
}

/**
 * Delete a subspecialty style profile (reset to defaults).
 * This removes the profile entirely; future generations will use default behavior.
 */
export async function deleteStyleProfile(
  userId: string,
  subspecialty: Subspecialty
): Promise<ProfileOperationResponse> {
  const log = logger.child({ action: 'deleteStyleProfile', userId, subspecialty });

  const existing = await prisma.styleProfile.findUnique({
    where: {
      userId_subspecialty: {
        userId,
        subspecialty,
      },
    },
  });

  if (!existing) {
    return {
      success: false,
      message: `No style profile found for subspecialty ${subspecialty}`,
    };
  }

  await prisma.styleProfile.delete({
    where: {
      userId_subspecialty: {
        userId,
        subspecialty,
      },
    },
  });

  // Invalidate cache
  invalidateCachedProfile(userId, subspecialty);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'style.subspecialty_profile_deleted',
      resourceType: 'style_profile',
      resourceId: existing.id,
      metadata: {
        subspecialty,
        totalEditsAnalyzed: existing.totalEditsAnalyzed,
      },
    },
  });

  log.info('Style profile deleted (reset to defaults)', { profileId: existing.id });

  return {
    success: true,
    message: `Style profile for ${subspecialty} has been reset to defaults`,
  };
}

/**
 * Adjust the learning strength for a subspecialty profile.
 * Learning strength controls how aggressively the profile is applied:
 * - 0.0 = disabled (no personalization)
 * - 0.5 = moderate (balanced personalization)
 * - 1.0 = full (strong personalization)
 */
export async function adjustLearningStrength(
  userId: string,
  subspecialty: Subspecialty,
  learningStrength: number
): Promise<ProfileOperationResponse> {
  const log = logger.child({ action: 'adjustLearningStrength', userId, subspecialty, learningStrength });

  // Validate range
  if (learningStrength < 0 || learningStrength > 1) {
    return {
      success: false,
      message: 'Learning strength must be between 0.0 and 1.0',
    };
  }

  const existing = await prisma.styleProfile.findUnique({
    where: {
      userId_subspecialty: {
        userId,
        subspecialty,
      },
    },
  });

  if (!existing) {
    return {
      success: false,
      message: `No style profile found for subspecialty ${subspecialty}`,
    };
  }

  const profile = await prisma.styleProfile.update({
    where: {
      userId_subspecialty: {
        userId,
        subspecialty,
      },
    },
    data: {
      learningStrength,
    },
  });

  const mapped = mapPrismaProfileToDomain(profile);

  // Update cache (overwrites any existing entry)
  setCachedProfile(userId, subspecialty, mapped);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'style.learning_strength_adjusted',
      resourceType: 'style_profile',
      resourceId: profile.id,
      metadata: {
        subspecialty,
        previousStrength: existing.learningStrength,
        newStrength: learningStrength,
      },
    },
  });

  log.info('Learning strength adjusted', {
    profileId: profile.id,
    previousStrength: existing.learningStrength,
    newStrength: learningStrength,
  });

  return {
    success: true,
    profile: mapped,
    message: `Learning strength updated to ${learningStrength}`,
  };
}

// ============ Seed Letter Operations ============

/**
 * Create a seed letter for bootstrapping a style profile.
 */
export async function createSeedLetter(
  input: CreateSeedLetterInput
): Promise<StyleSeedLetter> {
  const log = logger.child({ action: 'createSeedLetter', userId: input.userId, subspecialty: input.subspecialty });

  const seedLetter = await prisma.styleSeedLetter.create({
    data: {
      userId: input.userId,
      subspecialty: input.subspecialty,
      letterText: input.letterText,
      analyzedAt: null,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: 'style.seed_letter_created',
      resourceType: 'style_seed_letter',
      resourceId: seedLetter.id,
      metadata: {
        subspecialty: input.subspecialty,
        letterLength: input.letterText.length,
      },
    },
  });

  log.info('Seed letter created', { seedLetterId: seedLetter.id });

  return mapPrismaSeedLetterToDomain(seedLetter);
}

/**
 * List seed letters for a user, optionally filtered by subspecialty.
 */
export async function listSeedLetters(
  userId: string,
  subspecialty?: Subspecialty
): Promise<StyleSeedLetter[]> {
  const seedLetters = await prisma.styleSeedLetter.findMany({
    where: {
      userId,
      ...(subspecialty ? { subspecialty } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return seedLetters.map(mapPrismaSeedLetterToDomain);
}

/**
 * Delete a seed letter.
 */
export async function deleteSeedLetter(
  userId: string,
  seedLetterId: string
): Promise<ProfileOperationResponse> {
  const log = logger.child({ action: 'deleteSeedLetter', userId, seedLetterId });

  const existing = await prisma.styleSeedLetter.findFirst({
    where: {
      id: seedLetterId,
      userId,
    },
  });

  if (!existing) {
    return {
      success: false,
      message: 'Seed letter not found',
    };
  }

  await prisma.styleSeedLetter.delete({
    where: { id: seedLetterId },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'style.seed_letter_deleted',
      resourceType: 'style_seed_letter',
      resourceId: seedLetterId,
      metadata: {
        subspecialty: existing.subspecialty,
      },
    },
  });

  log.info('Seed letter deleted', { seedLetterId });

  return {
    success: true,
    message: 'Seed letter deleted',
  };
}

/**
 * Mark a seed letter as analyzed.
 */
export async function markSeedLetterAnalyzed(seedLetterId: string): Promise<void> {
  await prisma.styleSeedLetter.update({
    where: { id: seedLetterId },
    data: { analyzedAt: new Date() },
  });
}

// ============ Utility Functions ============

/**
 * Get edit statistics for a subspecialty profile.
 */
export async function getSubspecialtyEditStatistics(
  userId: string,
  subspecialty: Subspecialty
): Promise<{
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
      where: { userId, subspecialty },
    }),
    prisma.styleEdit.count({
      where: { userId, subspecialty, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.styleEdit.count({
      where: { userId, subspecialty, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.styleEdit.findFirst({
      where: { userId, subspecialty },
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

/**
 * Check if a user has enough edits to trigger style analysis.
 */
export async function hasEnoughEditsForAnalysis(
  userId: string,
  subspecialty: Subspecialty,
  minEdits: number = 5
): Promise<boolean> {
  const count = await prisma.styleEdit.count({
    where: { userId, subspecialty },
  });

  return count >= minEdits;
}

/**
 * Get the profile that should be used for generation.
 * Implements fallback chain: subspecialty → global → default
 *
 * 1. If subspecialty is provided and a subspecialty profile exists with edits analyzed, use it
 * 2. Otherwise, check if user has a global style profile (User.styleProfile)
 * 3. If no profiles exist, return null (default behavior)
 */
export async function getEffectiveProfile(
  userId: string,
  subspecialty?: Subspecialty
): Promise<{ profile: SubspecialtyStyleProfile | null; source: 'subspecialty' | 'global' | 'default' }> {
  // Try subspecialty-specific profile first
  if (subspecialty) {
    const subProfile = await getStyleProfile(userId, subspecialty);
    if (subProfile && subProfile.totalEditsAnalyzed > 0) {
      return { profile: subProfile, source: 'subspecialty' };
    }
  }

  // Try global profile from User.styleProfile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { styleProfile: true },
  });

  if (user?.styleProfile) {
    const globalProfile = user.styleProfile as Record<string, unknown>;

    // Check if global profile has been analyzed (has meaningful data)
    if (globalProfile.lastAnalyzedAt && globalProfile.totalEditsAnalyzed) {
      // Convert global profile to SubspecialtyStyleProfile format for consistent handling
      const convertedProfile = convertGlobalToSubspecialtyFormat(userId, globalProfile, subspecialty);
      if (convertedProfile) {
        return { profile: convertedProfile, source: 'global' };
      }
    }
  }

  // No usable profile available - use defaults
  return { profile: null, source: 'default' };
}

/**
 * Convert a global style profile (from User.styleProfile) to the SubspecialtyStyleProfile format.
 * This allows the prompt conditioner to handle both types uniformly.
 */
function convertGlobalToSubspecialtyFormat(
  userId: string,
  globalProfile: Record<string, unknown>,
  subspecialty?: Subspecialty
): SubspecialtyStyleProfile | null {
  // Validate that the global profile has the expected structure
  if (!globalProfile.confidence || typeof globalProfile.totalEditsAnalyzed !== 'number') {
    return null;
  }

  const confidence = globalProfile.confidence as Record<string, number>;

  return {
    id: 'global', // Synthetic ID to indicate this is from global profile
    userId,
    subspecialty: subspecialty ?? ('GENERAL_CARDIOLOGY' as Subspecialty), // Use provided or default
    sectionOrder: (globalProfile.sectionOrder as string[]) ?? [],
    sectionInclusion: {},
    sectionVerbosity: {},
    phrasingPreferences: {},
    avoidedPhrases: {},
    vocabularyMap: (globalProfile.vocabularyPreferences as VocabularyMap) ?? {},
    terminologyLevel: null,
    greetingStyle: (globalProfile.greetingStyle as SubspecialtyStyleProfile['greetingStyle']) ?? null,
    closingStyle: (globalProfile.closingStyle as SubspecialtyStyleProfile['closingStyle']) ?? null,
    signoffTemplate: (globalProfile.closingExamples as string[])?.[0] ?? null,
    formalityLevel: (globalProfile.formalityLevel as SubspecialtyStyleProfile['formalityLevel']) ?? null,
    paragraphStructure: (globalProfile.paragraphStructure as SubspecialtyStyleProfile['paragraphStructure']) ?? null,
    confidence: {
      sectionOrder: confidence.paragraphStructure ?? 0,
      sectionInclusion: 0,
      sectionVerbosity: 0,
      phrasingPreferences: 0,
      avoidedPhrases: 0,
      vocabularyMap: 0.5, // Assume moderate confidence if vocabulary exists
      terminologyLevel: 0,
      greetingStyle: confidence.greetingStyle ?? 0,
      closingStyle: confidence.closingStyle ?? 0,
      signoffTemplate: confidence.closingStyle ?? 0,
      formalityLevel: confidence.formalityLevel ?? 0,
      paragraphStructure: confidence.paragraphStructure ?? 0,
    },
    learningStrength: 1.0, // Full strength for global profile
    totalEditsAnalyzed: globalProfile.totalEditsAnalyzed as number,
    lastAnalyzedAt: globalProfile.lastAnalyzedAt ? new Date(globalProfile.lastAnalyzedAt as string) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Clear all cached profiles.
 * Useful for testing or when bulk updates occur.
 */
export function clearProfileCache(): void {
  profileCache.clear();
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: profileCache.size,
    keys: Array.from(profileCache.keys()),
  };
}

// ============ Helper Functions ============

/**
 * Map Prisma StyleProfile to domain type.
 */
function mapPrismaProfileToDomain(profile: {
  id: string;
  userId: string;
  subspecialty: Subspecialty;
  sectionOrder: string[];
  sectionInclusion: unknown;
  sectionVerbosity: unknown;
  phrasingPreferences: unknown;
  avoidedPhrases: unknown;
  vocabularyMap: unknown;
  terminologyLevel: string | null;
  greetingStyle: string | null;
  closingStyle: string | null;
  signoffTemplate: string | null;
  formalityLevel: string | null;
  paragraphStructure: string | null;
  confidence: unknown;
  learningStrength: number;
  totalEditsAnalyzed: number;
  lastAnalyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SubspecialtyStyleProfile {
  return {
    id: profile.id,
    userId: profile.userId,
    subspecialty: profile.subspecialty,
    sectionOrder: profile.sectionOrder,
    sectionInclusion: (profile.sectionInclusion ?? {}) as SectionInclusionMap,
    sectionVerbosity: (profile.sectionVerbosity ?? {}) as SectionVerbosityMap,
    phrasingPreferences: (profile.phrasingPreferences ?? {}) as SectionPhrasingMap,
    avoidedPhrases: (profile.avoidedPhrases ?? {}) as SectionPhrasingMap,
    vocabularyMap: (profile.vocabularyMap ?? {}) as VocabularyMap,
    terminologyLevel: profile.terminologyLevel as SubspecialtyStyleProfile['terminologyLevel'],
    greetingStyle: profile.greetingStyle as SubspecialtyStyleProfile['greetingStyle'],
    closingStyle: profile.closingStyle as SubspecialtyStyleProfile['closingStyle'],
    signoffTemplate: profile.signoffTemplate,
    formalityLevel: profile.formalityLevel as SubspecialtyStyleProfile['formalityLevel'],
    paragraphStructure: profile.paragraphStructure as SubspecialtyStyleProfile['paragraphStructure'],
    confidence: (profile.confidence ?? {}) as Partial<SubspecialtyConfidenceScores>,
    learningStrength: profile.learningStrength,
    totalEditsAnalyzed: profile.totalEditsAnalyzed,
    lastAnalyzedAt: profile.lastAnalyzedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Map Prisma StyleSeedLetter to domain type.
 */
function mapPrismaSeedLetterToDomain(seedLetter: {
  id: string;
  userId: string;
  subspecialty: Subspecialty;
  letterText: string;
  analyzedAt: Date | null;
  createdAt: Date;
}): StyleSeedLetter {
  return {
    id: seedLetter.id,
    userId: seedLetter.userId,
    subspecialty: seedLetter.subspecialty,
    letterText: seedLetter.letterText,
    analyzedAt: seedLetter.analyzedAt,
    createdAt: seedLetter.createdAt,
  };
}

/**
 * Build Prisma update data from partial input.
 * Only includes fields that are explicitly provided.
 */
function buildUpdateData(updates: UpdateSubspecialtyProfileInput): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (updates.sectionOrder !== undefined) {
    data.sectionOrder = updates.sectionOrder;
  }
  if (updates.sectionInclusion !== undefined) {
    data.sectionInclusion = updates.sectionInclusion as never;
  }
  if (updates.sectionVerbosity !== undefined) {
    data.sectionVerbosity = updates.sectionVerbosity as never;
  }
  if (updates.phrasingPreferences !== undefined) {
    data.phrasingPreferences = updates.phrasingPreferences as never;
  }
  if (updates.avoidedPhrases !== undefined) {
    data.avoidedPhrases = updates.avoidedPhrases as never;
  }
  if (updates.vocabularyMap !== undefined) {
    data.vocabularyMap = updates.vocabularyMap as never;
  }
  if (updates.terminologyLevel !== undefined) {
    data.terminologyLevel = updates.terminologyLevel;
  }
  if (updates.greetingStyle !== undefined) {
    data.greetingStyle = updates.greetingStyle;
  }
  if (updates.closingStyle !== undefined) {
    data.closingStyle = updates.closingStyle;
  }
  if (updates.signoffTemplate !== undefined) {
    data.signoffTemplate = updates.signoffTemplate;
  }
  if (updates.formalityLevel !== undefined) {
    data.formalityLevel = updates.formalityLevel;
  }
  if (updates.paragraphStructure !== undefined) {
    data.paragraphStructure = updates.paragraphStructure;
  }
  if (updates.confidence !== undefined) {
    data.confidence = updates.confidence as never;
  }
  if (updates.learningStrength !== undefined) {
    data.learningStrength = updates.learningStrength;
  }
  if (updates.totalEditsAnalyzed !== undefined) {
    data.totalEditsAnalyzed = updates.totalEditsAnalyzed;
  }
  if (updates.lastAnalyzedAt !== undefined) {
    data.lastAnalyzedAt = updates.lastAnalyzedAt;
  }

  return data;
}
