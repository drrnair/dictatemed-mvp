// src/app/api/user/settings/theme/route.ts
// API endpoints for theme preferences

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const log = logger.child({ module: 'theme-settings-api' });

// Default theme preference
const DEFAULT_THEME_PREFERENCE = 'system';

// Validation schema for theme preference
const themePreferenceSchema = z.object({
  themePreference: z.enum(['system', 'light', 'dark']),
});

/**
 * GET /api/user/settings/theme
 * Get theme preference
 */
export async function GET() {
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

    // Extract theme preference from user settings JSON
    const settings = (user.settings as Record<string, unknown>) || {};
    const themePreference = (settings.themePreference as string) || DEFAULT_THEME_PREFERENCE;

    // Validate that the stored value is valid, otherwise use default
    const validPreferences = ['system', 'light', 'dark'];
    const preference = validPreferences.includes(themePreference)
      ? themePreference
      : DEFAULT_THEME_PREFERENCE;

    return NextResponse.json({ themePreference: preference });
  } catch (error) {
    log.error('Failed to get theme settings', { action: 'getThemeSettings' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch theme settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/settings/theme
 * Update theme preference
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = themePreferenceSchema.safeParse(body);

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

    // Update user settings
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        settings: {
          ...currentSettings,
          themePreference: parsed.data.themePreference,
        },
      },
    });

    log.info('Theme settings updated', {
      action: 'updateThemeSettings',
      userId: session.user.id,
      themePreference: parsed.data.themePreference,
    });

    return NextResponse.json({ themePreference: parsed.data.themePreference });
  } catch (error) {
    log.error('Failed to update theme settings', { action: 'updateThemeSettings' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to update theme settings' },
      { status: 500 }
    );
  }
}
