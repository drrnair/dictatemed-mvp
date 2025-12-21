# Letter Approval Workflow & Provenance System

This implementation provides a complete approval workflow and cryptographic provenance tracking system for DictateMED's AI-generated clinical letters.

## Overview

When a cardiologist approves a letter, the system:
1. Validates all critical clinical values are verified
2. Checks that critical hallucination flags are addressed
3. Calculates content differences between draft and final
4. Generates a cryptographic provenance record
5. Creates an immutable audit trail
6. Updates letter status to APPROVED

## Architecture

### Components Created

1. **Approval Service** (`src/domains/letters/approval.service.ts`)
   - Validates approval requirements
   - Manages the approval workflow
   - Calculates content diffs
   - Orchestrates provenance generation

2. **Provenance Service** (`src/domains/audit/provenance.service.ts`)
   - Generates cryptographic provenance records
   - Creates SHA-256 hashes for tamper detection
   - Formats human-readable reports
   - Verifies provenance integrity

3. **API Routes**
   - `POST /api/letters/[id]/approve` - Approve letter with full workflow
   - `GET /api/letters/[id]/provenance` - Retrieve provenance record

## Approval Workflow

### Step 1: Validation

Before approval, the system validates:

```typescript
const validation = await validateApprovalRequirements(letterId);

// Checks:
// - All critical clinical values (measurements, diagnoses) are verified
// - All critical hallucination flags are dismissed
// - Letter is in reviewable state (DRAFT or IN_REVIEW)
```

**Errors** (block approval):
- Critical values not verified
- Critical hallucination flags not addressed
- Letter in wrong status

**Warnings** (allow approval but log):
- Non-critical flags remain
- Verification rate < 80%
- Hallucination risk score > 70

### Step 2: Content Diff Calculation

```typescript
const diff = calculateContentDiff(draftContent, finalContent);

// Returns:
// {
//   additions: TextChange[]      // New text added
//   deletions: TextChange[]      // Text removed
//   modifications: TextChange[]  // Text changed
// }
```

### Step 3: Database Transaction

All operations are performed atomically:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Update clinical values (mark verified)
  // 2. Update hallucination flags (mark dismissed)
  // 3. Calculate content diff
  // 4. Update letter status to APPROVED
  // 5. Generate provenance record
  // 6. Create audit log entry
});
```

### Step 4: Provenance Generation

Creates a comprehensive audit trail including:
- Source materials (recordings, documents)
- AI models used (primary, critic)
- Clinical values extracted and verification status
- Hallucination detection results
- Physician review process
- Content changes made
- Cryptographic hash (SHA-256)

## Provenance Record Structure

```typescript
interface ProvenanceData {
  letterId: string;
  generatedAt: string;
  approvedAt: string;

  // AI Models
  primaryModel: string;
  criticModel: string | null;
  inputTokens: number;
  outputTokens: number;
  generationDurationMs: number;

  // Sources
  sourceFiles: Array<{
    id: string;
    type: 'recording' | 'document';
    name: string;
    createdAt: string;
  }>;

  // Clinical Safety
  extractedValues: Array<{
    id: string;
    name: string;
    value: string;
    unit?: string;
    verified: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
  }>;

  hallucinationChecks: Array<{
    id: string;
    flaggedText: string;
    severity: string;
    reason: string;
    dismissed: boolean;
    dismissedReason?: string;
  }>;

  // Review Process
  reviewingPhysician: {
    id: string;
    name: string;
    email: string;
  };

  reviewDurationMs: number;

  // Content Changes
  edits: Array<{
    type: 'addition' | 'deletion' | 'modification';
    index: number;
    originalText?: string;
    newText?: string;
    timestamp: string;
  }>;

  contentDiff: {
    original: string;
    final: string;
    percentChanged: number;
  };

  // Quality Metrics
  verificationRate: number;
  hallucinationRiskScore: number;
}
```

## API Usage

### Approve a Letter

```bash
POST /api/letters/:id/approve
Content-Type: application/json

