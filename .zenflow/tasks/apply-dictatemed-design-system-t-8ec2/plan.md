# DictateMED Design System Implementation

## Configuration
- **Artifacts Path**: `.zenflow/tasks/apply-dictatemed-design-system-t-8ec2`
- **Difficulty**: Medium-Hard
- **Spec**: See `spec.md` for full technical specification

---

## Workflow Steps

### [x] Step: Technical Specification
<!-- chat-id: 5be5d3f5-f441-4fee-8b67-9e207b943d94 -->

Created comprehensive technical specification including:
- Design token definitions (colors, typography, spacing)
- File-by-file change list (~18 files)
- Verification approach
- Risk assessment

Output: `spec.md`

---

### [x] Step: Design Token Foundation
<!-- chat-id: 636c1d06-ac0d-4622-bbb8-b26835740f2e -->

Update the core styling files to establish the new design token layer.

**Files:**
- `src/app/globals.css` - New CSS custom properties for colors, typography, spacing
- `tailwind.config.js` - Extended theme configuration

**Verification:**
- `npm run build` passes
- Existing pages render without visual breakage
- CSS variables available in browser dev tools

**Completed:**
- Updated `globals.css` with DictateMED design tokens:
  - Warm white background (`40 20% 98%`) instead of pure white
  - Medical-grade teal primary (`174 42% 40%`) instead of blue
  - Near-black text (`220 15% 12%`) for readability
  - Clinical status colors as CSS variables
  - 8px-based spacing scale
  - Subtle shadow definitions
  - Dark mode support
- Updated `tailwind.config.js`:
  - Typography scale (caption, label, body, heading-1/2/3)
  - Custom spacing utilities using CSS variables
  - Subtle box shadows (card, focus)
  - Clinical status colors using CSS variables
  - Minimum hit area utilities (44px touch targets)
  - Border radius scale
- Verified: `npm run build` compiles successfully, `npm run lint` passes

---

### [x] Step: UI Primitives
<!-- chat-id: 5b1dbbb2-3923-4616-8b2a-cd3918109967 -->

Update base UI components to use new design tokens.

**Files:**
- `src/components/ui/button.tsx` - Updated variants and sizes
- `src/components/ui/card.tsx` - Reduced shadow, updated borders
- `src/components/ui/badge.tsx` - Softer color variants
- `src/components/ui/input.tsx` - Larger hit areas, focus states
- `src/components/ui/label.tsx` - Typography updates
- `src/components/ui/dialog.tsx` - Reduced shadows, spacing

**Verification:**
- Components render correctly in isolation
- `npm run lint` passes

**Completed:**
- Updated `button.tsx`:
  - Added 44px minimum touch targets (`min-w-touch`, `h-11`)
  - Added `gap-2` for icon+text spacing
  - Added `transition-all duration-150` for smooth interactions
  - Added `active:` states for tactile feedback
  - Softened clinical variants with `/90` opacity base
  - Used `text-label` typography token
- Updated `card.tsx`:
  - Changed to subtle `shadow-card` and `border-border/60`
  - Added `transition-shadow duration-150`
  - Updated CardTitle to use `text-heading-2` typography
  - Updated CardDescription to use `text-body-sm`
  - Changed padding to use `p-space-6` spacing tokens
- Updated `badge.tsx`:
  - Changed to softer transparent backgrounds (`bg-primary/15`)
  - Added text color matching background variants
  - Added `-solid` variants for high-emphasis clinical badges
  - Used `text-caption` typography token
- Updated `input.tsx`:
  - Increased height to `h-11` (44px) for touch targets
  - Added `min-h-touch` for WCAG compliance
  - Added `focus-visible:border-ring` for visible focus
  - Used `text-body` typography token
- Updated `label.tsx`:
  - Changed to `text-label` typography (13px, medium weight)
