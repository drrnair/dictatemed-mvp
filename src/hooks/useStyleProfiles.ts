// src/hooks/useStyleProfiles.ts
// Hook for managing per-subspecialty style profiles

'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Subspecialty } from '@prisma/client';
import type {
  SubspecialtyStyleProfile,
  StyleSeedLetter,
  VerbosityLevel,
  FormalityLevel,
  StyleCategory,
  ParagraphStructure,
  TerminologyLevel,
  SectionInclusionMap,
  SectionVerbosityMap,
  SectionPhrasingMap,
  VocabularyMap,
} from '@/domains/style/subspecialty-profile.types';

// ============ Response Types ============

interface ListProfilesResponse {
  profiles: SubspecialtyStyleProfile[];
  totalCount: number;
}

interface ProfileResponse {
  profile: SubspecialtyStyleProfile;
}

interface SeedLettersResponse {
  seedLetters: StyleSeedLetter[];
  totalCount: number;
}

interface AnalysisStatusResponse {
  subspecialty: Subspecialty;
  editStats: {
    totalEdits: number;
    editsSinceLastAnalysis: number;
    lastEditDate: string | null;
  };
  canAnalyze: boolean;
  profile: SubspecialtyStyleProfile | null;
}

// ============ Input Types ============

interface CreateProfileInput {
  subspecialty: Subspecialty;
  sectionOrder?: string[];
  sectionInclusion?: SectionInclusionMap;
  sectionVerbosity?: SectionVerbosityMap;
  phrasingPreferences?: SectionPhrasingMap;
  avoidedPhrases?: SectionPhrasingMap;
  vocabularyMap?: VocabularyMap;
  terminologyLevel?: TerminologyLevel;
  greetingStyle?: StyleCategory;
  closingStyle?: StyleCategory;
  signoffTemplate?: string;
  formalityLevel?: FormalityLevel;
  paragraphStructure?: ParagraphStructure;
  learningStrength?: number;
}

interface UpdateProfileInput {
  sectionOrder?: string[];
  sectionInclusion?: SectionInclusionMap;
  sectionVerbosity?: SectionVerbosityMap;
  phrasingPreferences?: SectionPhrasingMap;
  avoidedPhrases?: SectionPhrasingMap;
  vocabularyMap?: VocabularyMap;
  terminologyLevel?: TerminologyLevel | null;
  greetingStyle?: StyleCategory | null;
  closingStyle?: StyleCategory | null;
  signoffTemplate?: string | null;
  formalityLevel?: FormalityLevel | null;
  paragraphStructure?: ParagraphStructure | null;
  learningStrength?: number;
}

interface CreateSeedLetterInput {
  subspecialty: Subspecialty;
  letterText: string;
  triggerAnalysis?: boolean;
}

// ============ Hook State ============

interface UseStyleProfilesState {
  profiles: SubspecialtyStyleProfile[];
  loading: boolean;
  error: string | null;
}

interface UseStyleProfilesReturn extends UseStyleProfilesState {
  // Profile operations
  fetchProfiles: () => Promise<void>;
  getProfile: (subspecialty: Subspecialty) => Promise<SubspecialtyStyleProfile | null>;
  createProfile: (input: CreateProfileInput) => Promise<SubspecialtyStyleProfile | null>;
  updateProfile: (subspecialty: Subspecialty, input: UpdateProfileInput) => Promise<SubspecialtyStyleProfile | null>;
  deleteProfile: (subspecialty: Subspecialty) => Promise<boolean>;
  adjustLearningStrength: (subspecialty: Subspecialty, strength: number) => Promise<boolean>;

  // Analysis operations
  triggerAnalysis: (subspecialty: Subspecialty, forceReanalyze?: boolean) => Promise<boolean>;
  getAnalysisStatus: (subspecialty: Subspecialty) => Promise<AnalysisStatusResponse | null>;

  // Seed letter operations
  uploadSeedLetter: (input: CreateSeedLetterInput) => Promise<StyleSeedLetter | null>;
  listSeedLetters: (subspecialty?: Subspecialty) => Promise<StyleSeedLetter[]>;
  deleteSeedLetter: (id: string) => Promise<boolean>;

