'use client';

// src/components/settings/LetterSendingSettings.tsx
// Settings form for letter sending preferences

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Info } from 'lucide-react';

interface LetterSendingPreferences {
  alwaysCcGp: boolean;
  alwaysCcSelf: boolean;
  includeReferrer: boolean;
  defaultSubjectTemplate: string;
  defaultCoverNote: string;
}

const SUBJECT_TOKENS = [
  { token: '{{patient_name}}', description: 'Patient name' },
  { token: '{{letter_type}}', description: 'Type of letter' },
  { token: '{{subspecialty}}', description: 'Subspecialty' },
  { token: '{{date}}', description: 'Current date' },
];

export function LetterSendingSettings() {
  const [preferences, setPreferences] = useState<LetterSendingPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch current preferences
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/user/settings/letters');
        if (!response.ok) {
          throw new Error('Failed to fetch preferences');
        }
        const data = await response.json();
        setPreferences(data.preferences);
      } catch (err) {
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    fetchPreferences();
  }, []);

  const handleSave = useCallback(async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/user/settings/letters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  const updatePreference = useCallback(
    <K extends keyof LetterSendingPreferences>(key: K, value: LetterSendingPreferences[K]) => {
      setPreferences((prev) => (prev ? { ...prev, [key]: value } : null));
    },
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load settings
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Default Recipients</CardTitle>
          <CardDescription>
            Configure which recipients are automatically included when sending letters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="alwaysCcGp"
              checked={preferences.alwaysCcGp}
              onCheckedChange={(checked) => updatePreference('alwaysCcGp', Boolean(checked))}
            />
            <Label htmlFor="alwaysCcGp" className="cursor-pointer">
              Always CC the patient&apos;s GP (if available)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="alwaysCcSelf"
              checked={preferences.alwaysCcSelf}
              onCheckedChange={(checked) => updatePreference('alwaysCcSelf', Boolean(checked))}
            />
            <Label htmlFor="alwaysCcSelf" className="cursor-pointer">
              Always send a copy to myself
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeReferrer"
              checked={preferences.includeReferrer}
              onCheckedChange={(checked) => updatePreference('includeReferrer', Boolean(checked))}
            />
            <Label htmlFor="includeReferrer" className="cursor-pointer">
              Include referring doctor by default (if available)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Template</CardTitle>
          <CardDescription>
            Customize the default subject line and cover note for letter emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subjectTemplate">Default Subject Line</Label>
            <Input
              id="subjectTemplate"
              value={preferences.defaultSubjectTemplate}
              onChange={(e) => updatePreference('defaultSubjectTemplate', e.target.value)}
              placeholder="{{patient_name}} - {{letter_type}} - {{date}}"
            />
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="mb-1">Available tokens:</p>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_TOKENS.map((t) => (
                    <code
                      key={t.token}
                      className="rounded bg-muted px-1.5 py-0.5 text-xs"
                      title={t.description}
                    >
                      {t.token}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverNote">Default Cover Note</Label>
            <textarea
              id="coverNote"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={preferences.defaultCoverNote}
              onChange={(e) => updatePreference('defaultCoverNote', e.target.value)}
              placeholder="Enter a default cover note (optional)"
              maxLength={2000}
            />
            <p className="text-sm text-muted-foreground">
              This note will appear in the email body above the attached letter.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-clinical-verified-muted p-3 text-sm text-clinical-verified">
          Settings saved successfully
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
