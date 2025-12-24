// src/domains/specialties/specialty.service.ts
// Service layer for medical specialty management

import { prisma } from '@/infrastructure/db/client';
import type {
  SpecialtyOption,
  CustomSpecialtyOption,
  AnySpecialtyOption,
  SubspecialtyOption,
  CustomSubspecialtyOption,
  AnySubspecialtyOption,
  PracticeProfile,
  SelectedSpecialty,
  SelectedSubspecialty,
  CreateCustomSpecialtyInput,
  CreateCustomSubspecialtyInput,
  UpdatePracticeProfileInput,
  SpecialtySearchOptions,
  SubspecialtySearchOptions,
  SpecialtySearchResult,
  SubspecialtySearchResult,
  CreateCustomSpecialtyResult,
  CreateCustomSubspecialtyResult,
  UpdatePracticeProfileResult,
} from './specialty.types';
import type { ClinicianRole, CustomRequestStatus } from '@prisma/client';

// ============================================================================
// Mappers
// ============================================================================

/**
 * Map Prisma MedicalSpecialty to SpecialtyOption
 */
function mapToSpecialtyOption(specialty: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  synonyms: unknown;
}): SpecialtyOption {
  return {
    id: specialty.id,
    name: specialty.name,
    slug: specialty.slug,
    description: specialty.description,
    synonyms: Array.isArray(specialty.synonyms) ? (specialty.synonyms as string[]) : [],
    isCustom: false,
  };
}

/**
 * Map Prisma CustomSpecialty to CustomSpecialtyOption
 */
function mapToCustomSpecialtyOption(customSpecialty: {
  id: string;
  name: string;
  status: CustomRequestStatus;
}): CustomSpecialtyOption {
  return {
    id: customSpecialty.id,
    name: customSpecialty.name,
    slug: null,
    description: null,
    synonyms: [],
    isCustom: true,
    status: customSpecialty.status,
  };
}

/**
 * Map Prisma MedicalSubspecialty to SubspecialtyOption
 */
function mapToSubspecialtyOption(subspecialty: {
  id: string;
  specialtyId: string;
  name: string;
  slug: string;
  description: string | null;
}): SubspecialtyOption {
  return {
    id: subspecialty.id,
    specialtyId: subspecialty.specialtyId,
    name: subspecialty.name,
    slug: subspecialty.slug,
    description: subspecialty.description,
    isCustom: false,
  };
}

/**
 * Map Prisma CustomSubspecialty to CustomSubspecialtyOption
 */
function mapToCustomSubspecialtyOption(customSubspecialty: {
  id: string;
  specialtyId: string | null;
  customSpecialtyId: string | null;
  name: string;
  description: string | null;
  status: CustomRequestStatus;
}): CustomSubspecialtyOption {
  return {
    id: customSubspecialty.id,
    specialtyId: customSubspecialty.specialtyId,
    customSpecialtyId: customSubspecialty.customSpecialtyId,
    name: customSubspecialty.name,
    slug: null,
    description: customSubspecialty.description,
    isCustom: true,
    status: customSubspecialty.status,
  };
}

// ============================================================================
// Search Functions
// ============================================================================

/**
 * Search specialties by query (name + synonyms)
 * Returns global specialties matching the query plus user's custom specialties
 */
