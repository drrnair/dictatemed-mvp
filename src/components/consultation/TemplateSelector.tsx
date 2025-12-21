'use client';

// src/components/consultation/TemplateSelector.tsx
// Template selection with category filtering and recommendations

import { useState, useEffect, useCallback } from 'react';
import { FileText, Star, Clock, ChevronDown, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  subspecialties: string[];
  isGeneric: boolean;
  isFavorite?: boolean;
  usageCount?: number;
  lastUsedAt?: string;
}

interface TemplateSelectorProps {
  value?: string; // templateId
  onChange: (templateId: string | undefined) => void;
  letterType?: string; // To filter relevant templates
  disabled?: boolean;
}

type CategoryFilter = 'ALL' | 'CONSULTATION' | 'PROCEDURE' | 'DIAGNOSTIC' | 'FOLLOW_UP' | 'DISCHARGE';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  ALL: 'All Templates',
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure',
  DIAGNOSTIC: 'Diagnostic',
  FOLLOW_UP: 'Follow-up',
  DISCHARGE: 'Discharge',
};

export function TemplateSelector({
  value,
  onChange,
  letterType,
  disabled,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [isExpanded, setIsExpanded] = useState(false);

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      if (!response.ok) throw new Error('Failed to load templates');

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectedTemplate = templates.find((t) => t.id === value);

  // Filter templates by category
  const filteredTemplates =
    categoryFilter === 'ALL'
      ? templates
      : templates.filter((t) => t.category === categoryFilter);

  // Sort: favorites first, then by usage, then alphabetically
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    if ((a.usageCount || 0) > (b.usageCount || 0)) return -1;
    if ((a.usageCount || 0) < (b.usageCount || 0)) return 1;
    return a.name.localeCompare(b.name);
  });

  // Recommended templates (favorites + recently used)
  const recommendedTemplates = templates
    .filter((t) => t.isFavorite || t.lastUsedAt)
    .slice(0, 3);

  const handleSelect = useCallback(
    (templateId: string) => {
      onChange(templateId);
      setIsExpanded(false);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Letter Template</Label>
        <div className="flex items-center justify-center rounded-md border p-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label>Letter Template</Label>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Letter Template (Optional)</Label>

      {/* Selected template display */}
      {selectedTemplate ? (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{selectedTemplate.name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {selectedTemplate.description || CATEGORY_LABELS[selectedTemplate.category as CategoryFilter] || selectedTemplate.category}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
          >
            Change
          </Button>
        </div>
      ) : (
        // Template selection
        <div className="space-y-3">
          {/* Recommended templates */}
          {recommendedTemplates.length > 0 && !isExpanded && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Recommended</p>
              <div className="grid gap-2">
                {recommendedTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={() => handleSelect(template.id)}
                    disabled={disabled}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {/* Expand to see all templates */}
          {!isExpanded ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setIsExpanded(true)}
              disabled={disabled}
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              Browse All Templates
            </Button>
          ) : (
            <div className="space-y-3">
              {/* Category filter */}
              <div className="flex flex-wrap gap-1">
                {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      categoryFilter === category
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                    disabled={disabled}
                  >
                    {CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>

              {/* Template list */}
              <div className="max-h-64 overflow-auto rounded-md border">
                {sortedTemplates.length > 0 ? (
                  <div className="divide-y">
                    {sortedTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={() => handleSelect(template.id)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No templates found
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="w-full"
              >
                Collapse
              </Button>
            </div>
          )}

          {/* Skip option */}
          {!isExpanded && (
            <p className="text-xs text-muted-foreground text-center">
              or continue without a template
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: Template;
  onSelect: () => void;
  disabled?: boolean;
  compact?: boolean;
}

function TemplateCard({ template, onSelect, disabled, compact }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 w-full text-left transition-colors',
        'hover:bg-accent focus:bg-accent focus:outline-none',
        compact ? 'rounded-md border p-3' : 'p-3',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-md',
          compact ? 'h-8 w-8 bg-muted' : 'h-10 w-10 bg-muted'
        )}
      >
        <FileText className={cn(compact ? 'h-4 w-4' : 'h-5 w-5', 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('font-medium truncate', compact && 'text-sm')}>
            {template.name}
          </p>
          {template.isFavorite && (
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          )}
        </div>
        {!compact && template.description && (
          <p className="text-xs text-muted-foreground truncate">
            {template.description}
          </p>
        )}
        {template.lastUsedAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Recently used
          </p>
        )}
      </div>
    </button>
  );
}
