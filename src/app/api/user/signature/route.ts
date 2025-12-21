// src/app/api/user/signature/route.ts
// User signature upload/delete API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/db/client';
import { getSession } from '@/lib/auth';
import { getUploadUrl, deleteObject, getDownloadUrl } from '@/infrastructure/s3/presigned-urls';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'user-signature-api' });

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
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

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
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

    // Generate S3 key
    const fileExt = file.name.split('.').pop() || 'png';
    const s3Key = `signatures/${session.user.id}/${Date.now()}.${fileExt}`;

    // Get presigned upload URL
    const { url: uploadUrl } = await getUploadUrl(s3Key, file.type);

    // Upload file to S3
    const buffer = await file.arrayBuffer();
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to S3');
    }

    // Delete old signature if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { signature: true },
    });

    if (currentUser?.signature) {
      try {
        await deleteObject(currentUser.signature);
      } catch (err) {
        // Log but don't fail - old signature cleanup is best-effort
        log.warn('Failed to delete old signature', { key: currentUser.signature });
      }
    }

    // Update user with new signature key
    await prisma.user.update({
      where: { id: session.user.id },
      data: { signature: s3Key },
    });

    // Generate download URL for response
    const { url: downloadUrl } = await getDownloadUrl(s3Key);

    log.info('Signature uploaded', { userId: session.user.id, key: s3Key });

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

    // Delete from S3
    try {
      await deleteObject(user.signature);
    } catch (err) {
      log.warn('Failed to delete signature from S3', { key: user.signature });
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
