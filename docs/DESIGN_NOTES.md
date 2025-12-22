# DictateMED Design System

A calm, clinical, minimal UI system for medical documentation software.

## Design Philosophy

The design system follows these core principles:

1. **Clinical Calm** - Warm whites and muted tones reduce visual fatigue during long documentation sessions
2. **Clear Hierarchy** - Typography scale creates obvious information structure
3. **Accessible First** - WCAG 2.1 AA compliant with 44px touch targets and visible focus states
4. **Minimal Chrome** - Let content breathe; reduce decorative elements

## Color Palette

Colors are defined as CSS custom properties in `src/app/globals.css` and mapped to Tailwind in `tailwind.config.js`.

### Core Colors

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | `40 20% 98%` | Warm white page background |
| `--background-subtle` | `40 15% 96%` | Slightly darker for content areas |
| `--foreground` | `220 15% 12%` | Near-black text, high contrast |
| `--primary` | `174 42% 40%` | Medical-grade teal accent |
| `--muted` | `220 10% 94%` | Disabled/placeholder backgrounds |
| `--border` | `220 13% 88%` | Default border color |

### Clinical Status Colors

These are semantic colors for medical status indicators:

| Token | Usage |
|-------|-------|
| `--clinical-verified` | Green - Verified/approved items |
| `--clinical-warning` | Amber - Needs attention |
| `--clinical-critical` | Red - Errors/critical items |
| `--clinical-info` | Blue - Informational states |

Use with Tailwind: `bg-clinical-verified`, `text-clinical-warning`, etc.

## Typography

The system uses a clear typographic hierarchy:

| Class | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-heading-1` | 24px | 600 | 1.33 | Page titles |
| `text-heading-2` | 20px | 600 | 1.4 | Section headings |
| `text-heading-3` | 16px | 600 | 1.5 | Card titles |
| `text-body` | 15px | 400 | 1.5 | Main content |
| `text-body-sm` | 14px | 400 | 1.5 | Secondary content |
| `text-label` | 13px | 500 | 1.4 | Form labels, UI labels |
| `text-caption` | 12px | 400 | 1.4 | Metadata, timestamps |

## Spacing

The system uses an 8px base scale defined as CSS custom properties:

| Token | Value | Tailwind |
|-------|-------|----------|
| `--space-1` | 4px | `space-1`, `p-space-1`, `gap-space-1` |
| `--space-2` | 8px | `space-2`, `p-space-2`, `gap-space-2` |
| `--space-3` | 12px | `space-3`, `p-space-3`, `gap-space-3` |
| `--space-4` | 16px | `space-4`, `p-space-4`, `gap-space-4` |
| `--space-6` | 24px | `space-6`, `p-space-6`, `gap-space-6` |
| `--space-8` | 32px | `space-8`, `p-space-8`, `gap-space-8` |

## Touch Targets

All interactive elements must have a minimum 44x44px touch area:

```tsx
// Button with touch target
<button className="min-h-touch min-w-touch">Click me</button>

// Icon button
<button className="h-11 w-11">
  <Icon className="h-5 w-5" />
</button>
```

## Shadows

Subtle, layered shadows:

| Class | Usage |
|-------|-------|
| `shadow-card` | Default card elevation |
| `shadow-focus` | Focus ring for primary elements |

## Borders

Use subtle, translucent borders:

```tsx
// Preferred
<div className="border border-border/60">

// Not recommended (too heavy)
<div className="border border-border">
```

## Component Patterns

### Cards

```tsx
<Card className="border-border/60 shadow-card">
  <CardHeader className="p-space-6">
    <CardTitle className="text-heading-2">Title</CardTitle>
    <CardDescription className="text-body-sm">Description</CardDescription>
  </CardHeader>
  <CardContent className="p-space-6 pt-0">
    {/* content */}
  </CardContent>
</Card>
```

### Buttons

Primary actions use the `bg-primary` color. For clinical actions:

```tsx
// Approve action
<Button className="bg-clinical-verified hover:bg-clinical-verified/90">
  Approve
</Button>

