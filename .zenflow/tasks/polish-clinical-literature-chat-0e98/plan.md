# Spec and build

## Configuration
- **Artifacts Path**: `.zenflow/tasks/polish-clinical-literature-chat-0e98`
- **Difficulty**: Hard
- **Spec**: See `spec.md` for full technical specification

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification

Created comprehensive technical specification in `spec.md` covering:
- Task difficulty assessment: **Hard**
- Technical context (stack, existing architecture)
- Implementation approach (extend design system, not replace)
- 17 source files to modify/create
- Verification approach with automated and manual checklists
- Risk considerations and mitigations

---

### [x] Step: Design System Setup
<!-- chat-id: 28cc4850-9593-42b2-9e59-c22de3d72f4a -->

Configure typography, colors, and animations in Tailwind and CSS.

**Tasks:**
1. Update `tailwind.config.js` with:
   - Font families: `letter-serif`, `ui-sans`, `clinical-mono`
   - Clinical color scales
   - Animation keyframes
2. Update `src/app/globals.css` with:
   - CSS custom properties for animations
   - `@keyframes citation-flash`
3. Update `src/app/layout.tsx` with:
   - Google Fonts: Inter, IBM Plex Mono

**Verification:**
- `npm run typecheck` ✓
- `npm run lint` ✓

**Completed:**
- Added 3 font families: `letter-serif` (Charter), `ui-sans` (Inter), `clinical-mono` (IBM Plex Mono)
- Added 5 clinical color scales: `clinical-blue`, `verified`, `caution`, `critical`, `clinical-gray`
- Added 5 animation keyframes: `citation-flash`, `source-pulse`, `slide-in-right`, `cascade-in`, `spin-slow`
- Added CSS utility classes for clinical components
- Loaded Inter and IBM Plex Mono via Google Fonts in layout.tsx

---

### [ ] Step: Animation Utilities

Create shared animation constants and Framer Motion variants.

**Tasks:**
1. Create `src/styles/clinical-animations.ts`:
   - Custom easing curves
   - Duration constants
   - Panel animation variants
   - Card cascade variants

**Verification:**
- TypeScript compiles
- No lint errors

---

### [ ] Step: Layout Components Polish

Enhance the three layout components with distinctive animations.

**Tasks:**
1. Update `SidePanelLayout.tsx`:
   - Custom easing for slide
   - Staggered content fade-in
   - 42% width (not fixed pixels)
   - Subtle inner shadow
2. Update `PopupLayout.tsx`:
   - Custom easing curves
   - Refined backdrop blur
3. Update `DrawerLayout.tsx`:
   - Custom drag easing
   - Polished handle

**Verification:**
- Manual test: open/close each layout
- Animation smoothness at 60fps

---

### [ ] Step: Search Input Polish

Transform the search input to clinical-grade design.

**Tasks:**
1. Update `LiteratureSearchInput.tsx`:
   - Larger padding and rounded corners
   - Animated keyboard shortcut badge
   - Clinical blue focus ring
   - Shadow progression on hover/focus
   - Icon color transition

**Verification:**
- Manual test: focus states, hover states
- Keyboard navigation works

---

### [ ] Step: Search Results Polish

Enhance results display with clinical styling.

**Tasks:**
1. Update `LiteratureSearchResults.tsx`:
   - Section headers with icons
   - Dosing box with mono font
   - Warning box with border emphasis
2. Update `CitationCard.tsx`:
   - Left accent border per source
   - Larger icon badges
   - Improved hover states
   - Line-clamp for overflow

**Verification:**
- Visual inspection with mock data
- Overflow handling works

---

### [ ] Step: Badge Components Polish

Polish confidence and source badges.

**Tasks:**
1. Update `ConfidenceBadge.tsx`:
   - Pill shape with icons
   - Clinical labels (not just "Low")
   - Border for definition
2. Update `LiteratureSourceBadge.tsx`:
   - Source-specific colors
   - Connected pulse animation
   - Improved contrast

**Verification:**
- Visual inspection of all badge states

---

### [ ] Step: Loading & Empty States

Create distinctive loading and empty states.

**Tasks:**
1. Create `LoadingState.tsx`:
   - Progressive indicator
   - Source-by-source feedback
   - Cycling icon animation
2. Create `EmptyState.tsx`:
   - Custom SVG illustration
   - Welcoming copy
   - Upload CTA

**Verification:**
- Manual test loading state
- Empty state renders correctly

---

### [ ] Step: Main Panel Integration

Integrate all polished components in the main panel.

**Tasks:**
1. Update `ClinicalAssistantPanel.tsx`:
   - Use new LoadingState
   - Use new EmptyState
   - Apply staggered animations
   - Polish usage indicator
2. Update `LiteratureToolbarButton.tsx`:
   - Clinical blue accent
   - Keyboard shortcut tooltip
3. Update `LayoutToggle.tsx`:
   - Clinical styling

**Verification:**
- Full flow test: open panel, search, view results, close

---

### [ ] Step: Final Testing & Verification

Run all tests and perform comprehensive verification.

**Tasks:**
1. Run test suite: `npm run test`
2. Run type check: `npm run typecheck`
3. Run linter: `npm run lint`
4. Manual verification checklist from spec.md
5. Write completion report to `report.md`

**Verification:**
- All tests pass
- No type errors
- No lint errors
- All manual checklist items verified
