// src/app/(dashboard)/settings/page.tsx
// Settings page with navigation to sub-settings - Redesigned

import Link from 'next/link';
import { Building2, Sparkles, Heart, FileText, User, Send, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Route } from 'next';

const settingsLinks: Array<{
  title: string;
  description: string;
  href: Route;
  icon: typeof Building2;
}> = [
  {
    title: 'Profile',
    description: 'Your name, signature, and account settings',
    href: '/settings/profile' as Route,
    icon: User,
  },
  {
    title: 'Practice',
    description: 'Manage practice details, letterhead, and team members',
    href: '/settings/practice' as Route,
    icon: Building2,
  },
  {
    title: 'Writing Style',
    description: 'View and customize your letter writing style preferences',
    href: '/settings/style' as Route,
    icon: Sparkles,
  },
  {
    title: 'Subspecialties',
    description: 'Select your cardiology subspecialty interests for tailored templates',
    href: '/settings/subspecialties' as Route,
    icon: Heart,
  },
  {
    title: 'Letter Templates',
    description: 'Browse and manage your favorite letter templates',
    href: '/settings/templates' as Route,
    icon: FileText,
  },
  {
    title: 'Letter Sending',
    description: 'Configure default recipients and email templates for sending letters',
    href: '/settings/letters' as Route,
    icon: Send,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
          Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage your account and practice settings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map((item) => (
          <Link key={item.href} href={item.href} className="group block">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 rounded-xl bg-teal-50 dark:bg-teal-950 p-3 text-teal-600 dark:text-teal-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 transition-colors duration-200">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-800 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors duration-200">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0 mt-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
