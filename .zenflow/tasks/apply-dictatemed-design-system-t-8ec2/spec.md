# Technical Specification: DictateMED Design System Implementation

## Difficulty Assessment: **Medium-Hard**

This is a visual/UX refactor affecting multiple core screens and components. While no business logic changes, it requires:
- Careful token system design that works across light/dark modes
- Updating ~20+ files without breaking functionality
- WCAG 2.1 AA compliance verification
- Consistent application across varied component patterns

---

## 1. Technical Context

### Stack
- **Framework**: Next.js 14.2 (App Router) + React 18.2 + TypeScript
- **Styling**: Tailwind CSS 3.4.1 with CSS custom properties
- **UI Library**: Custom components built on Radix UI primitives
- **Component Patterns**: CVA (class-variance-authority) for variants, `cn()` for class merging

### Current State
- Existing token system in `globals.css` using HSL CSS variables
- Tailwind config extends these tokens
- Components use semantic tokens (`bg-card`, `text-muted-foreground`, etc.)
- Clinical status colors already defined (`clinical-verified`, `clinical-warning`, etc.)

---

## 2. Design System Definition

Based on task requirements and brand references (Brightside, Tia, Rest Assured, SNP Therapeutics):

### 2.1 Color Palette

#### Light Mode (Primary)
| Token | HSL Value | Hex | Usage |
|-------|-----------|-----|-------|
| `--background` | `40 20% 98%` | `#FDFCFA` | Page background, warm white |
| `--background-subtle` | `40 15% 96%` | `#F8F7F4` | Subtle sections, alternating rows |
| `--foreground` | `220 15% 12%` | `#1A1D23` | Primary text, near-black |
| `--foreground-muted` | `220 10% 46%` | `#6B7280` | Secondary text |
| `--card` | `0 0% 100%` | `#FFFFFF` | Card backgrounds |
| `--card-foreground` | `220 15% 12%` | `#1A1D23` | Card text |
| `--primary` | `174 42% 40%` | `#3B9B8E` | Medical-grade teal accent |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on primary |
| `--secondary` | `40 15% 94%` | `#F3F1ED` | Secondary buttons, subtle UI |
| `--secondary-foreground` | `220 15% 20%` | `#2D3340` | Text on secondary |
| `--muted` | `40 12% 92%` | `#EFECEA` | Muted backgrounds |
| `--muted-foreground` | `220 10% 46%` | `#6B7280` | Muted text |
| `--accent` | `174 35% 95%` | `#EDF7F6` | Hover states, highlights |
| `--accent-foreground` | `174 42% 30%` | `#2D756A` | Text on accent |
| `--border` | `40 12% 88%` | `#E5E2DC` | Borders, dividers |
| `--input` | `40 12% 88%` | `#E5E2DC` | Input borders |
| `--ring` | `174 42% 40%` | `#3B9B8E` | Focus rings |
| `--destructive` | `0 72% 51%` | `#DC2626` | Errors, destructive actions |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Text on destructive |

#### Clinical Status Colors (Unchanged - Already Good)
| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--clinical-verified` | `142 76% 36%` | Verified values (green) |
| `--clinical-warning` | `45 93% 47%` | Warnings (amber) |
| `--clinical-critical` | `0 84% 60%` | Critical flags (red) |
| `--clinical-info` | `174 42% 40%` | Info (matches primary) |

#### Dark Mode
| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | `220 15% 10%` | `#161920` |
| `--background-subtle` | `220 15% 13%` | `#1E2128` |
| `--foreground` | `40 15% 95%` | `#F5F4F2` |
| `--foreground-muted` | `220 10% 60%` | `#8B929E` |
| `--card` | `220 15% 13%` | `#1E2128` |
| `--primary` | `174 45% 50%` | `#40B3A4` (slightly brighter) |
| `--border` | `220 15% 20%` | `#2D3340` |

### 2.2 Typography

#### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

#### Scale (8px base)
| Style | Size | Weight | Line Height | Letter Spacing |
|-------|------|--------|-------------|----------------|
| `heading-1` | 24px (1.5rem) | 600 | 1.33 | -0.02em |
| `heading-2` | 20px (1.25rem) | 600 | 1.4 | -0.01em |
| `heading-3` | 16px (1rem) | 600 | 1.5 | 0 |
| `body` | 15px (0.9375rem) | 400 | 1.6 | 0 |
| `body-sm` | 14px (0.875rem) | 400 | 1.5 | 0 |
| `caption` | 12px (0.75rem) | 500 | 1.5 | 0.01em |
| `label` | 13px (0.8125rem) | 500 | 1.4 | 0.01em |

### 2.3 Spacing (8px Scale)
```
--space-1: 4px   (0.25rem)
--space-2: 8px   (0.5rem)
--space-3: 12px  (0.75rem)
--space-4: 16px  (1rem)
--space-5: 20px  (1.25rem)
--space-6: 24px  (1.5rem)
--space-8: 32px  (2rem)
--space-10: 40px (2.5rem)
--space-12: 48px (3rem)
--space-16: 64px (4rem)
```

### 2.4 Border Radius
```
--radius-sm: 4px
--radius: 8px (default)
--radius-lg: 12px
--radius-xl: 16px
--radius-full: 9999px
```

### 2.5 Shadows (Subtle)
```
--shadow-sm: 0 1px 2px rgba(0,0,0,0.04)
--shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md: 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)
```

---

## 3. Implementation Approach

### 3.1 Design Token Layer

**New/Modified Files:**
1. `src/app/globals.css` - Update CSS custom properties
2. `tailwind.config.js` - Extend with new tokens and typography

**Strategy:**
- Replace existing HSL values with new calm palette
- Add typography utilities
- Add spacing scale utilities
- Maintain backward compatibility with existing token names

