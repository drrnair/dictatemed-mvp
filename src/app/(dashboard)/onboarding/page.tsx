'use client';

// src/app/(dashboard)/onboarding/page.tsx
// New user onboarding - subspecialty selection

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Heart, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SubspecialtyOption {
  value: string;
  label: string;
  description: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [options, setOptions] = useState<SubspecialtyOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubspecialties();
  }, []);

  async function fetchSubspecialties() {
    try {
      const response = await fetch('/api/user/subspecialties');
      if (!response.ok) throw new Error('Failed to load subspecialties');

      const data = await response.json();
      setOptions(data.options);
      // If user already has subspecialties, they shouldn't be here
      if (data.selected && data.selected.length > 0) {
        router.push('/dashboard');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load options');
    } finally {
      setLoading(false);
    }
  }

  function toggleSubspecialty(value: string) {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  async function handleComplete() {
    if (selected.length === 0) {
      setError('Please select at least one subspecialty to continue');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/user/subspecialties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subspecialties: selected }),
      });

      if (!response.ok) throw new Error('Failed to save preferences');

      // Seed templates if not already done
      await fetch('/api/templates', { method: 'POST' });

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      {/* Welcome Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to DictateMED</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Let&apos;s personalize your experience. Select your cardiology subspecialties
          to get tailored letter templates.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
          {error}
        </div>
      )}

      {/* Subspecialty Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleSubspecialty(option.value)}
              className={cn(
                'text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                'rounded-lg border-2',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <Card className="border-0 bg-transparent shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart
                        className={cn(
                          'h-5 w-5',
                          isSelected ? 'fill-primary text-primary' : 'text-muted-foreground'
                        )}
                      />
                      <CardTitle className="text-base">{option.label}</CardTitle>
                    </div>
                    {isSelected && (
                      <div className="rounded-full bg-primary p-1">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {option.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Selection Summary */}
      <div className="rounded-lg border bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          {selected.length === 0 ? (
            'Select at least one subspecialty to continue'
          ) : (
            <>
              <span className="font-medium text-foreground">{selected.length}</span>{' '}
              {selected.length === 1 ? 'subspecialty' : 'subspecialties'} selected.
              You can update these anytime in Settings.
            </>
          )}
        </p>
      </div>

      {/* Continue Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleComplete}
          disabled={saving || selected.length === 0}
          className="min-w-[200px]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* Skip option for testing */}
      <p className="text-center text-sm text-muted-foreground">
        You can always update your subspecialties later in{' '}
        <span className="font-medium">Settings &rarr; Subspecialties</span>
      </p>
    </div>
  );
}
