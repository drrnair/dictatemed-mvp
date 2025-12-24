'use client';

// src/app/(dashboard)/settings/templates/page.tsx
// Templates browsing and favorites management page

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  Loader2,
  Filter,
  Search,
  FileText,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  description?: string;
  slug: string;
  category: string;
  subspecialties: string[];
  isGeneric: boolean;
  variants?: Template[];
  userPreference?: {
    isFavorite: boolean;
    usageCount: number;
  };
}

interface Recommendation {
  template: Template;
  score: number;
  reasons: Array<{
    type: string;
    subspecialty?: string;
    usageCount?: number;
  }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure Report',
  DIAGNOSTIC: 'Diagnostic Report',
  FOLLOW_UP: 'Follow-up',
  DISCHARGE: 'Discharge Summary',
};

const SUBSPECIALTY_LABELS: Record<string, string> = {
  GENERAL_CARDIOLOGY: 'General',
  INTERVENTIONAL: 'Interventional',
  STRUCTURAL: 'Structural',
  ELECTROPHYSIOLOGY: 'EP',
  IMAGING: 'Imaging',
  HEART_FAILURE: 'Heart Failure',
  CARDIAC_SURGERY: 'Surgery',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subspecialtyFilter, setSubspecialtyFilter] = useState<string>('all');
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [templatesRes, recommendationsRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/templates/recommendations?limit=6'),
      ]);

      if (!templatesRes.ok) throw new Error('Failed to load templates');

      const templatesData = await templatesRes.json();
      setTemplates(templatesData.templates);

      if (recommendationsRes.ok) {
        const recommendationsData = await recommendationsRes.json();
        setRecommendations(recommendationsData.recommendations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleFavorite(templateId: string) {
    setTogglingFavorite(templateId);
    setError(null); // Clear any previous errors

    try {
      const response = await fetch(`/api/templates/${templateId}/favorite`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to toggle favorite');

      const data = await response.json();

      // Update templates list
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === templateId
            ? {
                ...t,
                userPreference: {
                  ...t.userPreference,
                  isFavorite: data.isFavorite,
                  usageCount: t.userPreference?.usageCount ?? 0,
                },
              }
            : t
        )
      );

      // Refresh recommendations (failure is non-critical, don't show error)
      try {
        const recommendationsRes = await fetch('/api/templates/recommendations?limit=6');
        if (recommendationsRes.ok) {
          const recommendationsData = await recommendationsRes.json();
          setRecommendations(recommendationsData.recommendations);
        }
      } catch {
        // Silently ignore recommendation refresh failures
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle favorite');
    } finally {
      setTogglingFavorite(null);
    }
  }

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        template.name.toLowerCase().includes(searchLower) ||
        template.description?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && template.category !== categoryFilter) {
      return false;
    }

    // Subspecialty filter
    if (subspecialtyFilter !== 'all') {
      if (!template.isGeneric && !template.subspecialties.includes(subspecialtyFilter)) {
        return false;
      }
    }

    return true;
  });

  // Group templates by category
  const groupedTemplates = filteredTemplates.reduce(
    (acc, template) => {
      const category = template.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(template);
      return acc;
    },
    {} as Record<string, Template[]>
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Letter Templates</h1>
          <p className="text-muted-foreground">
            Browse templates and star your favorites for quick access.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Recommendations Section */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Recommended for You</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec) => (
              <Card
                key={rec.template.id}
                className="relative overflow-hidden transition-colors hover:bg-muted/50"
              >
                <div className="absolute right-2 top-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleFavorite(rec.template.id)}
                    disabled={togglingFavorite === rec.template.id}
                  >
                    {togglingFavorite === rec.template.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Star
                        className={cn(
                          'h-4 w-4',
                          rec.template.userPreference?.isFavorite
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground'
                        )}
                      />
                    )}
                  </Button>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 pr-8 text-base">
                    <FileText className="h-4 w-4 text-primary" />
                    {rec.template.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {rec.reasons.slice(0, 2).map((reason, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {reason.type === 'subspecialty_match' &&
                          SUBSPECIALTY_LABELS[reason.subspecialty ?? '']}
                        {reason.type === 'favorite' && 'Favorite'}
                        {reason.type === 'recently_used' && 'Recent'}
                        {reason.type === 'frequently_used' && `Used ${reason.usageCount}x`}
                        {reason.type === 'generic' && 'Generic'}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subspecialtyFilter} onValueChange={setSubspecialtyFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Subspecialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subspecialties</SelectItem>
              {Object.entries(SUBSPECIALTY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates by Category */}
      {Object.keys(groupedTemplates).length === 0 ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">
            {search || categoryFilter !== 'all' || subspecialtyFilter !== 'all'
              ? 'No templates match your filters.'
              : 'No templates available.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
            <div key={category} className="space-y-3">
              <h3 className="font-semibold text-muted-foreground">
                {CATEGORY_LABELS[category] ?? category}
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {categoryTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="relative transition-colors hover:bg-muted/50"
                  >
                    <div className="absolute right-2 top-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleFavorite(template.id)}
                        disabled={togglingFavorite === template.id}
                      >
                        {togglingFavorite === template.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Star
                            className={cn(
                              'h-4 w-4',
                              template.userPreference?.isFavorite
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            )}
                          />
                        )}
                      </Button>
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 pr-8 text-base">
                        <FileText className="h-4 w-4 text-primary" />
                        {template.name}
                      </CardTitle>
                      {template.description && (
                        <CardDescription className="line-clamp-2 text-sm">
                          {template.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {template.isGeneric && (
                          <Badge variant="outline" className="text-xs">
                            Generic
                          </Badge>
                        )}
                        {template.subspecialties.slice(0, 2).map((sub) => (
                          <Badge key={sub} variant="secondary" className="text-xs">
                            {SUBSPECIALTY_LABELS[sub] ?? sub}
                          </Badge>
                        ))}
                        {template.subspecialties.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.subspecialties.length - 2}
                          </Badge>
                        )}
                      </div>
                      {template.variants && template.variants.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ChevronRight className="h-3 w-3" />
                          {template.variants.length} variant
                          {template.variants.length > 1 ? 's' : ''} available
                        </div>
                      )}
                      {template.userPreference?.usageCount ? (
                        <p className="text-xs text-muted-foreground">
                          Used {template.userPreference.usageCount} time
                          {template.userPreference.usageCount > 1 ? 's' : ''}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link to specialties */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          Want better recommendations?{' '}
          <Link href="/settings/specialties" className="text-primary hover:underline">
            Update your specialty interests
          </Link>
        </p>
      </div>
    </div>
  );
}
