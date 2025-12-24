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
    <div className="mx-auto max-w-2xl space-y-8 py-8 animate-fade-in-up">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-900/20">
          <Sparkles className="h-7 w-7 text-teal-600 dark:text-teal-400" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          Welcome to DictateMED
        </h1>
        <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
          Let&apos;s personalize your experience in just a moment.
        </p>
      </div>

      {/* Practice Profile Form - autoFocus is intentional for onboarding UX */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-soft">
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
      <p className="text-center text-sm text-slate-500 dark:text-slate-500">
        You can always update your specialties later in{' '}
        <span className="font-medium">Settings → Your Specialties</span>
      </p>
    </div>
  );
}