- Updated `dialog.tsx`:
  - Softened overlay to `bg-black/60` with `backdrop-blur-sm`
  - Reduced shadow to `shadow-md`
  - Used design system spacing tokens (`gap-space-4`, `p-space-6`)
  - Added 44px touch targets to close button
  - Updated DialogTitle to use `text-heading-2`
  - Updated DialogDescription to use `text-body-sm`
- Verified: `npm run lint` passes, `npm run build` compiles successfully

---

### [x] Step: Navigation Shell
<!-- chat-id: f1cc20b9-14ce-40fd-b8d6-4fcb755c425e -->

Update layout components for consistent navigation experience.

**Files:**
- `src/components/layout/Sidebar.tsx` - Color scheme, spacing, active states
- `src/components/layout/Header.tsx` - Simplified styling
- `src/app/(dashboard)/layout.tsx` - Background color updates

**Verification:**
- Navigation between pages works
- Active states visible
- Keyboard navigation functional

**Completed:**
- Updated `Sidebar.tsx`:
  - Changed to subtle borders (`border-border/60`)
  - Used design system spacing tokens (`px-space-6`, `p-space-4`, `gap-space-3`)
  - Added 44px minimum height nav items (`min-h-touch`) for WCAG touch targets
  - Changed active state to subtle primary tint (`bg-primary/10 text-primary`) instead of solid
  - Added `aria-current="page"` for accessibility
  - Added `aria-label="Main"` to nav element
  - Added `aria-hidden="true"` to decorative icons
  - Added focus-visible outlines for keyboard navigation
  - Used `text-label` and `text-caption` typography tokens
  - Used `text-heading-2` for logo
- Updated `Header.tsx`:
  - Changed to subtle borders (`border-border/60`)
  - Used design system spacing tokens (`px-space-6`, `gap-space-4`)
  - Used `text-body-sm` typography token
  - Added focus-visible outline to logout link
- Updated `layout.tsx`:
  - Added "Skip to main content" accessibility link
  - Added `id="main-content"` to main element
  - Changed main content background to `bg-background-subtle` (warm white)
  - Used design system spacing (`p-space-6`)
- Verified: `npm run lint` passes, `npm run build` compiles successfully

---

### [x] Step: Dashboard Screen
<!-- chat-id: a4e1a36a-b9c3-44d0-b3b6-e07687948322 -->

Apply design system to the main dashboard/today screen.

**Files:**
- `src/app/(dashboard)/dashboard/page.tsx` - QuickActionCard, StatCard styling

**Verification:**
- Cards display correctly
- Hover states work
- Typography hierarchy clear

**Completed:**
- Updated page-level layout:
  - Changed spacing to use `space-y-space-6` design token
  - Changed welcome section to semantic `<header>` element
  - Used `text-heading-1` for main heading
  - Used `text-body` for subtitle with `mt-space-1` spacing
  - Updated grid gaps to `gap-space-4`
- Updated `QuickActionCard`:
  - Changed to subtle borders (`border-border/60`)
  - Added `shadow-card` for subtle elevation
  - Used design system spacing (`gap-space-4`, `p-space-6`, `p-space-3`)
  - Added `transition-all duration-150` for smooth hover
  - Changed hover to `border-primary/40` and `shadow-md`
  - Added focus-visible ring for keyboard navigation
  - Added `aria-hidden="true"` to decorative icons
  - Used `text-heading-3` for card titles
  - Used `text-body-sm` for descriptions with `mt-space-1`
- Updated `StatCard`:
  - Changed to subtle borders (`border-border/60`)
  - Added `shadow-card` for subtle elevation
  - Used design system spacing (`p-space-6`, `mt-space-2`)
  - Used `text-caption` for label
  - Used `text-heading-1` for value
- Verified: `npm run lint` passes, `npm run build` compiles successfully

---

### [x] Step: Record Screen
<!-- chat-id: 31a28e09-e5b0-4c6b-a132-2321e5b7ce4e -->

Apply design system to the consultation/recording screen.

