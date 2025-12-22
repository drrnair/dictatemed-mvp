// src/app/(dashboard)/layout.tsx
// Dashboard layout with sidebar and header

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { OnboardingRedirect } from '@/components/layout/OnboardingRedirect';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex h-screen bg-background">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="absolute -top-10 left-0 z-50 bg-primary px-4 py-2 text-primary-foreground transition-all focus:top-0"
      >
        Skip to main content
      </a>

      {/* Client-side onboarding redirect check */}
      <OnboardingRedirect onboardingCompleted={user?.onboardingCompleted ?? false} />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header userName={user?.name} />

        {/* Page content - warm white subtle background for content area */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-background-subtle p-space-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
