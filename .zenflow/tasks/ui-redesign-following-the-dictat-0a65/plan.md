# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

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

**Difficulty Assessment: Medium-Hard**

Created comprehensive technical specification in `spec.md` covering:
- Technical context (Next.js 14.2, Tailwind CSS, TypeScript, Radix UI)
- Gap analysis between current and target design
- Design system updates (fonts, colors, shadows, animations)
- Component-level changes (button, card, input, badge)
- Page-by-page implementation guide
- 8-phase implementation plan
- Verification approach with automated and manual checklists

---

### [ ] Step 1: Foundation Layer (Tailwind & Fonts)
<!-- chat-id: 630ec1a0-07b1-46dd-adb3-b4e48259a1a9 -->

Update the design token foundation:

1. **tailwind.config.js**:
   - Add teal/amber/emerald/rose color scales
   - Add soft/medium/elevated shadows
   - Update border radius default to 12px (rounded-xl)

2. **src/app/layout.tsx**:
   - Replace Inter with Plus Jakarta Sans font
   - Add font weight variants (400, 500, 600, 700)

3. **src/app/globals.css**:
   - Add transition-lift utility class
   - Add fadeInUp keyframe animation
   - Add animate-fade-in-up class

**Verification**: `npm run build` passes, font loads correctly

---

### [ ] Step 2: Core UI Components

Update base UI component styling:

1. **src/components/ui/button.tsx**:
   - Update to rounded-xl
   - Add shadow-sm/hover:shadow-md to primary
   - Add transition-all duration-200
   - Update destructive to rose colors

2. **src/components/ui/card.tsx**:
   - Update to rounded-xl
   - Add interactive card variant with hover lift

3. **src/components/ui/input.tsx**:
   - Update to rounded-xl
   - Add bg-slate-50 background
   - Update focus ring to teal

4. **src/components/ui/badge.tsx** (if exists):
   - Add amber/emerald status variants

**Verification**: `npm run lint` passes, components render correctly

---

### [ ] Step 3: Navigation Shell

Update navigation components:

1. **src/components/layout/Sidebar.tsx**:
   - Update active state: bg-teal-50 text-teal-700 border-l-2 border-teal-500
   - Add hover lift effect
   - Update logo area styling

2. **src/components/layout/Header.tsx**:
   - Ensure consistent styling with sidebar
   - Update button variants if needed

**Verification**: Navigation renders, active states work correctly

---

### [ ] Step 4: Dashboard Redesign

Full dashboard page redesign:

1. **src/app/(dashboard)/dashboard/page.tsx**:
   - Add time-aware greeting function (Good morning/afternoon/evening)
   - Create HeroActionCard for "Start Recording" (teal gradient, prominent)
   - Convert existing QuickActionCards to secondary style (smaller, white)
   - Add TimeSavedStat component placeholder
   - Add RecentActivity section with status badges
   - Improve empty state with encouraging copy

**Verification**: Dashboard displays hero card, greeting updates based on time

---

### [ ] Step 5: Record Page Updates

Update recording page styling:

1. **src/app/(dashboard)/record/page.tsx**:
   - Update CollapsibleSection styling with completion badges
   - Update recording button states (teal=ready, rose=recording, grey=disabled)
   - Enhance dropzone styling

2. **src/components/recording/RecordingSection.tsx** (if separate):
   - Update button color states
   - Add pulse animation for recording state

**Verification**: Recording flow works, button states transition correctly

---

### [ ] Step 6: Letters Page Updates

Update letters page styling:

1. **src/app/(dashboard)/letters/page.tsx**:
   - Update stat cards with rounded-xl, shadow
   - Add hover states to list items

2. **src/components/letters/LetterList.tsx**:
   - Update status badges: pending=amber, approved=emerald
   - Add hover lift effect to rows

3. **src/components/letters/LetterCard.tsx**:
   - Update status badge colors
   - Add hover effect

**Verification**: Letters display correctly, status badges have correct colors

---

### [ ] Step 7: Settings Pages

Update all settings pages:

1. **src/app/(dashboard)/settings/page.tsx**:
   - Update card hover states with lift effect
   - Consistent icon treatment

2. **Settings sub-pages** (profile, practice, style, etc.):
   - Update form inputs to new style
   - Add danger zone card styling (rose border) where applicable

**Verification**: All settings pages render with consistent styling

---

### [ ] Step 8: Final Testing & Report

Complete testing and documentation:

1. Run full test suite: `npm run test`
2. Run build: `npm run build`
3. Run lint: `npm run lint`
4. Manual verification:
   - Check all pages in light mode
   - Check all pages in dark mode
   - Verify hover states and animations
   - Verify accessibility (focus states, contrast)

5. Write report to `report.md`:
   - Summary of changes
   - Files modified
   - Testing results
   - Any issues encountered

**Verification**: All tests pass, manual checklist complete
