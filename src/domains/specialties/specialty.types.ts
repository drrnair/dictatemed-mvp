// src/domains/specialties/specialty.types.ts
// Type definitions for medical specialties domain

import type { ClinicianRole, CustomRequestStatus } from '@prisma/client';

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Medical specialty option for display in type-ahead/combobox
 */
export interface SpecialtyOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  synonyms: string[];
  isCustom: false;
}

/**
 * Custom specialty option (user-created, pending approval)
 */
export interface CustomSpecialtyOption {
  id: string;
  name: string;
  slug: null; // Custom specialties don't have slugs until approved
  description: null;
  synonyms: [];
  isCustom: true;
  status: CustomRequestStatus;
}

/**
 * Union type for any specialty option (global or custom)
 */
export type AnySpecialtyOption = SpecialtyOption | CustomSpecialtyOption;

/**
 * Medical subspecialty option for display in type-ahead/combobox
 */
export interface SubspecialtyOption {
  id: string;
  specialtyId: string;
  name: string;
  slug: string;
  description: string | null;
  isCustom: false;
}

/**
 * Custom subspecialty option (user-created, pending approval)
 */
export interface CustomSubspecialtyOption {
  id: string;
  specialtyId: string | null;
  customSpecialtyId: string | null;
  name: string;
  slug: null;
  description: string | null;
  isCustom: true;
  status: CustomRequestStatus;
}

/**
 * Union type for any subspecialty option (global or custom)
 */
export type AnySubspecialtyOption = SubspecialtyOption | CustomSubspecialtyOption;

// ============================================================================
// Practice Profile Types
// ============================================================================

/**
 * Selected specialty for a clinician's profile
 */
export interface SelectedSpecialty {
  id: string;
  specialtyId: string;
  name: string;
  isCustom: boolean;
  subspecialties: SelectedSubspecialty[];
}

/**
 * Selected subspecialty for a clinician's profile
 */
export interface SelectedSubspecialty {
  id: string;
  subspecialtyId: string;
  name: string;
  isCustom: boolean;
}

/**
 * Complete practice profile for a clinician
 */
export interface PracticeProfile {
  userId: string;
  clinicianRole: ClinicianRole;
  specialties: SelectedSpecialty[];
  updatedAt: Date;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a custom specialty
 */
export interface CreateCustomSpecialtyInput {
  name: string;
  region?: string;
  notes?: string;
}

/**
 * Input for creating a custom subspecialty
 */
export interface CreateCustomSubspecialtyInput {
  name: string;
  specialtyId?: string;
  customSpecialtyId?: string;
  description?: string;
}

/**
 * Input for updating a clinician's practice profile
 */
export interface UpdatePracticeProfileInput {
  clinicianRole?: ClinicianRole;
  specialties: SpecialtySelection[];
}

/**
 * A single specialty selection with its subspecialties
 */
export interface SpecialtySelection {
  specialtyId?: string;
  customSpecialtyId?: string;
  subspecialtyIds?: string[];
  customSubspecialtyIds?: string[];
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Options for searching specialties
 */
export interface SpecialtySearchOptions {
  query: string;
  userId: string;
  limit?: number;
  includeCustom?: boolean;
}

/**
 * Options for fetching subspecialties
 */
export interface SubspecialtySearchOptions {
  specialtyId?: string;
  customSpecialtyId?: string;
  userId: string;
  query?: string;
  limit?: number;
  includeCustom?: boolean;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result from searching specialties
 */
export interface SpecialtySearchResult {
  specialties: AnySpecialtyOption[];
  total: number;
}

/**
 * Result from fetching subspecialties
 */
export interface SubspecialtySearchResult {
  subspecialties: AnySubspecialtyOption[];
  total: number;
}

/**
 * Result from creating a custom specialty
 */
export interface CreateCustomSpecialtyResult {
  success: boolean;
  customSpecialty: CustomSpecialtyOption;
}

/**
 * Result from creating a custom subspecialty
 */
export interface CreateCustomSubspecialtyResult {
  success: boolean;
  customSubspecialty: CustomSubspecialtyOption;
}

/**
 * Result from updating practice profile
 */
export interface UpdatePracticeProfileResult {
  success: boolean;
  profile: PracticeProfile;
}
