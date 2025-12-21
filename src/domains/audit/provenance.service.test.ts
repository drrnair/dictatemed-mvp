// src/domains/audit/provenance.service.test.ts
// Example tests for provenance service (for documentation purposes)

/**
 * EXAMPLE USAGE:
 *
 * 1. Generate provenance (usually called by approval service):
 *
 * const provenance = await generateProvenance(tx, {
 *   letter: letterRecord,
 *   user: userRecord,
 *   patient: patientRecord,
 *   recording: recordingRecord,
 *   documents: [doc1, doc2],
 *   verifiedValues: [...],
 *   dismissedFlags: [...],
 *   contentDiff: { additions: [], deletions: [], modifications: [] },
 *   reviewDurationMs: 180000,
 * });
 *
 * console.log('Provenance ID:', provenance.id);
 * console.log('Hash:', provenance.hash);
 *
 * 2. Retrieve provenance:
 *
 * const provenance = await getProvenance('letter-123');
 * console.log('Verified:', provenance.verified);
 * console.log('Data:', provenance.data);
 *
 * 3. Verify integrity:
 *
 * const isValid = await verifyProvenanceIntegrity('letter-123');
 * console.log('Tamper-free:', isValid);
 *
 * 4. Generate report:
 *
 * const provenance = await getProvenance('letter-123');
 * const report = formatProvenanceReport(provenance.data);
 * console.log(report);
 */

/**
 * API ENDPOINT USAGE:
 *
 * GET /api/letters/:id/provenance
 *
 * Response (JSON):
 * {
 *   "id": "prov-xyz",
 *   "data": {
 *     "letterId": "letter-abc",
 *     "generatedAt": "2025-12-21T10:00:00.000Z",
 *     "approvedAt": "2025-12-21T10:30:00.000Z",
 *     "primaryModel": "anthropic.claude-3-5-sonnet-20241022-v2:0",
 *     "sourceFiles": [...],
 *     "extractedValues": [...],
 *     "hallucinationChecks": [...],
 *     "reviewingPhysician": {
 *       "id": "user-123",
 *       "name": "Dr. Jane Smith",
 *       "email": "jane.smith@example.com"
 *     },
 *     "reviewDurationMs": 180000,
 *     "edits": [...],
 *     "contentDiff": {
 *       "original": "...",
 *       "final": "...",
 *       "percentChanged": 5.2
 *     }
 *   },
 *   "hash": "a3b2c1d4e5f6...",
 *   "verified": true,
 *   "createdAt": "2025-12-21T10:30:00.000Z"
 * }
 *
 * GET /api/letters/:id/provenance?format=text
 *
 * Response (Plain Text):
 * ================================================================================
 * LETTER PROVENANCE REPORT
 * ================================================================================
 *
 * Letter ID: letter-abc
 * Generated: 12/21/2025, 10:00:00 AM
 * Approved: 12/21/2025, 10:30:00 AM
 *
 * AI MODELS USED:
 *   Primary: anthropic.claude-3-5-sonnet-20241022-v2:0
 *   Input Tokens: 12,450
 *   Output Tokens: 1,234
 *   Generation Time: 8.50s
 *
 * SOURCE MATERIALS:
 *   - RECORDING: Recording from 2025-12-21T09:45:00.000Z
 *   - DOCUMENT: echo_report_2025.pdf
 *
 * CLINICAL VALUES EXTRACTED:
 *   Total: 8
 *   Verified: 8 (100.0%)
 *     [VERIFIED] LVEF: 45 %
 *     [VERIFIED] LAD stenosis: 70 %
 *     ...
 *
 * HALLUCINATION CHECKS:
 *   Total Flags: 2
 *   Critical: 0
 *   Dismissed: 2
 *   Hallucination Risk Score: 25/100
 *
 * REVIEW PROCESS:
 *   Physician: Dr. Jane Smith (jane.smith@example.com)
 *   Review Duration: 3.0 minutes
 *   Content Changed: 5.2%
 *   Edits Made: 12
 *
 * QUALITY METRICS:
 *   Verification Rate: 95.5%
 *   Hallucination Risk: 25/100
 *
 * ================================================================================
 * END OF REPORT
 * ================================================================================
 */

/**
 * PROVENANCE DATA STRUCTURE:
 *
 * The provenance record contains:
 * - Complete audit trail of letter generation
 * - All source materials used
 * - AI models and parameters
 * - Clinical values extracted and verification status
 * - Hallucination detection results
 * - Physician review process and timing
 * - Content changes made during review
 * - Cryptographic hash for tamper detection
 *
 * The hash is calculated using SHA-256 over the entire provenance JSON,
 * ensuring any modification can be detected.
 */

export {};
