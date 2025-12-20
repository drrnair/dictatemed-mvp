# DictateMED MVP - Product Requirements Document

**Version:** 1.0
**Date:** December 2025
**Status:** Draft

---

## 1. Executive Summary

DictateMED is an administrative documentation support tool designed for specialist cardiologists in private practice. It combines ambient voice capture, clinical document analysis, and AI-assisted letter generation to reduce consultation letter creation time from 15-20 minutes to under 3 minutes of physician review.

### 1.1 Core Value Proposition

> "Consult your patient naturally. Upload your reports. Get a letter in your exact style with every clinical fact verified and traceable to its source."

### 1.2 Key Differentiators

| Feature | Description |
|---------|-------------|
| **Cardiology-Native** | Built by cardiologist for cardiologists with specialized templates |
| **Source Traceability** | Every clinical fact is clickable and traceable to its source |
| **Value Verification** | Mandatory confirmation of critical metrics (LVEF, stenosis, etc.) |
| **Hallucination Detection** | AI cross-validation catches fabricated content |
| **Dual-Mode Capture** | Both ambient scribing and traditional dictation modes |

---

## 2. Intended Use & Regulatory Positioning

### 2.1 Official Intended Use Statement

DictateMED is an **administrative documentation support tool** that assists specialist physicians in generating draft consultation letters and procedure reports from recorded consultations and uploaded clinical documents.

**The software:**
- Records and transcribes physician-patient consultations (ambient or dictated)
- Extracts relevant information from uploaded clinical documents
- Generates draft correspondence in the physician's preferred style and format
- Flags critical clinical values for mandatory physician verification
- Provides source traceability for all clinical facts in generated letters
- Requires physician review and approval before any letter is finalized

**DictateMED does NOT:**
- Provide clinical decision support or treatment recommendations
- Diagnose, screen, or monitor diseases or conditions
- Replace physician clinical judgment
- Generate final clinical documentation without physician review
- Interface directly with electronic health records without physician action

### 2.2 Regulatory Classification

This intended use positions DictateMED **outside medical device regulation** under Australian TGA and international frameworks by:
- Focusing on administrative/documentation workflow, not clinical decisions
- Requiring mandatory physician review before any output reaches patients
- Making no diagnostic or treatment claims
- Flagging values for verification rather than interpretation

---

## 3. Target Users & Use Cases

### 3.1 Primary Users

**Specialist Cardiologists in Private Practice**
- Interventional cardiologists
- General cardiologists
- Imaging/echo specialists
- Electrophysiologists

**User Characteristics:**
- Generate 30+ consultation letters per month
- Currently spend 4-6 hours/week on after-hours documentation
- Value accuracy and efficiency
- Comfortable with technology but time-constrained

### 3.2 Secondary Users

- Practice administrators (billing, user management)
- Practice managers (usage reporting, settings)

### 3.3 Primary Use Cases

| Use Case | Description | Mode |
|----------|-------------|------|
| UC1: New Patient Consultation | Capture initial consultation, generate comprehensive letter | Ambient |
| UC2: Follow-up Consultation | Capture follow-up visit, generate progress letter | Ambient |
| UC3: Procedure Documentation | Post-procedure dictation with report integration | Dictation |
| UC4: Report Letter | Generate letter summarizing uploaded clinical reports | Dictation |

---

## 4. Functional Requirements

### 4.1 Audio Capture System

#### FR-AUD-001: Dual-Mode Recording
The system SHALL support two recording modes:
- **Ambient Mode**: Continuous recording of full consultation (10-30 minutes)
- **Dictation Mode**: Structured recording after consultation (1-3 minutes)

#### FR-AUD-002: Speaker Diarization
In Ambient Mode, the system SHALL:
- Distinguish between clinician and patient voices
- Support two-speaker mode (default)
- Optionally support multi-speaker mode (family, interpreters)
- Allow manual correction if roles are mis-assigned

#### FR-AUD-003: Audio Quality Monitoring
The system SHALL:
- Display real-time audio quality indicator (Excellent/Good/Fair/Poor)
- Warn users when background noise is detected
- Queue recordings for upload when offline

#### FR-AUD-004: Patient Consent Tracking
The system SHALL:
- Prompt for consent confirmation before recording starts
- Support consent types: Verbal, Written on file, Standing consent
- Log consent with timestamp in audit trail
- Optionally accept uploaded consent forms

### 4.2 Document Processing

#### FR-DOC-001: Document Upload
The system SHALL accept:
- PDF documents (clinical reports)
- Image files (PNG, JPG - scanned reports)
- Maximum file size: 20MB per document
- Multiple documents per letter

