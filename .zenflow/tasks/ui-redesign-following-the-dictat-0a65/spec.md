# Technical Specification: DictateMED UI Redesign

## Difficulty Assessment: **Medium-Hard**

This is a comprehensive visual redesign affecting:
- Foundation layer (fonts, colors, shadows, animations)
- Core UI components (buttons, cards, inputs)
- All major pages (dashboard, record, letters, settings)
- Navigation components (sidebar, header)

Risk factors:
- Many files to modify (~20+) without breaking functionality
- Dark mode support must be maintained
- WCAG accessibility compliance must be preserved
- Existing component patterns must be respected

---

## 1. Technical Context

### Stack
- **Framework**: Next.js 14.2 (App Router) + React 18.2 + TypeScript 5.3.3
- **Styling**: Tailwind CSS 3.4.1 with CSS custom properties (HSL)
- **UI Library**: Custom components built on Radix UI primitives (shadcn/ui pattern)
- **Component Patterns**: CVA (class-variance-authority) for variants, `cn()` for class merging
- **Theme**: next-themes for dark mode support

### Current State Analysis
- **Font**: Inter (Google Fonts) - **needs to change to Plus Jakarta Sans**
- **Colors**: Already using teal primary (174 42% 40%) - close to target but needs adjustment
- **Border Radius**: Using 8px base (--radius) - **needs to change to 12px (rounded-xl)**
- **Shadows**: Subtle shadows already in place - needs enhancement with lift effects
- **Typography**: Custom scale exists - needs minor updates
- **Animations**: Basic animations exist - needs motion/transitions enhancement

### Gap Analysis (Current vs Target)

