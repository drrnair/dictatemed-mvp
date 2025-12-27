// src/app/(dashboard)/settings/literature/page.tsx
// Clinical Literature settings - UpToDate and Personal Library management

import { LiteratureSettingsClient } from './LiteratureSettingsClient';

export const metadata = {
  title: 'Clinical Literature - DictateMED',
  description: 'Manage your clinical literature sources and personal library',
};

export default function LiteratureSettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinical Literature</h1>
        <p className="text-muted-foreground">
          Connect clinical evidence sources and manage your personal reference library.
        </p>
      </div>

      <LiteratureSettingsClient />
    </div>
  );
}
