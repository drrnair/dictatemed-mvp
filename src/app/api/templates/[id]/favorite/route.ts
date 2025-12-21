// src/app/api/templates/[id]/favorite/route.ts
// Toggle favorite status for a template

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { toggleFavorite, getTemplateById } from '@/domains/letters/templates/template.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/templates/[id]/favorite
 * Toggle the favorite status of a template.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'POST /api/templates/[id]/favorite' });
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

    const preference = await toggleFavorite(session.user.id, id);

    log.info('Template favorite toggled', {
      userId: session.user.id,
      templateId: id,
      isFavorite: preference.isFavorite,
    });

    return NextResponse.json({
      success: true,
      isFavorite: preference.isFavorite,
      preference,
    });
  } catch (error) {
    log.error('Failed to toggle favorite', { templateId: id }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