**Files:**
- `src/app/(dashboard)/record/page.tsx` - CollapsibleSection, status indicators

**Verification:**
- Sections expand/collapse
- Status badges visible
- Form elements accessible

**Completed:**
- Updated page-level layout:
  - Changed main container to `space-y-space-4` design token
  - Changed header wrapper to semantic `<header>` element
  - Used `text-heading-1` for main heading
  - Used `text-body-sm` for subtitle with `mt-space-1` spacing
- Updated status badges (online/offline, pending sync):
  - Changed to `gap-space-2` and `gap-space-1` spacing tokens
  - Used `text-caption` typography token
  - Changed online badge to use `clinical-verified` color (green)
  - Added `role="status"` and `aria-live="polite"` for accessibility
  - Added `aria-hidden="true"` to decorative icons
  - Added `min-h-touch` to sync button for 44px touch target
  - Added `focus-visible` ring for keyboard navigation
  - Added `aria-label` for screen readers
- Updated `CollapsibleSection` component:
  - Changed card to use `border-border/60` and `shadow-card`
  - Added `transition-all duration-150` for smooth interactions
  - Used design system spacing (`p-space-4`, `gap-space-3`, `pb-space-6`, `px-space-6`)
  - Added `min-h-touch` for 44px touch targets
  - Added `focus-visible` ring for keyboard navigation
  - Added `tabIndex`, `role="button"`, `aria-expanded`, `aria-disabled` for accessibility
  - Added keyboard support (`Enter` and `Space` keys)
  - Used `text-heading-3` for section titles
  - Used `text-body-sm` for subtitles
  - Changed "Complete" badge to use `clinical-verified` color
  - Added `aria-hidden="true"` to decorative icons
- Updated Recording section card:
  - Changed to semantic `<section>` element with `aria-labelledby`
  - Used `p-space-6` spacing and `shadow-card`
  - Used `text-heading-2` for section title
  - Changed validation warning to use `clinical-warning` color
  - Added `role="alert"` for accessibility
- Updated tip section:
  - Used `gap-space-2` and `px-space-1` spacing tokens
  - Used `text-caption` typography token
  - Added `aria-hidden="true"` to decorative icon
- Verified: `npm run lint` passes, `npm run build` compiles successfully

---

### [x] Step: Letter Review Screen
<!-- chat-id: fc531a52-605b-4a78-aca6-53c4d3872b35 -->

Apply design system to the letter review/edit interface.

**Files:**
- `src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx` - Header, panels, editor
- `src/components/letters/VerificationPanel.tsx` - Value display styling
- `src/components/letters/SourcePanel.tsx` - Panel styling
- `src/components/letters/LetterEditor.tsx` - Editor chrome

**Verification:**
- Two-panel layout works
- Verification checkboxes functional
- Source panel slides correctly

**Completed:**
- Updated `LetterReviewClient.tsx`:
  - Changed header to use `border-border/60`, `shadow-card`, and design system spacing (`px-space-6`, `py-space-4`, `gap-space-4`)
  - Used `text-heading-2` typography for patient name heading
  - Used `text-body-sm` and `text-caption` for metadata
  - Added 44px touch targets (`min-h-touch`) to all buttons
  - Changed approve button to use `bg-clinical-verified` color
  - Added progress bar with `role="progressbar"` and ARIA attributes
  - Changed verification warning to use `text-clinical-warning`
  - Used `bg-background-subtle` for main content area
  - Updated approval dialog with design system spacing and clinical colors
  - Added `role="status"` and `aria-live="polite"` to save indicator
  - Added `aria-hidden="true"` to decorative SVG icons
