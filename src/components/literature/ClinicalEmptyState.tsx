'use client';

import { motion } from 'framer-motion';
import { Search, BookOpen, FileText, Upload, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  staggerContainerVariants,
  staggerChildVariants,
} from '@/styles/clinical-animations';

interface ClinicalEmptyStateProps {
  /** Type of empty state to show */
  variant: 'search' | 'library' | 'results';
  /** Selected text context (if any) */
  selectedText?: string;
  /** Callback when upload is clicked (library variant) */
  onUpload?: () => void;
  /** Callback when search is clicked (search variant) */
  onSearch?: () => void;
  /** Callback when a quick tip is selected (pre-fills the query) */
  onQuerySelect?: (query: string) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Custom SVG illustration for the empty library state.
 * Shows a stylized medical document/book icon.
 */
function LibraryIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle cx="60" cy="60" r="56" className="fill-clinical-gray-100" />

      {/* Stack of documents */}
      <rect
        x="32"
        y="42"
        width="56"
        height="44"
        rx="4"
        className="fill-white stroke-clinical-gray-300"
        strokeWidth="2"
      />
      <rect
        x="36"
        y="38"
        width="48"
        height="4"
        rx="2"
        className="fill-clinical-gray-200"
      />
      <rect
        x="40"
        y="34"
        width="40"
        height="4"
        rx="2"
        className="fill-clinical-gray-100"
      />

      {/* Document lines */}
      <rect x="40" y="52" width="32" height="3" rx="1.5" className="fill-clinical-gray-200" />
      <rect x="40" y="60" width="40" height="3" rx="1.5" className="fill-clinical-gray-200" />
      <rect x="40" y="68" width="28" height="3" rx="1.5" className="fill-clinical-gray-200" />

      {/* Medical cross icon */}
      <rect x="54" y="75" width="12" height="4" rx="2" className="fill-clinical-blue-500" />
      <rect x="58" y="71" width="4" height="12" rx="2" className="fill-clinical-blue-500" />
    </svg>
  );
}

/**
 * Custom SVG illustration for the search empty state.
 * Shows a stylized search/magnifying glass with sparkles.
 */
function SearchIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle cx="60" cy="60" r="56" className="fill-clinical-blue-50" />

      {/* Magnifying glass circle */}
      <circle
        cx="52"
        cy="52"
        r="24"
        className="fill-white stroke-clinical-blue-400"
        strokeWidth="4"
      />

      {/* Handle */}
      <rect
        x="68"
        y="68"
        width="20"
        height="8"
        rx="4"
        transform="rotate(45 68 68)"
        className="fill-clinical-blue-400"
      />

      {/* Sparkles */}
      <circle cx="44" cy="44" r="3" className="fill-clinical-blue-300" />
      <circle cx="60" cy="48" r="2" className="fill-clinical-blue-200" />
      <circle cx="48" cy="60" r="2" className="fill-clinical-blue-200" />

      {/* Small sparkle decorations */}
      <path
        d="M90 30L92 34L96 32L92 34L94 38L92 34L88 36L92 34L90 30Z"
        className="fill-verified-400"
      />
      <path
        d="M26 70L28 74L32 72L28 74L30 78L28 74L24 76L28 74L26 70Z"
        className="fill-caution-400"
      />
    </svg>
  );
}

/**
 * Custom SVG illustration for the no results state.
 * Shows a document with a question mark.
 */
function NoResultsIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle cx="60" cy="60" r="56" className="fill-caution-50" />

      {/* Document */}
      <rect
        x="36"
        y="28"
        width="48"
        height="64"
        rx="4"
        className="fill-white stroke-caution-300"
        strokeWidth="2"
      />

      {/* Corner fold */}
      <path
        d="M72 28V40H84"
        className="stroke-caution-300"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M72 28L84 40V28H72Z"
        className="fill-caution-100"
      />

      {/* Question mark */}
      <path
        d="M54 54C54 48.477 58.477 44 64 44C69.523 44 74 48.477 74 54C74 58.5 71 61.5 67 63V67"
        className="stroke-caution-500"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="67" cy="76" r="3" className="fill-caution-500" />
    </svg>
  );
}

/**
 * Clinical Empty State component for literature search.
 *
 * Features:
 * - Custom SVG illustrations for each variant
 * - Welcoming, helpful copy
 * - Optional CTA button (upload/search)
 * - Context display when text is selected
 *
 * Design notes:
 * - Uses clinical color palette
 * - Generous whitespace (py-16)
 * - Staggered entrance animation
 * - Accessible with proper headings
 */
