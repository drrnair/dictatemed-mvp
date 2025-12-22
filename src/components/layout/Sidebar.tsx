// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Mic, FileText, Settings, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Route } from 'next';

interface NavItem {
  name: string;
  href: Route;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard' as Route,
    icon: Home,
  },
  {
    name: 'Record',
    href: '/record' as Route,
    icon: Mic,
  },
  {
    name: 'Letters',
    href: '/letters' as Route,
    icon: FileText,
  },
  {
    name: 'Settings',
    href: '/settings' as Route,
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border/60 bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border/60 px-space-6">
        <Link
          href={'/dashboard' as Route}
          className="flex items-center gap-space-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="text-heading-2 text-primary">DictateMED</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-space-1 p-space-4" role="navigation" aria-label="Main">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                // Base styles - 44px min height for touch targets
                'flex items-center gap-space-3 rounded-lg px-space-3 min-h-touch',
                'text-label transition-all duration-150',
                // Focus visible for keyboard navigation
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isActive
                  ? // Active: subtle primary background, primary text
                    'bg-primary/10 text-primary font-medium'
                  : // Inactive: muted text, hover state
                    'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/60 p-space-4">
        <p className="text-caption text-muted-foreground">
          DictateMED v0.1.0
          <br />
          Clinical documentation assistant
        </p>
      </div>
    </aside>
  );
}
