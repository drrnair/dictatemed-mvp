// src/app/api/patients/route.ts
// Create and list patients with PHI encryption

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import {
  encryptPatientData,
  decryptPatientData,
  type PatientData,
} from '@/infrastructure/db/encryption';
import {
  createPatientSchema,
  paginationSchema,
  validateBody,
  formatZodErrors,
} from '@/lib/validation';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

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
 * GET /api/patients - List patients for the authenticated practice
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const practiceId = session.user.practiceId;

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const query = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    };

    const validation = validateBody(paginationSchema, query);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(validation.errors) },
        { status: 400 }
      );
    }

    const { page = 1, limit = 20 } = validation.data;
    const skip = (page - 1) * limit;

    // Fetch patients with pagination
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where: { practiceId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.patient.count({
        where: { practiceId },
      }),
    ]);

    // Decrypt patient data
    const decryptedPatients = patients.map((patient) => {
      try {
        return formatPatientResponse(patient);
      } catch (error) {
        logger.error(
          'Failed to decrypt patient data',
          { patientId: patient.id },
          error instanceof Error ? error : undefined
        );
        throw new Error(`Failed to decrypt patient data for patient ${patient.id}`);
      }
    });

    return NextResponse.json({
      data: decryptedPatients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to list patients', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to list patients' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/patients - Create a new patient
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const practiceId = session.user.practiceId;

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(createPatientSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(validation.errors) },
        { status: 400 }
      );
    }

    const patientData: PatientData = {
      name: validation.data.name,
      dateOfBirth: validation.data.dateOfBirth,
      ...(validation.data.medicareNumber !== undefined && {
        medicareNumber: validation.data.medicareNumber,
      }),
      ...(validation.data.address !== undefined && {
        address: validation.data.address,
      }),
      ...(validation.data.phone !== undefined && {
        phone: validation.data.phone,
      }),
      ...(validation.data.email !== undefined && {
        email: validation.data.email,
      }),
    };

    // Encrypt patient data
    const encryptedData = encryptPatientData(patientData);

    // Create patient in database
    const patient = await prisma.patient.create({
      data: {
        encryptedData,
        practiceId,
      },
    });

    // Return decrypted patient data
    const response = formatPatientResponse(patient);

    logger.info('Patient created', { patientId: patient.id, practiceId });

    return NextResponse.json({ patient: response }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create patient', {}, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to create patient' },
      { status: 500 }
    );
  }
}
