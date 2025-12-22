// src/app/(dashboard)/settings/page.tsx
// Settings page with navigation to sub-settings

import Link from 'next/link';
import { Building2, Sparkles, Heart, FileText, User, Send, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  {
    title: 'Appearance',
    description: 'Customize theme, colors, and display preferences',
    href: '/settings/appearance' as Route,
    icon: Palette,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and practice settings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
