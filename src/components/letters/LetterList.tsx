// src/components/letters/LetterList.tsx
// Table view for letter list display

'use client';

import { useRouter } from 'next/navigation';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Letter, LetterStatus } from '@/hooks/useLetters';

interface LetterListProps {
  letters: Letter[];
  loading?: boolean;
}

// Updated status config with new semantic variants
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

export function LetterList({ letters, loading }: LetterListProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Approved</TableHead>
            <TableHead className="w-[100px]">Risk Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {letters.map((letter) => (
            <TableRow
              key={letter.id}
              className="cursor-pointer"
              onClick={() => { window.location.href = `/letters/${letter.id}`; }}
            >
              <TableCell className="font-medium">{letter.patientName}</TableCell>
              <TableCell>{letterTypeLabels[letter.letterType] || letter.letterType}</TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(letter.createdAt)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {letter.approvedAt ? formatDate(letter.approvedAt) : '-'}
              </TableCell>
              <TableCell>
                {letter.hallucinationRiskScore !== null ? (
                  <span
                    className={
                      letter.hallucinationRiskScore > 70
                        ? 'text-red-600'
                        : letter.hallucinationRiskScore > 40
                          ? 'text-orange-600'
                          : 'text-green-600'
                    }
                  >
                    {letter.hallucinationRiskScore}
                  </span>
                ) : (
                  '-'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
