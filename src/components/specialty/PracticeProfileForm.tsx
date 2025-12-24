'use client';

// src/components/specialty/PracticeProfileForm.tsx
// Main form component for specialty onboarding and profile editing

import { useState, useCallback, useEffect } from 'react';
import { Loader2, Stethoscope, Info, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SpecialtyCombobox, type SelectedSpecialtyItem } from './SpecialtyCombobox';
import { SubspecialtyPanel, type SelectedSubspecialtyItem } from './SubspecialtyPanel';
import {
  usePracticeProfile,
  profileToFormState,
  formStateToSaveData,
} from '@/hooks/usePracticeProfile';
import type { ClinicianRole } from '@prisma/client';
import type { PracticeProfile } from '@/domains/specialties';

// ============================================================================
// Types
// ============================================================================

export interface PracticeProfileFormProps {
  /** Initial profile to populate form (for edit mode) */
  initialProfile?: PracticeProfile | null;
  /** Callback when profile is saved successfully */
  onSave?: (profile: PracticeProfile) => void;
  /** Callback for skip/cancel action */
  onSkip?: () => void;
  /** Whether this is onboarding (shows skip) or settings (shows cancel) */
  mode?: 'onboarding' | 'settings';
  /** Whether to auto-focus the specialty input */
  autoFocus?: boolean;
  /** Custom save button text */
  saveButtonText?: string;
  /** Custom skip/cancel button text */
  skipButtonText?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Practice profile form combining specialty and subspecialty selection.
 * Used in onboarding and settings pages.
 */
export function PracticeProfileForm({
  initialProfile,
  onSave,
  onSkip,
  mode = 'onboarding',
  autoFocus,
  saveButtonText,
  skipButtonText,
  className,
}: PracticeProfileFormProps) {
  // Default autoFocus to true for onboarding, false for settings
  const shouldAutoFocus = autoFocus ?? mode === 'onboarding';
  const {
    profile: fetchedProfile,
    isLoading,
    isSaving,
    error: apiError,
    saveProfile,
    createCustomSpecialty,
    createCustomSubspecialty,
  } = usePracticeProfile({ fetchOnMount: !initialProfile });

  // Use provided initial profile or fetched profile
  const baseProfile = initialProfile ?? fetchedProfile;

  // Form state
  const [selectedSpecialties, setSelectedSpecialties] = useState<SelectedSpecialtyItem[]>([]);
  const [subspecialtiesBySpecialty, setSubspecialtiesBySpecialty] = useState<
    Map<string, SelectedSubspecialtyItem[]>
  >(new Map());
  const [formError, setFormError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form state from profile
  useEffect(() => {
    if (baseProfile) {
      const { specialties, subspecialtiesBySpecialty: subs } = profileToFormState(baseProfile);
      setSelectedSpecialties(specialties);
      setSubspecialtiesBySpecialty(subs);
      setHasChanges(false);
    }
  }, [baseProfile]);

  // Track changes
  useEffect(() => {
    if (!baseProfile) {
      setHasChanges(selectedSpecialties.length > 0);
      return;
    }

    const { specialties: origSpecialties, subspecialtiesBySpecialty: origSubs } =
      profileToFormState(baseProfile);

    // Check if specialties changed
    const specialtiesChanged =
      selectedSpecialties.length !== origSpecialties.length ||
      selectedSpecialties.some(
        (s, i) => !origSpecialties[i] || s.id !== origSpecialties[i].id
      );

    // Check if subspecialties changed
    let subsChanged = false;
    if (!specialtiesChanged) {
      const entries = Array.from(subspecialtiesBySpecialty.entries());
      for (const [specId, subs] of entries) {
        const origSubsForSpec = origSubs.get(specId) || [];
        if (
          subs.length !== origSubsForSpec.length ||
          subs.some((s: SelectedSubspecialtyItem, i: number) =>
            !origSubsForSpec[i] || s.id !== origSubsForSpec[i].id
          )
        ) {
          subsChanged = true;
          break;
        }
      }
    }

    setHasChanges(specialtiesChanged || subsChanged);
  }, [selectedSpecialties, subspecialtiesBySpecialty, baseProfile]);

  // Handle specialty selection change
  const handleSpecialtiesChange = useCallback((newSpecialties: SelectedSpecialtyItem[]) => {
    setSelectedSpecialties(newSpecialties);
    setFormError(null);

    // Clean up subspecialties for removed specialties
    setSubspecialtiesBySpecialty((prev) => {
      const newIds = new Set(newSpecialties.map((s) => s.id));
      const updated = new Map<string, SelectedSubspecialtyItem[]>();
      const prevEntries = Array.from(prev.entries());

      for (const [specId, subs] of prevEntries) {
        if (newIds.has(specId)) {
          updated.set(specId, subs);
        }
      }

      // Initialize empty arrays for new specialties
      for (const spec of newSpecialties) {
        if (!updated.has(spec.id)) {
          updated.set(spec.id, []);
        }
      }

      return updated;
    });
  }, []);

  // Handle subspecialty change for a specific specialty
  const handleSubspecialtiesChange = useCallback(
    (specialtyId: string, newSubspecialties: SelectedSubspecialtyItem[]) => {
      setSubspecialtiesBySpecialty((prev) => {
        const updated = new Map(prev);
        updated.set(specialtyId, newSubspecialties);
        return updated;
      });
      setFormError(null);
    },
    []
  );

  // Create custom specialty handler
  const handleCreateCustomSpecialty = useCallback(
    async (name: string): Promise<SelectedSpecialtyItem | null> => {
      const result = await createCustomSpecialty(name);
      if (!result) {
        setFormError('Failed to create custom specialty. Please try again.');
      }
      return result;
    },
    [createCustomSpecialty]
  );

  // Create custom subspecialty handler
  const handleCreateCustomSubspecialty = useCallback(
    async (name: string, specialtyId: string): Promise<SelectedSubspecialtyItem | null> => {
      const result = await createCustomSubspecialty(name, specialtyId);
      if (!result) {
        setFormError('Failed to create custom subspecialty. Please try again.');
      }
      return result;
    },
    [createCustomSubspecialty]
  );

  // Save handler
  const handleSave = useCallback(async () => {
    setFormError(null);

    const clinicianRole: ClinicianRole = baseProfile?.clinicianRole || 'MEDICAL';
    const saveData = formStateToSaveData(
      clinicianRole,
      selectedSpecialties,
      subspecialtiesBySpecialty
    );

    const updatedProfile = await saveProfile(saveData);

    if (updatedProfile) {
      onSave?.(updatedProfile);
    } else {
      setFormError('Failed to save your practice profile. Please try again.');
    }
  }, [
    baseProfile?.clinicianRole,
    selectedSpecialties,
    subspecialtiesBySpecialty,
    saveProfile,
    onSave,
  ]);

  // Skip handler
  const handleSkip = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  // Derived state
  const error = formError || apiError;
  const isDisabled = isLoading || isSaving;
  const canSave = mode === 'onboarding' ? true : hasChanges;

  // Loading state
  if (isLoading && !initialProfile) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Section A: Intro */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Stethoscope className="h-4 w-4" />
          <span>About your practice</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Tell DictateMED what you practice. This helps tailor notes and templates for you.
        </p>
        {mode === 'onboarding' && (
          <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
            <Info className="h-3 w-3" />
            You can always change this later in Settings.
          </p>
        )}
      </div>

      {/* Section B: Primary specialties */}
      <div className="space-y-2">
        <p className="text-sm font-medium" id="specialty-label">
          What do you practice?
        </p>
        <SpecialtyCombobox
          value={selectedSpecialties}
          onChange={handleSpecialtiesChange}
          onCreateCustom={handleCreateCustomSpecialty}
          placeholder='Start typing, e.g. "cardio", "neuro", "GP"...'
          disabled={isDisabled}
          autoFocus={shouldAutoFocus} // eslint-disable-line jsx-a11y/no-autofocus -- Intentional for onboarding UX
          maxResults={7}
          aria-labelledby="specialty-label"
        />
        {selectedSpecialties.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Skip if you prefer a generic profile.
          </p>
        )}
      </div>

      {/* Section C: Subspecialties per specialty */}
      {selectedSpecialties.length > 0 && (
        <div className="space-y-3">
          {selectedSpecialties.map((specialty) => (
            <SubspecialtyPanel
              key={specialty.id}
              specialtyId={specialty.id}
              specialtyName={specialty.name}
              isCustomSpecialty={specialty.isCustom}
              value={subspecialtiesBySpecialty.get(specialty.id) || []}
              onChange={(subs) => handleSubspecialtiesChange(specialty.id, subs)}
              onCreateCustom={handleCreateCustomSubspecialty}
              disabled={isDisabled}
              defaultExpanded={selectedSpecialties.length === 1}
            />
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onSkip && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={isSaving}
          >
            {skipButtonText || (mode === 'onboarding' ? 'Skip for now' : 'Cancel')}
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={isDisabled || !canSave}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saveButtonText || (mode === 'onboarding' ? 'Continue' : 'Save changes')}
        </Button>
      </div>
    </div>
  );
}
