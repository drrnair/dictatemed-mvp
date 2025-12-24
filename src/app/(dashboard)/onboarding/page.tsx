'use client';

// src/app/(dashboard)/onboarding/page.tsx
// New user onboarding - specialty selection via "About your practice" screen

import { useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { PracticeProfileForm } from '@/components/specialty';

export default function OnboardingPage() {
  // Handle save completion - redirect to dashboard
  const handleSave = useCallback(() => {
    // Seed templates if not already done (fire and forget)
    fetch('/api/templates', { method: 'POST' }).catch(() => {
      // Ignore template seeding errors - non-blocking
    });

    // Use full page navigation to ensure server state is refreshed
    // This prevents issues with stale onboardingCompleted prop in layout
    window.location.href = '/dashboard';
  }, []);

  // Handle skip - allow user to proceed with generic profile
  const handleSkip = useCallback(async () => {
    // Mark onboarding as complete (even without specialty selection)
    try {
      await fetch('/api/user/onboarding/complete', { method: 'POST' });
    } catch {
      // Continue even if the API call fails - user wants to skip
    }

    // Seed templates if not already done (fire and forget)
    fetch('/api/templates', { method: 'POST' }).catch(() => {
      // Ignore template seeding errors - non-blocking
    });

    // Use full page navigation to ensure server state is refreshed
    window.location.href = '/dashboard';
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      {/* Welcome Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to DictateMED</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Let&apos;s personalize your experience in just a moment.
        </p>
      </div>

      {/* Practice Profile Form - autoFocus is intentional for onboarding UX */}
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <div className="rounded-lg border bg-card p-6">
        <PracticeProfileForm
          mode="onboarding"
          onSave={handleSave}
          onSkip={handleSkip}
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus -- Intentional for onboarding UX
          saveButtonText="Get Started"
          skipButtonText="Skip for now"
        />
      </div>

      {/* Bottom reassurance */}
      <p className="text-center text-sm text-muted-foreground">
        You can always update your specialties later in{' '}
        <span className="font-medium">Settings &rarr; Your Specialties</span>
      </p>
    </div>
  );
}
