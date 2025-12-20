// src/components/layout/Header.tsx
'use client';

import { Button } from '@/components/ui/button';
import { OfflineIndicator } from './OfflineIndicator';

interface HeaderProps {
  userName: string | undefined;
}

export function Header({ userName }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      {/* Left side - Breadcrumb or page title could go here */}
      <div className="flex items-center gap-4">
        <OfflineIndicator />
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center gap-4">
        {userName && (
          <span className="text-sm text-muted-foreground">
            Welcome, {userName}
          </span>
        )}
        <a href="/api/auth/logout">
          <Button variant="ghost" size="sm">
            Sign out
          </Button>
        </a>
      </div>
    </header>
  );
}
