'use client';

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ==================== INTERFACES ====================

export interface ExtractedValue {
  id: string;
  category:
    | 'cardiac_function'
    | 'coronary_disease'
    | 'valvular'
    | 'medication'
    | 'procedural';
  name: string;
  value: string;
  unit?: string;
  sourceAnchorId: string;
  verified: boolean;
  critical: boolean; // LVEF, stenosis are critical
}

export interface HallucinationFlag {
  id: string;
  flaggedText: string;
  reason: string;
  severity: 'warning' | 'critical';
  dismissed: boolean;
  dismissedReason?: string;
}

export interface VerificationPanelProps {
  extractedValues: ExtractedValue[];
  hallucinationFlags: HallucinationFlag[];
  onVerifyValue: (valueId: string) => void;
  onVerifyAll: () => void;
  onDismissFlag: (flagId: string, reason: string) => void;
  onValueClick: (valueId: string) => void; // To show source
}

// ==================== CONSTANTS ====================

const CATEGORY_LABELS: Record<ExtractedValue['category'], string> = {
  cardiac_function: 'Cardiac Function',
  coronary_disease: 'Coronary Disease',
  valvular: 'Valvular Assessment',
  medication: 'Medications',
  procedural: 'Procedural Details',
};

const CATEGORY_ORDER: ExtractedValue['category'][] = [
  'cardiac_function',
  'coronary_disease',
  'valvular',
  'medication',
  'procedural',
];

// ==================== COMPONENT ====================

