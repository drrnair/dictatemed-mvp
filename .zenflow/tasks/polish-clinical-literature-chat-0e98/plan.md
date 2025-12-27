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
- Component relationship clarification (`ClinicalAssistantPanel` is active, `LiteratureChatPanel` is legacy)
- Color naming clarification (`clinical-blue` vs existing `clinical` semantic tokens)
- Dark mode clarification (functional support, not optimized for this task)
- Font clarification (Inter, not Inter Tight - better Next.js support)
- Implementation approach (extend design system, not replace)
- 15 source files to modify/create
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

### [x] Step: Animation Utilities
<!-- chat-id: 8696da54-070b-4f49-b796-97fc679152cd -->

Create shared animation constants and Framer Motion variants.

**Tasks:**
1. Create `src/styles/clinical-animations.ts`:
   - Custom easing curves
   - Duration constants
   - Panel animation variants
   - Card cascade variants

**Verification:**
- TypeScript compiles ✓
- No lint errors ✓

**Completed:**
- Created `src/styles/clinical-animations.ts` with comprehensive animation system:
  - 5 custom easing curves: `smooth`, `snappy`, `bounce`, `default`, `emphasized`
  - 11 duration constants: `instant`, `fast`, `quickExit`, `normal`, `panelExit`, `card`, `slow`, `slower`, `stagger`, `contentDelay`
  - Panel variants: `panelVariants`, `createPanelVariants(width)`, `panelContentVariants` (42% desktop, configurable)
  - Card variants: `cardVariants`, `createCascadeVariants`, `staggerContainerVariants`, `staggerChildVariants`
  - Modal variants: `overlayVariants`, `popupVariants`
  - Drawer variants: `drawerVariants` (spring-based)
  - Button effects: `buttonHoverEffect`, `iconButtonEffect`
  - Loading variants: `loadingStageVariants`, `loadingTextVariants`
  - Pulse animation: `pulseAnimation` for connected sources
  - Citation flash: `citationFlashVariants`, `triggerCitationFlash()` utility
  - Utility functions: `createSpringTransition`, `createTweenTransition`

**Review fixes applied:**
- Fixed misleading "milliseconds" comment → "seconds (Framer Motion format)"
- Added named duration constants: `quickExit` (0.2), `panelExit` (0.28), `card` (0.3)
- Replaced all hardcoded durations with named constants
- Added `createPanelVariants(width)` for responsive width support
- Added `citationFlashVariants` and `triggerCitationFlash()` for citation insertion

---

### [x] Step: Layout Components Polish
<!-- chat-id: 6bf28557-a661-4355-ab4e-d33c6cb76c51 -->

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
- `npm run typecheck` ✓
- `npm run lint` ✓

**Completed:**
- `SidePanelLayout.tsx` already polished with:
  - Custom easing from `clinical-animations.ts`
  - Configurable width (42% default, intentionally asymmetric)
  - Staggered content fade-in with `contentDelay`
  - Subtle inner shadow + soft outer shadow
  - Clinical gray colors and typography
- `PopupLayout.tsx` already polished with:
  - Custom easing via `overlayVariants` and `popupVariants`
  - Refined backdrop blur (`backdrop-blur-md`)
  - Clinical color palette
  - Keyboard hint footer
- `DrawerLayout.tsx` updated:
  - Fixed missing `GripHorizontal` import
  - Applied `overlayVariants` and `drawerVariants` for consistent animations
  - Replaced `Maximize2` icon (was incorrect `GripHorizontal`)
  - Clinical color palette (white bg, clinical-gray borders/text)
  - Polished drag handle (slimmer pill, hover state)
  - Added icon badge in header matching other layouts

---

### [x] Step: Search Input Polish
<!-- chat-id: 49ab23f7-7979-4fd6-9ab6-8a9fa1a0086b -->

Transform the search input to clinical-grade design.

**Tasks:**
1. Update `LiteratureSearchInput.tsx`:
   - Larger padding and rounded corners
   - Animated keyboard shortcut badge
   - Clinical blue focus ring
   - Shadow progression on hover/focus
   - Icon color transition

**Verification:**
- `npm run typecheck` ✓
- `npm run lint` ✓

