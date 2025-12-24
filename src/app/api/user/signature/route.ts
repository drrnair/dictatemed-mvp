// src/app/api/user/signature/route.ts
// User signature upload/delete API endpoints
// Migrated from S3 to Supabase Storage

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import {
  generateSignaturePath,
  uploadFile,
  deleteSignature,
  getSignatureDownloadUrl,
  isValidImageType,
  STORAGE_BUCKETS,
  createStorageAuditLog,
} from '@/infrastructure/supabase';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'user-signature-api' });

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * POST /api/user/signature
 * Upload a new signature image
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('signature') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type using Supabase storage validation
    if (!isValidImageType(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WebP' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB' },
        { status: 400 }
      );
    }

    // Generate Supabase storage path
    const storagePath = generateSignaturePath(session.user.id, file.name);

    // Upload file directly to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(STORAGE_BUCKETS.USER_ASSETS, storagePath, buffer, file.type);

    // Audit the upload
    await createStorageAuditLog({
      userId: session.user.id,
      action: 'storage.upload',
      bucket: STORAGE_BUCKETS.USER_ASSETS,
      storagePath,
      resourceType: 'signature',
      resourceId: session.user.id,
      metadata: { fileSize: file.size, contentType: file.type },
    });

    // Delete old signature if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { signature: true },
    });

    if (currentUser?.signature) {
      try {
        await deleteSignature(session.user.id, currentUser.signature);
      } catch (err) {
        // Log but don't fail - old signature cleanup is best-effort
        log.warn('Failed to delete old signature', { path: currentUser.signature });
      }
    }

    // Update user with new storage path
    await prisma.user.update({
      where: { id: session.user.id },
      data: { signature: storagePath },
    });

    // Generate download URL for response
    const { signedUrl: downloadUrl } = await getSignatureDownloadUrl(
      session.user.id,
      storagePath
    );

    log.info('Signature uploaded', { userId: session.user.id, path: storagePath });

    return NextResponse.json({
      success: true,
      signatureUrl: downloadUrl,
    });
  } catch (error) {
    log.error('Failed to upload signature', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to upload signature' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/signature
 * Remove the user's signature
 */
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current signature
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { signature: true },
    });

    if (!user?.signature) {
      return NextResponse.json({ success: true, message: 'No signature to delete' });
    }

    // Delete from Supabase Storage (includes audit logging)
    try {
      await deleteSignature(session.user.id, user.signature);
    } catch (err) {
      log.warn('Failed to delete signature from storage', { path: user.signature });
    }

    // Clear signature in database
    await prisma.user.update({
      where: { id: session.user.id },
      data: { signature: null },
    });

    log.info('Signature deleted', { userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete signature', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to delete signature' },
      { status: 500 }
    );
  }
}
