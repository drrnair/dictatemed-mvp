// src/domains/contacts/contact.service.ts
// Service layer for patient contact management

import { prisma } from '@/infrastructure/db/client';
import type {
  PatientContact,
  CreateContactInput,
  UpdateContactInput,
  ContactListQuery,
  ContactListResult,
} from './contact.types';

/**
 * Map Prisma PatientContact to domain type
 */
function mapToContact(prismaContact: {
  id: string;
  patientId: string;
  type: string;
  fullName: string;
  organisation: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  secureMessagingId: string | null;
  preferredChannel: string;
  isDefaultForPatient: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PatientContact {
  return {
    id: prismaContact.id,
    patientId: prismaContact.patientId,
    type: prismaContact.type as PatientContact['type'],
    fullName: prismaContact.fullName,
    organisation: prismaContact.organisation,
    role: prismaContact.role,
    email: prismaContact.email,
    phone: prismaContact.phone,
    fax: prismaContact.fax,
    address: prismaContact.address,
    secureMessagingId: prismaContact.secureMessagingId,
    preferredChannel: prismaContact.preferredChannel as PatientContact['preferredChannel'],
    isDefaultForPatient: prismaContact.isDefaultForPatient,
    createdAt: prismaContact.createdAt,
    updatedAt: prismaContact.updatedAt,
  };
}

/**
 * Create a new patient contact
 */
export async function createContact(input: CreateContactInput): Promise<PatientContact> {
  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true },
  });

  if (!patient) {
    throw new Error('Patient not found');
  }

  // If setting as default, unset any existing default of the same type
  if (input.isDefaultForPatient) {
    await prisma.patientContact.updateMany({
      where: {
        patientId: input.patientId,
        type: input.type,
        isDefaultForPatient: true,
      },
      data: {
        isDefaultForPatient: false,
      },
    });
  }

  const contact = await prisma.patientContact.create({
    data: {
      patientId: input.patientId,
      type: input.type,
      fullName: input.fullName,
      organisation: input.organisation,
      role: input.role,
      email: input.email,
      phone: input.phone,
      fax: input.fax,
      address: input.address,
      secureMessagingId: input.secureMessagingId,
      preferredChannel: input.preferredChannel ?? 'EMAIL',
      isDefaultForPatient: input.isDefaultForPatient ?? false,
    },
  });

  return mapToContact(contact);
}

/**
 * Get a contact by ID
 * @param id - Contact ID
 * @param patientId - Optional patient ID for authorization check
 */
export async function getContact(
  id: string,
  patientId?: string
): Promise<PatientContact | null> {
  const contact = await prisma.patientContact.findUnique({
    where: { id },
  });

  if (!contact) {
    return null;
  }

  // If patientId is provided, verify ownership
  if (patientId && contact.patientId !== patientId) {
    return null;
  }

  return mapToContact(contact);
}

/**
 * List contacts for a patient with optional filters
 */
export async function listContactsForPatient(
  query: ContactListQuery
): Promise<ContactListResult> {
  const { patientId, type, isDefaultForPatient, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  const where = {
    patientId,
    ...(type && { type }),
    ...(isDefaultForPatient !== undefined && { isDefaultForPatient }),
  };

  const [contacts, total] = await Promise.all([
    prisma.patientContact.findMany({
      where,
      orderBy: [
        { isDefaultForPatient: 'desc' },
        { type: 'asc' },
        { fullName: 'asc' },
      ],
      skip,
      take: limit,
    }),
    prisma.patientContact.count({ where }),
  ]);

  return {
    items: contacts.map(mapToContact),
    total,
    page,
    limit,
    hasMore: skip + contacts.length < total,
  };
}

/**
 * Update a patient contact
 * @param id - Contact ID
 * @param input - Fields to update
 * @param patientId - Optional patient ID for authorization check
 */
export async function updateContact(
  id: string,
  input: UpdateContactInput,
  patientId?: string
): Promise<PatientContact> {
  // First verify the contact exists and optionally check ownership
  const existing = await prisma.patientContact.findUnique({
    where: { id },
    select: { id: true, patientId: true, type: true },
  });

  if (!existing) {
    throw new Error('Contact not found');
  }

  if (patientId && existing.patientId !== patientId) {
    throw new Error('Unauthorized: contact belongs to another patient');
  }

  // If setting as default, unset any existing default of the same type
  if (input.isDefaultForPatient === true) {
    const typeToUse = input.type ?? existing.type;
    await prisma.patientContact.updateMany({
      where: {
        patientId: existing.patientId,
        type: typeToUse,
        isDefaultForPatient: true,
        id: { not: id },
      },
      data: {
        isDefaultForPatient: false,
      },
    });
  }

  const contact = await prisma.patientContact.update({
    where: { id },
    data: {
      ...(input.type !== undefined && { type: input.type }),
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(input.organisation !== undefined && { organisation: input.organisation }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.fax !== undefined && { fax: input.fax }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.secureMessagingId !== undefined && { secureMessagingId: input.secureMessagingId }),
      ...(input.preferredChannel !== undefined && { preferredChannel: input.preferredChannel }),
      ...(input.isDefaultForPatient !== undefined && { isDefaultForPatient: input.isDefaultForPatient }),
    },
  });

  return mapToContact(contact);
}

/**
 * Delete a patient contact
 * @param id - Contact ID
 * @param patientId - Optional patient ID for authorization check
 */
export async function deleteContact(id: string, patientId?: string): Promise<void> {
  // First verify the contact exists and optionally check ownership
  const existing = await prisma.patientContact.findUnique({
    where: { id },
    select: { id: true, patientId: true },
  });

  if (!existing) {
    throw new Error('Contact not found');
  }

  if (patientId && existing.patientId !== patientId) {
    throw new Error('Unauthorized: contact belongs to another patient');
  }

  await prisma.patientContact.delete({
    where: { id },
  });
}

/**
 * Get the default contact of a specific type for a patient
 */
export async function getDefaultContactForPatient(
  patientId: string,
  type: PatientContact['type']
): Promise<PatientContact | null> {
  const contact = await prisma.patientContact.findFirst({
    where: {
      patientId,
      type,
      isDefaultForPatient: true,
    },
  });

  return contact ? mapToContact(contact) : null;
}

/**
 * Get all default contacts for a patient (one per type if set)
 */
export async function getDefaultContactsForPatient(
  patientId: string
): Promise<PatientContact[]> {
  const contacts = await prisma.patientContact.findMany({
    where: {
      patientId,
      isDefaultForPatient: true,
    },
    orderBy: {
      type: 'asc',
    },
  });

  return contacts.map(mapToContact);
}

/**
 * Get contacts by IDs (useful for letter sending)
 */
export async function getContactsByIds(ids: string[]): Promise<PatientContact[]> {
  if (ids.length === 0) {
    return [];
  }

  const contacts = await prisma.patientContact.findMany({
    where: {
      id: { in: ids },
    },
  });

  return contacts.map(mapToContact);
}

/**
 * Check if a patient has any contacts
 */
export async function hasContacts(patientId: string): Promise<boolean> {
  const count = await prisma.patientContact.count({
    where: { patientId },
  });

  return count > 0;
}
