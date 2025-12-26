// src/components/settings/PracticeSettings.tsx
// Practice-wide settings configuration

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { logger } from '@/lib/logger';

type SettingValue = string | number | boolean | undefined;

interface SettingsData {
  defaultLetterType?: string;
  autoSaveInterval?: number;
  reviewReminderDays?: number;
  enableHallucinationCheck?: boolean;
  enableStyleLearning?: boolean;
  requireSourceAnchors?: boolean;
  minVerificationRate?: number;
  [key: string]: SettingValue;
}

interface PracticeSettingsProps {
  initialSettings: SettingsData;
  onUpdate: (settings: SettingsData) => void;
}

export function PracticeSettings({ initialSettings, onUpdate }: PracticeSettingsProps) {
  const [settings, setSettings] = useState({
    defaultLetterType: initialSettings.defaultLetterType || 'FOLLOW_UP',
    autoSaveInterval: initialSettings.autoSaveInterval || 30,
    reviewReminderDays: initialSettings.reviewReminderDays || 2,
    enableHallucinationCheck: initialSettings.enableHallucinationCheck ?? true,
    enableStyleLearning: initialSettings.enableStyleLearning ?? true,
    requireSourceAnchors: initialSettings.requireSourceAnchors ?? true,
    minVerificationRate: initialSettings.minVerificationRate || 80,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSettingChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/practice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const { practice } = await response.json();
      onUpdate(practice);
      setHasChanges(false);
    } catch (error) {
      logger.error('Error saving settings', { error });
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({
      defaultLetterType: initialSettings.defaultLetterType || 'FOLLOW_UP',
      autoSaveInterval: initialSettings.autoSaveInterval || 30,
      reviewReminderDays: initialSettings.reviewReminderDays || 2,
      enableHallucinationCheck: initialSettings.enableHallucinationCheck ?? true,
      enableStyleLearning: initialSettings.enableStyleLearning ?? true,
      requireSourceAnchors: initialSettings.requireSourceAnchors ?? true,
      minVerificationRate: initialSettings.minVerificationRate || 80,
    });
    setHasChanges(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Settings</CardTitle>
        <CardDescription>
          Configure default settings for letter generation and clinical safety features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Letter Type */}
        <div className="space-y-2">
          <Label htmlFor="default-letter-type">Default Letter Type</Label>
          <select
            id="default-letter-type"
            value={settings.defaultLetterType}
            onChange={(e) => handleSettingChange('defaultLetterType', e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="NEW_PATIENT">New Patient</option>
            <option value="FOLLOW_UP">Follow-up</option>
            <option value="ANGIOGRAM_PROCEDURE">Angiogram Procedure</option>
            <option value="ECHO_REPORT">Echo Report</option>
          </select>
          <p className="text-xs text-muted-foreground">
            The default letter type when starting a new recording.
          </p>
        </div>

        {/* Auto-save Interval */}
        <div className="space-y-2">
          <Label htmlFor="auto-save-interval">Auto-save Interval (seconds)</Label>
          <select
            id="auto-save-interval"
            value={settings.autoSaveInterval}
            onChange={(e) => handleSettingChange('autoSaveInterval', parseInt(e.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="120">2 minutes</option>
            <option value="0">Disabled</option>
          </select>
          <p className="text-xs text-muted-foreground">
            How often to automatically save letter drafts during editing.
          </p>
        </div>

        {/* Review Reminder */}
        <div className="space-y-2">
          <Label htmlFor="review-reminder-days">Review Reminder (days)</Label>
          <select
            id="review-reminder-days"
            value={settings.reviewReminderDays}
            onChange={(e) => handleSettingChange('reviewReminderDays', parseInt(e.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="1">1 day</option>
            <option value="2">2 days</option>
            <option value="3">3 days</option>
            <option value="7">1 week</option>
            <option value="0">Disabled</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Remind users to review pending letters after this many days.
          </p>
        </div>

        {/* Clinical Safety Features */}
        <div className="space-y-4 pt-4 border-t">
          <div>
            <h4 className="text-sm font-semibold mb-3">Clinical Safety Features</h4>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="enable-hallucination-check"
              checked={settings.enableHallucinationCheck}
              onCheckedChange={(checked) =>
                handleSettingChange('enableHallucinationCheck', checked)
              }
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="enable-hallucination-check" className="cursor-pointer">
                Enable Hallucination Detection
              </Label>
              <p className="text-xs text-muted-foreground">
                Run AI critic model to detect unsupported clinical claims.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="enable-style-learning"
              checked={settings.enableStyleLearning}
              onCheckedChange={(checked) => handleSettingChange('enableStyleLearning', checked)}
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="enable-style-learning" className="cursor-pointer">
                Enable Style Learning
              </Label>
              <p className="text-xs text-muted-foreground">
                Learn and adapt to individual physician writing styles over time.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="require-source-anchors"
              checked={settings.requireSourceAnchors}
              onCheckedChange={(checked) => handleSettingChange('requireSourceAnchors', checked)}
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="require-source-anchors" className="cursor-pointer">
                Require Source Anchors
              </Label>
              <p className="text-xs text-muted-foreground">
                All clinical values must be traceable to source documents or recordings.
              </p>
            </div>
          </div>
        </div>

        {/* Minimum Verification Rate */}
        <div className="space-y-2">
          <Label htmlFor="min-verification-rate">
            Minimum Verification Rate (%)
          </Label>
          <select
            id="min-verification-rate"
            value={settings.minVerificationRate}
            onChange={(e) => handleSettingChange('minVerificationRate', parseInt(e.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="60">60%</option>
            <option value="70">70%</option>
            <option value="80">80%</option>
            <option value="90">90%</option>
            <option value="100">100%</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Minimum percentage of clinical values that must have verified sources.
          </p>
        </div>

        {/* Save/Reset Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
