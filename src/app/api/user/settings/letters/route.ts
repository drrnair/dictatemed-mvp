// src/app/api/user/settings/letters/route.ts
// API endpoints for letter sending preferences

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { DEFAULT_SENDING_PREFERENCES } from '@/domains/letters/sending.types';

const log = logger.child({ module: 'letter-settings-api' });

// Validation schema for letter sending preferences
const letterSettingsSchema = z.object({
  alwaysCcGp: z.boolean().optional(),
  alwaysCcSelf: z.boolean().optional(),
  includeReferrer: z.boolean().optional(),
  defaultSubjectTemplate: z.string().max(500, 'Subject template too long').optional(),
  defaultCoverNote: z.string().max(2000, 'Cover note too long').optional(),
});

/**
 * GET /api/user/settings/letters
 * Get letter sending preferences
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { settings: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Extract letter settings from user settings JSON
    const settings = (user.settings as Record<string, unknown>) || {};
    const letterSending = (settings.letterSending as Record<string, unknown>) || {};

    // Merge with defaults
    const preferences = {
      alwaysCcGp: letterSending.alwaysCcGp ?? DEFAULT_SENDING_PREFERENCES.alwaysCcGp,
      alwaysCcSelf: letterSending.alwaysCcSelf ?? DEFAULT_SENDING_PREFERENCES.alwaysCcSelf,
      includeReferrer: letterSending.includeReferrer ?? DEFAULT_SENDING_PREFERENCES.includeReferrer,
      defaultSubjectTemplate:
        letterSending.defaultSubjectTemplate ?? DEFAULT_SENDING_PREFERENCES.defaultSubjectTemplate,
      defaultCoverNote:
        letterSending.defaultCoverNote ?? DEFAULT_SENDING_PREFERENCES.defaultCoverNote,
    };

    return NextResponse.json({ preferences });
  } catch (error) {
    log.error('Failed to get letter settings', { action: 'getLetterSettings' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/settings/letters
 * Update letter sending preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = letterSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Get current settings
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { settings: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentSettings = (user.settings as Record<string, unknown>) || {};
    const currentLetterSending = (currentSettings.letterSending as Record<string, unknown>) || {};

    // Merge updates
    const updatedLetterSending = {
      ...currentLetterSending,
      ...parsed.data,
    };

    // Update user settings
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        settings: {
          ...currentSettings,
          letterSending: updatedLetterSending,
        },
      },
    });

    log.info('Letter settings updated', {
      action: 'updateLetterSettings',
      userId: session.user.id,
    });

    // Return updated preferences merged with defaults
    const preferences = {
      alwaysCcGp: updatedLetterSending.alwaysCcGp ?? DEFAULT_SENDING_PREFERENCES.alwaysCcGp,
      alwaysCcSelf: updatedLetterSending.alwaysCcSelf ?? DEFAULT_SENDING_PREFERENCES.alwaysCcSelf,
      includeReferrer:
        updatedLetterSending.includeReferrer ?? DEFAULT_SENDING_PREFERENCES.includeReferrer,
      defaultSubjectTemplate:
        updatedLetterSending.defaultSubjectTemplate ??
        DEFAULT_SENDING_PREFERENCES.defaultSubjectTemplate,
      defaultCoverNote:
        updatedLetterSending.defaultCoverNote ?? DEFAULT_SENDING_PREFERENCES.defaultCoverNote,
    };

    return NextResponse.json({ preferences });
  } catch (error) {
    log.error('Failed to update letter settings', { action: 'updateLetterSettings' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
