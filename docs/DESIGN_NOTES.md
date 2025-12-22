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
| `text-heading-1` | 24px | 600 | 1.2 | Page titles |
| `text-heading-2` | 20px | 600 | 1.3 | Section headings |
| `text-heading-3` | 16px | 600 | 1.4 | Card titles |
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
