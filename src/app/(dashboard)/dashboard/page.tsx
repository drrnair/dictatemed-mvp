// src/app/(dashboard)/dashboard/page.tsx
// Dashboard home page - Redesigned with hero card, time-aware greeting, and activity section

import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Time-aware greeting helper
// NOTE: This runs on the server, so greeting is based on server time, not user's local time.
// For client-side time, consider extracting greeting to a client component.
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface DashboardStats {
  draftCount: number;
  lettersToday: number;
  pendingReview: number;
  thisMonth: number;
  timeSavedHours: number;
  recentActivity: {
    id: string;
    patientInitials: string;
    letterType: string;
    status: 'pending' | 'approved';
    time: string;
  }[];
}

async function getDashboardStats(userId: string, practiceId: string): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    draftCount,
    lettersToday,
    pendingReview,
    thisMonth,
    approvedThisMonth,
    recentLetters,
  ] = await Promise.all([
    prisma.letter.count({
      where: { userId, status: 'DRAFT' },
    }),
    prisma.letter.count({
      where: { userId, createdAt: { gte: todayStart } },
    }),
    prisma.letter.count({
      where: {
        user: { practiceId },
        status: { in: ['DRAFT', 'IN_REVIEW'] },
      },
    }),
    prisma.letter.count({
      where: { userId, createdAt: { gte: monthStart } },
    }),
    prisma.letter.count({
      where: { userId, status: 'APPROVED', createdAt: { gte: monthStart } },
    }),
    prisma.letter.findMany({
      where: { user: { practiceId } },
      select: {
        id: true,
        letterType: true,
        status: true,
        createdAt: true,
        patientId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const timeSavedHours = Math.round((approvedThisMonth * 15) / 60);

  const recentActivity = recentLetters.map((letter) => {
    // Patient data is encrypted - use patientId for initials or fallback
    const patientInitials = letter.patientId
      ? letter.patientId.substring(0, 2).toUpperCase()
      : '??';

    const letterType = letter.letterType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const diff = now.getTime() - new Date(letter.createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let time: string;
    if (days > 0) time = `${days}d ago`;
    else if (hours > 0) time = `${hours}h ago`;
    else if (minutes > 0) time = `${minutes}m ago`;
    else time = 'Just now';

    return {
      id: letter.id,
      patientInitials,
      letterType,
      status: (letter.status === 'APPROVED' ? 'approved' : 'pending') as 'pending' | 'approved',
      time,
    };
  });

  return {
    draftCount,
    lettersToday,
    pendingReview,
    thisMonth,
    timeSavedHours,
    recentActivity,
  };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const greeting = getGreeting();

  // Fetch real stats if user is authenticated
  const stats = user
    ? await getDashboardStats(user.id, user.practiceId)
    : { draftCount: 0, lettersToday: 0, pendingReview: 0, thisMonth: 0, timeSavedHours: 0, recentActivity: [] };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Welcome section - Time-aware greeting */}
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
          {greeting}
          {user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Ready to capture your next consultation.
        </p>
      </header>

      {/* Hero Action Card - Start Recording (prominent, teal gradient) */}
      <HeroActionCard />

      {/* Secondary action cards - smaller, white background */}
      <div className="grid gap-4 md:grid-cols-2">
        <SecondaryActionCard
          title="Draft Letters"
          description="Review and approve pending letters"
          href="/letters?status=draft"
          count={stats.draftCount}
          icon={
            <svg
              className="h-5 w-5"
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

        <SecondaryActionCard
          title="All Letters"
          description="View your complete letter history"
          href="/letters"
          icon={
            <svg
              className="h-5 w-5"
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

      {/* Stats row - Time Saved highlighted */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TimeSavedCard hours={stats.timeSavedHours} />
        <StatCard title="Letters Today" value={String(stats.lettersToday)} icon="today" />
        <StatCard title="Pending Review" value={String(stats.pendingReview)} icon="pending" />
        <StatCard title="This Month" value={String(stats.thisMonth)} icon="month" />
      </div>

      {/* Recent Activity section */}
      <RecentActivitySection recentActivity={stats.recentActivity} />
    </div>
  );
}

// Hero action card with teal gradient - the primary CTA
function HeroActionCard() {
  return (
    <Link
      href="/record"
      className="group block relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 p-6 md:p-8 shadow-md hover:shadow-elevated transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
    >
      {/* Background decorative element */}
      <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute right-12 bottom-0 -mb-12 h-24 w-24 rounded-full bg-white/5" />

      <div className="relative flex items-center gap-4 md:gap-6">
        {/* Icon container */}
        <div className="flex-shrink-0 rounded-xl bg-white/20 p-4 backdrop-blur-sm">
          <svg
            className="h-8 w-8 md:h-10 md:w-10 text-white"
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
        </div>

        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
            Start Recording
          </h2>
          <p className="text-white/80 mt-1">
            Capture your consultation and generate a letter automatically
          </p>
        </div>

        {/* Arrow indicator */}
        <div className="flex-shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

// Secondary action cards - smaller, white background with hover lift
function SecondaryActionCard({
  title,
  description,
  href,
  icon,
  count,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  count?: number;
}) {
  return (
    <Link
      href={href as '/'}
      className="group block"
    >
      <Card variant="interactive" className="h-full">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="flex-shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-slate-600 dark:text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 dark:group-hover:bg-teal-950 dark:group-hover:text-teal-400 transition-colors duration-200">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-800 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors duration-200">
                {title}
              </h3>
              {count !== undefined && count > 0 && (
                <Badge variant="pending" className="text-xs">
                  {count}
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {description}
            </p>
          </div>
          <svg
            className="h-5 w-5 text-slate-400 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m8.25 4.5 7.5 7.5-7.5 7.5"
            />
          </svg>
        </CardContent>
      </Card>
    </Link>
  );
}

// Time saved stat card - highlighted with teal accent
function TimeSavedCard({ hours }: { hours: number }) {
  return (
    <Card className="relative overflow-hidden border-teal-200 dark:border-teal-800">
      <div className="absolute right-0 top-0 h-16 w-16 -mr-4 -mt-4 rounded-full bg-teal-500/10" />
      <CardContent className="p-5 relative">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-teal-600 dark:text-teal-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <p className="text-xs text-teal-600 dark:text-teal-400 font-medium uppercase tracking-wide">
            Time Saved
          </p>
        </div>
        <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
          {hours} <span className="text-base font-normal text-slate-500">hrs</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This month</p>
      </CardContent>
    </Card>
  );
}

// Standard stat card
function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: 'today' | 'pending' | 'month';
}) {
  const iconMap = {
    today: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
        />
      </svg>
    ),
    pending: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
    month: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
      </svg>
    ),
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          {iconMap[icon]}
          <p className="text-xs font-medium uppercase tracking-wide">{title}</p>
        </div>
        <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// Recent activity section with status badges
function RecentActivitySection({
  recentActivity,
}: {
  recentActivity: {
    id: string;
    patientInitials: string;
    letterType: string;
    status: 'pending' | 'approved';
    time: string;
  }[];
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
          Recent Activity
        </h2>
        {recentActivity.length > 0 && (
          <Link
            href="/letters"
            className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium transition-colors duration-200"
          >
            View all
          </Link>
        )}
      </div>

      {recentActivity.length === 0 ? (
        <EmptyActivityState />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentActivity.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/letters/${item.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200"
                >
                  {/* Patient avatar/initials */}
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-400">
                    {item.patientInitials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                      {item.letterType}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {item.time}
                    </p>
                  </div>

                  <Badge variant={item.status}>
                    {item.status === 'pending' ? 'Pending' : 'Approved'}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

// Empty state with encouraging copy
function EmptyActivityState() {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center">
        {/* Illustration placeholder */}
        <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg
            className="h-8 w-8 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
        </div>
        <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-1">
          No letters yet
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
          Start your first recording to generate a consultation letter. It only takes a few minutes.
        </p>
        <Button asChild>
          <Link href="/record" className="gap-2">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
              />
            </svg>
            Start Recording
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
