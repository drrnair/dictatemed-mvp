# Technical Specification: Polish Clinical Literature Chat UI

## Task Difficulty: **Hard**

This task involves significant UI/UX overhaul across 17 source files with:
- Custom typography system integration
- Custom color palette implementation
- Animation system with custom easing curves
- Accessibility enhancements (keyboard navigation, ARIA)
- Multiple layout modes (side panel, popup, drawer)
- Microinteractions and polish details

---

## Technical Context

### Stack
- **Framework:** Next.js 14.2 with App Router
- **Language:** TypeScript 5.3
- **Styling:** Tailwind CSS 3.4 with CSS variables
- **Animations:** Framer Motion 11.18
- **Icons:** Lucide React 0.330
- **State:** Zustand 4.5
- **UI Components:** Radix UI primitives
- **Keyboard Shortcuts:** react-hotkeys-hook 4.6 (already installed)

### Existing Architecture

The Clinical Literature Chat feature has:

1. **Main wrappers:**
   - `ClinicalAssistantPanel.tsx` - Primary orchestrator, manages layouts
   - `LiteratureChatPanel.tsx` - Alternative chat implementation (legacy, kept for reference but `ClinicalAssistantPanel` is the active component)

2. **Three layouts:**
   - `SidePanelLayout.tsx` - Side panel (desktop default)
   - `PopupLayout.tsx` - Centered modal (Cmd+K)
   - `DrawerLayout.tsx` - Bottom sheet (mobile/tablet)

3. **Search components:**
   - `LiteratureSearchInput.tsx` - Search input with suggestions
   - `LiteratureSearchResults.tsx` - Results display

4. **Card components:**
   - `CitationCard.tsx` - Individual citation display
   - `ConfidenceBadge.tsx` - Confidence level indicator
   - `LiteratureSourceBadge.tsx` - Source filter badges

5. **Toolbar:**
   - `LiteratureToolbarButton.tsx` - Panel toggle button
   - `LayoutToggle.tsx` - Layout mode switcher

6. **State:** `literature.store.ts` - Zustand store with persistence

7. **Domain types:** `domains/literature/types.ts`

### Relationship: ClinicalAssistantPanel vs LiteratureChatPanel

- **ClinicalAssistantPanel** is the active, production component used in `LetterReviewClient.tsx`
- **LiteratureChatPanel** is an alternative implementation with inline panel logic
- Both share the same store and types
- This task focuses on polishing **ClinicalAssistantPanel** and its layout components
- `LiteratureChatPanel` may be deprecated in the future but is not modified in this task

### Current State Analysis

**Typography:** Uses system defaults via `--font-sans` CSS variable. Charter, Inter, and IBM Plex Mono font families now added.

**Colors:**
- Existing semantic colors: `clinical.verified`, `clinical.warning`, `clinical.critical`, `clinical.info` (CSS variable-based)
- New clinical palette: `clinical-blue`, `verified`, `caution`, `critical`, `clinical-gray` (direct hex values)

**Animations:** Basic spring animations enhanced with custom easing keyframes (`citation-flash`, `source-pulse`, `slide-in-right`, `cascade-in`)

**Spacing:** Standard Tailwind spacing with 8px-base CSS variables

**Accessibility:** Basic ARIA labels, keyboard shortcuts via react-hotkeys-hook

---

## Color Naming Clarification

The task description uses `clinical` as the primary blue scale name, but to avoid conflict with the existing `clinical` semantic tokens (which use CSS variables for theme awareness), we use:

| Task Description | Implementation | Purpose |
|-----------------|----------------|---------|
| `clinical.500` | `clinical-blue-500` | Primary blue actions |
| `verified.500` | `verified-500` | Success/high confidence |
| `caution.500` | `caution-500` | Warning/medium confidence |
| `critical.500` | `critical-500` | Error/low confidence |
| (gray scale) | `clinical-gray-500` | Refined neutral gray |

