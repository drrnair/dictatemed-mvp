// src/lib/cache.ts
// Server-side caching utilities using Next.js unstable_cache
//
// This module provides cached wrappers for expensive database queries.
// Use these functions in Server Components and API routes for automatic
// request deduplication and time-based revalidation.
//
// Cache Tiers:
// - STATIC: 24 hours - Reference data (specialties, subspecialties)
// - TEMPLATES: 1 hour - Admin-managed template data
// - USER_SETTINGS: 30 minutes - User preferences that change infrequently
// - DYNAMIC: 5 minutes - Frequently changing data with acceptable staleness

import { unstable_cache } from 'next/cache';
import { prisma } from '@/infrastructure/db/client';
import type { Subspecialty } from '@prisma/client';

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Cache TTL values in seconds
 */
export const CACHE_TTL = {
  /** Reference data that rarely changes (24 hours) */
  STATIC: 24 * 60 * 60,
  /** Admin-managed templates (1 hour) */
  TEMPLATES: 60 * 60,
  /** User settings and preferences (30 minutes) */
  USER_SETTINGS: 30 * 60,
  /** Dynamic data with acceptable staleness (5 minutes) */
  DYNAMIC: 5 * 60,
} as const;

/**
 * Cache tags for invalidation
 */
export const CACHE_TAGS = {
  SPECIALTIES: 'specialties',
  SUBSPECIALTIES: 'subspecialties',
  TEMPLATES: 'templates',
  USER_SETTINGS: 'user-settings',
} as const;

// ============================================================================
// Specialty Caching (Static Reference Data)
// ============================================================================

/**
 * Get all active medical specialties (cached for 24 hours)
 *
 * Use this in Server Components for specialty dropdowns, search, etc.
 * Data is static reference data managed by admins.
 *
 * @example
 * ```tsx
 * // In a Server Component
 * const specialties = await getCachedSpecialties();
 * ```
 */
export const getCachedSpecialties = unstable_cache(
  async () => {
    const specialties = await prisma.medicalSpecialty.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        synonyms: true,
      },
    });

    return specialties.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      synonyms: Array.isArray(s.synonyms) ? (s.synonyms as string[]) : [],
      isCustom: false as const,
    }));
  },
  ['all-specialties'],
  {
    revalidate: CACHE_TTL.STATIC,
    tags: [CACHE_TAGS.SPECIALTIES],
  }
);

/**
 * Get subspecialties for a given specialty (cached for 24 hours)
 *
 * @param specialtyId - The parent specialty ID
 *
 * @example
 * ```tsx
 * const cardioSubspecialties = await getCachedSubspecialties('cardiology-id');
 * ```
 */
export const getCachedSubspecialties = unstable_cache(
  async (specialtyId: string) => {
    const subspecialties = await prisma.medicalSubspecialty.findMany({
      where: {
        specialtyId,
        active: true,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        specialtyId: true,
        name: true,
        slug: true,
        description: true,
      },
    });

    return subspecialties.map((s) => ({
      id: s.id,
      specialtyId: s.specialtyId,
      name: s.name,
      slug: s.slug,
      description: s.description,
      isCustom: false as const,
    }));
  },
  ['subspecialties-by-specialty'],
  {
    revalidate: CACHE_TTL.STATIC,
    tags: [CACHE_TAGS.SUBSPECIALTIES],
  }
);

/**
 * Get a single specialty by ID (cached for 24 hours)
 */
export const getCachedSpecialtyById = unstable_cache(
  async (id: string) => {
    const specialty = await prisma.medicalSpecialty.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        synonyms: true,
      },
    });

    if (!specialty) return null;

    return {
      id: specialty.id,
      name: specialty.name,
      slug: specialty.slug,
      description: specialty.description,
      synonyms: Array.isArray(specialty.synonyms)
        ? (specialty.synonyms as string[])
        : [],
      isCustom: false as const,
    };
  },
  ['specialty-by-id'],
  {
    revalidate: CACHE_TTL.STATIC,
    tags: [CACHE_TAGS.SPECIALTIES],
  }
);

// ============================================================================
// Template Caching (Admin-Managed Data)
// ============================================================================

/**
 * Get all active letter templates (cached for 1 hour)
 *
 * Templates are admin-managed and change infrequently.
 * For user-specific template preferences, use getTemplatesWithPreferences()
 * from the template service.
 *
 * @example
 * ```tsx
 * const templates = await getCachedTemplates();
 * ```
 */
export const getCachedTemplates = unstable_cache(
  async () => {
    const templates = await prisma.letterTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        category: true,
        subspecialties: true,
        isGeneric: true,
        sortOrder: true,
        promptTemplate: true,
        parentId: true,
      },
    });

    return templates;
  },
  ['all-templates'],
  {
    revalidate: CACHE_TTL.TEMPLATES,
    tags: [CACHE_TAGS.TEMPLATES],
  }
);

