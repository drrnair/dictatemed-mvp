# Technical Specification: Polish Clinical Literature Chat UI

## Task Difficulty: **Hard**

This task involves significant UI/UX overhaul across 10+ components with:
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
1. **Main wrapper:** `ClinicalAssistantPanel.tsx` - orchestrates layouts
2. **Three layouts:** `SidePanelLayout.tsx`, `PopupLayout.tsx`, `DrawerLayout.tsx`
3. **Search components:** `LiteratureSearchInput.tsx`, `LiteratureSearchResults.tsx`
4. **Card components:** `CitationCard.tsx`, `ConfidenceBadge.tsx`, `LiteratureSourceBadge.tsx`
5. **Toolbar:** `LiteratureToolbarButton.tsx`, `LayoutToggle.tsx`
6. **State:** `literature.store.ts` - Zustand store with persistence
7. **Domain types:** `domains/literature/types.ts`

### Current State Analysis
**Typography:** Uses system defaults via `--font-sans` CSS variable
**Colors:** Uses generic semantic colors (`primary`, `secondary`, `muted`)
**Animations:** Basic spring animations, no custom easing
**Spacing:** Standard Tailwind spacing, not medical-optimized
**Accessibility:** Basic ARIA labels, no keyboard shortcuts for panel

---

## Implementation Approach

### Design System Additions

Rather than replacing the existing design system, we'll **extend** it with clinical-specific tokens:

1. **Typography:** Add 3 new font families to Tailwind config
2. **Colors:** Add `clinical` color scale with blue/green/amber/red variants
3. **Animations:** Add custom easing curves and animation keyframes
4. **Spacing:** Use existing 8px-base spacing more consistently

### Component Updates

Each component will be updated in-place with:
- New typography classes
- New color tokens
- Enhanced animations
- Improved accessibility

---

## Source Code Changes

### Configuration Files

#### 1. `tailwind.config.js` (modify)
Add:
- Custom font families: `letter-serif`, `ui-sans`, `clinical-mono`
- Clinical color scales: `clinical`, `verified`, `caution`, `critical`
- Custom animation keyframes: `citation-flash`, `source-pulse`
- Custom easing variables

#### 2. `src/app/globals.css` (modify)
Add:
- Font-face declarations for Charter fallbacks
- CSS custom properties for animation easings
- `@keyframes citation-flash` for insertion feedback
- Focus and hover utility classes

#### 3. `src/app/layout.tsx` (modify)
- Add Google Fonts: Inter Tight, IBM Plex Mono

### Component Files

#### 4. `src/components/literature/ClinicalAssistantPanel.tsx` (modify)
- Update header with new typography and icon badge
- Add staggered content animation
- Improve loading state with progressive indicator
- Add empty state illustration
- Polish usage indicator

#### 5. `src/components/literature/layouts/SidePanelLayout.tsx` (modify)
- Custom easing for slide animation
- Staggered content fade-in (180ms delay)
- Subtle inner shadow for depth
- 42% width instead of fixed px

#### 6. `src/components/literature/layouts/PopupLayout.tsx` (modify)
- Custom easing curves
- Backdrop blur refinement
- Keyboard hint styling

#### 7. `src/components/literature/layouts/DrawerLayout.tsx` (modify)
- Custom drag easing
- Rounded handle styling
- Snap point indicators

#### 8. `src/components/literature/LiteratureSearchInput.tsx` (modify)
- Clinical-grade styling with larger padding
- Animated keyboard shortcut badge
- Focus ring with clinical blue
- Shadow progression on hover/focus
- Icon color transition on focus

#### 9. `src/components/literature/LiteratureSearchResults.tsx` (modify)
- Section headers with icons
- Dosing box with clinical mono font
- Warning box with border emphasis
- Citation cards with source accent borders

#### 10. `src/components/literature/CitationCard.tsx` (modify)
- Left accent border per source (orange/blue/green)
- Larger source icon badges (44px)
- Improved hover states
- Line-clamp for overflow prevention

#### 11. `src/components/literature/ConfidenceBadge.tsx` (modify)
- Pill shape with icons
- Thicker stroke weight on icons
- Specific clinical labels
- Border for definition

#### 12. `src/components/literature/LiteratureSourceBadge.tsx` (modify)
- Source-specific colors (UpToDate=orange, PubMed=blue, Library=green)
- Connected pulse animation for active sources
- Improved active/inactive contrast

#### 13. `src/components/literature/LiteratureToolbarButton.tsx` (modify)
- Clinical blue accent when active
- Keyboard shortcut tooltip
- Improved badge positioning

#### 14. `src/components/literature/LayoutToggle.tsx` (modify)
- Clinical styling for toggle group
- Tooltip improvements

### New Files

#### 15. `src/styles/clinical-animations.ts` (create)
- Custom easing curves
- Duration constants
- Animation variants for Framer Motion

#### 16. `src/components/literature/LoadingState.tsx` (create)
- Progressive loading indicator
- Source-by-source feedback
- Cycling icon animation

#### 17. `src/components/literature/EmptyState.tsx` (create)
- Custom SVG illustration
- Welcoming copy
- Upload CTA button

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

#### Typography
- [ ] Charter font renders for letter content
- [ ] Inter Tight font renders for UI elements
- [ ] IBM Plex Mono renders for clinical data
- [ ] Fallback fonts work when custom fonts fail to load

#### Colors
- [ ] Clinical blue palette used for primary actions
- [ ] Verified green for success states
- [ ] Caution amber for warnings
- [ ] Critical red for errors
- [ ] No generic grays (#888) remaining

#### Animations
- [ ] Panel opens with 300ms custom easing
- [ ] Content staggers in after panel
- [ ] Cards cascade with 80ms stagger
- [ ] Loading spinner smooth at 60fps
- [ ] Citation flash on insert

#### Accessibility
- [ ] Cmd+K opens popup layout
- [ ] Escape closes panel
- [ ] Tab navigation works through all interactive elements
- [ ] Focus indicators visible (2px clinical blue ring)
- [ ] Screen reader announces search results

#### Responsiveness
- [ ] Side panel works at 1440px+
- [ ] Popup works at all sizes
- [ ] Drawer works on tablet/mobile

---

## Risk Considerations

1. **Font Loading Performance:** Web fonts can delay first paint
   - Mitigation: Use `font-display: swap` and system fallbacks

2. **Animation Performance:** Complex animations may jank
   - Mitigation: Use `will-change` and GPU-accelerated properties only

3. **Accessibility Regression:** Visual changes may break a11y
   - Mitigation: Test with keyboard-only navigation and screen reader

4. **Dark Mode Compatibility:** Current system uses dark mode
   - Mitigation: Test both light and dark themes for all changes

---

## Dependencies

All required dependencies are already installed:
- `framer-motion` 11.18.2
- `lucide-react` 0.330.0
- `react-hotkeys-hook` 4.6.1

No new dependencies needed.