export function ClinicalEmptyState({
  variant,
  selectedText,
  onUpload,
  onSearch,
  onQuerySelect,
  className,
}: ClinicalEmptyStateProps) {
  const config = {
    search: {
      Illustration: SearchIllustration,
      title: 'Ask a Clinical Question',
      description:
        'Search clinical literature for dosing guidelines, contraindications, treatment protocols, and evidence-based recommendations.',
      buttonText: 'Start Searching',
      buttonIcon: Search,
      onAction: onSearch,
      showContext: true,
    },
    library: {
      Illustration: LibraryIllustration,
      title: 'Build Your Medical Library',
      description:
        'Upload clinical guidelines, textbooks, and protocols to search while editing letters. Your documents stay private and secure.',
      buttonText: 'Upload Your First Reference',
      buttonIcon: Upload,
      onAction: onUpload,
      showContext: false,
    },
    results: {
      Illustration: NoResultsIllustration,
      title: 'No Results Found',
      description:
        'Try adjusting your search terms or check the source filters. You can also try asking your question in a different way.',
      buttonText: 'Clear Search',
      buttonIcon: Search,
      onAction: onSearch,
      showContext: false,
    },
  } as const;

  const { Illustration, title, description, buttonText, buttonIcon: ButtonIcon, onAction, showContext } =
    config[variant];

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex flex-col items-center py-16 px-8 text-center', className)}
    >
      {/* Illustration */}
      <motion.div variants={staggerChildVariants} className="mb-6">
        <Illustration className="w-[120px] h-[120px]" />
      </motion.div>

      {/* Title */}
      <motion.h3
        variants={staggerChildVariants}
        className="text-lg font-semibold text-clinical-gray-900 mb-2 font-ui-sans"
      >
        {title}
      </motion.h3>

      {/* Description */}
      <motion.p
        variants={staggerChildVariants}
        className="text-sm text-clinical-gray-600 mb-6 max-w-sm font-ui-sans leading-relaxed"
      >
        {description}
      </motion.p>

      {/* Context indicator (when text is selected) */}
      {showContext && selectedText && (
        <motion.div
          variants={staggerChildVariants}
          className="mb-6 px-4 py-3 bg-clinical-blue-50 border border-clinical-blue-200 rounded-lg max-w-sm"
        >
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-clinical-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="text-xs font-medium text-clinical-blue-700 mb-1">
                Searching with context:
              </p>
              <p className="text-xs text-clinical-blue-600 line-clamp-2">
                &ldquo;{selectedText.substring(0, 100)}
                {selectedText.length > 100 ? '...' : ''}&rdquo;
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* CTA Button */}
      {onAction && (
        <motion.div variants={staggerChildVariants}>
          <Button
            onClick={onAction}
            className={cn(
              'px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-shadow',
              variant === 'library'
                ? 'bg-verified-600 hover:bg-verified-700 text-white'
                : 'bg-clinical-blue-600 hover:bg-clinical-blue-700 text-white'
            )}
          >
            <ButtonIcon className="w-4 h-4 mr-2" />
            {buttonText}
          </Button>
        </motion.div>
      )}

      {/* Quick tips (search variant only) */}
      {variant === 'search' && onQuerySelect && (
        <motion.div
          variants={staggerChildVariants}
          className="mt-8 text-left max-w-sm"
        >
          <p className="text-xs font-semibold text-clinical-gray-500 uppercase tracking-wide mb-3">
            Try asking about
          </p>
          <div className="space-y-2">
            {[
              { icon: FileText, text: 'Dosing for metformin in renal impairment' },
              { icon: BookOpen, text: 'First-line treatment for H. pylori' },
              { icon: Sparkles, text: 'Contraindications for ACE inhibitors' },
            ].map((tip) => (
              <button
                key={tip.text}
                onClick={() => onQuerySelect(tip.text)}
                className="flex items-center gap-2 w-full text-left px-3 py-2
                         bg-clinical-gray-50 hover:bg-clinical-gray-100
                         rounded-lg text-sm text-clinical-gray-700
                         transition-colors duration-150"
              >
                <tip.icon className="w-4 h-4 text-clinical-gray-400 flex-shrink-0" />
                <span>{tip.text}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Compact empty state for inline use.
 * Shows a minimal message without illustration.
 */
export function CompactEmptyState({
  message = 'No results',
  icon: Icon = Search,
  className,
}: {
  message?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center py-8 text-center', className)}>
      <div className="w-12 h-12 rounded-full bg-clinical-gray-100 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-clinical-gray-400" />
      </div>
      <p className="text-sm text-clinical-gray-500 font-ui-sans">{message}</p>
    </div>
  );
}