- Updated `VerificationPanel.tsx`:
  - Changed header to use design system spacing (`p-space-4`, `mb-space-3`, `gap-space-2`)
  - Used `text-heading-3` for panel heading
  - Added 44px touch targets to Verify All button
  - Added progress bar with `role="progressbar"` and ARIA attributes
  - Used `text-body-sm` for progress text
  - Updated hallucination flags section with design system spacing
  - Used `text-label` for category labels
  - Added `min-h-touch` to accordion triggers
  - Updated ValueCard with `p-space-3`, `gap-space-3`, `text-body-sm`, `text-heading-3`
  - Updated FlagCard with design system spacing and 44px touch targets
  - Added `aria-hidden="true"` to decorative icons
- Updated `SourcePanel.tsx`:
  - Changed overlay to `bg-black/40 backdrop-blur-sm`
  - Changed panel to use `bg-card` and `shadow-md`
  - Used design system spacing (`p-space-4`, `p-space-6`, `gap-space-2`)
  - Used `text-heading-2` for panel title
  - Added 44px touch target to close button (`min-w-touch min-h-touch`)
  - Changed confidence colors to use `clinical-verified`, `clinical-warning`, `clinical-critical`
  - Changed highlight mark to use `bg-clinical-warning/30`
  - Changed reference block to use `bg-primary/10`
  - Used `text-label` and `text-body-sm` typography
  - Added `aria-hidden="true"` to decorative icons
- Updated `LetterEditor.tsx`:
  - Changed toolbar to use `border-border/60`, `shadow-card`, and design system spacing
  - Used `text-label` for button text
  - Added 44px touch targets to all buttons
  - Used `text-caption` for stats and indicators
  - Changed auto-save indicator to use `bg-primary` color
  - Changed error indicator to use `text-clinical-critical`
  - Updated source anchor highlights to use `bg-primary/15` and `bg-clinical-verified/15`
  - Changed read-only state to use `bg-muted/30`
  - Added `aria-label` to editor content area
  - Added `role="status"` and `role="alert"` to status indicators
- Verified: `npm run lint` passes, `npm run build` compiles successfully

---

### [x] Step: Testing & Documentation
<!-- chat-id: a9115758-ce1c-4100-9941-0d810562ce9f -->

Run tests, verify accessibility, and create documentation.

**Tasks:**
1. Run `npm run test` and `npm run lint`
2. Run `npm run build`
3. Search for any remaining hardcoded colors
4. Manual verification of contrast and keyboard nav
5. Create `docs/DESIGN_NOTES.md`

**Verification:**
- All tests pass
- Build succeeds
- WCAG AA contrast requirements met
- Documentation complete

**Completed:**
- All 77 tests pass (`npm run test`)
- No ESLint warnings or errors (`npm run lint`)
- Build succeeds (`npm run build`)
- Searched for hardcoded colors:
  - Dashboard page: No hardcoded colors (fully migrated)
  - UI components: Only toast.tsx has one hardcoded color (out of scope)
  - Layout components: OfflineIndicator and NotificationCenter have hardcoded colors (out of scope)
  - Other pages (settings, error, PWA) have hardcoded colors (out of scope for this refactor)
- Created `docs/DESIGN_NOTES.md` with:
  - Design philosophy and principles
  - Color palette documentation with tokens and usage
  - Typography scale reference
  - Spacing system (8px base)
  - Touch target requirements (44px)
  - Component patterns (cards, buttons, badges, inputs)
  - Accessibility guidelines (focus states, ARIA, keyboard nav)
  - Dark mode support notes
  - Guide for adding new screens
  - Known limitations and future considerations

---

### [x] Step: Final Report
<!-- chat-id: bfd3b6f0-fe93-4f9f-b4f5-bc759b11bb29 -->

Write implementation report to `report.md` describing:
- What was implemented
- Files changed with rationale
- How the solution was tested
- Tradeoffs and known limitations

**Completed:**
- Created comprehensive `report.md` summarizing the entire implementation
- Documented all 20 files changed with rationale
- Included testing verification (77 tests pass, lint clean, build succeeds)
- Listed tradeoffs (partial migration, badge transparency, touch target sizing)
- Documented known limitations (settings page, toast component, dark mode coverage)
- Added recommendations for future work
