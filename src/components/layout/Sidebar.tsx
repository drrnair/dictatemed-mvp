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
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href={'/dashboard' as Route} className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">DictateMED</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          DictateMED v0.1.0
          <br />
          Clinical documentation assistant
        </p>
      </div>
    </aside>
  );
}
