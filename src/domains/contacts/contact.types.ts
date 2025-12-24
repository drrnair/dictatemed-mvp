// src/domains/contacts/contact.types.ts
// Type definitions for patient contacts domain

export type ContactType = 'GP' | 'REFERRER' | 'SPECIALIST' | 'OTHER';

export type ChannelType = 'EMAIL' | 'SECURE_MESSAGING' | 'FAX' | 'POST';

/**
 * Patient contact domain model
 */
export interface PatientContact {
  id: string;
  patientId: string;
  type: ContactType;
  fullName: string;
  organisation: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  secureMessagingId: string | null;
  preferredChannel: ChannelType;
  isDefaultForPatient: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new patient contact
 */
export interface CreateContactInput {
  patientId: string;
  type: ContactType;
  fullName: string;
  organisation?: string;
  role?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
  secureMessagingId?: string;
  preferredChannel?: ChannelType;
  isDefaultForPatient?: boolean;
}

/**
 * Input for updating an existing patient contact
 */
export interface UpdateContactInput {
  type?: ContactType;
  fullName?: string;
  organisation?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  address?: string | null;
  secureMessagingId?: string | null;
  preferredChannel?: ChannelType;
  isDefaultForPatient?: boolean;
}

/**
 * Query filters for listing contacts
 */
export interface ContactListQuery {
  patientId: string;
  type?: ContactType;
  isDefaultForPatient?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Paginated result for contact listings
 */
export interface ContactListResult {
  items: PatientContact[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
