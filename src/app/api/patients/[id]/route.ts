// src/app/api/patients/[id]/route.ts
// Get, update, and delete individual patients with PHI encryption

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import {
  encryptPatientData,
  decryptPatientData,
  type PatientData,
} from '@/infrastructure/db/encryption';
import {
  uuidSchema,
  updatePatientSchema,
  validateBody,
  formatZodErrors,
} from '@/lib/validation';
import { logger } from '@/lib/logger';

// TODO: Replace with actual auth once implemented
const PLACEHOLDER_PRACTICE_ID = 'placeholder-practice-id';

/**
 * Decrypted patient response type
 */
interface PatientResponse {
  id: string;
  name: string;
  dateOfBirth: string;
  medicareNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  practiceId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert DB patient to response format with decryption
 */
function formatPatientResponse(patient: {
  id: string;
  encryptedData: string;
  practiceId: string;
  createdAt: Date;
  updatedAt: Date;
}): PatientResponse {
  const decryptedData = decryptPatientData(patient.encryptedData);

  return {
    id: patient.id,
    ...decryptedData,
    practiceId: patient.practiceId,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}

/**
 * GET /api/patients/[id] - Get a single patient by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Get practiceId from authenticated session
    const practiceId = PLACEHOLDER_PRACTICE_ID;

    // Await params to get the id
    const { id } = await params;

    // Validate patient ID
    const idValidation = uuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid patient ID format' },
        { status: 400 }
      );
    }

    // Fetch patient
    const patient = await prisma.patient.findUnique({
      where: { id },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Verify patient belongs to the practice
    if (patient.practiceId !== practiceId) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Decrypt and return patient data
    try {
      const response = formatPatientResponse(patient);
      return NextResponse.json(response);
    } catch (error) {
      logger.error(
        'Failed to decrypt patient data',
        { patientId: patient.id },
        error instanceof Error ? error : undefined
      );
      return NextResponse.json(
        { error: 'Failed to decrypt patient data' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Failed to get patient', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to get patient' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/patients/[id] - Update a patient
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Get practiceId from authenticated session
    const practiceId = PLACEHOLDER_PRACTICE_ID;

    // Await params to get the id
    const { id } = await params;

    // Validate patient ID
    const idValidation = uuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid patient ID format' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(updatePatientSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(validation.errors) },
        { status: 400 }
      );
    }

    // Check if any fields were provided
    if (Object.keys(validation.data).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update provided' },
        { status: 400 }
      );
    }

    // Fetch existing patient
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
    });

    if (!existingPatient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Verify patient belongs to the practice
    if (existingPatient.practiceId !== practiceId) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Decrypt existing patient data
    let existingData: PatientData;
    try {
      existingData = decryptPatientData(existingPatient.encryptedData);
    } catch (error) {
      logger.error(
        'Failed to decrypt existing patient data',
        { patientId: id },
        error instanceof Error ? error : undefined
      );
      return NextResponse.json(
        { error: 'Failed to decrypt patient data' },
        { status: 500 }
      );
    }

    // Merge with updates
    const updatedData: PatientData = {
      name: validation.data.name ?? existingData.name,
      dateOfBirth: validation.data.dateOfBirth ?? existingData.dateOfBirth,
    };

    // Handle optional fields properly - only set if value exists
    const medicareNumber = validation.data.medicareNumber ?? existingData.medicareNumber;
    if (medicareNumber !== undefined) {
      updatedData.medicareNumber = medicareNumber;
    }
    const address = validation.data.address ?? existingData.address;
    if (address !== undefined) {
      updatedData.address = address;
    }
    const phone = validation.data.phone ?? existingData.phone;
    if (phone !== undefined) {
      updatedData.phone = phone;
    }
    const email = validation.data.email ?? existingData.email;
    if (email !== undefined) {
      updatedData.email = email;
    }

    // Encrypt updated data
    const encryptedData = encryptPatientData(updatedData);

    // Update patient in database
    const patient = await prisma.patient.update({
      where: { id },
      data: { encryptedData },
    });

    // Return decrypted patient data
    const response = formatPatientResponse(patient);

    logger.info('Patient updated', { patientId: patient.id, practiceId });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to update patient', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to update patient' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/patients/[id] - Partially update a patient (alias for PUT)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

/**
 * DELETE /api/patients/[id] - Delete a patient
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Get practiceId from authenticated session
    const practiceId = PLACEHOLDER_PRACTICE_ID;

    // Await params to get the id
    const { id } = await params;

    // Validate patient ID
    const idValidation = uuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid patient ID format' },
        { status: 400 }
      );
    }

    // Fetch patient to verify existence and ownership
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        recordings: true,
        documents: true,
        letters: true,
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Verify patient belongs to the practice
    if (patient.practiceId !== practiceId) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Check for related records
    const hasRelatedRecords =
      patient.recordings.length > 0 ||
      patient.documents.length > 0 ||
      patient.letters.length > 0;

    if (hasRelatedRecords) {
      return NextResponse.json(
        {
          error: 'Cannot delete patient with associated recordings, documents, or letters',
          details: {
            recordings: patient.recordings.length,
            documents: patient.documents.length,
            letters: patient.letters.length,
          },
        },
        { status: 409 }
      );
    }

    // Delete patient
    await prisma.patient.delete({
      where: { id },
    });

    logger.info('Patient deleted', { patientId: id, practiceId });

    return NextResponse.json({ success: true, message: 'Patient deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete patient', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to delete patient' },
      { status: 500 }
    );
  }
}
