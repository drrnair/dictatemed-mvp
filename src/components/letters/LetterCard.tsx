// src/components/letters/LetterCard.tsx
// Card view for mobile-friendly letter display

'use client';

import { useRouter } from 'next/navigation';
import { Calendar, User, FileText, AlertCircle } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Letter, LetterStatus } from '@/hooks/useLetters';

interface LetterCardProps {
  letter: Letter;
}

// Updated status config with semantic variants
const statusConfig: Record<
  LetterStatus,
  { label: string; variant: 'default' | 'secondary' | 'pending' | 'approved' | 'error' | 'outline' }
> = {
  GENERATING: { label: 'Generating', variant: 'default' },
  DRAFT: { label: 'Draft', variant: 'pending' },
  IN_REVIEW: { label: 'In Review', variant: 'pending' },
  APPROVED: { label: 'Approved', variant: 'approved' },
  FAILED: { label: 'Failed', variant: 'error' },
};

const letterTypeLabels: Record<string, string> = {
  NEW_PATIENT: 'New Patient',
  FOLLOW_UP: 'Follow Up',
  ANGIOGRAM_PROCEDURE: 'Angiogram',
  ECHO_REPORT: 'Echo Report',
};

export function LetterCard({ letter }: LetterCardProps) {
  const router = useRouter();

  return (
    <Card variant="interactive" className="cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg text-slate-800 dark:text-slate-100">{letter.patientName}</CardTitle>
            <CardDescription className="mt-1 text-slate-500 dark:text-slate-400">
              {letterTypeLabels[letter.letterType] || letter.letterType}
            </CardDescription>
          </div>
          <Badge variant={statusConfig[letter.status].variant}>
            {statusConfig[letter.status].label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Created Date */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Calendar className="h-4 w-4" />
          <span>Created: {formatDateTime(letter.createdAt)}</span>
        </div>

        {/* Approved Date */}
        {letter.approvedAt && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <FileText className="h-4 w-4" />
            <span>Approved: {formatDate(letter.approvedAt)}</span>
          </div>
        )}

        {/* Risk Score */}
        {letter.hallucinationRiskScore !== null && (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500 dark:text-slate-400">Risk Score:</span>
            <span
              className={
                letter.hallucinationRiskScore > 70
                  ? 'font-medium text-rose-600 dark:text-rose-400'
                  : letter.hallucinationRiskScore > 40
                    ? 'font-medium text-amber-600 dark:text-amber-400'
                    : 'font-medium text-emerald-600 dark:text-emerald-400'
              }
            >
              {letter.hallucinationRiskScore}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            onClick={() => { window.location.href = `/letters/${letter.id}`; }}
          >
            View Letter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface LetterCardListProps {
  letters: Letter[];
  loading?: boolean;
}

export function LetterCardList({ letters, loading }: LetterCardListProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="rounded-xl">
            <CardHeader className="pb-3">
              <div className="h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-9 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (letters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <FileText className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-slate-600 dark:text-slate-300 font-medium">No letters found</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Try adjusting your filters or create a new letter
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {letters.map((letter) => (
        <LetterCard key={letter.id} letter={letter} />
      ))}
    </div>
  );
}
