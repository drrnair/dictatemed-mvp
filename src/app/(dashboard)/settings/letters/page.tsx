// src/app/(dashboard)/settings/letters/page.tsx
// Letter sending preferences settings page

import { LetterSendingSettings } from '@/components/settings/LetterSendingSettings';

export const metadata = {
  title: 'Letter Settings - DictateMED',
  description: 'Configure your letter sending preferences',
};

export default function LetterSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Letter Settings</h1>
        <p className="text-muted-foreground">
          Configure default recipients and email templates for sending letters.
        </p>
      </div>

      <LetterSendingSettings />
    </div>
  );
}
