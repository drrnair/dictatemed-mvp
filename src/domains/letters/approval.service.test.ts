// src/domains/letters/approval.service.test.ts
// Example tests for approval service (for documentation purposes)

/**
 * EXAMPLE USAGE:
 *
 * 1. Validate approval requirements:
 *
 * const validation = await validateApprovalRequirements(letterId);
 * if (!validation.isValid) {
 *   console.error('Cannot approve:', validation.errors);
 * }
 *
 * 2. Get approval status (for UI):
 *
 * const status = await getApprovalStatus(letterId);
 * console.log('Can approve:', status.canApprove);
 * console.log('Requirements:', status.requirements);
 *
 * 3. Approve a letter:
 *
 * const result = await approveLetter({
 *   letterId: 'letter-123',
 *   userId: 'user-456',
 *   reviewDurationMs: 180000, // 3 minutes
 *   verifiedValueIds: ['value-1', 'value-2'],
 *   dismissedFlagIds: ['flag-1'],
 *   finalContent: 'Final letter content after edits...',
 * });
 *
 * console.log('Approved:', result.letterId);
 * console.log('Provenance ID:', result.provenanceId);
 *
 * 4. Calculate content diff:
 *
 * const diff = calculateContentDiff(
 *   'Original draft content',
 *   'Final approved content'
 * );
 *
 * console.log('Additions:', diff.additions.length);
 * console.log('Deletions:', diff.deletions.length);
 * console.log('Modifications:', diff.modifications.length);
 */

/**
 * API ENDPOINT USAGE:
 *
 * POST /api/letters/:id/approve
 *
 * Request:
 * {
 *   "finalContent": "Dear Dr. Smith,\n\n...",
 *   "verifiedValueIds": ["val-123", "val-456"],
 *   "dismissedFlagIds": ["flag-789"],
 *   "reviewDurationMs": 180000
 * }
 *
 * Response:
 * {
 *   "letterId": "letter-abc",
 *   "status": "APPROVED",
 *   "approvedAt": "2025-12-21T10:30:00.000Z",
 *   "provenanceId": "prov-xyz"
 * }
 *
 * Error Response (validation failed):
 * {
 *   "error": "Letter does not meet approval requirements",
 *   "code": 2001,
 *   "details": {
 *     "errors": [
 *       "2 critical clinical values not verified: LVEF, LAD stenosis"
 *     ],
 *     "warnings": [
 *       "Low verification rate: 65.0% (recommended: >80%)"
 *     ]
 *   }
 * }
 */

export {};
