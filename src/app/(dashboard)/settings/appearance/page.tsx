// src/app/(dashboard)/settings/appearance/page.tsx
// Appearance settings page with theme configuration

'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeSettings } from '@/components/settings/ThemeSettings';

export default function AppearanceSettingsPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Settings
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Appearance</h1>
        <p className="text-muted-foreground">
          Customize the look and feel of the application.
        </p>
      </div>

      {/* Theme Settings Component with server sync */}
      <ThemeSettings />

      {/* Preview section */}
      {mounted && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              See how your content will look with the selected theme.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary" />
                <div>
                  <p className="font-medium">Sample Letter</p>
                  <p className="text-sm text-muted-foreground">
                    Patient: John Smith
                  </p>
                </div>
              </div>
              <p className="text-sm">
                Dear Dr. Johnson,
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Thank you for referring Mr. John Smith for cardiology evaluation.
                Following comprehensive assessment including clinical examination
                and echocardiography, I am pleased to report...
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="default">
                  Approve
                </Button>
                <Button size="sm" variant="outline">
                  Edit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
