'use client';

// src/app/(dashboard)/settings/specialties/page.tsx
// Specialty and subspecialty management page for settings

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PracticeProfileForm } from '@/components/specialty';

export default function SpecialtiesPage() {
  const router = useRouter();

  const handleSave = useCallback(() => {
    router.push('/settings');
  }, [router]);

  const handleCancel = useCallback(() => {
    router.push('/settings');
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Specialties</h1>
          <p className="text-muted-foreground">
            Manage your medical specialties and subspecialties for personalized content.
          </p>
        </div>
      </div>

      {/* Practice Profile Form - autoFocus defaults to true but settings mode should not auto-focus */}
      <PracticeProfileForm
        onSave={handleSave}
        onSkip={handleCancel}
        mode="settings"
      />
    </div>
  );
}