| Aspect | Current | Target | Change Required |
|--------|---------|--------|-----------------|
| Font | Inter | Plus Jakarta Sans | Font swap in layout.tsx |
| Primary Color | teal-500 (174 42% 40%) | teal-500 (#14b8a6) | Minor HSL adjustment |
| Border Radius | rounded-md (8px) | rounded-xl (12px) | Update components |
| Buttons | Basic variants | Enhanced with hover lift | Update button.tsx |
| Cards | Simple borders | Hover lift, shadow-md | Update card.tsx |
| Dashboard | 3 equal cards | Hero card + secondary | Full redesign |
| Shadows | Minimal | Soft/medium/elevated | Add to tailwind config |

---

## 2. Design System Updates

### 2.1 Font Changes

**File: `src/app/layout.tsx`**
```tsx
// Replace Inter with Plus Jakarta Sans
import { Plus_Jakarta_Sans } from 'next/font/google'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700']
})
```

### 2.2 Color System

**File: `tailwind.config.js` - Add/update colors**

The current HSL-based system works well. Primary adjustments needed:

| Token | Current HSL | Target Hex | New HSL |
|-------|-------------|------------|---------|
| primary-500 | 174 42% 40% (#3B9B8E) | #14b8a6 | 174 84% 40% |
| success | 142 76% 36% | #10b981 | 160 84% 39% |
| warning | 45 93% 47% | #f59e0b | 38 92% 50% |
| danger | 0 72% 51% | #ef4444 | 0 84% 60% |

New semantic colors to add:
```js
colors: {
  teal: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
  },
  emerald: {
    50: '#ecfdf5',
    500: '#10b981',
    600: '#059669',
  },
  rose: {
    50: '#fef2f2',
    500: '#ef4444',
    600: '#dc2626',
  },
}
```

### 2.3 Shadow System

**File: `tailwind.config.js` - Add new shadows**
```js
boxShadow: {
  'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 12px -4px rgba(0, 0, 0, 0.08)',
  'medium': '0 4px 12px -4px rgba(0, 0, 0, 0.08), 0 8px 24px -8px rgba(0, 0, 0, 0.1)',
  'elevated': '0 8px 24px -8px rgba(0, 0, 0, 0.1), 0 16px 48px -16px rgba(0, 0, 0, 0.12)',
}
```

### 2.4 Motion & Transitions

**File: `src/app/globals.css` - Add utilities**
```css
/* Hover lift effect */
.transition-lift {
  @apply transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md;
}

/* Scale effect */
.transition-scale {
  @apply transition-transform duration-200 hover:scale-[1.02];
}

/* Page fade in */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out;
}
```

---

## 3. Component Updates

### 3.1 Button Component (`src/components/ui/button.tsx`)

**Changes:**
- Update default border-radius to `rounded-xl`
- Add `shadow-sm` and `hover:shadow-md` for primary
- Ensure 200ms transition on all states
- Update destructive to use rose colors

**Current vs Target:**
```tsx
// Current
'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'

// Target
'bg-teal-500 hover:bg-teal-600 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200'
```

### 3.2 Card Component (`src/components/ui/card.tsx`)

**Changes:**
- Update border-radius to `rounded-xl`
- Add hover states for interactive cards
- Enhance shadow on hover

**Add interactive card variant:**
```tsx
// Interactive card (clickable)
'bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200'
```

### 3.3 Input Component (`src/components/ui/input.tsx`)

**Changes:**
- Update to `rounded-xl`
- Add `bg-slate-50` background
- Update focus ring to teal

**Target:**
```tsx
'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200'
```

---

## 4. Page-by-Page Changes

### 4.1 Dashboard Page (`src/app/(dashboard)/dashboard/page.tsx`)

**Current Structure:**
- Welcome header with generic greeting
- 3 equal QuickActionCard components
- 4 StatCard components with placeholder values

**Target Structure:**
1. **Time-aware greeting**: "Good morning/afternoon/evening, {name}"
2. **Hero "Start Recording" card**: Large teal gradient, prominent CTA
3. **Secondary action cards**: "Draft Letters" and "All Letters" (smaller, white)
4. **"Time Saved" stat**: New metric showing hours saved this month
5. **Recent Activity section**: List of pending/approved letters with status badges
6. **Improved empty state**: Encouraging copy with illustration

**Key Changes:**
- Add `getGreeting()` function for time-aware greeting
- Create new `HeroActionCard` component with teal gradient
- Restructure grid layout (hero full-width, secondary cards smaller)
- Add `RecentActivity` component with letter status badges
- Add `TimeSavedStat` component

### 4.2 Record Page (`src/app/(dashboard)/record/page.tsx`)

**Current Structure:**
- Header with network status
- Collapsible sections (Context, Materials, Uploads)
- Recording section with mode selector
- Tip footer

**Target Changes:**
1. **Collapsible sections**: Add completion indicator styling
2. **Waveform visualizer**: Add visual feedback during recording (new component)
3. **Recording button states**:
   - Ready: teal background
   - Recording: rose/red with pulse animation
   - Disabled: grey
4. **Letter type selector**: Convert to card-style with icons
5. **Mode selector**: Convert to pill-style toggle (Ambient/Dictation/Upload)
6. **File upload dropzone**: Enhanced styling with dashed border, icon

**Components to modify:**
- `CollapsibleSection` - enhance styling
- `RecordingSection` - add waveform, update button colors
- Create `WaveformVisualizer` component
- Update mode selector styling

### 4.3 Letters Page (`src/app/(dashboard)/letters/page.tsx`)

**Current Structure:**
- Header with view mode toggle
- 3 stat cards
- Filter section
- Letter list/grid
- Pagination

**Target Changes:**
1. **Stat cards**: Match new design system (rounded-xl, shadows)
2. **Status badges**:
   - Pending: amber background (bg-amber-50 text-amber-600)
   - Approved: emerald background (bg-emerald-50 text-emerald-600)
3. **Hover states**: Add lift effect to letter rows
4. **Empty state**: Encouraging illustration and copy
5. **Filter bar**: Updated styling with rounded-xl inputs

**Components to modify:**
- StatCard styling
- Status badge colors in `LetterList` and `LetterCardList`
- Add hover states to list items

### 4.4 Settings Pages

**Main Settings (`src/app/(dashboard)/settings/page.tsx`):**
- Update card hover states to use lift effect
- Consistent icon treatment with teal accent
- rounded-xl on all cards

**Sub-pages (profile, practice, style, etc.):**
- Update all form inputs to new style
- Add "Danger Zone" card with rose border for destructive actions
- Consistent hover states on all interactive elements

### 4.5 Navigation (`src/components/layout/Sidebar.tsx`)

**Current:**
- Primary/10 background for active state
- Basic hover with accent background

**Target:**
- Active: `bg-teal-50 text-teal-700 border-l-2 border-teal-500`
- Hover: Subtle lift with accent background
- Logo area: Clean, professional

---

## 5. Files to Modify (Priority Order)

### Phase 1: Foundation (4 files)
| File | Changes |
|------|---------|
| `tailwind.config.js` | Colors, shadows, radius, fonts |
| `src/app/layout.tsx` | Plus Jakarta Sans font |
| `src/app/globals.css` | Animations, transitions, utilities |
| `postcss.config.js` | No changes needed |

### Phase 2: Core Components (4 files)
| File | Changes |
|------|---------|
| `src/components/ui/button.tsx` | Variants, radius, transitions |
| `src/components/ui/card.tsx` | Radius, shadows, interactive variant |
| `src/components/ui/input.tsx` | Background, radius, focus states |
| `src/components/ui/badge.tsx` | Status color variants |

### Phase 3: Layout Components (3 files)
| File | Changes |
|------|---------|
| `src/components/layout/Sidebar.tsx` | Active state, hover, logo |
| `src/components/layout/Header.tsx` | Consistent styling |
| `src/app/(dashboard)/layout.tsx` | Background color if needed |

### Phase 4: Dashboard (1 file + new components)
| File | Changes |
|------|---------|
| `src/app/(dashboard)/dashboard/page.tsx` | Full redesign with hero card, greeting, activity |

### Phase 5: Record Page (2+ files)
| File | Changes |
|------|---------|
| `src/app/(dashboard)/record/page.tsx` | Collapsible styling, button colors |
| `src/components/recording/RecordingSection.tsx` | Waveform, button states |
| New: `WaveformVisualizer.tsx` | Recording visual feedback |

### Phase 6: Letters Page (3 files)
| File | Changes |
|------|---------|
| `src/app/(dashboard)/letters/page.tsx` | Stat cards, empty state |
| `src/components/letters/LetterList.tsx` | Hover states, badges |
| `src/components/letters/LetterCard.tsx` | Status badge colors |

### Phase 7: Settings Pages (5+ files)
| File | Changes |
|------|---------|
| `src/app/(dashboard)/settings/page.tsx` | Card hover, icons |
| `src/app/(dashboard)/settings/profile/page.tsx` | Form inputs |
| `src/app/(dashboard)/settings/practice/page.tsx` | Form inputs, danger zone |
| Other settings pages | Consistent styling |

**Total Files: ~18-22**

---

## 6. Verification Approach

### 6.1 Automated Testing
```bash
# TypeScript compilation
npm run build

# Linting
npm run lint

# Unit tests
npm run test
```

### 6.2 Visual Verification Checklist

**Typography:**
- [ ] Plus Jakarta Sans loading correctly
- [ ] Heading hierarchy clear (H1 > H2 > H3)
- [ ] Body text readable (15px)

**Colors:**
- [ ] Teal primary consistent across buttons
- [ ] Amber for pending/warning states
- [ ] Emerald for success/approved states
- [ ] Rose for destructive/danger

**Components:**
- [ ] All buttons use rounded-xl
- [ ] All cards use rounded-xl with subtle shadow
- [ ] Inputs have slate-50 background
- [ ] Focus rings visible and teal

**Motion:**
- [ ] Hover lift effect on interactive cards
- [ ] 200ms transitions on all interactive elements
- [ ] Recording pulse animation working

**Pages:**
- [ ] Dashboard: Hero card prominent, time-aware greeting
- [ ] Record: Collapsibles work, button states correct
- [ ] Letters: Status badges colored correctly
- [ ] Settings: Hover states on all cards

**Accessibility:**
- [ ] Contrast ratios meet WCAG AA (4.5:1 minimum)
- [ ] Focus visible states on all interactive elements
- [ ] 44px minimum touch targets maintained
- [ ] Dark mode works correctly

---

## 7. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking dark mode | Test each component in dark mode after changes |
| CSS specificity conflicts | Use Tailwind @apply for utilities, avoid !important |
| Font loading issues | Add fallback font stack, test on slow connections |
| Missing hover states | Create checklist of all interactive elements |
| Inconsistent radius | Global find/replace for rounded-* classes |

---

## 8. Implementation Plan

### Step 1: Foundation Layer
- Update tailwind.config.js with new design tokens
- Swap font to Plus Jakarta Sans in layout.tsx
- Add animation utilities to globals.css
- **Verification**: Build passes, no TypeScript errors

### Step 2: Core UI Components
- Update button.tsx with new variants and styling
- Update card.tsx with hover effects
- Update input.tsx with new background and focus
- Update badge.tsx with status color variants
- **Verification**: Storybook/visual inspection of all variants

### Step 3: Navigation Shell
- Update Sidebar.tsx with teal active state
- Update Header.tsx for consistency
- **Verification**: Navigation works, active states visible

### Step 4: Dashboard Redesign
- Implement time-aware greeting
- Create hero action card component
- Add recent activity section
- Add time saved stat
- **Verification**: Dashboard displays correctly, cards clickable

### Step 5: Record Page Updates
- Update collapsible section styling
- Update recording button states
- Add waveform visualizer (if time permits)
- **Verification**: Recording flow works end-to-end

### Step 6: Letters Page Updates
- Update stat card styling
- Update status badge colors
- Add hover states to letter rows
- **Verification**: Letters display correctly, filters work

### Step 7: Settings Pages
- Update all settings cards
- Update form inputs throughout
- Add danger zone styling
- **Verification**: All settings pages consistent

### Step 8: Final Testing & Documentation
- Run full test suite
- Manual testing of all pages
- Dark mode verification
- Accessibility audit
- Create implementation report
- **Verification**: All tests pass, WCAG compliance

---

## 9. Out of Scope

- Backend/API changes
- New features beyond UI redesign
- Mobile-specific layouts (responsive preserved)
- Performance optimizations
- Component refactoring beyond styling
- Authentication/authorization changes
