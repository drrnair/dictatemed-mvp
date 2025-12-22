// src/app/(dashboard)/dashboard/page.tsx
// Dashboard home page

import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-space-6">
      {/* Welcome section */}
      <header>
        <h1 className="text-heading-1 text-foreground">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="text-body text-muted-foreground mt-space-1">
          Create and manage your consultation letters efficiently.
        </p>
      </header>

      {/* Quick actions */}
      <div className="grid gap-space-4 md:grid-cols-2 lg:grid-cols-3">
        <QuickActionCard
          title="Start Recording"
          description="Record a new consultation session"
          href="/record"
          icon={
            <svg
              className="h-6 w-6 text-recording-active"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
              />
            </svg>
          }
        />

        <QuickActionCard
          title="Draft Letters"
          description="Review and approve pending letters"
          href="/letters?status=draft"
          icon={
            <svg
              className="h-6 w-6 text-clinical-warning"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          }
        />

        <QuickActionCard
          title="All Letters"
          description="View your letter history"
          href="/letters"
          icon={
            <svg
              className="h-6 w-6 text-clinical-verified"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
              />
            </svg>
          }
        />
      </div>

      {/* Stats placeholder - will be populated with real data later */}
      <div className="grid gap-space-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Letters Today" value="-" />
        <StatCard title="Pending Review" value="-" />
        <StatCard title="This Week" value="-" />
        <StatCard title="This Month" value="-" />
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href as '/'}
      className="group flex items-start gap-space-4 rounded-lg border border-border/60 bg-card p-space-6 shadow-card transition-all duration-150 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div
        className="flex-shrink-0 rounded-lg bg-background-subtle p-space-3"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div>
        <h3 className="text-heading-3 text-foreground group-hover:text-primary transition-colors duration-150">
          {title}
        </h3>
        <p className="text-body-sm text-muted-foreground mt-space-1">
          {description}
        </p>
      </div>
    </Link>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-space-6 shadow-card">
      <p className="text-caption text-muted-foreground">{title}</p>
      <p className="mt-space-2 text-heading-1 text-foreground">{value}</p>
    </div>
  );
}