export async function searchSpecialties(
  options: SpecialtySearchOptions
): Promise<SpecialtySearchResult> {
  const { query, userId, limit = 7, includeCustom = true } = options;
  const normalizedQuery = query.toLowerCase().trim();

  // Fetch active global specialties
  const globalSpecialties = await prisma.medicalSpecialty.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });

  // Filter by query (match name or synonyms)
  const matchingSpecialties = globalSpecialties.filter((specialty) => {
    const nameMatch = specialty.name.toLowerCase().includes(normalizedQuery);
    const synonyms = Array.isArray(specialty.synonyms) ? (specialty.synonyms as string[]) : [];
    const synonymMatch = synonyms.some((syn) => syn.toLowerCase().includes(normalizedQuery));
    return nameMatch || synonymMatch;
  });

  // Sort by relevance (exact match first, then starts with, then contains)
  matchingSpecialties.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    // Exact match first
    if (aName === normalizedQuery && bName !== normalizedQuery) return -1;
    if (bName === normalizedQuery && aName !== normalizedQuery) return 1;

    // Starts with next
    if (aName.startsWith(normalizedQuery) && !bName.startsWith(normalizedQuery)) return -1;
    if (bName.startsWith(normalizedQuery) && !aName.startsWith(normalizedQuery)) return 1;

    // Alphabetical
    return aName.localeCompare(bName);
  });

  const results: AnySpecialtyOption[] = matchingSpecialties
    .slice(0, limit)
    .map(mapToSpecialtyOption);

  // Include user's custom specialties if requested
  if (includeCustom && normalizedQuery.length > 0) {
    const customSpecialties = await prisma.customSpecialty.findMany({
      where: {
        userId,
        name: { contains: normalizedQuery, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      take: 3,
    });

    results.push(...customSpecialties.map(mapToCustomSpecialtyOption));
  }

  return {
    specialties: results.slice(0, limit),
    total: results.length,
  };
}

/**
 * Get a specialty by ID
 */
export async function getSpecialtyById(id: string): Promise<SpecialtyOption | null> {
  const specialty = await prisma.medicalSpecialty.findUnique({
    where: { id },
  });

  return specialty ? mapToSpecialtyOption(specialty) : null;
}

/**
 * Get all active specialties (for initial load or empty query)
 */
export async function getAllSpecialties(): Promise<SpecialtyOption[]> {
  const specialties = await prisma.medicalSpecialty.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });

  return specialties.map(mapToSpecialtyOption);
}

// ============================================================================
// Subspecialty Functions
// ============================================================================

/**
 * Get subspecialties for a specialty with optional search
 * Returns global subspecialties plus user's custom subspecialties
 */
export async function getSubspecialtiesForSpecialty(
  options: SubspecialtySearchOptions
): Promise<SubspecialtySearchResult> {
  const {
    specialtyId,
    customSpecialtyId,
    userId,
    query,
    limit = 10,
    includeCustom = true,
  } = options;

  const normalizedQuery = query?.toLowerCase().trim() || '';
  const results: AnySubspecialtyOption[] = [];

  // Fetch global subspecialties for the specialty
  if (specialtyId) {
    const globalSubspecialties = await prisma.medicalSubspecialty.findMany({
      where: {
        specialtyId,
        active: true,
        ...(normalizedQuery && { name: { contains: normalizedQuery, mode: 'insensitive' } }),
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    results.push(...globalSubspecialties.map(mapToSubspecialtyOption));
  }

  // Include user's custom subspecialties if requested
  // Only query if at least one parent ID is provided to avoid empty OR array
  if (includeCustom && (specialtyId || customSpecialtyId)) {
    const orConditions = [
      ...(specialtyId ? [{ specialtyId }] : []),
      ...(customSpecialtyId ? [{ customSpecialtyId }] : []),
    ];

    const customSubspecialties = await prisma.customSubspecialty.findMany({
      where: {
        userId,
        OR: orConditions,
        ...(normalizedQuery && { name: { contains: normalizedQuery, mode: 'insensitive' } }),
      },
      orderBy: { name: 'asc' },
      take: 5,
    });

    results.push(...customSubspecialties.map(mapToCustomSubspecialtyOption));
  }

  return {
    subspecialties: results.slice(0, limit),
    total: results.length,
  };
}

/**
 * Get a subspecialty by ID
 */
export async function getSubspecialtyById(id: string): Promise<SubspecialtyOption | null> {
  const subspecialty = await prisma.medicalSubspecialty.findUnique({
    where: { id },
  });

  return subspecialty ? mapToSubspecialtyOption(subspecialty) : null;
}

// ============================================================================
// Custom Entry Functions
// ============================================================================

/**
 * Create a custom specialty for a user
 * Used when user types a specialty that doesn't exist in the global list
 */
export async function createCustomSpecialty(
  userId: string,
  input: CreateCustomSpecialtyInput
): Promise<CreateCustomSpecialtyResult> {
  // Check if user already has a custom specialty with this name
  const existing = await prisma.customSpecialty.findFirst({
    where: {
      userId,
      name: { equals: input.name, mode: 'insensitive' },
    },
  });

  if (existing) {
    return {
      success: true,
      customSpecialty: mapToCustomSpecialtyOption(existing),
    };
  }

  const customSpecialty = await prisma.customSpecialty.create({
    data: {
      userId,
      name: input.name,
      region: input.region,
      notes: input.notes,
      status: 'PENDING',
    },
  });

  return {
    success: true,
    customSpecialty: mapToCustomSpecialtyOption(customSpecialty),
  };
}

/**
 * Create a custom subspecialty for a user
 * Used when user types a subspecialty that doesn't exist in the global list
 */
export async function createCustomSubspecialty(
  userId: string,
  input: CreateCustomSubspecialtyInput
): Promise<CreateCustomSubspecialtyResult> {
  // Validate that at least one parent is specified
  if (!input.specialtyId && !input.customSpecialtyId) {
    throw new Error('Either specialtyId or customSpecialtyId must be provided');
  }

  // Check if user already has a custom subspecialty with this name for this parent
  const existing = await prisma.customSubspecialty.findFirst({
    where: {
      userId,
      name: { equals: input.name, mode: 'insensitive' },
      ...(input.specialtyId && { specialtyId: input.specialtyId }),
      ...(input.customSpecialtyId && { customSpecialtyId: input.customSpecialtyId }),
    },
  });

  if (existing) {
    return {
      success: true,
      customSubspecialty: mapToCustomSubspecialtyOption(existing),
    };
  }

  const customSubspecialty = await prisma.customSubspecialty.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      specialtyId: input.specialtyId,
      customSpecialtyId: input.customSpecialtyId,
      status: 'PENDING',
    },
  });

  return {
    success: true,
    customSubspecialty: mapToCustomSubspecialtyOption(customSubspecialty),
  };
}

