'use client';

// src/components/layout/OnboardingRedirect.tsx
// Client component to handle onboarding redirect

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Route } from 'next';

interface OnboardingRedirectProps {
  onboardingCompleted: boolean;
}

export function OnboardingRedirect({ onboardingCompleted }: OnboardingRedirectProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip if already on onboarding page or settings pages (allow access to subspecialties)
    const allowedPaths = ['/onboarding', '/settings/subspecialties'];
    const isAllowedPath = allowedPaths.some(path => pathname.startsWith(path));

    if (!onboardingCompleted && !isAllowedPath) {
      router.push('/onboarding' as Route);
    }
  }, [onboardingCompleted, pathname, router]);

  // This component doesn't render anything
  return null;
}
