// src/app/(dashboard)/settings/practice/page.tsx
// Practice settings page - Admin only

import { redirect } from 'next/navigation';
import { requireAuth, isPracticeAdmin } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { PracticeSettingsClient } from './PracticeSettingsClient';

export default async function PracticeSettingsPage() {
  // Require authentication and admin role
  const user = await requireAuth();

  if (!isPracticeAdmin(user)) {
    redirect('/dashboard');
  }

  // Fetch practice details
  const practice = await prisma.practice.findUnique({
    where: { id: user.practiceId },
    select: {
      id: true,
      name: true,
      settings: true,
      letterhead: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!practice) {
    throw new Error('Practice not found');
  }

  // Fetch practice users
  const users = await prisma.user.findMany({
    where: { practiceId: user.practiceId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: [
      { role: 'asc' }, // ADMIN first
      { name: 'asc' },
    ],
  });

  // Serialize dates for client component
  const serializedUsers = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() || null,
  }));

  return (
    <PracticeSettingsClient
      practice={practice}
      users={serializedUsers}
      currentUserId={user.id}
    />
  );
}
