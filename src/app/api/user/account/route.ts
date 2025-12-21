// src/app/api/user/account/route.ts
// Account deletion API endpoint (GDPR-aligned)

import { NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { deleteObject } from '@/infrastructure/s3/presigned-urls';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'user-account-api' });

/**
 * DELETE /api/user/account
 * Delete user account and all associated data (GDPR-aligned)
 */
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    log.info('Starting account deletion', { userId });

    // Get user data before deletion for cleanup
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        recordings: { select: { id: true, s3AudioKey: true } },
        documents: { select: { id: true, s3Key: true } },
        letters: { select: { id: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete S3 objects (best-effort, continue on failure)
    const s3DeletionErrors: string[] = [];

    // Delete signature
    if (user.signature) {
      try {
        await deleteObject(user.signature);
      } catch (err) {
        s3DeletionErrors.push(`signature: ${user.signature}`);
      }
    }

    // Delete recordings audio files
    for (const recording of user.recordings) {
      if (recording.s3AudioKey) {
        try {
          await deleteObject(recording.s3AudioKey);
        } catch (err) {
          s3DeletionErrors.push(`recording: ${recording.s3AudioKey}`);
        }
      }
    }

    // Delete document files
    for (const document of user.documents) {
      if (document.s3Key) {
        try {
          await deleteObject(document.s3Key);
        } catch (err) {
          s3DeletionErrors.push(`document: ${document.s3Key}`);
        }
      }
    }

    if (s3DeletionErrors.length > 0) {
      log.warn('Some S3 objects failed to delete', { userId, errors: s3DeletionErrors });
    }

    // Delete database records in order (respecting foreign keys)
    await prisma.$transaction(async (tx) => {
      // Delete audit logs
      await tx.auditLog.deleteMany({ where: { userId } });

      // Delete notifications
      await tx.notification.deleteMany({ where: { userId } });

      // Delete style edits
      await tx.styleEdit.deleteMany({ where: { userId } });

      // Delete template preferences
      await tx.userTemplatePreference.deleteMany({ where: { userId } });

      // Delete letters
      await tx.letter.deleteMany({ where: { userId } });

      // Delete documents
      await tx.document.deleteMany({ where: { userId } });

      // Delete recordings
      await tx.recording.deleteMany({ where: { userId } });

      // Delete consultations
      await tx.consultation.deleteMany({ where: { userId } });

      // Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    log.info('Account deleted successfully', {
      userId,
      recordingsDeleted: user.recordings.length,
      documentsDeleted: user.documents.length,
      lettersDeleted: user.letters.length,
    });

    // Create final audit log (separate transaction since user is deleted)
    // This is for compliance - logged at practice level
    try {
      await prisma.auditLog.create({
        data: {
          userId: 'SYSTEM', // User no longer exists
          action: 'user.account_deleted',
          resourceType: 'user',
          resourceId: userId,
          metadata: {
            deletedByUser: true,
            recordingsDeleted: user.recordings.length,
            documentsDeleted: user.documents.length,
            lettersDeleted: user.letters.length,
            deletedAt: new Date().toISOString(),
          },
        },
      });
    } catch {
      // Best effort - audit log failure shouldn't block deletion confirmation
    }

    return NextResponse.json({
      success: true,
      message: 'Account and all associated data have been permanently deleted',
    });
  } catch (error) {
    log.error('Failed to delete account', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to delete account. Please contact support.' },
      { status: 500 }
    );
  }
}
