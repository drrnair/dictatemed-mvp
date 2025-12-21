// src/app/(dashboard)/patients/page.tsx
// Patients list page with search and patient management

import { Suspense } from 'react';
import { PatientsClient } from './PatientsClient';

export const metadata = {
  title: 'Patients | DictateMED',
  description: 'Manage patient records',
};

export default function PatientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Patients</h1>
        <p className="text-muted-foreground">
          View and manage patient records
        </p>
      </div>

      <Suspense fallback={<PatientsSkeleton />}>
        <PatientsClient />
      </Suspense>
    </div>
  );
}

function PatientsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search skeleton */}
      <div className="h-10 w-full max-w-sm rounded-md bg-muted animate-pulse" />

      {/* Table skeleton */}
      <div className="rounded-lg border">
        <div className="h-12 border-b bg-muted/50" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 border-b last:border-0 animate-pulse">
            <div className="flex items-center gap-4 p-4">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
