# Letter Approval Workflow - Visual Guide

## Complete Workflow Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHYSICIAN REVIEWS LETTER                      │
│  - Verifies clinical values (LVEF, stenosis, medications, etc.) │
│  - Dismisses hallucination flags (or resolves them)             │
│  - Edits letter content as needed                                │
│  - Tracks review duration (client-side timer)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              POST /api/letters/:id/approve                       │
│  Request Body:                                                   │
│  {                                                               │
│    finalContent: "Dear Dr. Smith...",                            │
│    verifiedValueIds: ["val-1", "val-2"],                         │
│    dismissedFlagIds: ["flag-1"],                                 │
│    reviewDurationMs: 180000                                      │
│  }                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           APPROVAL SERVICE: validateApprovalRequirements()       │
│                                                                  │
│  ✓ Check all critical values verified                           │
│  ✓ Check critical hallucination flags dismissed                 │
│  ✓ Check letter status is valid                                 │
│  ✓ Calculate verification rate                                  │
│  ✓ Check hallucination risk score                               │
│                                                                  │
│  If validation fails → Return 400 with errors                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BEGIN DATABASE TRANSACTION                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Fetch letter with related data (user, patient, recording)   │
│     - Lock row for update                                        │
│     - Verify ownership                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Update clinical values                                       │
│     - Mark verified values with timestamp                        │
│     - Set verifiedBy = userId                                    │
│     - Set verifiedAt = now()                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Update hallucination flags                                   │
│     - Mark dismissed flags                                       │
│     - Set dismissedBy = userId                                   │
│     - Set dismissedAt = now()                                    │
│     - Set dismissReason = "Reviewed and dismissed by physician"  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Calculate content diff                                       │
│     - Compare draft vs final (line-by-line)                      │
│     - Track additions, deletions, modifications                  │
│     - Set userId and timestamp on each change                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Update Letter record                                         │
│     - status = 'APPROVED'                                        │
│     - contentFinal = finalContent                                │
│     - contentDiff = diff                                         │
│     - extractedValues = updatedValues                            │
│     - hallucinationFlags = updatedFlags                          │
│     - verifiedValues = verified subset                           │
│     - approvedAt = now()                                         │
│     - approvedBy = userId                                        │
│     - reviewDurationMs = calculated                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                PROVENANCE SERVICE: generateProvenance()          │
│                                                                  │
│  Build provenance data:                                          │
│  ├─ Source files (recordings, documents)                         │
│  ├─ AI models used (primary, critic)                             │
│  ├─ Extracted values + verification status                       │
│  ├─ Hallucination checks + dismissal info                        │
│  ├─ Reviewing physician info                                     │
│  ├─ Review duration and timing                                   │
│  ├─ Content edits made                                           │
│  ├─ Content diff summary                                         │
│  └─ Quality metrics                                              │
│                                                                  │
│  Calculate SHA-256 hash:                                         │
│  - Serialize provenance JSON (sorted keys)                       │
│  - Hash = sha256(json)                                           │
│                                                                  │
│  Create Provenance record:                                       │
│  - data = provenanceData (JSONB)                                 │
│  - hash = calculated hash                                        │
│  - letterId = letter.id                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Create audit log entry                                       │
│     - action = 'letter.approve'                                  │
│     - resourceType = 'letter'                                    │
│     - resourceId = letterId                                      │
│     - metadata = {                                               │
│         letterType,                                              │
│         reviewDurationMs,                                        │
│         verifiedValuesCount,                                     │
│         dismissedFlagsCount,                                     │
│         contentChanges: { additions, deletions, modifications }, │
│         provenanceId,                                            │
│         provenanceHash                                           │
│       }                                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COMMIT TRANSACTION                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RETURN SUCCESS RESPONSE                       │
│  {                                                               │
│    letterId: "letter-123",                                       │
│    status: "APPROVED",                                           │
│    approvedAt: "2025-12-21T10:30:00.000Z",                       │
│    provenanceId: "prov-xyz"                                      │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      VALIDATION ERRORS                           │
│                                                                  │
│  ✗ Critical values not verified                                 │
│  ✗ Critical flags not dismissed                                 │
│  ✗ Letter already approved                                      │
│  ✗ Letter in wrong status (GENERATING, FAILED)                  │
│                                                                  │
│  → Return 400 with ValidationError                              │
│  {                                                               │
│    error: "Letter does not meet approval requirements",         │
│    code: 2001,                                                   │
│    details: {                                                    │
│      errors: [...],                                              │
│      warnings: [...]                                             │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    AUTHORIZATION ERRORS                          │
│                                                                  │
│  ✗ User not authenticated                                       │
│  ✗ Letter belongs to different user                             │
│                                                                  │
│  → Return 401/403 with AppError                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      NOT FOUND ERRORS                            │
│                                                                  │
│  ✗ Letter not found                                             │
│  ✗ Provenance not found (when retrieving)                       │
│                                                                  │
│  → Return 404                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Provenance Verification Flow

```
GET /api/letters/:id/provenance
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Verify user owns letter                                      │
│  2. Check letter is approved                                     │
│  3. Retrieve provenance record from database                     │
│  4. Extract stored hash                                          │
│  5. Recalculate hash from data                                   │
│  6. Compare hashes:                                              │
│     - Match: verified = true (no tampering)                      │
│     - Mismatch: verified = false (data modified!)               │
│  7. Return provenance + verification status                      │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
     Format = text?
          │
    ┌─────┴─────┐
    │           │
   Yes         No
    │           │
    ▼           ▼
┌───────┐  ┌────────┐
│ Plain │  │  JSON  │
│ Text  │  │ Object │
│Report │  │        │
└───────┘  └────────┘
```

## Data Flow Summary

```
┌──────────────┐
│   Physician  │  Verifies values, dismisses flags, edits content
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  API Route   │  Validates input, checks auth & rate limits
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Approval   │  Validates requirements, calculates diff
│   Service    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Provenance  │  Generates audit trail, calculates hash
│   Service    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Database   │  Letter, Provenance, AuditLog (atomic)
└──────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Authentication (Auth0 JWT)                             │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Authorization (User owns letter)                       │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Rate Limiting (30 approvals/min)                       │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Validation (Critical values verified)                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: Transaction Atomicity (All-or-nothing)                 │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Layer 6: Cryptographic Hash (Tamper detection)                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Layer 7: Audit Logging (Complete trail)                         │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Characteristics

| Operation | Complexity | Typical Time |
|-----------|-----------|--------------|
| Validation | O(n) values + O(m) flags | < 10ms |
| Content Diff | O(n) lines | < 50ms |
| Provenance Generation | O(1) | < 100ms |
| Hash Calculation | O(n) JSON size | < 10ms |
| Database Transaction | O(1) writes | < 300ms |
| **Total Approval** | | **< 500ms** |

## Database Writes Per Approval

```
1. UPDATE Letter (status, content, values, flags)
2. INSERT Provenance (data, hash)
3. INSERT AuditLog (action metadata)
```

**Total: 3 writes in single transaction**
