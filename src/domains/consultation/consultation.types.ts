// src/domains/consultation/consultation.types.ts
// Type definitions for consultation context

import type { LetterType, ConsultationStatus } from '@prisma/client';

/**
 * Summary of patient info for display (decrypted)
 */
export interface PatientSummary {
  id: string;
  name: string;
  dateOfBirth: string;
  mrn?: string;
}

/**
 * Referrer/GP information
 */
export interface ReferrerInfo {
  id?: string;
  name: string;
  practiceName?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
}

/**
 * CC recipient for a consultation
 */
export interface CCRecipientInfo {
  id?: string;
  name: string;
  email?: string;
  address?: string;
}

/**
 * Material item (letter or document) that can be selected as context
 */
export interface MaterialItem {
  id: string;
  type: 'letter' | 'document';
  name: string;
  description?: string;
  date: Date;
  documentType?: string;
  letterType?: LetterType;
}

/**
 * Complete consultation context
 */
export interface ConsultationContext {
  id: string;
  userId: string;
  patient?: PatientSummary;
  referrer?: ReferrerInfo;
  ccRecipients: CCRecipientInfo[];
  templateId?: string;
  letterType?: LetterType;
  selectedLetterIds: string[];
  selectedDocumentIds: string[];
  status: ConsultationStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new consultation
 */
export interface CreateConsultationInput {
  patientId?: string;
  patient?: {
    name: string;
    dateOfBirth: string;
    mrn?: string;
    medicareNumber?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  referrerId?: string;
  referrer?: Omit<ReferrerInfo, 'id'>;
  ccRecipients?: Omit<CCRecipientInfo, 'id'>[];
  templateId?: string;
  letterType?: LetterType;
  selectedLetterIds?: string[];
  selectedDocumentIds?: string[];
}

/**
 * Input for updating a consultation
 */
export interface UpdateConsultationInput {
  patientId?: string;
  referrerId?: string;
  referrer?: Omit<ReferrerInfo, 'id'>;
  ccRecipients?: Omit<CCRecipientInfo, 'id'>[];
  templateId?: string;
  letterType?: LetterType;
  selectedLetterIds?: string[];
  selectedDocumentIds?: string[];
  status?: ConsultationStatus;
}

/**
 * Input for creating a new referrer
 */
export interface CreateReferrerInput {
  name: string;
  practiceName?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
}

/**
 * Input for patient search
 */
export interface PatientSearchQuery {
  q: string;
  limit?: number;
}

/**
 * Patient search result
 */
export interface PatientSearchResult {
  id: string;
  name: string;
  dateOfBirth: string;
  mrn?: string;
}

/**
 * Available materials for a patient (for selection as context)
 */
export interface PatientMaterials {
  letters: MaterialItem[];
  documents: MaterialItem[];
}

/**
 * Consultation with all related data for display
 */
export interface ConsultationWithRelations extends ConsultationContext {
  recordings: {
    id: string;
    mode: string;
    status: string;
    durationSeconds?: number;
    createdAt: Date;
  }[];
  documents: {
    id: string;
    filename: string;
    documentType?: string;
    status: string;
    createdAt: Date;
  }[];
  letters: {
    id: string;
    letterType: LetterType;
    status: string;
    createdAt: Date;
  }[];
}

/**
 * Validation result for consultation context
 */
export interface ConsultationValidation {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
  }[];
}

/**
 * Validate consultation context has required fields
 */
export function validateConsultationContext(
  context: Partial<ConsultationContext>
): ConsultationValidation {
  const errors: ConsultationValidation['errors'] = [];

  if (!context.patient?.name) {
    errors.push({ field: 'patient.name', message: 'Patient name is required' });
  }

  if (!context.patient?.dateOfBirth) {
    errors.push({ field: 'patient.dateOfBirth', message: 'Patient date of birth is required' });
  }

  if (!context.referrer?.name) {
    errors.push({ field: 'referrer.name', message: 'Referrer name is required' });
  }

  if (!context.templateId && !context.letterType) {
    errors.push({ field: 'templateId', message: 'Letter type is required' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