{
  "finalContent": "Dear Dr. Smith,\n\nThank you for referring...",
  "verifiedValueIds": ["val-123", "val-456", "val-789"],
  "dismissedFlagIds": ["flag-abc"],
  "reviewDurationMs": 180000
}
```

**Success Response:**
```json
{
  "letterId": "letter-123",
  "status": "APPROVED",
  "approvedAt": "2025-12-21T10:30:00.000Z",
  "provenanceId": "prov-xyz"
}
```

**Validation Error Response:**
```json
{
  "error": "Letter does not meet approval requirements",
  "code": 2001,
  "details": {
    "errors": [
      "2 critical clinical values not verified: LVEF, LAD stenosis"
    ],
    "warnings": [
      "Low verification rate: 65.0% (recommended: >80%)"
    ]
  }
}
```

### Retrieve Provenance

**JSON Format:**
```bash
GET /api/letters/:id/provenance
```

**Text Report:**
```bash
GET /api/letters/:id/provenance?format=text
```

Returns a human-readable provenance report suitable for printing or regulatory submission.

## Security Features

### Cryptographic Integrity

1. **Hash Calculation**: SHA-256 hash computed over entire provenance JSON
2. **Tamper Detection**: Hash verified on retrieval to detect modifications
3. **Immutability**: Provenance records cannot be updated after creation

```typescript
const hash = calculateProvenanceHash(provenanceData);
// Hash: "a3b2c1d4e5f6789..." (64-character hex string)

// On retrieval:
const provenance = await getProvenance(letterId);
console.log('Verified:', provenance.verified); // true if hash matches
```

### Audit Trail

Every approval creates:
1. Audit log entry with metadata
2. Provenance record with full context
3. Updated letter with final content
4. Immutable database records

## Error Handling

The system uses structured error types:

```typescript
// Validation errors (400)
throw new ValidationError('Letter does not meet approval requirements', {
  errors: [...],
  warnings: [...]
});

// Authorization errors (401/403)
throw new AppError(ErrorCode.FORBIDDEN, 'Cannot approve another user\'s letter');

// Not found errors (404)
throw new AppError(ErrorCode.VALIDATION_ERROR, 'Letter not found');
```

## Testing Examples

See:
- `src/domains/letters/approval.service.test.ts`
- `src/domains/audit/provenance.service.test.ts`

## Database Schema

The implementation uses existing Prisma models:

```prisma
model Letter {
  // ... existing fields ...
  contentFinal     String? @db.Text
  contentDiff      Json?
  verifiedValues   Json?
  approvedAt       DateTime?
  approvedBy       String?
  reviewDurationMs Int?

  provenance Provenance?
}

model Provenance {
  id       String @id @default(uuid())
  letterId String @unique
  letter   Letter @relation(fields: [letterId], references: [id])

  data Json    // Complete provenance data
  hash String  // SHA-256 hash for integrity

  createdAt DateTime @default(now())
}

model AuditLog {
  // ... tracks all approval actions ...
}
```

## Integration Points

The approval service integrates with:

1. **Letter Service** - Retrieves letter data
2. **User Service** - Gets physician information
3. **Patient Service** - Includes patient (encrypted)
4. **Recording Service** - Links source recordings
5. **Document Service** - Links source documents
6. **Audit Service** - Creates audit logs

## Regulatory Compliance

The provenance system supports:

1. **TGA/PBS Requirements** - Complete audit trail
2. **Medical Record Standards** - Source attribution
3. **AI Transparency** - Model parameters and sources
4. **Clinical Governance** - Physician review verification
5. **Data Integrity** - Cryptographic tamper detection

## Performance Considerations

1. **Transaction Atomicity** - All operations in single transaction
2. **Hash Calculation** - O(n) where n = JSON size (~10-50KB typical)
3. **Database Writes** - 3-4 writes per approval (Letter, Provenance, AuditLog)
4. **Response Time** - Target < 500ms for approval workflow

## Future Enhancements

Potential improvements:
1. Digital signatures (physician's private key)
2. Blockchain anchoring for additional immutability
3. Multi-signature approval for high-risk cases
4. Automated compliance report generation
5. Real-time integrity monitoring

## Files Created

1. `/src/domains/letters/approval.service.ts` - Approval workflow (446 lines)
2. `/src/domains/audit/provenance.service.ts` - Provenance generation (492 lines)
3. `/src/app/api/letters/[id]/approve/route.ts` - Updated approval endpoint
4. `/src/app/api/letters/[id]/provenance/route.ts` - Provenance retrieval API
5. `/src/domains/audit/index.ts` - Export barrel
6. `/src/domains/letters/index.ts` - Export barrel

Total: ~1,500 lines of production code + tests + documentation