**Completed:**
- Replaced generic Input component with clinical-grade custom input
- Added `rounded-xl` (12px) corners for distinctive look
- Implemented shadow progression: `shadow-sm` → `shadow-md` → `shadow-lg` on hover/focus
- Added animated keyboard shortcut badge (`⌘K`) that fades out on focus using Framer Motion
- Clinical blue focus ring (`ring-2 ring-clinical-blue-500`)
- Search icon color transitions from `clinical-gray-400` to `clinical-blue-500` on focus
- Submit button with motion effects (`whileHover`, `whileTap`)
- Improved placeholder text: "Ask about dosing, contraindications, guidelines..."
- Polished suggestions dropdown with staggered animations
- Added proper ARIA combobox role for accessibility
- Clinical color palette throughout (clinical-blue, clinical-gray)

---

### [x] Step: Search Results Polish
<!-- chat-id: 1c91b088-870a-447d-8d52-2557b0ff35c6 -->

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
- `npm run typecheck` ✓
- `npm run lint` ✓

**Completed:**
- `LiteratureSearchResults.tsx` polished with:
  - Section headers with icon badges (28px rounded-lg) in clinical colors
  - Staggered animations using `staggerContainerVariants` and `staggerChildVariants`
  - Dosing box with `font-clinical-mono` for prescription-pad precision
  - Warning box with emphasized border (`border-2 border-caution-400`)
  - Clinical color palette throughout (clinical-blue, verified, caution, clinical-gray)
  - Cascading animation for citation cards (80ms stagger)
  - Compact version `LiteratureResultSummary` also polished
- `CitationCard.tsx` transformed with:
  - Source-specific configuration (UpToDate=orange, PubMed=blue, Library=green)
  - Left accent border per source type (`border-l-4`)
  - Large icon badges (44px, `rounded-xl`) for visual identity
  - Confidence badges with icons (CheckCircle, AlertCircle, AlertTriangle)
  - Improved hover states with shadow progression (`hover:shadow-md`)
  - Line-clamp for overflow handling (`line-clamp-2` title, `truncate` authors)
  - Inline insert citation button with motion effects
  - Clinical year display with `font-clinical-mono`
  - Footer section with confidence badge + action buttons

---

### [x] Step: Badge Components Polish
<!-- chat-id: 115a819c-af10-4bd2-9047-771faa9c2cce -->

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
- `npm run typecheck` ✓
- `npm run lint` ✓

**Completed:**
- `ConfidenceBadge.tsx` polished with:
  - Pill shape (`rounded-full`) for distinctive clinical look
  - Icons with bolder stroke weight (2.5) for clarity at small sizes
  - Clinical labels: "High Confidence", "Review Recommended", "Verify Manually"
  - Border for definition (`border-verified-300`, etc.)
  - Clinical color palette: verified (green), caution (amber), critical (red)
  - Improved padding (`px-3 py-1.5`) for better proportions
  - Semantic dark mode support
- `LiteratureSourceBadge.tsx` transformed with:
  - Source-specific colors: UpToDate=orange, PubMed=clinical-blue, Library=verified-green
  - Icon badges with subtle background (20x20px rounded-full)
  - Connected pulse animation using `pulseAnimation` from clinical-animations
  - Framer Motion hover/tap effects (`whileHover`, `whileTap`)
  - Shadow progression on hover (`hover:shadow-md`)
  - New `SourceConnectionIndicator` component for standalone status display
  - Improved accessibility with aria-pressed and descriptive labels

---

### [x] Step: Loading & Empty States
<!-- chat-id: 3cb7ff94-d5b0-4dc0-a414-6b9f4100b3d3 -->

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
- `npm run typecheck` ✓
- `npm run lint` ✓

**Completed:**
- Created `src/components/literature/ClinicalLoadingState.tsx`:
  - Progressive loading indicator with 4 stages (Library → PubMed → UpToDate → Synthesis)
  - Source-by-source feedback with cycling icons
  - Custom spinner with centered icon badge (source-specific colors)
  - Smooth crossfade between stages using `loadingStageVariants` and `loadingTextVariants`
  - Progress dots showing current stage with scale animation
  - Compact mode for inline display
  - Screen reader support via `aria-live="polite"`
  - Also exported `InlineLoadingState` for simple spinner + text
