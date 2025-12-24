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
    <header className="flex h-16 items-center justify-between border-b border-border/60 bg-card px-space-6">
      {/* Left side - Breadcrumb or page title could go here */}
      <div className="flex items-center gap-space-4">
        <OfflineIndicator />
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center gap-space-4">
        {userName && (
          <span className="text-body-sm text-muted-foreground">
            Welcome, {userName}
          </span>
        )}
        <ThemeToggle />
        <a
          href="/api/auth/logout"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Button variant="ghost" size="sm">
            Sign out
          </Button>
        </a>
      </div>
    </header>
  );
}