/**
 * Get templates filtered by subspecialty (cached for 1 hour)
 *
 * Returns templates that match the subspecialty or are marked as generic.
 *
 * @param subspecialty - The Subspecialty enum value to filter by
 */
export const getCachedTemplatesBySubspecialty = unstable_cache(
  async (subspecialty: Subspecialty) => {
    const templates = await prisma.letterTemplate.findMany({
      where: {
        isActive: true,
        OR: [{ subspecialties: { has: subspecialty } }, { isGeneric: true }],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        category: true,
        subspecialties: true,
        isGeneric: true,
        sortOrder: true,
        promptTemplate: true,
        parentId: true,
      },
    });

    return templates;
  },
  ['templates-by-subspecialty'],
  {
    revalidate: CACHE_TTL.TEMPLATES,
    tags: [CACHE_TAGS.TEMPLATES],
  }
);

/**
 * Get a single template by ID (cached for 1 hour)
 */
export const getCachedTemplateById = unstable_cache(
  async (id: string) => {
    const template = await prisma.letterTemplate.findUnique({
      where: { id },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return template;
  },
  ['template-by-id'],
  {
    revalidate: CACHE_TTL.TEMPLATES,
    tags: [CACHE_TAGS.TEMPLATES],
  }
);

/**
 * Get a template by slug (cached for 1 hour)
 */
export const getCachedTemplateBySlug = unstable_cache(
  async (slug: string) => {
    const template = await prisma.letterTemplate.findUnique({
      where: { slug },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return template;
  },
  ['template-by-slug'],
  {
    revalidate: CACHE_TTL.TEMPLATES,
    tags: [CACHE_TAGS.TEMPLATES],
  }
);

// ============================================================================
// User Settings Caching
// ============================================================================

/**
 * Get user's selected specialties (cached for 30 minutes per user)
 *
 * Returns standard specialty selections from the clinician_specialties junction table.
 * Cache is keyed by userId for isolation.
 *
 * @param userId - The user's ID
 */
export const getCachedUserSpecialties = unstable_cache(
  async (userId: string) => {
    const specialties = await prisma.clinicianSpecialty.findMany({
      where: { userId },
      include: {
        specialty: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
          },
        },
      },
    });

    return specialties;
  },
  ['user-specialties'],
  {
    revalidate: CACHE_TTL.USER_SETTINGS,
    tags: [CACHE_TAGS.USER_SETTINGS],
  }
);

/**
 * Get user's selected subspecialties (cached for 30 minutes per user)
 *
 * Returns standard subspecialty selections from the clinician_subspecialties junction table.
 *
 * @param userId - The user's ID
 */
export const getCachedUserSubspecialties = unstable_cache(
  async (userId: string) => {
    const subspecialties = await prisma.clinicianSubspecialty.findMany({
      where: { userId },
      include: {
        subspecialty: {
          select: {
            id: true,
            specialtyId: true,
            name: true,
            slug: true,
            description: true,
          },
        },
      },
    });

    return subspecialties;
  },
  ['user-subspecialties'],
  {
    revalidate: CACHE_TTL.USER_SETTINGS,
    tags: [CACHE_TAGS.USER_SETTINGS],
  }
);

/**
 * Template preference data structure
 */
export interface TemplatePreference {
  isFavorite: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
}

/**
 * Get user's template preferences (cached for 30 minutes per user)
 *
 * Template preferences include favorites and usage counts.
 * Returns a plain object keyed by templateId for JSON serialization compatibility.
 *
 * @param userId - The user's ID
 * @returns Record<templateId, TemplatePreference> for efficient lookup
 */
export const getCachedUserTemplatePreferences = unstable_cache(
  async (userId: string): Promise<Record<string, TemplatePreference>> => {
    const preferences = await prisma.userTemplatePreference.findMany({
      where: { userId },
      select: {
        templateId: true,
        isFavorite: true,
        usageCount: true,
        lastUsedAt: true,
      },
    });

    // Return plain object for JSON serialization (Map doesn't serialize with unstable_cache)
    return Object.fromEntries(
      preferences.map((p) => [
        p.templateId,
        {
          isFavorite: p.isFavorite,
          usageCount: p.usageCount,
          lastUsedAt: p.lastUsedAt,
        },
      ])
    );
  },
  ['user-template-preferences'],
  {
    revalidate: CACHE_TTL.USER_SETTINGS,
    tags: [CACHE_TAGS.USER_SETTINGS],
  }
);

// ============================================================================
// Cache Invalidation Helpers
// ============================================================================

// Note: Cache invalidation using revalidateTag() should be called from
// Server Actions or Route Handlers after mutations.
//
// Example usage in a mutation:
// ```tsx
// 'use server';
// import { revalidateTag } from 'next/cache';
// import { CACHE_TAGS } from '@/lib/cache';
//
// export async function updateTemplate(id: string, data: TemplateData) {
//   await prisma.letterTemplate.update({ where: { id }, data });
//   revalidateTag(CACHE_TAGS.TEMPLATES);
// }
// ```
