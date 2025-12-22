# DictateMED Roadmap

**Last Updated:** 2025-12-22

---

## MVP

Core features required for a functional medical dictation and letter generation system.

### Done

- **Record page** - Ambient + dictation + file upload modes
- **Transcription** - Deepgram medical model with speaker diarization
- **Letter generation** - AWS Bedrock (Claude) with multi-source context
- **Hallucination detection** - AI critic model with severity levels
- **Source anchoring** - Transcript and document linking for verification
- **Clinical extraction** - LVEF, stenosis, medications parsing
- **Verification panel** - Clinical value verification UI
- **Letter workflow** - Draft → Review → Approved states
- **Patient management** - CRUD with AES-256-GCM encryption for PHI
- **Template system** - 7 subspecialties with favorites and recommendations
- **Style learning** - Edit tracking and style inference
- **Document processing** - Upload, OCR, extraction pipeline
- **Consultation context** - Multi-material bundling for letter generation
- **Notifications** - 5 notification types
- **Offline support** - PWA with IndexedDB sync
- **Authentication** - Auth0 session management
- **Multi-tenant** - Practice-based data isolation

### In Progress

| Branch | Feature | Status |
|--------|---------|--------|
| `record-page-clinical-context-red-a581` | Record page & clinical context redesign | Active |
| `record-page-and-clinical-context-9f4c` | Context workflow improvements | Active |
| `project-status-feature-audit-c74b` | Documentation & status audit | Active |

### Not Started

*All MVP features complete*

---

## v1.1

Enhancements and quality improvements for production readiness.

### Done

*None*

### In Progress

*None*

### Not Started

- **Test coverage expansion** - Target 70%+ coverage (current: <10%)
- **API documentation** - OpenAPI/Swagger specs
- **Error tracking** - Sentry or DataDog integration
- **Performance monitoring** - APM metrics and dashboards
- **CI/CD pipeline** - Automated testing and deployments
- **Rate limiting** - Production-ready Redis-based limiter
- **HIPAA compliance documentation** - Formal compliance checklist

---

## Backlog

Future features and improvements.

### Done

*None*

### In Progress

*None*

### Not Started

- **Batch letter generation** - Generate multiple letters at once
- **Template versioning** - Track template changes over time
- **Change history UI** - Visual diff for letter revisions
- **Usage analytics** - Business intelligence dashboard
- **Fax integration** - Send letters via fax
- **EHR integration** - Connect to hospital systems
- **Voice commands** - Hands-free recording control
- **Mobile app** - Native iOS/Android apps
- **Team collaboration** - Multi-user letter review workflow
- **Audit reporting** - Compliance and usage reports

---

## Branch Status

| Branch | Purpose | Last Activity |
|--------|---------|---------------|
| `main` | Production | Active |
| `dictatemed-mvp-ed61` | MVP development | Merged |
| `record-page-clinical-context-red-a581` | UI redesign | Active |
| `record-page-and-clinical-context-9f4c` | Context workflow | Active |
| `project-status-feature-audit-c74b` | Documentation | Active |

---

*See [docs/status/STATUS-20251222.md](status/STATUS-20251222.md) for detailed feature inventory.*