// ============================================================================
// Practice Profile Functions
// ============================================================================

/**
 * Get a user's complete practice profile
 */
export async function getUserPracticeProfile(userId: string): Promise<PracticeProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      clinicianRole: true,
      updatedAt: true,
      clinicianSpecialties: {
        include: {
          specialty: true,
        },
      },
      clinicianSubspecialties: {
        include: {
          subspecialty: {
            include: {
              specialty: true,
            },
          },
        },
      },
      customSpecialties: {
        where: { status: { not: 'REJECTED' } },
      },
      customSubspecialties: {
        where: { status: { not: 'REJECTED' } },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Build specialty map with subspecialties
  const specialtyMap = new Map<string, SelectedSpecialty>();

  // Add global specialties
  for (const cs of user.clinicianSpecialties) {
    specialtyMap.set(cs.specialty.id, {
      id: cs.id,
      specialtyId: cs.specialty.id,
      name: cs.specialty.name,
      isCustom: false,
      subspecialties: [],
    });
  }

  // Add custom specialties
  for (const cs of user.customSpecialties) {
    specialtyMap.set(`custom:${cs.id}`, {
      id: cs.id,
      specialtyId: cs.id,
      name: cs.name,
      isCustom: true,
      subspecialties: [],
    });
  }

  // Add global subspecialties to their parent specialties
  for (const sub of user.clinicianSubspecialties) {
    const parentId = sub.subspecialty.specialtyId;
    const parent = specialtyMap.get(parentId);
    if (parent) {
      parent.subspecialties.push({
        id: sub.id,
        subspecialtyId: sub.subspecialty.id,
        name: sub.subspecialty.name,
        isCustom: false,
      });
    }
  }

  // Add custom subspecialties to their parent specialties
  for (const sub of user.customSubspecialties) {
    const parentId = sub.specialtyId || `custom:${sub.customSpecialtyId}`;
    const parent = specialtyMap.get(parentId);
    if (parent) {
      parent.subspecialties.push({
        id: sub.id,
        subspecialtyId: sub.id,
        name: sub.name,
        isCustom: true,
      });
    }
  }

  return {
    userId: user.id,
    clinicianRole: user.clinicianRole,
    specialties: Array.from(specialtyMap.values()),
    updatedAt: user.updatedAt,
  };
}