- Created `src/components/literature/ClinicalEmptyState.tsx`:
  - 3 variants: `search` (initial state), `library` (empty library), `results` (no results)
  - Custom SVG illustrations for each variant:
    - `SearchIllustration`: Magnifying glass with sparkles (clinical-blue)
    - `LibraryIllustration`: Document stack with medical cross (verified-green)
    - `NoResultsIllustration`: Document with question mark (caution-amber)
  - Welcoming, helpful copy for each variant
  - Context indicator when text is selected (clinical-blue box)
  - Optional CTA button (Upload for library, Search for others)
  - Quick tips section for search variant with example queries
  - Staggered entrance animations via `staggerContainerVariants`
  - Also exported `CompactEmptyState` for minimal inline use

**Review Fixes Applied:**
- Added `onQuerySelect` prop to `ClinicalEmptyState` for pre-filling search query from quick tips
- Updated quick tips to use `onQuerySelect(tip.text)` instead of just `onSearch()`
- Changed array key from `idx` to `tip.text` (stable, unique key)
- Integrated components in `ClinicalAssistantPanel.tsx`:
  - Imports `ClinicalLoadingState`, `ClinicalEmptyState`, `ConfidenceBadge`
  - Uses `ClinicalLoadingState` for loading states
  - Uses `ClinicalEmptyState` with `onQuerySelect={setQuery}` for empty states
  - Uses imported `ConfidenceBadge` instead of local `ConfidenceIndicator`
  - Removed local duplicate `ConfidenceIndicator` component

---

### [x] Step: Main Panel Integration
<!-- chat-id: 73e08ea0-9b87-441d-9b43-24eb3cfce96c -->

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
- `npm run typecheck` ✓
- `npm run lint` ✓

**Completed:**
- `ClinicalAssistantPanel.tsx` polished with:
  - Uses `ClinicalLoadingState` for progressive loading feedback
  - Uses `ClinicalEmptyState` for welcoming empty state with quick tips
  - Chat messages with staggered animations (`staggerContainerVariants`, `staggerChildVariants`)
  - User messages: clinical-blue-600 background, white text, rounded-xl
  - Assistant messages: white background, clinical-gray border, rounded-xl
  - Citations displayed with clinical styling and cascading animations
  - Uses `ConfidenceBadge` component instead of inline indicator
  - Error state with clinical-critical colors and icon badge
  - Selected citation action bar with AnimatePresence, motion button effects
  - Clinical-styled footer with search input (clinical-gray border, white bg)
- `LiteratureToolbarButton.tsx` already polished with:
  - Clinical blue accent when active (`bg-clinical-blue-100`, `text-clinical-blue-700`)
  - Motion hover effects (`buttonHoverEffect`)
  - Keyboard shortcut tooltip showing `⌘K`
  - Clinical-styled unread indicator badge
  - Proper ARIA labels for accessibility
- `LayoutToggle.tsx` already polished with:
  - Clinical color palette (`clinical-gray-100` background)
  - Animated background indicator with `layoutId` for smooth transitions
  - Custom easing from `clinical-animations.ts`
  - Clinical-styled tooltips with descriptions and keyboard shortcuts
  - `LayoutSelector` component also polished with clinical colors

---

### [x] Step: Final Testing & Verification
<!-- chat-id: 5d953122-9fe1-47c7-8c49-138c742edf11 -->

Run all tests and perform comprehensive verification.

**Tasks:**
1. Run test suite: `npm run test`
2. Run type check: `npm run typecheck`
3. Run linter: `npm run lint`
4. Manual verification checklist from spec.md
5. Write completion report to `report.md`

**Verification:**
- All tests pass ✓
- No type errors ✓
- No lint errors ✓

**Completed:**
- `npm run typecheck` - passed with no errors
- `npm run lint` - passed (only pre-existing warnings in unrelated files)
- `npm run test` - all 1901 tests pass (67 test files)
- All clinical literature chat components polished with medical-grade design:
  - Custom typography: Charter (letter content), Inter (UI), IBM Plex Mono (clinical data)
  - Clinical color palette: clinical-blue, verified, caution, critical, clinical-gray
  - Custom animations with distinctive easing curves
  - Staggered animations for cascading content
  - Progressive loading with source-by-source feedback
  - Welcoming empty states with quick tips
  - Polished badge components with icons
  - Clinical styling throughout all 3 layout modes (side, popup, drawer)
