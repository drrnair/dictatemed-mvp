// src/app/(dashboard)/settings/practice/PracticeSettingsClient.tsx
// Client component for practice settings page

'use client';

import { useState } from 'react';
import { PracticeDetails } from '@/components/settings/PracticeDetails';
import { UserManagement } from '@/components/settings/UserManagement';
import { PracticeSettings } from '@/components/settings/PracticeSettings';
import { logger } from '@/lib/logger';

import type { JsonValue } from '@prisma/client/runtime/library';

/** Practice settings configuration values */
type SettingValue = string | number | boolean | undefined;

interface SettingsData {
  defaultLetterType?: string;
  autoSaveInterval?: number;
  reviewReminderDays?: number;
  enableHallucinationCheck?: boolean;
  enableStyleLearning?: boolean;
  requireSourceAnchors?: boolean;
  minVerificationRate?: number;
  [key: string]: SettingValue;
}

interface Practice {
  id: string;
  name: string;
  /** Settings from Prisma (JsonValue) - normalized to SettingsData in component */
  settings: JsonValue;
  letterhead: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SPECIALIST';
  createdAt: string;
  lastLoginAt: string | null;
}

interface PracticeSettingsClientProps {
  practice: Practice;
  users: User[];
  currentUserId: string;
}

export function PracticeSettingsClient({
  practice: initialPractice,
  users: initialUsers,
  currentUserId,
}: PracticeSettingsClientProps) {
  const [practice, setPractice] = useState(initialPractice);
  const [users, setUsers] = useState(initialUsers);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handlePracticeUpdate = (updatedPractice: Partial<Practice>) => {
    setPractice((prev) => ({ ...prev, ...updatedPractice }));
  };

  const handleRefreshUsers = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/practice/users');
      if (response.ok) {
        const { users: updatedUsers } = await response.json();
        setUsers(updatedUsers);
      }
    } catch (error) {
      logger.error('Error refreshing users', { error });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Practice Settings</h1>
        <p className="text-muted-foreground">
          Manage your practice details, users, and clinical safety settings.
        </p>
      </div>

      {/* Practice Details */}
      <PracticeDetails practice={practice} onUpdate={handlePracticeUpdate} />

      {/* User Management */}
      <UserManagement
        users={users}
        currentUserId={currentUserId}
        onUserUpdate={handleRefreshUsers}
      />

      {/* Practice Settings */}
      <PracticeSettings
        initialSettings={(practice.settings as SettingsData | null) || {}}
        onUpdate={(settings) => handlePracticeUpdate({ settings })}
      />
    </div>
  );
}
