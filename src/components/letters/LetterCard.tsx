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

const statusConfig: Record<
  LetterStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  GENERATING: { label: 'Generating', variant: 'default' },
  DRAFT: { label: 'Draft', variant: 'secondary' },
  IN_REVIEW: { label: 'In Review', variant: 'outline' },
  APPROVED: { label: 'Approved', variant: 'default' },
  FAILED: { label: 'Failed', variant: 'destructive' },
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
    <Card className="cursor-pointer transition-colors hover:bg-muted/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg">{letter.patientName}</CardTitle>
            <CardDescription className="mt-1">
              {letterTypeLabels[letter.letterType] || letter.letterType}
            </CardDescription>
          </div>
          <Badge
            variant={statusConfig[letter.status].variant}
            className={
              letter.status === 'GENERATING'
                ? 'bg-blue-500'
                : letter.status === 'DRAFT'
                  ? 'bg-yellow-500'
                  : letter.status === 'IN_REVIEW'
                    ? 'bg-orange-500'
                    : letter.status === 'APPROVED'
                      ? 'bg-green-500'
                      : undefined
            }
          >
            {statusConfig[letter.status].label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Created Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Created: {formatDateTime(letter.createdAt)}</span>
        </div>

        {/* Approved Date */}
        {letter.approvedAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Approved: {formatDate(letter.approvedAt)}</span>
          </div>
        )}

        {/* Risk Score */}
        {letter.hallucinationRiskScore !== null && (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span className="text-muted-foreground">Risk Score:</span>
            <span
              className={
                letter.hallucinationRiskScore > 70
                  ? 'font-medium text-red-600'
                  : letter.hallucinationRiskScore > 40
                    ? 'font-medium text-orange-600'
                    : 'font-medium text-green-600'
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
            className="w-full"
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
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-9 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (letters.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <p className="text-muted-foreground">No letters found</p>
        <p className="mt-1 text-sm text-muted-foreground">
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
