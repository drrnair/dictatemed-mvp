// src/app/api/templates/route.ts
// Letter templates API - list and filter templates

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  getTemplatesWithPreferences,
  seedTemplates,
} from '@/domains/letters/templates/template.service';
import type {
  TemplateCategory,
  Subspecialty,
} from '@/domains/letters/templates/template.types';

/**
 * GET /api/templates
 * List templates with optional filtering.
 * Includes user preference data (favorites, usage).
 *
 * Query params:
 * - category: Filter by template category
 * - subspecialty: Filter by subspecialty (includes generic templates)
 * - includeGeneric: Include generic templates (default: true)
 * - favoritesOnly: Only return favorites (default: false)
 */
export async function GET(request: NextRequest) {
  const log = logger.child({ action: 'GET /api/templates' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as TemplateCategory | null;
    const subspecialty = searchParams.get('subspecialty') as Subspecialty | null;
    const includeGeneric = searchParams.get('includeGeneric') !== 'false';
    const favoritesOnly = searchParams.get('favoritesOnly') === 'true';

    const templates = await getTemplatesWithPreferences(session.user.id, {
      category: category ?? undefined,
      subspecialty: subspecialty ?? undefined,
      includeGeneric,
      favoritesOnly,
    });

    log.info('Templates listed', {
      userId: session.user.id,
      count: templates.length,
      filters: { category, subspecialty, includeGeneric, favoritesOnly },
    });

    return NextResponse.json({
      templates,
      total: templates.length,
    });
  } catch (error) {
    log.error('Failed to list templates', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates/seed
 * Seed templates from registry (admin only, or first-run).
 * This is typically called during deployment or setup.
 */
export async function POST(request: NextRequest) {
  const log = logger.child({ action: 'POST /api/templates (seed)' });

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can seed templates
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can seed templates' },
        { status: 403 }
      );
    }

    const result = await seedTemplates();

    log.info('Templates seeded', {
      userId: session.user.id,
      created: result.created,
      skipped: result.skipped,
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
    });
  } catch (error) {
    log.error('Failed to seed templates', {}, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Failed to seed templates' },
      { status: 500 }
    );
  }
}