  // Utility
  clearError: () => void;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing per-subspecialty style profiles.
 */
export function useStyleProfiles(): UseStyleProfilesReturn {
  const [state, setState] = useState<UseStyleProfilesState>({
    profiles: [],
    loading: true,
    error: null,
  });

  // ============ Profile Operations ============

  const fetchProfiles = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/style/profiles');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch profiles');
      }

      const data: ListProfilesResponse = await response.json();
      setState({
        profiles: data.profiles,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch profiles',
      }));
    }
  }, []);

  const getProfile = useCallback(async (subspecialty: Subspecialty): Promise<SubspecialtyStyleProfile | null> => {
    try {
      const response = await fetch(`/api/style/profiles/${subspecialty}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch profile');
      }

      const data: ProfileResponse = await response.json();
      return data.profile;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to fetch profile',
      }));
      return null;
    }
  }, []);

  const createProfile = useCallback(async (input: CreateProfileInput): Promise<SubspecialtyStyleProfile | null> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const response = await fetch('/api/style/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create profile');
      }

      const data: ProfileResponse = await response.json();

      // Update local state
      setState((prev) => ({
        ...prev,
        profiles: [...prev.profiles.filter((p) => p.subspecialty !== input.subspecialty), data.profile],
      }));

      return data.profile;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to create profile',
      }));
      return null;
    }
  }, []);

  const updateProfile = useCallback(async (
    subspecialty: Subspecialty,
    input: UpdateProfileInput
  ): Promise<SubspecialtyStyleProfile | null> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const response = await fetch(`/api/style/profiles/${subspecialty}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      const data: ProfileResponse = await response.json();

      // Update local state
      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.subspecialty === subspecialty ? data.profile : p
        ),
      }));

      return data.profile;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to update profile',
      }));
      return null;
    }
  }, []);

  const deleteProfile = useCallback(async (subspecialty: Subspecialty): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const response = await fetch(`/api/style/profiles/${subspecialty}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete profile');
      }

      // Update local state
      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.filter((p) => p.subspecialty !== subspecialty),
      }));

      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to delete profile',
      }));
      return false;
    }
  }, []);

  const adjustLearningStrength = useCallback(async (
    subspecialty: Subspecialty,
    strength: number
  ): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const response = await fetch(`/api/style/profiles/${subspecialty}/strength`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learningStrength: strength }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to adjust learning strength');
      }

      const data: ProfileResponse = await response.json();

      // Update local state
      setState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.subspecialty === subspecialty ? data.profile : p
        ),
      }));

      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to adjust learning strength',
      }));
      return false;
    }
  }, []);

  // ============ Analysis Operations ============

  const triggerAnalysis = useCallback(async (
    subspecialty: Subspecialty,
    forceReanalyze: boolean = false
  ): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const response = await fetch(`/api/style/profiles/${subspecialty}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReanalyze }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger analysis');
      }

      // Refetch profiles to get updated data
      await fetchProfiles();
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to trigger analysis',
      }));
      return false;
    }
  }, [fetchProfiles]);

  const getAnalysisStatus = useCallback(async (subspecialty: Subspecialty): Promise<AnalysisStatusResponse | null> => {
    try {
      const response = await fetch(`/api/style/profiles/${subspecialty}/analyze`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get analysis status');
      }

      return await response.json();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to get analysis status',
      }));
      return null;
    }
  }, []);

  // ============ Seed Letter Operations ============

  const uploadSeedLetter = useCallback(async (input: CreateSeedLetterInput): Promise<StyleSeedLetter | null> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const response = await fetch('/api/style/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload seed letter');
      }

      const data = await response.json();

      // Refetch profiles if analysis was triggered
      if (input.triggerAnalysis !== false) {
        await fetchProfiles();
      }

      return data.seedLetter;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to upload seed letter',
      }));
      return null;
    }
  }, [fetchProfiles]);

  const listSeedLetters = useCallback(async (subspecialty?: Subspecialty): Promise<StyleSeedLetter[]> => {
    try {
      const url = subspecialty
        ? `/api/style/seed?subspecialty=${subspecialty}`
        : '/api/style/seed';

      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to list seed letters');
      }

      const data: SeedLettersResponse = await response.json();
      return data.seedLetters;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to list seed letters',
      }));
      return [];
    }
  }, []);

  const deleteSeedLetter = useCallback(async (id: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const response = await fetch(`/api/style/seed/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete seed letter');
      }

      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to delete seed letter',
      }));
      return false;
    }
  }, []);

  // ============ Utility ============

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return {
    profiles: state.profiles,
    loading: state.loading,
    error: state.error,
    fetchProfiles,
    getProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    adjustLearningStrength,
    triggerAnalysis,
    getAnalysisStatus,
    uploadSeedLetter,
    listSeedLetters,
    deleteSeedLetter,
    clearError,
    refetch: fetchProfiles,
  };
}

// ============ Utility Functions ============

/**
 * Format subspecialty enum value for display.
 */
export function formatSubspecialtyLabel(subspecialty: Subspecialty): string {
  return subspecialty
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get short label for subspecialty (e.g., "HF" for Heart Failure).
 */
export function getSubspecialtyShortLabel(subspecialty: Subspecialty): string {
  const shortLabels: Record<Subspecialty, string> = {
    GENERAL_CARDIOLOGY: 'General',
    INTERVENTIONAL: 'Interventional',
    STRUCTURAL: 'Structural',
    ELECTROPHYSIOLOGY: 'EP',
    IMAGING: 'Imaging',
    HEART_FAILURE: 'HF',
    CARDIAC_SURGERY: 'Surgery',
  };
  return shortLabels[subspecialty] || subspecialty;
}

/**
 * Get description for subspecialty.
 */
export function getSubspecialtyDescription(subspecialty: Subspecialty): string {
  const descriptions: Record<Subspecialty, string> = {
    GENERAL_CARDIOLOGY: 'General cardiology consultations and follow-ups',
    INTERVENTIONAL: 'Coronary and peripheral interventions',
    STRUCTURAL: 'Structural heart disease including TAVR and MitraClip',
    ELECTROPHYSIOLOGY: 'Arrhythmia management and device therapy',
    IMAGING: 'Echocardiography and cardiac imaging',
    HEART_FAILURE: 'Advanced heart failure management',
    CARDIAC_SURGERY: 'Cardiac surgical consultations and reports',
  };
  return descriptions[subspecialty] || '';
}

/**
 * Get all available subspecialties.
 */
export function getAllSubspecialties(): Subspecialty[] {
  return [
    'GENERAL_CARDIOLOGY',
    'INTERVENTIONAL',
    'STRUCTURAL',
    'ELECTROPHYSIOLOGY',
    'IMAGING',
    'HEART_FAILURE',
    'CARDIAC_SURGERY',
  ] as Subspecialty[];
}

/**
 * Calculate overall confidence from profile.
 */
export function calculateProfileConfidence(profile: SubspecialtyStyleProfile | null): number {
  if (!profile || !profile.confidence) return 0;

  const values = Object.values(profile.confidence);
  if (values.length === 0) return 0;

  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 100);
}
