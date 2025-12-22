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
<!-- chat-id: fa9b053f-13ee-41d8-9509-19d3647f3500 -->

**Completed:** Technical specification created at `.zenflow/tasks/record-page-and-clinical-context-9f4c/spec.md`

**Assessment:** Medium complexity
- Most infrastructure already exists (Consultation model, APIs, components)
- Primarily UI reorganization with component enhancements
- No new external service integrations required
- Clear data model with established patterns

**Key Findings:**
- Existing `ConsultationContextForm`, `PatientSelector`, `ReferrerSelector`, `LetterTypeSelector` components can be reused
- Recording components (`RecordingSection`, `RecordingModeSelector`, etc.) fully implemented
- `PreviousMaterialsPanel` and `NewUploadsSection` exist and work
- Prisma schema already supports `Consultation` with `selectedLetterIds`, `selectedDocumentIds`
- All required API endpoints exist

**Implementation Approach:** Enhance existing page layout and components rather than rebuild

---

### [ ] Step: Layout Refinement

Refactor `src/app/(dashboard)/record/page.tsx` layout:

1. Reorganize into 3 clear card sections:
   - **Consultation Details** (patient, referrer, CC, letter type) - Required
   - **Clinical Context** (previous materials + new uploads) - Optional
   - **Recording** (mode selector + controls) - Enabled when context valid

2. Improve visual hierarchy:
   - Clear section headers with descriptions
   - Proper spacing between sections
   - Disabled state styling for recording section

3. Verify:
   - Form validation blocks recording when context incomplete
   - Responsive layout on desktop/tablet/mobile

**Files to modify:**
- `src/app/(dashboard)/record/page.tsx`

---

### [ ] Step: Clinical Context Section

Create unified clinical context component:

1. Create `src/components/consultation/ClinicalContextSection.tsx`:
   - Combines previous materials panel and new uploads
   - Shows previous materials when patient selected
   - Allows document uploads linked to consultation
   - Handles empty states gracefully

2. Enhance `PreviousMaterialsPanel`:
   - Better visual display of letters vs documents
   - Type badges and dates
   - Selection checkboxes with select all/clear

3. Verify:
   - Materials load when patient selected
   - Selection persists via consultation update
   - Uploads link to consultation

**Files:**
- Create: `src/components/consultation/ClinicalContextSection.tsx`
- Modify: `src/components/consultation/PreviousMaterialsPanel.tsx` (if needed)

---

### [ ] Step: Recording Mode Selector

Update recording section for horizontal mode selection:

1. Update `RecordingModeSelector.tsx`:
   - Horizontal toggle group layout
   - Icons + labels: Ambient | Dictation | Upload Audio
   - Visual indication of selected mode
   - Mode descriptions below when selected

2. Ensure `RecordingSection.tsx`:
   - Shows appropriate controls per mode
   - Handles disabled state properly
   - Links recording to consultation

3. Verify:
   - Mode switching works smoothly
   - All three modes functional
   - Touch targets meet 44px minimum

**Files to modify:**
- `src/components/recording/RecordingModeSelector.tsx`
- `src/components/recording/RecordingSection.tsx` (if needed)

---

### [ ] Step: Integration & Polish

Final integration and verification:

1. End-to-end data flow:
   - Verify consultation context saved correctly
   - Verify selected materials linked to consultation
   - Verify uploaded documents linked to consultation
   - Verify recording linked to consultation
   - Verify letter generation receives all context

2. Responsive testing:
   - Desktop (1440px+)
   - Tablet (768-1024px)
   - Mobile (< 768px)

3. Accessibility:
   - Keyboard navigation
   - Focus states
   - Screen reader labels

4. Run verification:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   ```

5. Write completion report to `{@artifacts_path}/report.md`

**Verification checklist:**
- [ ] Context form validates required fields
- [ ] Previous materials selectable as context
- [ ] Documents uploadable and linked
- [ ] Recording modes all functional
- [ ] Letter generation includes all context sources
- [ ] Responsive on all breakpoints
- [ ] No lint/type errors
- [ ] Tests pass