### 3.2 Component Updates

#### UI Primitives (Low Risk)
| Component | Changes |
|-----------|---------|
| `button.tsx` | Update variants to use new tokens, adjust sizing |
| `card.tsx` | Reduce shadow, update border styling |
| `badge.tsx` | Softer colors, consistent with clinical status |
| `input.tsx` | Larger hit areas (min 44px), updated focus states |
| `dialog.tsx` | Reduced shadows, consistent padding |

#### Layout Components (Medium Risk)
| Component | Changes |
|-----------|---------|
| `Sidebar.tsx` | Calmer colors, improved active states, better spacing |
| `Header.tsx` | Simplified, consistent with sidebar |
| `(dashboard)/layout.tsx` | Background color updates |

#### Screen-Level Updates (Medium Risk)
| Screen | Changes |
|--------|---------|
| `dashboard/page.tsx` | Card styling, typography, spacing |
| `record/page.tsx` | Section styling, form layout, status indicators |
| `letters/[id]/LetterReviewClient.tsx` | Panel styling, editor chrome, verification UI |

### 3.3 Accessibility Requirements

- **Color Contrast**: All text must meet WCAG 2.1 AA (4.5:1 for body, 3:1 for large text)
- **Hit Areas**: Minimum 44x44px for interactive elements
- **Focus States**: Visible focus rings using `--ring` token
- **Keyboard Navigation**: Maintain existing keyboard support
- **ARIA for Streaming**: Status announcements for recording/processing states

---

## 4. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `docs/DESIGN_NOTES.md` | Design system documentation |

### Modified Files

#### Core Styling (2 files)
| File | Changes |
|------|---------|
| `src/app/globals.css` | New color tokens, typography, spacing variables |
| `tailwind.config.js` | Extended theme with typography utilities, colors |

#### UI Components (6 files)
| File | Changes |
|------|---------|
| `src/components/ui/button.tsx` | Updated variants, sizes |
| `src/components/ui/card.tsx` | Reduced shadow, padding adjustments |
| `src/components/ui/badge.tsx` | Softer variants |
| `src/components/ui/input.tsx` | Larger hit areas, focus states |
| `src/components/ui/label.tsx` | Typography updates |
| `src/components/ui/dialog.tsx` | Reduced shadows, spacing |

#### Layout Components (3 files)
| File | Changes |
|------|---------|
| `src/components/layout/Sidebar.tsx` | Color scheme, spacing, active states |
| `src/components/layout/Header.tsx` | Simplified styling |
| `src/app/(dashboard)/layout.tsx` | Background color |

#### Dashboard Screen (1 file)
| File | Changes |
|------|---------|
| `src/app/(dashboard)/dashboard/page.tsx` | QuickActionCard, StatCard styling |

#### Record Screen (1 file)
| File | Changes |
|------|---------|
| `src/app/(dashboard)/record/page.tsx` | CollapsibleSection, status indicators |

#### Letter Review Screen (4 files)
| File | Changes |
|------|---------|
| `src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx` | Header, panels, editor chrome |
| `src/components/letters/VerificationPanel.tsx` | Card styling, value display |
| `src/components/letters/SourcePanel.tsx` | Panel styling |
| `src/components/letters/LetterEditor.tsx` | Editor chrome, typography |

**Total: ~18 files**

---

## 5. Verification Approach

### 5.1 Automated Testing
```bash
# Run existing test suite
npm run test

# Run linting
npm run lint

# Build to check for TypeScript errors
npm run build
```

### 5.2 Manual Verification Checklist

#### Contrast & Legibility
- [ ] Body text on background: ≥4.5:1 contrast
- [ ] Muted text on background: ≥4.5:1 contrast
- [ ] Primary button text: ≥4.5:1 contrast
- [ ] All text readable at 100% zoom

#### Keyboard Navigation
- [ ] Tab through dashboard cards
- [ ] Tab through record page sections
- [ ] Tab through letter review panels
- [ ] Focus rings visible on all interactive elements

#### Critical Actions
- [ ] Start recording flow works
- [ ] Letter editing works
- [ ] Letter approval flow works
- [ ] Navigation between screens works

#### Visual Consistency
- [ ] Sidebar matches design system
- [ ] Cards have consistent styling
- [ ] Typography hierarchy is clear
- [ ] Status colors are distinguishable

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing layouts | Medium | High | Test each screen after changes |
| Contrast failures | Low | Medium | Use contrast checker during implementation |
| Missing token updates | Medium | Low | Search for hardcoded colors after |
| Dark mode breakage | Medium | Medium | Test dark mode at each step |

---

## 7. Implementation Plan

Given the complexity, the implementation should be broken into incremental steps:

### Step 1: Design Token Foundation
- Update `globals.css` with new color palette
- Update `tailwind.config.js` with typography and spacing
- Verify existing components still render

### Step 2: UI Primitives
- Update Button, Card, Badge, Input, Dialog components
- Test in isolation

### Step 3: Navigation Shell
- Update Sidebar and Header
- Update dashboard layout
- Test navigation flows

### Step 4: Dashboard Screen
- Update QuickActionCard and StatCard
- Verify layout and interactions

### Step 5: Record Screen
- Update CollapsibleSection styling
- Update status indicators
- Test recording flow (visual only)

### Step 6: Letter Review Screen
- Update LetterReviewClient header and panels
- Update VerificationPanel styling
- Update SourcePanel styling
- Test editing and approval flows

### Step 7: Documentation & Cleanup
- Create DESIGN_NOTES.md
- Search for any hardcoded colors
- Run full test suite
- Manual verification checklist

---

## 8. Out of Scope

- Backend/API changes
- New features or functionality
- Component refactoring beyond styling
- Performance optimizations
- Mobile-specific layouts (existing responsive behavior preserved)
