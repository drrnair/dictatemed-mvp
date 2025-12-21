'use client';

// src/app/(dashboard)/settings/subspecialties/page.tsx
// Subspecialty interests selection page

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Heart, Loader2 } from 'lucide-react';
import Link from 'next/link';
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
  selected: boolean;
}

export default function SubspecialtiesPage() {
  const router = useRouter();
  const [options, setOptions] = useState<SubspecialtyOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSubspecialties();
  }, []);

  async function fetchSubspecialties() {
    setError(null); // Clear any previous errors
    try {
      const response = await fetch('/api/user/subspecialties');
      if (!response.ok) throw new Error('Failed to load subspecialties');

      const data = await response.json();
      setOptions(data.options);
      setSelected(data.selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subspecialties');
    } finally {
      setLoading(false);
    }
  }

  function toggleSubspecialty(value: string) {
    setSelected((prev) => {
      const newSelected = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value];
      setHasChanges(true);
      return newSelected;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/user/subspecialties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subspecialties: selected }),
      });

      if (!response.ok) throw new Error('Failed to save subspecialties');

      setHasChanges(false);
      router.push('/settings/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subspecialties');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subspecialty Interests</h1>
          <p className="text-muted-foreground">
            Select your cardiology subspecialties to get personalized template recommendations.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
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
      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          {selected.length === 0 ? (
            'Select at least one subspecialty to get personalized template recommendations.'
          ) : (
            <>
              <span className="font-medium text-foreground">{selected.length}</span>{' '}
              {selected.length === 1 ? 'subspecialty' : 'subspecialties'} selected.
              Templates relevant to your interests will appear first.
            </>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href="/settings">
          <Button variant="outline">Cancel</Button>
        </Link>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <p className="text-sm text-muted-foreground">Unsaved changes</p>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save & Continue to Templates'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
