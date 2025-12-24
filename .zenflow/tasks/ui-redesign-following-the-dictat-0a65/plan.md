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

### [x] Step 1: Foundation Layer (Tailwind & Fonts)
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

**Completed Changes**:
- Added teal, emerald, amber, rose, and slate color scales to tailwind.config.js
- Added soft, medium, elevated shadow variants
- Added fontFamily configuration for Plus Jakarta Sans
- Added fade-in-up keyframe animation and animation class
- Replaced Inter with Plus Jakarta Sans in src/app/layout.tsx
- Added transition-lift, transition-scale, and card-interactive utility classes to globals.css
- Build passes successfully

---

### [x] Step 2: Core UI Components
<!-- chat-id: f7bac414-3df4-41fd-805a-e02bbcbf5e9c -->

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

**Completed Changes**:
- **button.tsx**: Updated to rounded-xl, teal-500 primary with shadow-sm/hover:shadow-md, 200ms transitions, rose-500 for destructive, teal focus ring
- **card.tsx**: Added cardVariants with cva for default/interactive/selected/ghost variants, rounded-xl, interactive variant has hover lift effect (-translate-y-0.5)
- **input.tsx**: Updated to rounded-xl, bg-slate-50, teal-500 focus ring, 200ms transitions, focus:bg-white
- **badge.tsx**: Added pending (amber-50/amber-600), approved (emerald-50/emerald-600), error (rose-50/rose-600) status variants plus solid versions
- Both `npm run lint` and `npm run build` pass successfully

---

### [x] Step 3: Navigation Shell
<!-- chat-id: fec8968e-bf40-40d7-b3cf-9215c97982b1 -->

Update navigation components:

1. **src/components/layout/Sidebar.tsx**:
   - Update active state: bg-teal-50 text-teal-700 border-l-2 border-teal-500
   - Add hover lift effect
   - Update logo area styling

2. **src/components/layout/Header.tsx**:
   - Ensure consistent styling with sidebar
   - Update button variants if needed

**Verification**: Navigation renders, active states work correctly

**Completed Changes**:
- **Sidebar.tsx**: Updated to new design system with:
  - Active nav items: `bg-teal-50 text-teal-700 border-l-2 border-teal-500` with dark mode support
  - Inactive items: slate colors with hover lift effect (`hover:-translate-y-0.5 hover:shadow-sm`)
  - Logo: teal-600 color with tracking-tight typography
  - Borders: slate-200/800 for light/dark modes
  - Focus states: teal-500 outline
  - Icon coloring: teal-600 when active
- **Header.tsx**: Updated to consistent styling with:
  - slate-200/800 borders for light/dark modes
  - White/slate-900 backgrounds for light/dark modes
  - User greeting with emphasized name (font-medium text-slate-700)
  - Rounded-xl focus rings with teal-500 outline
- Both `npm run lint` and `npm run build` pass successfully

---

### [x] Step 4: Dashboard Redesign
<!-- chat-id: 17c81182-34fa-4aec-a473-878257a28379 -->

Full dashboard page redesign:

1. **src/app/(dashboard)/dashboard/page.tsx**:
   - Add time-aware greeting function (Good morning/afternoon/evening)
   - Create HeroActionCard for "Start Recording" (teal gradient, prominent)
   - Convert existing QuickActionCards to secondary style (smaller, white)
   - Add TimeSavedStat component placeholder
   - Add RecentActivity section with status badges
   - Improve empty state with encouraging copy

**Verification**: Dashboard displays hero card, greeting updates based on time

**Completed Changes**:
- **Time-aware greeting**: Added `getGreeting()` function that returns "Good morning/afternoon/evening" based on current hour
- **HeroActionCard**: Created prominent teal gradient card for "Start Recording" with:
  - `bg-gradient-to-br from-teal-500 to-teal-600` gradient
  - Large microphone icon in frosted glass container
  - Decorative background circles for visual interest
  - Hover lift effect and arrow indicator
  - Full accessibility with focus-visible states
- **SecondaryActionCard**: Replaced original QuickActionCard with smaller, white cards:
  - Uses Card component with interactive variant
  - Icon changes to teal on hover
  - Chevron arrow indicator with hover animation
  - Optional count badge for pending items
- **TimeSavedCard**: Added highlighted stat card with:
  - Teal accent border and decorative circle
  - Clock icon with teal coloring
  - Hours display with "This month" subtitle
- **StatCard**: Redesigned standard stat cards with icons for today/pending/month
- **RecentActivitySection**: Added activity feed section with:
  - Section header with "View all" link
  - List layout with patient initials, letter type, time
  - Status badges using approved/pending variants
- **EmptyActivityState**: Encouraging empty state with:
  - Document illustration icon
  - Friendly copy: "No letters yet" / "Start your first recording..."
  - Prominent "Start Recording" CTA button
- Both `npm run lint` and `npm run build` pass successfully

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
