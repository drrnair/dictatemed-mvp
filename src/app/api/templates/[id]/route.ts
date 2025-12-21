// src/app/api/templates/[id]/route.ts
// Single template API - get template details

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getTemplateById } from '@/domains/letters/templates/template.service';
import { prisma } from '@/infrastructure/db/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/templates/[id]
 * Get a single template with user preference data.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = logger.child({ action: 'GET /api/templates/[id]' });
  const { id } = await params;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await getTemplateById(id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get user preference for this template
    const preference = await prisma.userTemplatePreference.findUnique({
      where: {
        userId_templateId: {
          userId: session.user.id,
          templateId: id,
        },
      },
    });

    log.info('Template retrieved', {
      userId: session.user.id,
      templateId: id,
    });

    return NextResponse.json({
      ...template,
      userPreference: preference
        ? {
            id: preference.id,
            userId: preference.userId,
            templateId: preference.templateId,
            isFavorite: preference.isFavorite,
            usageCount: preference.usageCount,
            styleOverrides: preference.styleOverrides,
            lastUsedAt: preference.lastUsedAt,
            createdAt: preference.createdAt,
            updatedAt: preference.updatedAt,
          }
        : null,
    });
  } catch (error) {
    log.error('Failed to get template', { templateId: id }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to get template' },
      { status: 500 }
    );
  }
}
