// src/components/layout/Header.tsx
'use client';

import { Button } from '@/components/ui/button';
import { OfflineIndicator } from './OfflineIndicator';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface HeaderProps {
  userName: string | undefined;
}

export function Header({ userName }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      {/* Left side - Breadcrumb or page title could go here */}
      <div className="flex items-center gap-4">
        <OfflineIndicator />
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center gap-4">
        {userName && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Welcome, <span className="font-medium text-slate-700 dark:text-slate-200">{userName}</span>
          </span>
        )}
        <ThemeToggle />
        <a
          href="/api/auth/logout"
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
        >
          <Button variant="ghost" size="sm">
            Sign out
          </Button>
        </a>
      </div>
    </header>
  );
}
