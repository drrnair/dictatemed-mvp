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

### [ ] Step: UI Primitives

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

---

### [ ] Step: Navigation Shell

Update layout components for consistent navigation experience.

**Files:**
- `src/components/layout/Sidebar.tsx` - Color scheme, spacing, active states
- `src/components/layout/Header.tsx` - Simplified styling
- `src/app/(dashboard)/layout.tsx` - Background color updates

**Verification:**
- Navigation between pages works
- Active states visible
- Keyboard navigation functional

---

### [ ] Step: Dashboard Screen

Apply design system to the main dashboard/today screen.

**Files:**
- `src/app/(dashboard)/dashboard/page.tsx` - QuickActionCard, StatCard styling

**Verification:**
- Cards display correctly
- Hover states work
- Typography hierarchy clear

---

### [ ] Step: Record Screen

Apply design system to the consultation/recording screen.

**Files:**
- `src/app/(dashboard)/record/page.tsx` - CollapsibleSection, status indicators

**Verification:**
- Sections expand/collapse
- Status badges visible
- Form elements accessible

---

### [ ] Step: Letter Review Screen

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

---

### [ ] Step: Testing & Documentation

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

---

### [ ] Step: Final Report

Write implementation report to `report.md` describing:
- What was implemented
- Files changed with rationale
- How the solution was tested
- Tradeoffs and known limitations
