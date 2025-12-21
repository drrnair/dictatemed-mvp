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
      {/* Client-side onboarding redirect check */}
      <OnboardingRedirect onboardingCompleted={user?.onboardingCompleted ?? false} />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header userName={user?.name} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