// Warning action
<Button variant="outline" className="text-clinical-warning border-clinical-warning">
  Needs Review
</Button>
```

### Status Badges

```tsx
// Verified status
<Badge className="bg-clinical-verified/15 text-clinical-verified">
  Verified
</Badge>

// Warning status
<Badge className="bg-clinical-warning/15 text-clinical-warning">
  Pending Review
</Badge>
```

### Form Inputs

All inputs have 44px height for touch accessibility:

```tsx
<Input className="h-11 min-h-touch" />
```

## Accessibility

### Focus States

All interactive elements have visible focus outlines:

```tsx
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

### ARIA Attributes

- Use `aria-current="page"` for active navigation items
- Use `role="status"` and `aria-live="polite"` for status indicators
- Use `aria-hidden="true"` for decorative icons
- Use `aria-label` for icon-only buttons

### Keyboard Navigation

- All interactive elements are focusable
- Custom interactive components support Enter/Space activation
- Skip links are provided for main content

## Dark Mode

The system supports dark mode via CSS custom properties. All color tokens have dark mode variants defined in `globals.css` under the `.dark` class.

## Adding New Screens

When adding new screens:

1. **Use semantic HTML** - `<header>`, `<main>`, `<section>`, `<nav>`
2. **Apply typography tokens** - Never use raw font sizes
3. **Use spacing tokens** - Prefer `p-space-4` over `p-4`
4. **Ensure touch targets** - 44px minimum for all interactive elements
5. **Add ARIA attributes** - Especially for dynamic content
6. **Use clinical colors** - For status indicators, not for decoration
7. **Test keyboard nav** - Tab through all interactive elements
8. **Verify contrast** - Use browser dev tools accessibility panel

## Files Reference

| File | Purpose |
|------|---------|
| `src/app/globals.css` | CSS custom properties for tokens |
| `tailwind.config.js` | Tailwind theme configuration |
| `src/components/ui/*.tsx` | Base UI components |
| `src/components/layout/*.tsx` | Shell and navigation |

## Known Limitations

1. **Partial Migration** - Some screens (settings, PWA, recording indicators) still use hardcoded Tailwind colors. These are outside the initial scope.

2. **Toast Component** - Uses shadcn/ui defaults; consider updating to use clinical colors.

3. **Error Pages** - Use default gray palette; could be updated for consistency.

4. **Third-party Components** - Some libraries may not respect design tokens.

## Future Considerations

- Add motion/animation tokens for consistent transitions
- Create component variants for different contexts (modal vs page)
- Add responsive typography scaling
- Create Storybook documentation for component library
# Design Notes: Per-Clinician Style Learning

