'use client';

// src/hooks/usePracticeProfile.ts
// Hook for fetching and updating user's practice profile

import { useState, useCallback, useEffect } from 'react';
import type { ClinicianRole } from '@prisma/client';
import type {
  PracticeProfile,
  SpecialtySelection,
} from '@/domains/specialties';
import type {
  SelectedSpecialtyItem,
  SelectedSubspecialtyItem,
} from '@/components/specialty';

// ============================================================================
// Types
// ============================================================================

interface UsePracticeProfileOptions {
  /** Whether to fetch profile on mount */
  fetchOnMount?: boolean;
}

interface UsePracticeProfileReturn {
  /** Current practice profile */
  profile: PracticeProfile | null;
  /** Whether profile is loading */
  isLoading: boolean;
  /** Whether profile is being saved */
  isSaving: boolean;
  /** Error message */
  error: string | null;
  /** Fetch the profile */
  fetchProfile: () => Promise<void>;
  /** Save the profile, returns the updated profile on success */
  saveProfile: (data: SaveProfileData) => Promise<PracticeProfile | null>;
  /** Create a custom specialty */
  createCustomSpecialty: (name: string) => Promise<SelectedSpecialtyItem | null>;
  /** Create a custom subspecialty */
  createCustomSubspecialty: (
    name: string,
    specialtyId: string
  ) => Promise<SelectedSubspecialtyItem | null>;
  /** Check if profile has been set up */
  hasProfile: boolean;
}

interface SaveProfileData {
  clinicianRole?: ClinicianRole;
  specialties: SpecialtySelectionInput[];
}

interface SpecialtySelectionInput {
  id: string;
  isCustom: boolean;
  subspecialties: SubspecialtySelectionInput[];
}

interface SubspecialtySelectionInput {
  id: string;
  isCustom: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing user's practice profile (specialties & subspecialties)
 */
export function usePracticeProfile(
  options: UsePracticeProfileOptions = {}
): UsePracticeProfileReturn {
  const { fetchOnMount = true } = options;

  const [profile, setProfile] = useState<PracticeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(fetchOnMount);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's practice profile
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/practice-profile');
      if (!response.ok) {
        throw new Error('Failed to load practice profile');
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save practice profile
  const saveProfile = useCallback(async (data: SaveProfileData): Promise<PracticeProfile | null> => {
    setIsSaving(true);
    setError(null);

    try {
      // Transform input data to API format
      const apiData = {
        clinicianRole: data.clinicianRole,
        specialties: data.specialties.map((s) => {
          const selection: SpecialtySelection = {
            subspecialtyIds: [],
            customSubspecialtyIds: [],
          };

          if (s.isCustom) {
            selection.customSpecialtyId = s.id;
          } else {
            selection.specialtyId = s.id;
          }

          // Separate subspecialties by type
          for (const sub of s.subspecialties) {
            if (sub.isCustom) {
              selection.customSubspecialtyIds?.push(sub.id);
            } else {
              selection.subspecialtyIds?.push(sub.id);
            }
          }

          return selection;
        }),
      };

      const response = await fetch('/api/user/practice-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      const updatedProfile: PracticeProfile = await response.json();
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Create a custom specialty
  const createCustomSpecialty = useCallback(
    async (name: string): Promise<SelectedSpecialtyItem | null> => {
      try {
        const response = await fetch('/api/specialties/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create specialty');
        }

        const data = await response.json();
        return {
          id: data.customSpecialty.id,
          name: data.customSpecialty.name,
          isCustom: true,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create specialty');
        return null;
      }
    },
    []
  );

  // Create a custom subspecialty
  const createCustomSubspecialty = useCallback(
    async (
      name: string,
      specialtyId: string
    ): Promise<SelectedSubspecialtyItem | null> => {
      try {
        const response = await fetch('/api/subspecialties/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, specialtyId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create subspecialty');
        }

        const data = await response.json();
        return {
          id: data.customSubspecialty.id,
          name: data.customSubspecialty.name,
          isCustom: true,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create subspecialty');
        return null;
      }
    },
    []
  );

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount) {
      fetchProfile();
    }
  }, [fetchOnMount, fetchProfile]);

  return {
    profile,
    isLoading,
    isSaving,
    error,
    fetchProfile,
    saveProfile,
    createCustomSpecialty,
    createCustomSubspecialty,
    hasProfile: Boolean(profile?.specialties.length),
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert PracticeProfile specialties to component format
 */
export function profileToFormState(profile: PracticeProfile | null): {
  specialties: SelectedSpecialtyItem[];
  subspecialtiesBySpecialty: Map<string, SelectedSubspecialtyItem[]>;
} {
  const specialties: SelectedSpecialtyItem[] = [];
  const subspecialtiesBySpecialty = new Map<string, SelectedSubspecialtyItem[]>();

  if (!profile) {
    return { specialties, subspecialtiesBySpecialty };
  }

  for (const specialty of profile.specialties) {
    specialties.push({
      id: specialty.specialtyId,
      name: specialty.name,
      isCustom: specialty.isCustom,
    });

    subspecialtiesBySpecialty.set(
      specialty.specialtyId,
      specialty.subspecialties.map((sub) => ({
        id: sub.subspecialtyId,
        name: sub.name,
        isCustom: sub.isCustom,
      }))
    );
  }

  return { specialties, subspecialtiesBySpecialty };
}

/**
 * Convert component form state to save format
 */
export function formStateToSaveData(
  clinicianRole: ClinicianRole,
  specialties: SelectedSpecialtyItem[],
  subspecialtiesBySpecialty: Map<string, SelectedSubspecialtyItem[]>
): SaveProfileData {
  return {
    clinicianRole,
    specialties: specialties.map((s) => ({
      id: s.id,
      isCustom: s.isCustom,
      subspecialties: subspecialtiesBySpecialty.get(s.id) || [],
    })),
  };
}
