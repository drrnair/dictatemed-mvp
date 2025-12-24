// src/components/letters/LetterList.tsx
// Table view for letter list display - Redesigned

'use client';

import { FileText } from 'lucide-react';
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
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="text-slate-600 dark:text-slate-300">Patient</TableHead>
              <TableHead className="text-slate-600 dark:text-slate-300">Type</TableHead>
              <TableHead className="text-slate-600 dark:text-slate-300">Status</TableHead>
              <TableHead className="text-slate-600 dark:text-slate-300">Created</TableHead>
              <TableHead className="text-slate-600 dark:text-slate-300">Approved</TableHead>
              <TableHead className="w-[100px] text-slate-600 dark:text-slate-300">Risk Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-800/50">
            <TableHead className="text-slate-600 dark:text-slate-300">Patient</TableHead>
            <TableHead className="text-slate-600 dark:text-slate-300">Type</TableHead>
            <TableHead className="text-slate-600 dark:text-slate-300">Status</TableHead>
            <TableHead className="text-slate-600 dark:text-slate-300">Created</TableHead>
            <TableHead className="text-slate-600 dark:text-slate-300">Approved</TableHead>
            <TableHead className="w-[100px] text-slate-600 dark:text-slate-300">Risk Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {letters.map((letter) => (
            <TableRow
              key={letter.id}
              className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150"
              onClick={() => { window.location.href = `/letters/${letter.id}`; }}
            >
              <TableCell className="font-medium text-slate-800 dark:text-slate-100">{letter.patientName}</TableCell>
              <TableCell className="text-slate-600 dark:text-slate-300">{letterTypeLabels[letter.letterType] || letter.letterType}</TableCell>
              <TableCell>
                <Badge variant={statusConfig[letter.status].variant}>
                  {statusConfig[letter.status].label}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-500 dark:text-slate-400">
                {formatDateTime(letter.createdAt)}
              </TableCell>
              <TableCell className="text-slate-500 dark:text-slate-400">
                {letter.approvedAt ? formatDate(letter.approvedAt) : '-'}
              </TableCell>
              <TableCell>
                {letter.hallucinationRiskScore !== null ? (
                  <span
                    className={
                      letter.hallucinationRiskScore > 70
                        ? 'text-rose-600 dark:text-rose-400 font-medium'
                        : letter.hallucinationRiskScore > 40
                          ? 'text-amber-600 dark:text-amber-400 font-medium'
                          : 'text-emerald-600 dark:text-emerald-400 font-medium'
                    }
                  >
                    {letter.hallucinationRiskScore}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