/**
 * Update a user's practice profile
 * Handles both specialty and subspecialty selections
 */
export async function updateUserPracticeProfile(
  userId: string,
  input: UpdatePracticeProfileInput
): Promise<UpdatePracticeProfileResult> {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Use a transaction to ensure consistency
  await prisma.$transaction(async (tx) => {
    // Update clinician role and mark onboarding as complete
    await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.clinicianRole && { clinicianRole: input.clinicianRole }),
        // Mark onboarding as complete when profile is saved
        onboardingCompletedAt: new Date(),
      },
    });

    // Clear existing specialty selections
    await tx.clinicianSpecialty.deleteMany({
      where: { userId },
    });

    // Clear existing subspecialty selections
    await tx.clinicianSubspecialty.deleteMany({
      where: { userId },
    });

    // Add new specialty selections
    for (const selection of input.specialties) {
      // Only add if it's a global specialty (has specialtyId)
      if (selection.specialtyId) {
        await tx.clinicianSpecialty.create({
          data: {
            userId,
            specialtyId: selection.specialtyId,
          },
        });
      }

      // Add subspecialties for global specialties
      if (selection.subspecialtyIds) {
        for (const subId of selection.subspecialtyIds) {
          await tx.clinicianSubspecialty.create({
            data: {
              userId,
              subspecialtyId: subId,
            },
          });
        }
      }

      // Note: Custom specialties and subspecialties are already stored
      // in CustomSpecialty/CustomSubspecialty tables and don't need
      // separate junction table entries. They're linked via userId.
    }
  });

  // Fetch and return the updated profile
  const profile = await getUserPracticeProfile(userId);
  if (!profile) {
    throw new Error('Failed to fetch updated profile');
  }

  return {
    success: true,
    profile,
  };
}

/**
 * Check if a user has completed their practice profile setup
 */
export async function hasCompletedPracticeProfile(userId: string): Promise<boolean> {
  const [specialtyCount, customSpecialtyCount] = await Promise.all([
    prisma.clinicianSpecialty.count({ where: { userId } }),
    prisma.customSpecialty.count({
      where: { userId, status: { not: 'REJECTED' } },
    }),
  ]);

  // User has a profile if they have at least one specialty
  // (either global or custom)
  return specialtyCount > 0 || customSpecialtyCount > 0;
}

/**
 * Get user's specialty IDs for quick lookups
 * Useful for filtering templates or content by specialty
 */
export async function getUserSpecialtyIds(userId: string): Promise<string[]> {
  const clinicianSpecialties = await prisma.clinicianSpecialty.findMany({
    where: { userId },
    select: { specialtyId: true },
  });

  return clinicianSpecialties.map((cs) => cs.specialtyId);
}

/**
 * Get user's subspecialty IDs for quick lookups
 */
export async function getUserSubspecialtyIds(userId: string): Promise<string[]> {
  const clinicianSubspecialties = await prisma.clinicianSubspecialty.findMany({
    where: { userId },
    select: { subspecialtyId: true },
  });

  return clinicianSubspecialties.map((cs) => cs.subspecialtyId);
}

// ============================================================================
// Specialty Suggestions (for UX hints)
// ============================================================================

/**
 * Get suggested subspecialties for quick selection
 * Returns the most common subspecialties for a specialty
 */
export async function getSuggestedSubspecialties(
  specialtyId: string,
  limit = 4
): Promise<SubspecialtyOption[]> {
  // For now, just return the first N subspecialties
  // In the future, this could be based on usage analytics
  const subspecialties = await prisma.medicalSubspecialty.findMany({
    where: {
      specialtyId,
      active: true,
    },
    orderBy: { name: 'asc' },
    take: limit,
  });

  return subspecialties.map(mapToSubspecialtyOption);
}

/**
 * Get specialty by slug (for URL routing)
 */
export async function getSpecialtyBySlug(slug: string): Promise<SpecialtyOption | null> {
  const specialty = await prisma.medicalSpecialty.findUnique({
    where: { slug },
  });

  return specialty ? mapToSpecialtyOption(specialty) : null;
}