#### FR-DOC-002: Document Types Supported (MVP)
The system SHALL extract data from:
- Echocardiogram reports
- Angiogram/catheterization reports
- ECG/Holter reports
- Referral letters
- External investigation reports

#### FR-DOC-003: Data Extraction
The system SHALL:
- Extract clinical values (measurements, grades, findings)
- Identify patient demographics
- Parse structured and semi-structured reports
- Handle handwritten annotations (best effort)

### 4.3 Letter Generation

#### FR-LET-001: AI-Assisted Draft Generation
The system SHALL:
- Generate draft letters from transcript + uploaded documents
- Use Claude AI models via AWS Bedrock
- Apply intelligent model selection (Sonnet 70%, Opus 30%)
- Process in background with notification on completion

#### FR-LET-002: Letter Types (MVP)
The system SHALL support templates for:
- New patient consultation letter
- Follow-up consultation letter
- Angiogram/angioplasty procedure report
- Echocardiogram report letter

#### FR-LET-003: Style Learning
The system SHALL:
- Learn each physician's unique writing style from approved letters
- Improve style matching over time
- Maintain separate style profiles per physician
- Display "style confidence" indicator

#### FR-LET-004: Source-Anchored Documentation
The system SHALL:
- Link every clinical fact to its source (transcript timestamp or document page)
- Display source on click/tap in side panel
- Visually distinguish statements without clear sources
- Support "View Source" for any clickable segment

### 4.4 Clinical Safety Features

#### FR-SAF-001: High-Impact Value Verification
The system SHALL require mandatory verification of:
- **Cardiac Function**: LVEF %, RVEF %, GLS
- **Coronary Disease**: Stenosis percentages, vessel involvement
- **Valvular**: Gradients (mean/peak), valve areas, regurgitation grade
- **Procedural**: Stent sizes, deployment pressures, outcomes
- **Hemodynamic**: Blood pressure, heart rate
- **Medications**: Drug names, dosages, frequencies

Letters CANNOT be finalized until all flagged values are verified.

#### FR-SAF-002: Hallucination Detection
The system SHALL:
- Run a secondary "critic" model to cross-reference letter vs sources
- Identify clinical facts not supported by source materials
- Flag suspected fabrications with warning icons
- Require physician review of flagged items

#### FR-SAF-003: PHI Obfuscation Pipeline
The system SHALL:
- Apply Deepgram real-time redaction during transcription
- Tokenize remaining identifiers before LLM processing
- Replace tokens with actual values only in final output
- Support obfuscation for: names, DOB, Medicare numbers, addresses, phones

#### FR-SAF-004: Clinical Concept Extraction
The system SHALL extract and display:
- Diagnoses mentioned or confirmed
- Medications with dosages and frequencies
- Procedures performed or planned
- Follow-up recommendations and timelines

#### FR-SAF-005: Provenance Report
The system SHALL generate downloadable audit trail containing:
- Generation timestamp
- AI model versions used
- Source files referenced (filenames only)
- Value verification confirmations
- Hallucination check results
- Reviewing physician identity
- Review time duration
- Edits made (diff from original)
- Final approval timestamp

### 4.5 Review Interface

#### FR-REV-001: Letter Review Workflow
The system SHALL provide:
- Full letter view with formatted text
- Side-by-side source panel
- Inline editing capability
- Verification panel for clinical values
- Approval/reject actions

#### FR-REV-002: Differential View
The system SHALL offer view modes:
- **Full Letter**: Complete generated text
- **Changes Highlighted**: Differences from template in highlight color
- **Changes Only**: Collapsed view showing only variable content

#### FR-REV-003: Edit Capabilities
The system SHALL allow:
- Free-text editing of any letter section
- Drag-and-drop section reordering
- Add/remove sections
- Quick phrase insertion
- Undo/redo functionality

### 4.6 User Management

#### FR-USR-001: Authentication
The system SHALL:
- Require multi-factor authentication
- Support session timeout (30 minutes inactivity)
- Provide secure password reset flow
- Log all authentication events

#### FR-USR-002: Multi-User Practice Support
The system SHALL support:
- Practice-level accounts (organization)
- Individual specialist accounts (users)
- Role-based access (Admin, Specialist)
- User management by practice admins

#### FR-USR-003: Data Isolation
The system SHALL ensure:
- Style profiles are per-specialist, never shared
- Letters visible only to generating specialist
- Patient data isolated by specialist
- Practice admins see only aggregate statistics

### 4.7 Offline Capabilities

#### FR-OFF-001: PWA Offline Mode
The system SHALL:
- Function as an installable Progressive Web App
- Queue audio recordings when offline
- Auto-sync when connection restored
- Display offline status indicator

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Requirement |
|--------|-------------|
| Transcription processing | < 0.5x audio duration |
| Letter generation time | < 30 seconds after transcription |
| UI response time | < 200ms for interactions |
| Background sync | < 5 minutes after reconnection |

