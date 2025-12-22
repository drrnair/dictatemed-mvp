// src/app/(dashboard)/settings/style/components/StyleModeSelector.tsx
// Component for selecting between global and per-subspecialty style modes

'use client';

import { useState } from 'react';
import type { Subspecialty } from '@prisma/client';
import type { SubspecialtyStyleProfile } from '@/domains/style/subspecialty-profile.types';
import { formatSubspecialtyLabel, getAllSubspecialties } from '@/hooks/useStyleProfiles';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Layers,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type StyleMode = 'global' | 'subspecialty';

interface StyleModeSelectorProps {
  currentMode: StyleMode;
  globalProfileExists: boolean;
  subspecialtyProfiles: SubspecialtyStyleProfile[];
  userSubspecialties: Subspecialty[];
  onModeChange: (mode: StyleMode) => void;
  onViewSubspecialtyProfiles?: () => void;
}

/**
 * Selector component to toggle between global and per-subspecialty style modes.
 */
export function StyleModeSelector({
  currentMode,
  globalProfileExists,
  subspecialtyProfiles,
  userSubspecialties,
  onModeChange,
  onViewSubspecialtyProfiles,
}: StyleModeSelectorProps) {
  const activeSubspecialtyCount = subspecialtyProfiles.length;
  const hasSubspecialtyProfiles = activeSubspecialtyCount > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Global Mode Card */}
      <StyleModeCard
        mode="global"
        isActive={currentMode === 'global'}
        onClick={() => onModeChange('global')}
        icon={<Globe className="h-5 w-5" />}
        title="Global Style"
        description="One style profile for all your letters, regardless of subspecialty."
        statusIcon={
          globalProfileExists ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          )
        }
        statusText={globalProfileExists ? 'Profile active' : 'No profile yet'}
      >
        <ul className="text-sm text-muted-foreground space-y-1 mt-3">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">+</span>
            <span>Simpler setup - one profile covers everything</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">+</span>
            <span>Faster learning with edits from all letter types</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground mt-0.5">-</span>
            <span>Same style for different audiences (GPs, specialists)</span>
          </li>
        </ul>
      </StyleModeCard>

      {/* Per-Subspecialty Mode Card */}
      <StyleModeCard
        mode="subspecialty"
        isActive={currentMode === 'subspecialty'}
        onClick={() => onModeChange('subspecialty')}
        icon={<Layers className="h-5 w-5" />}
        title="Per-Subspecialty Style"
        description="Separate style profiles for each of your subspecialties."
        statusIcon={
          hasSubspecialtyProfiles ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          )
        }
        statusText={
          hasSubspecialtyProfiles
            ? `${activeSubspecialtyCount} profile${activeSubspecialtyCount > 1 ? 's' : ''} active`
            : 'No profiles yet'
        }
        badge={hasSubspecialtyProfiles ? 'Recommended' : undefined}
      >
        <ul className="text-sm text-muted-foreground space-y-1 mt-3">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">+</span>
            <span>Different styles for different letter types</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">+</span>
            <span>Better personalization per clinical context</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground mt-0.5">-</span>
            <span>Needs more edits to learn each subspecialty</span>
          </li>
        </ul>

        {/* Subspecialty Profile Summary */}
        {currentMode === 'subspecialty' && userSubspecialties.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-wrap gap-1.5">
              {userSubspecialties.map((sub) => {
                const hasProfile = subspecialtyProfiles.some((p) => p.subspecialty === sub);
                return (
                  <Badge
                    key={sub}
                    variant={hasProfile ? 'default' : 'outline'}
                    className={cn(
                      'text-xs',
                      !hasProfile && 'text-muted-foreground'
                    )}
                  >
                    {formatSubspecialtyLabel(sub)}
                  </Badge>
                );
              })}
            </div>
            {onViewSubspecialtyProfiles && (
              <Button
                variant="link"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewSubspecialtyProfiles();
                }}
                className="mt-2 h-auto p-0 text-xs"
              >
                Manage subspecialty profiles
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </StyleModeCard>
    </div>
  );
}

/**
 * Individual mode card component.
 */
interface StyleModeCardProps {
  mode: StyleMode;
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  statusIcon: React.ReactNode;
  statusText: string;
  badge?: string;
  children?: React.ReactNode;
}

function StyleModeCard({
  mode,
  isActive,
  onClick,
  icon,
  title,
  description,
  statusIcon,
  statusText,
  badge,
  children,
}: StyleModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left transition-all w-full rounded-lg',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isActive
          ? 'ring-2 ring-primary'
          : 'hover:shadow-md'
      )}
    >
      <Card className={cn(
        'h-full border-2 transition-colors',
        isActive
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:border-primary/30'
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                'p-2 rounded-full',
                isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{title}</CardTitle>
                  {badge && (
                    <Badge variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-sm">{description}</CardDescription>
              </div>
            </div>
            {isActive && (
              <div className="rounded-full bg-primary p-1">
                <CheckCircle className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1.5 text-sm">
            {statusIcon}
            <span className="text-muted-foreground">{statusText}</span>
          </div>
          {children}
        </CardContent>
      </Card>
    </button>
  );
}

/**
 * Information banner explaining style modes.
 */
export function StyleModeInfoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <h4 className="font-medium text-blue-900">How style learning works</h4>
        <p className="text-sm text-blue-700 mt-1">
          DictateMED learns your writing style from the edits you make to AI-generated letters.
          You can choose to have one global style profile, or separate profiles for each subspecialty
          you practice. Per-subspecialty profiles allow you to write differently for different
          clinical contexts (e.g., more detailed for EP, more concise for general follow-ups).
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-sm text-blue-600 hover:text-blue-800 mt-2"
        >
          Got it, dismiss
        </button>
      </div>
    </div>
  );
}

/**
 * Summary card showing active style profiles.
 */
interface StyleSummaryProps {
  mode: StyleMode;
  globalProfileExists: boolean;
  subspecialtyProfiles: SubspecialtyStyleProfile[];
}

export function StyleSummary({
  mode,
  globalProfileExists,
  subspecialtyProfiles,
}: StyleSummaryProps) {
  if (mode === 'global') {
    return (
      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium mb-2">Active Style Configuration</h4>
        {globalProfileExists ? (
          <p className="text-sm text-muted-foreground">
            Your global style profile is active. All letter drafts will be personalized
            using this profile.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No style profile detected yet. Start editing AI-generated letters or upload
            sample letters to build your profile.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/50 rounded-lg">
      <h4 className="font-medium mb-2">Active Style Profiles</h4>
      {subspecialtyProfiles.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Per-subspecialty profiles are active:
          </p>
          <div className="flex flex-wrap gap-2">
            {subspecialtyProfiles.map((profile) => (
              <Badge key={profile.id} variant="default">
                {formatSubspecialtyLabel(profile.subspecialty)}
                <span className="ml-1 opacity-70">
                  ({profile.totalEditsAnalyzed} edits)
                </span>
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No subspecialty profiles detected yet. Edit letters within specific subspecialties
          or upload sample letters to build profiles.
        </p>
      )}
    </div>
  );
}
