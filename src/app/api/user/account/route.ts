// src/app/api/user/account/route.ts
// Account deletion API endpoint (GDPR-aligned)
// Migrated from S3 to Supabase Storage

import { NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import {
  deleteFile,
  STORAGE_BUCKETS,
  createStorageAuditLog,
} from '@/infrastructure/supabase';
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
        recordings: { select: { id: true, storagePath: true, audioDeletedAt: true } },
        documents: { select: { id: true, storagePath: true, deletedAt: true } },
        letters: { select: { id: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete Supabase Storage objects (best-effort, continue on failure)
    const storageDeletionErrors: string[] = [];

    // Delete signature from user-assets bucket
    if (user.signature) {
      try {
        await deleteFile(STORAGE_BUCKETS.USER_ASSETS, user.signature);
        await createStorageAuditLog({
          userId,
          action: 'storage.delete',
          bucket: STORAGE_BUCKETS.USER_ASSETS,
          storagePath: user.signature,
          resourceType: 'signature',
          resourceId: userId,
          metadata: { reason: 'account_deletion' },
        });
      } catch (err) {
        storageDeletionErrors.push(`signature: ${user.signature}`);
      }
    }

    // Delete recordings audio files (only those not already deleted after transcription)
    for (const recording of user.recordings) {
      if (recording.storagePath && !recording.audioDeletedAt) {
        try {
          await deleteFile(STORAGE_BUCKETS.AUDIO_RECORDINGS, recording.storagePath);
          await createStorageAuditLog({
            userId,
            action: 'storage.delete',
            bucket: STORAGE_BUCKETS.AUDIO_RECORDINGS,
            storagePath: recording.storagePath,
            resourceType: 'audio_recording',
            resourceId: recording.id,
            metadata: { reason: 'account_deletion' },
          });
        } catch (err) {
          storageDeletionErrors.push(`recording: ${recording.storagePath}`);
        }
      }
    }

    // Delete document files (only those not already soft-deleted)
    for (const document of user.documents) {
      if (document.storagePath && !document.deletedAt) {
        try {
          await deleteFile(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, document.storagePath);
          await createStorageAuditLog({
            userId,
            action: 'storage.delete',
            bucket: STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
            storagePath: document.storagePath,
            resourceType: 'clinical_document',
            resourceId: document.id,
            metadata: { reason: 'account_deletion' },
          });
        } catch (err) {
          storageDeletionErrors.push(`document: ${document.storagePath}`);
        }
      }
    }

    if (storageDeletionErrors.length > 0) {
      log.warn('Some storage objects failed to delete', { userId, errors: storageDeletionErrors });
    }

    // Delete database records in order (respecting foreign keys)
    await prisma.$transaction(async (tx) => {
      // Delete audit logs
      await tx.auditLog.deleteMany({ where: { userId } });

      // Delete notifications
      await tx.notification.deleteMany({ where: { userId } });

      // Delete style edits
      await tx.styleEdit.deleteMany({ where: { userId } });

      // Delete style profiles and seed letters
      await tx.styleProfile.deleteMany({ where: { userId } });
      await tx.styleSeedLetter.deleteMany({ where: { userId } });

      // Delete template preferences
      await tx.userTemplatePreference.deleteMany({ where: { userId } });

      // Delete sent emails
      await tx.sentEmail.deleteMany({ where: { userId } });

      // Delete letter sends
      await tx.letterSend.deleteMany({ where: { senderId: userId } });

      // Delete letters
      await tx.letter.deleteMany({ where: { userId } });

      // Delete documents
      await tx.document.deleteMany({ where: { userId } });

      // Delete recordings
      await tx.recording.deleteMany({ where: { userId } });

      // Delete referral documents
      await tx.referralDocument.deleteMany({ where: { userId } });

      // Delete consultations
      await tx.consultation.deleteMany({ where: { userId } });

      // Delete medical specialty selections
      await tx.clinicianSubspecialty.deleteMany({ where: { userId } });
      await tx.clinicianSpecialty.deleteMany({ where: { userId } });
      await tx.customSubspecialty.deleteMany({ where: { userId } });
      await tx.customSpecialty.deleteMany({ where: { userId } });

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
