'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Pill, BookOpen, FileText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CitationCard } from './CitationCard';
import { ConfidenceBadge } from './ConfidenceBadge';
import {
  staggerContainerVariants,
  staggerChildVariants,
  durations,
} from '@/styles/clinical-animations';
import type { LiteratureSearchResult, Citation } from '@/domains/literature';

interface LiteratureSearchResultsProps {
  /** Search result to display */
  result: LiteratureSearchResult;
  /** Currently selected citation */
  selectedCitation?: Citation | null;
  /** Callback when a citation is clicked */
  onCitationClick?: (citation: Citation) => void;
  /** Callback when insert citation is clicked */
  onInsertCitation?: (citation: Citation) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Literature search results display component.
 *
 * Displays a complete literature search result including:
 * - Answer summary
 * - Key recommendations
 * - Dosing information
 * - Warnings and contraindications
 * - Source citations
 * - Confidence indicator
 */
export function LiteratureSearchResults({
  result,
  selectedCitation,
  onCitationClick,
  onInsertCitation,
  className,
}: LiteratureSearchResultsProps) {
  return (
    <motion.div
      className={cn('space-y-5', className)}
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Answer summary */}
      <motion.section variants={staggerChildVariants} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-clinical-blue-100 dark:bg-clinical-blue-900/30">
              <Sparkles className="h-4 w-4 text-clinical-blue-600 dark:text-clinical-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-clinical-gray-900 dark:text-clinical-gray-100">
              Summary
            </h3>
          </div>
          <ConfidenceBadge level={result.confidence} compact />
        </div>
        <p className="text-sm text-clinical-gray-700 dark:text-clinical-gray-300 leading-relaxed pl-9">
          {result.answer}
        </p>
      </motion.section>

      {/* Key recommendations */}
      {result.recommendations && result.recommendations.length > 0 && (
        <motion.section variants={staggerChildVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-verified-100 dark:bg-verified-900/30">
              <BookOpen className="h-4 w-4 text-verified-600 dark:text-verified-400" />
            </div>
            <h3 className="text-sm font-semibold text-clinical-gray-900 dark:text-clinical-gray-100">
              Key Recommendations
            </h3>
          </div>
          <ul className="space-y-2 pl-9">
            {result.recommendations.map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-sm text-clinical-gray-700 dark:text-clinical-gray-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-verified-500 flex-shrink-0" />
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* Dosing information - Clinical mono font for precision */}
      {result.dosing && (
        <motion.section
          variants={staggerChildVariants}
          className="rounded-xl border-2 border-clinical-blue-200 bg-clinical-blue-50
                     dark:border-clinical-blue-800 dark:bg-clinical-blue-950/30 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-clinical-blue-200 dark:bg-clinical-blue-800">
              <Pill className="h-4 w-4 text-clinical-blue-700 dark:text-clinical-blue-300" />
            </div>
            <h3 className="text-sm font-semibold text-clinical-blue-900 dark:text-clinical-blue-100">
              Dosing Information
            </h3>
          </div>
          <div className="pl-9">
            <p className="font-clinical-mono text-sm text-clinical-blue-800 dark:text-clinical-blue-200
                          whitespace-pre-wrap leading-relaxed tracking-tight">
              {result.dosing}
            </p>
          </div>
        </motion.section>
      )}

      {/* Warnings - Emphasized border for visibility */}
      {result.warnings && result.warnings.length > 0 && (
        <motion.section
          variants={staggerChildVariants}
          className="rounded-xl border-2 border-caution-400 bg-caution-50
                     dark:border-caution-600 dark:bg-caution-950/30 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-caution-200 dark:bg-caution-800">
              <AlertTriangle className="h-4 w-4 text-caution-700 dark:text-caution-300" />
            </div>
            <h3 className="text-sm font-semibold text-caution-900 dark:text-caution-100">
              Contraindications &amp; Warnings
            </h3>
          </div>
          <ul className="space-y-2 pl-9">
            {result.warnings.map((warning, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-sm text-caution-800 dark:text-caution-200"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-caution-500 flex-shrink-0" />
                <span className="leading-relaxed">{warning}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* Citations - Cascading animation */}
      {result.citations && result.citations.length > 0 && (
        <motion.section variants={staggerChildVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-clinical-gray-100 dark:bg-clinical-gray-800">
              <FileText className="h-4 w-4 text-clinical-gray-600 dark:text-clinical-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-clinical-gray-900 dark:text-clinical-gray-100">
              Sources
              <span className="ml-1.5 text-xs font-normal text-clinical-gray-500">
                ({result.citations.length})
              </span>
            </h3>
          </div>
          <div className="space-y-2.5 pl-9">
            {result.citations.map((citation, idx) => (
              <motion.div
                key={`${citation.source}-${idx}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: idx * durations.stagger,
                  duration: durations.card,
                }}
              >
                <CitationCard
                  citation={citation}
                  isSelected={selectedCitation === citation}
                  onClick={onCitationClick ? () => onCitationClick(citation) : undefined}
                  onInsertCitation={onInsertCitation}
                />
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Response time - Subtle footer */}
      {result.responseTimeMs && (
        <motion.p
          variants={staggerChildVariants}
          className="text-xs text-clinical-gray-400 dark:text-clinical-gray-500 text-right pt-2"
        >
          Response time: {(result.responseTimeMs / 1000).toFixed(1)}s
        </motion.p>
      )}
    </motion.div>
  );
}

/**
 * Compact version of search results for message bubbles.
 */
export function LiteratureResultSummary({
  result,
  className,
}: {
  result: LiteratureSearchResult;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm text-clinical-gray-700 dark:text-clinical-gray-300 whitespace-pre-wrap leading-relaxed">
        {result.answer}
      </p>

      {result.recommendations && result.recommendations.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {result.recommendations.slice(0, 3).map((rec, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-clinical-gray-600 dark:text-clinical-gray-400"
            >
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-verified-500 flex-shrink-0" />
              <span>{rec}</span>
            </li>
          ))}
          {result.recommendations.length > 3 && (
            <li className="text-xs text-clinical-gray-500 italic pl-3.5">
              +{result.recommendations.length - 3} more recommendations
            </li>
          )}
        </ul>
      )}

      {result.warnings && result.warnings.length > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                        bg-caution-100 dark:bg-caution-900/30
                        text-caution-700 dark:text-caution-300 text-xs font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{result.warnings.length} warning(s) - see details</span>
        </div>
      )}
    </div>
  );
}