This document captures the architectural decisions, trade-offs, and rationale behind the per-clinician, per-subspecialty style learning system.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Design Principles](#design-principles)
3. [Key Architecture Decisions](#key-architecture-decisions)
4. [Trade-offs & Alternatives Considered](#trade-offs--alternatives-considered)
5. [Known Limitations](#known-limitations)
6. [Future Considerations](#future-considerations)

---

## Problem Statement

### The Challenge

Clinicians have distinct writing styles that vary by subspecialty. A cardiologist who does both heart failure and electrophysiology work may:
- Use different terminology levels (specialist vs. referrer-friendly)
- Prefer different section arrangements
- Have distinct phrase preferences per subspecialty

The original global style profile blended all preferences together, producing suboptimal drafts for specialized consultations.

### Goals

1. **Learn per-subspecialty preferences** so drafts match the context
2. **Non-prescriptive learning** - clinician always in control
3. **Privacy-safe analytics** - aggregate insights without exposing PHI
4. **Cold-start solution** - new clinicians can seed with sample letters
5. **Graceful degradation** - works well even without profiles

---

## Design Principles

### 1. Clinician Control First

The system learns passively from edits but never forces style on clinicians:
- Learning strength slider (0-1) controls adaptation intensity
- Reset button returns to neutral defaults
- No mandatory seeding or configuration

### 2. Privacy by Design

- Style profiles contain **no PHI** - only structural preferences
- Analytics aggregation has **minimum thresholds** (5 clinicians)
- PHI stripping applied before any aggregation
- Audit logging for accountability

### 3. Progressive Enhancement

The feature gracefully degrades:
1. With subspecialty profile → full personalization
2. Without subspecialty profile → fall back to global profile
3. Without any profile → neutral generation (no conditioning)

### 4. Performance Over Accuracy

- Profile caching (5-minute TTL) for fast retrieval
- Async analysis (non-blocking on approval)
- Threshold-based analysis (not on every edit)

---

## Key Architecture Decisions

### Decision 1: Dedicated StyleProfile Table vs. JSON Field

**Chosen: Dedicated table with unique(userId, subspecialty) constraint**

**Rationale:**
- Enables efficient querying without JSON parsing
- Independent confidence/strength values per subspecialty
- Cleaner data model for complex nested preferences
- Better indexing for analytics queries

**Alternative considered:** Extending User.styleProfile JSON with nested subspecialty keys. Rejected due to complexity of merging and querying.

### Decision 2: Section-Level vs. Character-Level Diff

**Chosen: Section-level diff analysis**

**Rationale:**
- Medical letters have consistent section structure (History, Exam, Plan, etc.)
- Section-level changes are more meaningful for style learning
- Character-level diffs would capture noise (typos, minor rewordings)
- Enables section-specific preferences (verbose History, brief Plan)

**Implementation:**
```typescript
// Sections are detected by header patterns
const SECTION_PATTERNS = {
  history: /^(history|presenting complaint|hpi)/i,
  examination: /^(examination|physical exam|on exam)/i,
  // ...
};
```

### Decision 3: Async Analysis Pipeline

**Chosen: Fire-and-forget analysis triggered after edit threshold**

**Rationale:**
- Letter approval must be fast (<500ms for UX)
- Claude analysis takes 5-10 seconds
- Batch analysis is more cost-effective than per-edit
- Profile freshness isn't critical (used on next generation)

**Flow:**
```
Approval (sync) → Record Edit → Check Threshold → Queue Analysis (async)
                                                         ↓
                                                   Claude Call
                                                         ↓
                                                   Update Profile
```

### Decision 4: Weighted Profile Merging

**Chosen: Edit-count-weighted merge of new analysis with existing profile**

**Rationale:**
- Early profiles should be updated more aggressively
- Mature profiles should be more stable
- Recent patterns may reflect style evolution

**Formula:**
```typescript
const existingWeight = existingEdits / (existingEdits + newEdits);
const newWeight = 1 - existingWeight;
merged = existingWeight * existing + newWeight * new;
```

### Decision 5: Confidence-Gated Application

**Chosen: Only apply preferences with confidence ≥ 0.5**

**Rationale:**
- Low-confidence preferences may be noise
- Avoids over-fitting to small sample sizes
- Preserves clinical accuracy over style matching

**Thresholds:**
- 0.0-0.5: Not applied (too uncertain)
- 0.5-0.7: Applied cautiously
- 0.7-0.9: Applied confidently
- 0.9-1.0: Strong pattern, always applied

### Decision 6: Subspecialty Inference Chain

**Chosen: Explicit → Template → None (with fallback to global)**

**Rationale:**
- Templates already have subspecialty tags
- Explicit override allows flexibility
- Falling back to global preserves existing behavior

**Order:**
1. `input.subspecialty` (if provided in API call)
2. `template.subspecialties[0]` (if template selected)
3. `null` → triggers global profile fallback

### Decision 7: Seed Letters for Cold Start

**Chosen: Allow clinicians to paste/upload sample letters**

**Rationale:**
- New clinicians have no edit history
- Sample letters provide immediate signal
- One or two letters can bootstrap basic preferences

**Limitation:** Seed letters provide less signal than actual edits (no before/after comparison).

---

## Trade-offs & Alternatives Considered

### Trade-off: Real-time vs. Batch Analysis

| Approach | Pros | Cons |
|----------|------|------|
| Real-time (per edit) | Immediate learning | High latency, high cost |
| Batch (threshold) | Fast approval, cost-effective | Delayed learning |

**Decision:** Batch with threshold (5 edits initial, 10 subsequent)

### Trade-off: Profile Expiry

| Approach | Pros | Cons |
|----------|------|------|
| Time-based decay | Captures style evolution | Disrupts stable preferences |
| No expiry | Stable profiles | May become stale |

**Decision:** No automatic expiry. UI shows "last updated" for transparency. Manual reset available.

### Trade-off: Analytics Granularity

| Approach | Pros | Cons |
|----------|------|------|
| Per-clinician analytics | Detailed insights | Re-identification risk |
| Aggregate-only (5+ clinicians) | Privacy-safe | Less granular insights |

**Decision:** Aggregate-only with minimum thresholds. Product insights don't require per-clinician data.

### Alternative: Template-Level Profiles

**Considered:** Profiles keyed by (clinician, template) instead of (clinician, subspecialty).

**Rejected because:**
- Templates are more granular than needed
- Subspecialty captures the meaningful style variation
- Would require more edits to build per-template profiles

### Alternative: ML-Based Style Detection

**Considered:** Train a fine-tuned model for style classification.

**Rejected because:**
- Requires significant training data
- Claude's zero-shot analysis is sufficient
- Lower maintenance burden

---

## Known Limitations

### 1. Cold Start Problem

New clinicians without edit history or seed letters get no personalization. This is by design (non-prescriptive) but affects initial experience.

**Mitigation:** Seed letter feature, clear UI prompting.

### 2. Cross-Subspecialty Blending

Clinicians who work across many subspecialties may have fragmented profiles with low confidence in each.

**Mitigation:** Global profile fallback, UI shows which profiles are "strong" vs "developing".

### 3. Language Limitations

Style learning optimized for English medical terminology. Other languages may have:
- Different section detection patterns
- Different phrase structures

**Mitigation:** Section patterns are extensible; add language-specific patterns as needed.

### 4. Vocabulary Map Conflicts

If a clinician prefers different vocabulary in different subspecialties, the vocabulary map may contain conflicting entries.

**Current behavior:** Per-subspecialty profiles are independent, so this is handled naturally.

### 5. Letter Type Variation

Style may vary by letter type (New Patient vs. Follow-up) within the same subspecialty.

**Not addressed in current design.** Could be extended with (clinician, subspecialty, letterType) key if needed.

---

## Future Considerations

### 1. Collaborative Profiles

Share style insights within a practice:
- "This practice prefers..." defaults
- Junior clinicians inherit senior preferences (optional)

**Implementation sketch:**
```prisma
model PracticeStyleDefaults {
  practiceId   String
  subspecialty Subspecialty
  preferences  Json
  @@unique([practiceId, subspecialty])
}
```

### 2. A/B Testing Framework

Measure whether style-conditioned letters require fewer edits:
- Track edit distance per letter
- Compare conditioned vs. unconditioned cohorts
- Adjust thresholds based on results

### 3. Multi-Language Support

Extend section detection for non-English letters:
- Language detection on letter content
- Language-specific pattern sets
- Vocabulary maps per language

### 4. Incremental Analysis

Analyze only new edits since last analysis instead of reprocessing all:
- Reduces compute cost
- Faster analysis cycles
- Requires careful merge logic

### 5. Style Embedding Approach

Represent style as a vector embedding:
- Enable style similarity search
- "Find clinicians with similar style"
- Style transfer between subspecialties

### 6. Temporal Style Evolution

Track how style changes over time:
- Detect drift from established patterns
- Surface "style has changed significantly" alerts
- Time-weighted confidence decay

---

## Appendix: Schema Evolution

### v1.0 (Initial Release)

- StyleProfile table with full schema
- StyleSeedLetter table
- StyleAnalyticsAggregate table
- StyleEdit.subspecialty field
- Letter.subspecialty field

### Planned: v1.1

- Add `styleSource` to Letter for tracking which profile was used
- Add `analysisVersion` to StyleProfile for debugging

### Planned: v2.0

- Consider template-level overrides
- Consider practice-level defaults
- Consider multi-language section patterns

---

*Last updated: 2025-12-22*
*Authors: DictateMED Engineering*
