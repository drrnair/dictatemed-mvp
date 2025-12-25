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
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" data-testid="sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-200 px-6 dark:border-slate-800">
        <Link
          href={'/dashboard' as Route}
          className="flex items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
          data-testid="sidebar-logo"
        >
          <span className="text-xl font-semibold tracking-tight text-teal-600 dark:text-teal-400">
            DictateMED
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4" role="navigation" aria-label="Main" data-testid="sidebar-navigation">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`sidebar-${item.name.toLowerCase()}-link`}
              className={cn(
                // Base styles - 44px min height for touch targets
                'relative flex items-center gap-3 rounded-r-xl px-3 py-2.5 min-h-[44px]',
                'text-sm font-medium transition-all duration-200',
                // Focus visible for keyboard navigation
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500',
                isActive
                  ? // Active: teal highlight with left border accent (using pseudo-element for clean corners)
                    'bg-teal-50 text-teal-700 before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-teal-500 dark:bg-teal-950 dark:text-teal-300'
                  : // Inactive: slate text with hover lift effect
                    'text-slate-600 hover:bg-slate-100 hover:text-slate-800 hover:-translate-y-0.5 hover:shadow-sm dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  isActive ? 'text-teal-600 dark:text-teal-400' : ''
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="sidebar-version">
          DictateMED v0.1.0
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Clinical documentation assistant
        </p>
      </div>
    </aside>
  );
}