### 5.2 Security

| Requirement | Specification |
|-------------|---------------|
| Data in transit | TLS 1.3 |
| Data at rest | AES-256 encryption |
| Authentication | MFA required |
| Session management | 30-minute inactivity timeout |
| Audit logging | All access events logged |

### 5.3 Privacy & Compliance

| Requirement | Specification |
|-------------|---------------|
| Data residency | Australian (AWS Sydney region) |
| Privacy Act compliance | APPs 1, 5, 6, 11, 12, 13 |
| Provider BAAs | Deepgram, AWS (covering Bedrock/Claude) |
| Audio retention | Deleted immediately after transcription |
| Document retention | 90 days default, configurable |
| Account deletion | GDPR-aligned immediate permanent removal |

### 5.4 Scalability

| Metric | MVP Target |
|--------|------------|
| Concurrent users | 50 |
| Letters per month | 5,000 |
| Storage per practice | 10GB |

### 5.5 Availability

| Metric | Target |
|--------|--------|
| Uptime | 99.5% |
| Planned maintenance | < 4 hours/month, off-peak |
| Recovery time objective | < 4 hours |

---

## 6. User Interface Requirements

### 6.1 Platform

**Web-First PWA Architecture**
- Responsive design (desktop, tablet)
- Hospital network compatible (no special ports)
- Offline capable with sync
- Chrome, Safari, Edge support

### 6.2 Key Screens

| Screen | Primary Functions |
|--------|-------------------|
| Dashboard | Recent letters, quick actions, notifications |
| New Recording | Mode selection, recording controls, quality indicator |
| Document Upload | Multi-file upload, document preview |
| Letter Review | Full editor with source panel, verification, approval |
| Letter History | Search, filter, export, status tracking |
| Settings | Profile, style preferences, practice config |

### 6.3 Accessibility

- WCAG 2.1 AA compliance target
- Keyboard navigation support
- Screen reader compatibility
- Sufficient color contrast

---

## 7. Integration Requirements

### 7.1 External Services (MVP)

| Service | Purpose | Integration Type |
|---------|---------|------------------|
| Deepgram Nova-3 Medical | Transcription | REST API |
| AWS Bedrock (Claude) | Letter generation | AWS SDK |
| Auth0 / Cognito | Authentication | OAuth 2.0 |
| AWS S3 | Document/audio storage | AWS SDK |

### 7.2 Cardiology-Specific Configuration

**Deepgram Keyterm Prompting (100 terms):**
- **Anatomy**: LAD, LCx, RCA, LMCA, D1, D2, OM1, OM2, PDA, PLV
- **Procedures**: TAVI, TEER, PCI, CABG, ICD, CRT-D, CRT-P, PPM
- **Measurements**: LVEF, RVEF, GLS, TAPSE, E/e', LVEDP
- **Conditions**: NSTEMI, STEMI, HFrEF, HFpEF, HFmrEF, AF, AFL
- **Devices**: DES, BMS, Watchman, Amulet, MitraClip, SAPIEN, Evolut
- **Medications**: Ticagrelor, Prasugrel, Apixaban, Rivaroxaban, Entresto

---

## 8. Success Metrics

### 8.1 Efficiency Metrics

| Metric | Baseline | MVP Target |
|--------|----------|------------|
| Letter generation time | 15-20 min | < 3 min review |
| Additional patients/session | 0 | +1 patient |
| After-hours documentation | 4-6 hrs/week | < 1 hr/week |
| Ambient mode adoption | N/A | > 60% |

### 8.2 Accuracy Metrics

| Metric | Target | Failure Threshold |
|--------|--------|-------------------|
| Critical errors | 0 | > 2 in pilot |
| Transcription WER | < 5% | > 10% |
| Hallucination rate | < 1% | > 5% |
| Value verification accuracy | > 98% | < 90% |
| Source traceability coverage | > 95% | < 80% |

### 8.3 Adoption Metrics

| Metric | Target | Failure Threshold |
|--------|--------|-------------------|
| Pilot retention (week 8) | > 80% | < 50% |
| Letters per active user/month | > 20 | < 10 |
| Style confidence improvement | +20% by week 4 | No improvement |
| Referral willingness | > 70% | < 40% |

---

## 9. MVP Scope Boundaries

### 9.1 In Scope (MVP)

**Core Workflow**
- Dual-mode audio capture (Ambient + Dictation)
- Speaker diarization for ambient mode
- Clinical document upload and extraction
- AI-assisted letter generation
- Physician review and approval workflow