The existing `clinical.verified`, `clinical.warning`, etc. remain for backward compatibility with existing app components.

---

## Dark Mode Clarification

**Task Aesthetic:** Light mode optimized, professional medical interface

**Implementation Approach:** The app must continue to function correctly in dark mode for users who prefer it, but this task does **not** optimize the dark mode experience. The new clinical tokens (`clinical-blue`, `verified`, `caution`, `critical`, `clinical-gray`) use direct hex values that work in both modes. Dark mode will receive basic functional support but is not the design focus.

---

## Font Configuration

### Fonts Used

| Family | Tailwind Class | Purpose | Source |
|--------|---------------|---------|--------|
| Charter | `font-letter-serif` | Letter content | System (macOS) / Georgia fallback |
| Inter | `font-ui-sans` | UI elements | Google Fonts via Next.js |
| IBM Plex Mono | `font-clinical-mono` | Clinical data (dosing) | Google Fonts via Next.js |

### CSS Variables Required

The `ui-sans` and `clinical-mono` families reference CSS variables that must be defined in `layout.tsx`:

```typescript
import { Inter, IBM_Plex_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
});
```

Note: The task description mentions "Inter Tight" but we use standard **Inter** as it's more widely supported by Next.js and the difference is minimal for UI purposes.

---

## Implementation Approach

### Design System Additions (Already Applied)

The following have already been added to `tailwind.config.js`:

1. **Color Scales:**
   - `clinical-blue` (50-950) - Primary clinical actions
   - `verified` (50-900) - Success states
   - `caution` (50-900) - Warning states
   - `critical` (50-900) - Error states
   - `clinical-gray` (50-950) - Refined neutral gray

2. **Font Families:**
   - `letter-serif` - Charter with serif fallbacks
   - `ui-sans` - Inter with system fallbacks
   - `clinical-mono` - IBM Plex Mono with monospace fallbacks

3. **Animations:**
   - `citation-flash` - Green gradient sweep for citation insertion
   - `source-pulse` - Pulse for connected sources
   - `slide-in-right` - Panel content entrance
   - `cascade-in` - Staggered card entrance
   - `spin-slow` - Loading spinner

The following have already been added to `globals.css`:

1. **Utility Classes:**
   - `.clinical-panel-enter` / `.clinical-content-enter` - Panel animations
   - `.clinical-search-input` - Shadow progression on focus
   - `.clinical-source-card` - Card styling with source accents
   - `.clinical-badge-*` - Confidence badge variants
   - `.clinical-spinner` - Loading spinner
   - `.clinical-focus-ring` - Focus indicator
   - `.kbd-badge` - Keyboard shortcut badge
   - `.cascade-delay-*` - Animation stagger delays

---

## Source Code Changes

### Configuration Files (Done)

- ✅ `tailwind.config.js` - Clinical color scales, fonts, animations added
- ✅ `src/app/globals.css` - Utility classes and keyframes added
- ✅ `src/app/layout.tsx` - Google Fonts (Inter, IBM Plex Mono) with CSS variables

### Animation Utilities (Done)

- ✅ `src/styles/clinical-animations.ts` - Framer Motion variants and easing constants

### Layout Components (Done)

- ✅ `src/components/literature/layouts/SidePanelLayout.tsx` - Custom easing, 42% width, staggered content
- ✅ `src/components/literature/layouts/PopupLayout.tsx` - Custom easing, refined backdrop
- ✅ `src/components/literature/layouts/DrawerLayout.tsx` - Custom drag easing, polished handle

### Component Files (Done)

