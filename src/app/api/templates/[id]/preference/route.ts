// src/app/api/templates/[id]/preference/route.ts
// Update template preferences (style overrides)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  updateTemplatePreference,
  getTemplateById,
} from '@/domains/letters/templates/template.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updatePreferenceSchema = z.object({
  isFavorite: z.boolean().optional(),
  styleOverrides: z
    .object({
      greetingStyle: z.enum(['formal', 'casual', 'mixed']).optional(),
      closingStyle: z.enum(['formal', 'casual', 'mixed']).optional(),
      paragraphStructure: z.enum(['long', 'short', 'mixed']).optional(),
      medicationFormat: z.enum(['generic', 'brand', 'both']).optional(),
      clinicalValueFormat: z.enum(['concise', 'verbose', 'mixed']).optional(),
      formalityLevel: z.enum(['very-formal', 'formal', 'neutral', 'casual']).optional(),
      customSectionOrder: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * PUT /api/templates/[id]/preference
 * Update user preferences for a template.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'PUT /api/templates/[id]/preference' });
  const { id } = await params;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify template exists
    const template = await getTemplateById(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updatePreferenceSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.format() },
        { status: 400 }
      );
    }

    const preference = await updateTemplatePreference(
      session.user.id,
      id,
      validated.data
    );

    log.info('Template preference updated', {
      userId: session.user.id,
      templateId: id,
    });

    return NextResponse.json({
      success: true,
      preference,
    });
  } catch (error) {
    log.error('Failed to update preference', { templateId: id }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to update preference' },
      { status: 500 }
    );
  }
}