**Accuracy & Safety**
- Source-anchored documentation
- High-impact value verification
- Hallucination detection
- PHI obfuscation pipeline
- Clinical concept extraction panel
- Provenance report generation

**Speed Features**
- Differential view
- Intelligent model selection
- Background processing with notifications
- Audio quality indicator

**Infrastructure**
- PWA with offline audio queue
- Multi-user practice support
- Patient consent tracking
- MFA authentication

**Letter Types**
- New patient consultation
- Follow-up consultation
- Angiogram/angioplasty procedure report
- Echocardiogram report letter

### 9.2 Out of Scope (Post-MVP)

- Additional letter types (TAVI, TEER, device implant)
- Voice-activated editing commands
- Medical ontology integration (SNOMED-CT)
- Direct EHR integration
- Billing code suggestions
- Patient-facing summaries
- Mobile native apps (iOS/Android)
- Real-time collaborative editing
- Integration with practice management systems

---

## 10. Assumptions & Dependencies

### 10.1 Assumptions

1. Pilot users have adequate internet connectivity in their practices
2. Physicians are willing to obtain patient consent for recording
3. Existing clinical reports are in readable PDF/image formats
4. AWS Bedrock with Claude access is available in Sydney region
5. Deepgram BAA covers Australian healthcare use
6. Physicians will provide sample letters for style learning

### 10.2 Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Deepgram availability | Low | Alternative: AssemblyAI |
| AWS Bedrock access | Low | Alternative: Direct Anthropic API |
| Claude model performance | Medium | Extensive prompt engineering |
| Pilot participant availability | Medium | 5 backup participants identified |

---

## 11. Pilot Plan Summary

| Aspect | Specification |
|--------|---------------|
| Duration | 8 weeks |
| Participants | 10 specialist cardiologists |
| Setting | Australian private practices |
| Data | Real patient data (with consent) |
| Ethics | Not required (operational improvement) |

### 11.1 Go/No-Go Criteria (Week 8)

**Proceed if:**
- 8+ users remain active (>80% retention)
- Average review time < 3 minutes
- Ambient mode > 60% of consultations
- Zero critical errors requiring letter recall
- NPS > 50
- > 70% would recommend to colleagues

**Stop if:**
- > 2 critical clinical errors requiring recall
- Average review time exceeds 5 minutes
- < 50% users active after week 4
- Hallucination detection flags > 5% of letters

---

## 12. Pricing Model

| Tier | Monthly (AUD) | Letters |
|------|---------------|---------|
| Starter | $99 | 50 |
| Professional | $199 | 150 |
| Unlimited | $349 | Unlimited |

**Multi-user discounts:** 10% (2-3), 15% (4-6), Custom (7+)

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Ambient Scribing | Recording of natural physician-patient conversation |
| Diarization | Speaker identification in multi-party audio |
| Hallucination | AI-fabricated content not supported by sources |
| LVEF | Left Ventricular Ejection Fraction |
| PHI | Protected Health Information |
| Provenance | Complete audit trail of document generation |
| PWA | Progressive Web App |
| Source Traceability | Linking generated text to original sources |
| WER | Word Error Rate (transcription accuracy) |

---

## Appendix A: Letter Type Specifications

### A.1 New Patient Consultation Letter

**Purpose:** Communicate findings and recommendations to referring physician after initial consultation

**Typical Sections:**
- Greeting and acknowledgment of referral
- Presenting complaint and history
- Relevant past medical history
- Current medications
- Physical examination findings
- Investigation results (with source citations)
- Impression/diagnosis
- Management plan
- Follow-up arrangements
- Closing

**Typical Length:** 400-600 words

### A.2 Follow-up Consultation Letter

**Purpose:** Update referring physician on patient progress

**Typical Sections:**
- Reference to previous consultations
- Interval history
- Current symptoms
- Relevant investigations
- Assessment
- Plan changes
- Next follow-up

**Typical Length:** 200-400 words

### A.3 Angiogram/Angioplasty Procedure Report

**Purpose:** Document procedural findings and interventions

**Typical Sections:**
- Procedure indication
- Consent and preparation
- Access and technique
- Coronary anatomy findings (per vessel)
- Intervention details (if PCI performed)
- Complications (or lack thereof)
- Closure method
- Post-procedure plan
- Medications prescribed

**Typical Length:** 300-500 words

### A.4 Echocardiogram Report Letter

**Purpose:** Summarize echo findings for referring physician

**Typical Sections:**
- Indication for study
- LV size and function (LVEF)
- RV assessment
- Valve assessment (each valve)
- Other findings
- Comparison to prior (if available)
- Conclusion

**Typical Length:** 200-350 words

---

*Document End*
