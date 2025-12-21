// src/app/api/patients/search/route.ts
// API endpoint for searching patients

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { decryptPatientData } from '@/infrastructure/db/encryption';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'patient-search-api' });

/**
 * GET /api/patients/search
 * Search patients by name or MRN
 * Query params: q (search query), limit (max results)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    if (query.length < 2) {
      // Return recent patients if no query
      const recentPatients = await prisma.patient.findMany({
        where: {
          practiceId: session.user.practiceId,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });

      const results = recentPatients.map((patient) => {
        try {
          const decrypted = decryptPatientData(patient.encryptedData);
          return {
            id: patient.id,
            name: decrypted.name,
            dateOfBirth: decrypted.dateOfBirth,
            mrn: decrypted.medicareNumber || undefined,
          };
        } catch {
          return null;
        }
      }).filter(Boolean);

      return NextResponse.json({ patients: results, isRecent: true });
    }

    // Search patients - we need to decrypt and filter in memory
    // This is necessary because PHI is encrypted
    const allPatients = await prisma.patient.findMany({
      where: {
        practiceId: session.user.practiceId,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200, // Reasonable limit for in-memory search
    });

    const queryLower = query.toLowerCase();
    const matchedPatients = allPatients
      .map((patient) => {
        try {
          const decrypted = decryptPatientData(patient.encryptedData);
          const nameMatch = decrypted.name.toLowerCase().includes(queryLower);
          const mrnMatch = decrypted.medicareNumber?.toLowerCase().includes(queryLower);

          if (nameMatch || mrnMatch) {
            return {
              id: patient.id,
              name: decrypted.name,
              dateOfBirth: decrypted.dateOfBirth,
              mrn: decrypted.medicareNumber || undefined,
              // Score for sorting - exact matches first
              score: decrypted.name.toLowerCase().startsWith(queryLower) ? 2 : 1,
            };
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...patient }) => patient);

    log.info('Patient search', {
      action: 'searchPatients',
      query: query.substring(0, 3) + '***', // Partial for privacy
      resultCount: matchedPatients.length,
    });

    return NextResponse.json({ patients: matchedPatients, isRecent: false });
  } catch (error) {
    log.error('Failed to search patients', { action: 'searchPatients' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to search patients' },
      { status: 500 }
    );
  }
}