export function VerificationPanel({
  extractedValues,
  hallucinationFlags,
  onVerifyValue,
  onVerifyAll,
  onDismissFlag,
  onValueClick,
}: VerificationPanelProps) {
  const [dismissDialogOpen, setDismissDialogOpen] = React.useState(false);
  const [selectedFlag, setSelectedFlag] =
    React.useState<HallucinationFlag | null>(null);
  const [dismissReason, setDismissReason] = React.useState('');

  // Calculate verification progress
  const totalValues = extractedValues.length;
  const verifiedValues = extractedValues.filter((v) => v.verified).length;
  const criticalValues = extractedValues.filter((v) => v.critical);
  const unverifiedCriticalValues = criticalValues.filter((v) => !v.verified);
  const allCriticalVerified = unverifiedCriticalValues.length === 0;
  const allVerified = verifiedValues === totalValues;

  // Group values by category
  const valuesByCategory = React.useMemo(() => {
    const grouped = new Map<ExtractedValue['category'], ExtractedValue[]>();

    CATEGORY_ORDER.forEach((category) => {
      const values = extractedValues.filter((v) => v.category === category);
      if (values.length > 0) {
        grouped.set(category, values);
      }
    });

    return grouped;
  }, [extractedValues]);

  // Filter active flags
  const activeFlags = hallucinationFlags.filter((f) => !f.dismissed);
  const criticalFlags = activeFlags.filter((f) => f.severity === 'critical');
  const warningFlags = activeFlags.filter((f) => f.severity === 'warning');

  // Handle flag dismissal
  const handleDismissClick = (flag: HallucinationFlag) => {
    setSelectedFlag(flag);
    setDismissDialogOpen(true);
    setDismissReason('');
  };

  const handleDismissConfirm = () => {
    if (selectedFlag && dismissReason.trim()) {
      onDismissFlag(selectedFlag.id, dismissReason.trim());
      setDismissDialogOpen(false);
      setSelectedFlag(null);
      setDismissReason('');
    }
  };

  const handleVerifyAllClick = () => {
    if (!allVerified) {
      onVerifyAll();
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-background border-l"
      data-testid="verification-panel"
    >
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-clinical-critical" />
            Clinical Verification
          </h2>
          <Button
            variant={allVerified ? 'verified' : 'default'}
            size="sm"
            onClick={handleVerifyAllClick}
            disabled={allVerified}
            data-testid="verify-all-button"
            aria-label="Verify all clinical values"
          >
            {allVerified ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                All Verified
              </>
            ) : (
              'Verify All'
            )}
          </Button>
        </div>

        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Progress: {verifiedValues} of {totalValues} verified
            </span>
            <span className="font-medium">
              {totalValues > 0
                ? Math.round((verifiedValues / totalValues) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                allVerified
                  ? 'bg-clinical-verified'
                  : 'bg-primary'
              )}
              style={{
                width: `${totalValues > 0 ? (verifiedValues / totalValues) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Critical Values Warning */}
        {!allCriticalVerified && (
          <div
            className="mt-3 p-2 bg-clinical-critical-muted border border-clinical-critical rounded-md flex items-start gap-2"
            role="alert"
            aria-live="polite"
          >
            <AlertTriangle className="h-4 w-4 text-clinical-critical mt-0.5 flex-shrink-0" />
            <p className="text-xs text-clinical-critical">
              {unverifiedCriticalValues.length} critical value
              {unverifiedCriticalValues.length !== 1 ? 's' : ''} require
              verification before approval
            </p>
          </div>
        )}
      </div>

      {/* Hallucination Flags Section */}
      {activeFlags.length > 0 && (
        <div className="p-4 border-b bg-muted/10">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-clinical-warning" />
            AI Hallucination Flags ({activeFlags.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {criticalFlags.map((flag) => (
              <FlagCard
                key={flag.id}
                flag={flag}
                onDismiss={handleDismissClick}
              />
            ))}
            {warningFlags.map((flag) => (
              <FlagCard
                key={flag.id}
                flag={flag}
                onDismiss={handleDismissClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Values by Category */}
      <div className="flex-1 overflow-y-auto p-4">
        {valuesByCategory.size === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No clinical values extracted yet</p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={Array.from(valuesByCategory.keys())}
            className="w-full"
          >
            {Array.from(valuesByCategory.entries()).map(
              ([category, values]) => (
                <AccordionItem key={category} value={category}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <span className="font-medium">
                        {CATEGORY_LABELS[category]}
                      </span>
                      <CategoryBadge values={values} />
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {values.map((value, index) => (
                        <ValueCard
                          key={value.id}
                          value={value}
                          onVerify={onVerifyValue}
                          onClick={onValueClick}
                          tabIndex={0}
                          data-index={index}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            )}
          </Accordion>
        )}
      </div>

      {/* Dismiss Flag Dialog */}
      <Dialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <DialogContent data-testid="dismiss-flag-dialog">
          <DialogHeader>
            <DialogTitle>Dismiss Hallucination Flag</DialogTitle>
            <DialogDescription>
              Please provide a reason for dismissing this flag. This will be
              logged for quality assurance.
            </DialogDescription>
          </DialogHeader>
          {selectedFlag && (
            <div className="py-4">
              <div className="p-3 bg-muted rounded-md mb-4">
                <p className="text-sm font-medium mb-1">Flagged Text:</p>
                <p className="text-sm">{selectedFlag.flaggedText}</p>
              </div>
              <div className="p-3 bg-muted rounded-md mb-4">
                <p className="text-sm font-medium mb-1">AI Reason:</p>
                <p className="text-sm text-muted-foreground">
                  {selectedFlag.reason}
                </p>
              </div>
              <label htmlFor="dismiss-reason" className="sr-only">
                Dismissal reason
              </label>
              <textarea
                id="dismiss-reason"
                className="w-full min-h-[100px] p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter reason for dismissing this flag..."
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                aria-required="true"
                data-testid="dismiss-reason-input"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDismissDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDismissConfirm}
              disabled={!dismissReason.trim()}
              data-testid="confirm-dismiss-button"
            >
              Dismiss Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

interface ValueCardProps {
  value: ExtractedValue;
  onVerify: (valueId: string) => void;
  onClick: (valueId: string) => void;
  tabIndex: number;
  'data-index': number;
}

function ValueCard({
  value,
  onVerify,
  onClick,
  tabIndex,
  'data-index': dataIndex,
}: ValueCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(value.id);
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (checked) {
      onVerify(value.id);
    }
  };

  return (
    <div
      className={cn(
        'p-3 rounded-md border transition-all',
        value.verified
          ? 'bg-clinical-verified-muted border-clinical-verified'
          : 'bg-clinical-warning-muted border-clinical-warning hover:border-clinical-warning'
      )}
      data-testid={`value-card-${value.id}`}
      data-verified={value.verified}
      data-critical={value.critical}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id={`verify-${value.id}`}
          checked={value.verified}
          onCheckedChange={handleCheckboxChange}
          className="mt-0.5"
          aria-label={`Verify ${value.name}`}
          data-testid={`verify-checkbox-${value.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <label
              htmlFor={`verify-${value.id}`}
              className="text-sm font-medium cursor-pointer flex items-center gap-1"
            >
              {value.name}
              {value.critical && (
                <span
                  className="text-clinical-critical text-lg leading-none"
                  aria-label="Critical value"
                  title="Critical value - must be verified"
                >
                  *
                </span>
              )}
            </label>
            {value.verified && (
              <CheckCircle2 className="h-4 w-4 text-clinical-verified flex-shrink-0" />
            )}
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-base font-semibold">{value.value}</span>
            {value.unit && (
              <span className="text-sm text-muted-foreground">
                {value.unit}
              </span>
            )}
          </div>
          <button
            onClick={() => onClick(value.id)}
            onKeyDown={handleKeyDown}
            className="text-xs text-primary hover:underline flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-ring rounded"
            tabIndex={tabIndex}
            aria-label={`View source for ${value.name}`}
            data-testid={`view-source-${value.id}`}
          >
            <ExternalLink className="h-3 w-3" />
            View Source
          </button>
        </div>
      </div>
    </div>
  );
}

interface CategoryBadgeProps {
  values: ExtractedValue[];
}

function CategoryBadge({ values }: CategoryBadgeProps) {
  const verified = values.filter((v) => v.verified).length;
  const total = values.length;
  const allVerified = verified === total;

  return (
    <Badge
      variant={allVerified ? 'verified' : 'outline'}
      className="ml-2"
      aria-label={`${verified} of ${total} values verified in this category`}
    >
      {verified}/{total}
    </Badge>
  );
}

interface FlagCardProps {
  flag: HallucinationFlag;
  onDismiss: (flag: HallucinationFlag) => void;
}

function FlagCard({ flag, onDismiss }: FlagCardProps) {
  const isCritical = flag.severity === 'critical';

  return (
    <div
      className={cn(
        'p-3 rounded-md border',
        isCritical
          ? 'bg-clinical-critical-muted border-clinical-critical'
          : 'bg-clinical-warning-muted border-clinical-warning'
      )}
      data-testid={`flag-card-${flag.id}`}
      data-severity={flag.severity}
    >
      <div className="flex items-start gap-2 mb-2">
        {isCritical ? (
          <XCircle className="h-4 w-4 text-clinical-critical flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-clinical-warning flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <Badge
            variant={isCritical ? 'critical' : 'warning'}
            className="text-xs mb-1"
          >
            {isCritical ? 'CRITICAL' : 'WARNING'}
          </Badge>
          <p className="text-sm font-medium mb-1 break-words">
            {flag.flaggedText}
          </p>
          <p className="text-xs text-muted-foreground break-words">
            {flag.reason}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDismiss(flag)}
          data-testid={`dismiss-flag-${flag.id}`}
          aria-label={`Dismiss ${flag.severity} flag`}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