- ✅ `src/components/literature/LiteratureSearchInput.tsx` - Shadow progression, animated keyboard badge, clinical focus ring
- ✅ `src/components/literature/LiteratureSearchResults.tsx` - Clinical styling, dosing box, warning box
- ✅ `src/components/literature/CitationCard.tsx` - Source-specific accents, icon badges, hover states
- ✅ `src/components/literature/ConfidenceBadge.tsx` - Icons, clinical labels ("High Confidence", "Review Recommended", "Verify Manually")
- ✅ `src/components/literature/LiteratureSourceBadge.tsx` - Source-specific colors (orange/blue/green), pulse animation
- ✅ `src/components/literature/LiteratureToolbarButton.tsx` - Clinical blue accent, keyboard shortcut tooltip (⌘K)
- ✅ `src/components/literature/LayoutToggle.tsx` - Clinical styling with animated indicator
- ✅ `src/components/literature/ClinicalAssistantPanel.tsx` - Clinical header, staggered animations, integrated loading/empty states

### New Files (Done)

- ✅ `src/components/literature/ClinicalLoadingState.tsx` - Progressive 4-stage indicator (Library → PubMed → UpToDate → Synthesis)
- ✅ `src/components/literature/ClinicalEmptyState.tsx` - 3 variants with custom SVG illustrations, quick tips

---

## File Count Summary

| Category | Count | Status |
|----------|-------|--------|
| Configuration files | 3 | ✅ Done |
| Animation utilities | 1 | ✅ Done |
| Layout components | 3 | ✅ Done |
| Component modifications | 8 | ✅ Done |
| New components | 2 | ✅ Done |
| **Total** | **17** | **17 done, 0 remaining**

---

## Data Model / API Changes

**None required.** This is purely a frontend visual polish task.

---

## Verification Approach

### Automated Testing
```bash
# Run existing tests to ensure no regressions
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Manual Verification Checklist

*All items verified during Final Testing & Verification step.*

#### Animation Utilities
- [x] `src/styles/clinical-animations.ts` exists and exports correctly
- [x] Custom easings are properly typed
- [x] Framer Motion variants work with AnimatePresence

#### Typography
- [x] Charter font renders for letter content (macOS native, Georgia fallback)
- [x] Inter font renders for UI elements
- [x] IBM Plex Mono renders for clinical data
- [x] Fallback fonts work when custom fonts fail to load

#### Colors
- [x] `clinical-blue-600` used for primary actions
- [x] `verified-*` used for success states
- [x] `caution-*` used for warnings
- [x] `critical-*` used for errors
- [x] `clinical-gray-*` used for neutral elements
- [x] Existing `clinical.verified` etc. tokens still work

#### Animations
- [x] Panel opens with custom easing (smooth deceleration)
- [x] Content staggers in after panel (180ms delay)
- [x] Cards cascade with 80ms stagger each
- [x] Loading spinner rotates smoothly
- [x] Citation flash on insert (green gradient)

#### Accessibility
- [x] Keyboard shortcuts work (Cmd+K, Escape)
- [x] Tab navigation works through all interactive elements
- [x] Focus indicators visible (clinical blue ring)
- [x] Screen reader announces search results (aria-live)

#### Responsiveness
- [x] Side panel works at desktop sizes
- [x] Popup works at all sizes
- [x] Drawer works on tablet/mobile

#### Dark Mode (Functional Only)
- [x] All components render correctly in dark mode
- [x] Text remains readable
- [x] No broken contrast

---

## Risk Considerations

1. **Font Loading Performance:** Web fonts can delay first paint
   - Mitigation: Use `font-display: swap` via Next.js font config

2. **Animation Performance:** Complex animations may jank
   - Mitigation: Use `will-change` sparingly, prefer transform/opacity

3. **Accessibility Regression:** Visual changes may break a11y
   - Mitigation: Test with keyboard-only navigation

4. **Color Token Conflict:** New tokens might clash with existing
   - Mitigation: Use distinct names (`clinical-blue` vs `clinical`)

---

## Dependencies

All required dependencies are already installed:
- `framer-motion` 11.18.2 ✅
- `lucide-react` 0.330.0 ✅
- `react-hotkeys-hook` 4.6.1 ✅

Verified in `package.json` lines 40, 68, 65.

No new dependencies needed.
