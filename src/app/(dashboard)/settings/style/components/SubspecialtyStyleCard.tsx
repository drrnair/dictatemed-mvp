// src/app/(dashboard)/settings/style/components/SubspecialtyStyleCard.tsx
// Card component for displaying and managing per-subspecialty style profiles

'use client';

import { useState } from 'react';
import type { Subspecialty } from '@prisma/client';
import type { SubspecialtyStyleProfile } from '@/domains/style/subspecialty-profile.types';
import {
  formatSubspecialtyLabel,
  getSubspecialtyDescription,
  calculateProfileConfidence,
} from '@/hooks/useStyleProfiles';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Heart,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LearningStrengthSlider } from './LearningStrengthSlider';

interface SubspecialtyStyleCardProps {
  subspecialty: Subspecialty;
  profile: SubspecialtyStyleProfile | null;
  editCount?: number;
  isAnalyzing?: boolean;
  canAnalyze?: boolean;
  onAnalyze: (subspecialty: Subspecialty) => Promise<void>;
  onReset: (subspecialty: Subspecialty) => Promise<void>;
  onStrengthChange: (subspecialty: Subspecialty, strength: number) => Promise<void>;
}

export function SubspecialtyStyleCard({
  subspecialty,
  profile,
  editCount = 0,
  isAnalyzing = false,
  canAnalyze = false,
  onAnalyze,
  onReset,
  onStrengthChange,
}: SubspecialtyStyleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [resetting, setResetting] = useState(false);

  const label = formatSubspecialtyLabel(subspecialty);
  const description = getSubspecialtyDescription(subspecialty);
  const confidence = calculateProfileConfidence(profile);
  const hasProfile = profile !== null;

  const handleAnalyze = async () => {
    await onAnalyze(subspecialty);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await onReset(subspecialty);
    } finally {
      setResetting(false);
    }
  };

  const handleStrengthChange = async (strength: number) => {
    await onStrengthChange(subspecialty, strength);
  };

  return (
    <Card className={cn(
      'transition-all',
      hasProfile ? 'border-primary/30 bg-primary/5' : 'border-border'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Heart
              className={cn(
                'h-5 w-5',
                hasProfile ? 'fill-primary text-primary' : 'text-muted-foreground'
              )}
            />
            <div>
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription className="text-sm mt-0.5">{description}</CardDescription>
            </div>
          </div>
          {hasProfile && (
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Profile Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Edits recorded:</span>
          <span className="font-medium">{profile?.totalEditsAnalyzed ?? editCount}</span>
        </div>

        {hasProfile && (
          <>
            {/* Confidence Meter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Profile confidence:</span>
                <span className="font-medium">{confidence}%</span>
              </div>
              <Progress value={confidence} className="h-2" />
            </div>

            {/* Learning Strength */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Adaptation level:</span>
                <span className="font-medium">
                  {Math.round((profile.learningStrength ?? 1) * 100)}%
                </span>
              </div>
              <LearningStrengthSlider
                value={profile.learningStrength ?? 1}
                onChange={handleStrengthChange}
              />
              <p className="text-xs text-muted-foreground">
                Lower values produce more neutral drafts; higher values match your style more closely.
              </p>
            </div>
          </>
        )}

        {/* Expandable Details */}
        {hasProfile && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show details
              </>
            )}
          </button>
        )}

        {expanded && hasProfile && (
          <div className="space-y-3 pt-2 border-t">
            {/* Last Analyzed */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last analyzed:</span>
              <span className="font-medium">
                {profile.lastAnalyzedAt
                  ? new Date(profile.lastAnalyzedAt).toLocaleDateString()
                  : 'Never'}
              </span>
            </div>

            {/* Section Order */}
            {profile.sectionOrder && profile.sectionOrder.length > 0 && (
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Preferred section order:</span>
                <div className="text-sm font-medium">
                  {profile.sectionOrder.slice(0, 5).join(' → ')}
                  {profile.sectionOrder.length > 5 && ' ...'}
                </div>
              </div>
            )}

            {/* Style Indicators */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {profile.greetingStyle && (
                <div>
                  <span className="text-muted-foreground">Greeting:</span>{' '}
                  <span className="font-medium capitalize">{profile.greetingStyle}</span>
                </div>
              )}
              {profile.closingStyle && (
                <div>
                  <span className="text-muted-foreground">Closing:</span>{' '}
                  <span className="font-medium capitalize">{profile.closingStyle}</span>
                </div>
              )}
              {profile.formalityLevel && (
                <div>
                  <span className="text-muted-foreground">Formality:</span>{' '}
                  <span className="font-medium capitalize">{profile.formalityLevel.replace('-', ' ')}</span>
                </div>
              )}
              {profile.terminologyLevel && (
                <div>
                  <span className="text-muted-foreground">Terminology:</span>{' '}
                  <span className="font-medium capitalize">{profile.terminologyLevel}</span>
                </div>
              )}
            </div>

            {/* Vocabulary Preferences */}
            {profile.vocabularyMap && Object.keys(profile.vocabularyMap).length > 0 && (
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Vocabulary preferences:</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(profile.vocabularyMap).slice(0, 3).map(([from, to]) => (
                    <span key={from} className="text-xs bg-muted px-2 py-1 rounded">
                      <span className="line-through text-red-500">{from}</span>
                      {' → '}
                      <span className="text-green-600">{to}</span>
                    </span>
                  ))}
                  {Object.keys(profile.vocabularyMap).length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{Object.keys(profile.vocabularyMap).length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Signoff Template */}
            {profile.signoffTemplate && (
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Preferred signoff:</span>
                <div className="text-sm font-medium italic">&quot;{profile.signoffTemplate}&quot;</div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyze}
            disabled={!canAnalyze || isAnalyzing}
            className="flex-1"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3 w-3" />
                {hasProfile ? 'Re-analyze' : 'Analyze'}
              </>
            )}
          </Button>

          {hasProfile && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={resetting}
                  aria-label="Reset style profile"
                >
                  {resetting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Style Profile</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset your {label} style profile to neutral defaults.
                    Future letters will use generic formatting until the system
                    re-learns your preferences from new edits.
                    <br /><br />
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>
                    Reset Profile
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Help Text */}
        {!hasProfile && !canAnalyze && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Edit at least 5 {label} letters or upload sample letters to create a style profile.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
