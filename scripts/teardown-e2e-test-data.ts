// scripts/teardown-e2e-test-data.ts
// E2E Test Data Cleanup Script
//
// Removes all test data created by seed-e2e-test-data.ts.
// Uses transaction for atomicity - either all data is removed or none.
//
// Deletion order respects foreign key constraints:
// 1. Audit logs, Notifications, Style data
// 2. Letters, Recordings, Documents
// 3. Consultations, Patient Contacts
// 4. Patients, Referrers
// 5. Users
// 6. Practice
//
// Usage: npm run db:teardown:e2e

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// E2E test data identifiers (same as in seed script)
const TEST_IDS = {
  practice: 'e2e00000-0000-0000-0000-000000000001',
  clinician: 'e2e00000-0000-0000-0000-000000000010',
  patientHF: 'e2e00000-0000-0000-0000-000000000100',
  patientPCI: 'e2e00000-0000-0000-0000-000000000101',
  referrerGP: 'e2e00000-0000-0000-0000-000000000200',
  referrerCardiologist: 'e2e00000-0000-0000-0000-000000000201',
  contactGP1: 'e2e00000-0000-0000-0000-000000000300',
  contactGP2: 'e2e00000-0000-0000-0000-000000000301',
  styleProfile: 'e2e00000-0000-0000-0000-000000000400',
  consultation1: 'e2e00000-0000-0000-0000-000000000500',
  consultation2: 'e2e00000-0000-0000-0000-000000000501',
} as const;

// All test IDs for bulk deletion
const ALL_TEST_IDS = Object.values(TEST_IDS);
const TEST_PATIENT_IDS = [TEST_IDS.patientHF, TEST_IDS.patientPCI];
const TEST_REFERRER_IDS = [TEST_IDS.referrerGP, TEST_IDS.referrerCardiologist];
const TEST_CONTACT_IDS = [TEST_IDS.contactGP1, TEST_IDS.contactGP2];
const TEST_CONSULTATION_IDS = [TEST_IDS.consultation1, TEST_IDS.consultation2];

interface TeardownResult {
  success: boolean;
  deletedCounts: Record<string, number>;
  duration: number;
  errors: string[];
}

async function teardownE2ETestData(): Promise<TeardownResult> {
  const startTime = Date.now();
  console.log('🧹 Tearing down E2E test data...\n');

  const deletedCounts: Record<string, number> = {};
  const errors: string[] = [];

  try {
    // Increased timeout for CI environments where database operations may be slower
    await prisma.$transaction(
      async (tx) => {
        // 1. Delete audit logs for test user
      console.log('  Deleting audit logs...');
      const auditResult = await tx.auditLog.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.auditLogs = auditResult.count;

      // 2. Delete notifications for test user
      console.log('  Deleting notifications...');
      const notificationResult = await tx.notification.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.notifications = notificationResult.count;

      // 3. Delete style data
      console.log('  Deleting style data...');
      const styleEditResult = await tx.styleEdit.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.styleEdits = styleEditResult.count;

      const styleProfileResult = await tx.styleProfile.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.styleProfiles = styleProfileResult.count;

      const styleSeedResult = await tx.styleSeedLetter.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.styleSeedLetters = styleSeedResult.count;

      // 4. Delete sent emails and letter sends
      console.log('  Deleting sent emails and letter sends...');
      const sentEmailResult = await tx.sentEmail.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.sentEmails = sentEmailResult.count;

      const letterSendResult = await tx.letterSend.deleteMany({
        where: { senderId: TEST_IDS.clinician },
      });
      deletedCounts.letterSends = letterSendResult.count;

      // 5. Delete letter documents and provenance (via cascade from letters)
      // Delete letters first
      console.log('  Deleting letters...');
      const letterResult = await tx.letter.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.letters = letterResult.count;

      // 6. Delete recordings
      console.log('  Deleting recordings...');
      const recordingResult = await tx.recording.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.recordings = recordingResult.count;

      // 7. Delete documents
      console.log('  Deleting documents...');
      const documentResult = await tx.document.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.documents = documentResult.count;

      // 8. Delete referral documents
      console.log('  Deleting referral documents...');
      const referralDocResult = await tx.referralDocument.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.referralDocuments = referralDocResult.count;

      // 9. Delete CC recipients (via cascade from consultations)
      console.log('  Deleting CC recipients...');
      const ccResult = await tx.cCRecipient.deleteMany({
        where: { consultationId: { in: TEST_CONSULTATION_IDS } },
      });
      deletedCounts.ccRecipients = ccResult.count;

      // 10. Delete consultations
      console.log('  Deleting consultations...');
      const consultationResult = await tx.consultation.deleteMany({
        where: { id: { in: TEST_CONSULTATION_IDS } },
      });
      deletedCounts.consultations = consultationResult.count;

      // 11. Delete patient contacts
      console.log('  Deleting patient contacts...');
      const contactResult = await tx.patientContact.deleteMany({
        where: { id: { in: TEST_CONTACT_IDS } },
      });
      deletedCounts.patientContacts = contactResult.count;

      // 12. Delete patients
      console.log('  Deleting patients...');
      const patientResult = await tx.patient.deleteMany({
        where: { id: { in: TEST_PATIENT_IDS } },
      });
      deletedCounts.patients = patientResult.count;

      // 13. Delete referrers
      console.log('  Deleting referrers...');
      const referrerResult = await tx.referrer.deleteMany({
        where: { id: { in: TEST_REFERRER_IDS } },
      });
      deletedCounts.referrers = referrerResult.count;

      // 14. Delete user template preferences
      console.log('  Deleting user template preferences...');
      const templatePrefResult = await tx.userTemplatePreference.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.templatePreferences = templatePrefResult.count;

      // 15. Delete clinician specialties/subspecialties
      console.log('  Deleting clinician specialties...');
      const clinicianSpecResult = await tx.clinicianSpecialty.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.clinicianSpecialties = clinicianSpecResult.count;

      const clinicianSubspecResult = await tx.clinicianSubspecialty.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.clinicianSubspecialties = clinicianSubspecResult.count;

      // 16. Delete custom specialty requests
      console.log('  Deleting custom specialty requests...');
      const customSubspecResult = await tx.customSubspecialty.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.customSubspecialties = customSubspecResult.count;

      const customSpecResult = await tx.customSpecialty.deleteMany({
        where: { userId: TEST_IDS.clinician },
      });
      deletedCounts.customSpecialties = customSpecResult.count;

      // 17. Delete test clinician
      console.log('  Deleting test clinician...');
      const userResult = await tx.user.deleteMany({
        where: { id: TEST_IDS.clinician },
      });
      deletedCounts.users = userResult.count;

      // 18. Delete test practice
      console.log('  Deleting test practice...');
      const practiceResult = await tx.practice.deleteMany({
        where: { id: TEST_IDS.practice },
      });
      deletedCounts.practices = practiceResult.count;
      },
      {
        maxWait: 30000, // 30 seconds max wait to acquire connection
        timeout: 30000, // 30 seconds transaction timeout
      }
    );

    const duration = Date.now() - startTime;
    console.log(`\n✅ E2E test data teardown completed in ${duration}ms`);

    // Print summary of deleted records
    const totalDeleted = Object.values(deletedCounts).reduce((a, b) => a + b, 0);
    if (totalDeleted > 0) {
      console.log('\nDeleted records:');
      for (const [entity, count] of Object.entries(deletedCounts)) {
        if (count > 0) {
          console.log(`  • ${entity}: ${count}`);
        }
      }
    } else {
      console.log('\n  No E2E test data found to delete.');
    }

    return {
      success: true,
      deletedCounts,
      duration,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);
    console.error('❌ Teardown failed:', errorMessage);

    return {
      success: false,
      deletedCounts,
      duration: Date.now() - startTime,
      errors,
    };
  }
}

// Additional utility: Clean up any orphaned E2E data by pattern matching
async function cleanupOrphanedE2EData(): Promise<void> {
  console.log('\n🔍 Checking for orphaned E2E data...');

  // Find any data with e2e pattern in IDs that wasn't deleted by the main cleanup
  const orphanedPatients = await prisma.patient.findMany({
    where: {
      id: { startsWith: 'e2e' },
    },
    select: { id: true },
  });

  const orphanedUsers = await prisma.user.findMany({
    where: {
      OR: [
        { id: { startsWith: 'e2e' } },
        { email: { contains: '+e2e@' } },
        { auth0Id: { contains: 'e2e-test' } },
      ],
    },
    select: { id: true, email: true },
  });

  const orphanedPractices = await prisma.practice.findMany({
    where: {
      OR: [
        { id: { startsWith: 'e2e' } },
        { name: { contains: 'TEST-PRACTICE-E2E' } },
      ],
    },
    select: { id: true, name: true },
  });

  if (orphanedPatients.length > 0) {
    console.log(`  Found ${orphanedPatients.length} orphaned test patients`);
  }
  if (orphanedUsers.length > 0) {
    console.log(`  Found ${orphanedUsers.length} orphaned test users`);
  }
  if (orphanedPractices.length > 0) {
    console.log(`  Found ${orphanedPractices.length} orphaned test practices`);
  }

  if (orphanedPatients.length === 0 && orphanedUsers.length === 0 && orphanedPractices.length === 0) {
    console.log('  No orphaned E2E data found.');
  }
}

// Export for programmatic use
export { teardownE2ETestData, cleanupOrphanedE2EData, TEST_IDS };

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const checkOrphans = args.includes('--check-orphans');

  teardownE2ETestData()
    .then(async (result) => {
      if (checkOrphans) {
        await cleanupOrphanedE2EData();
      }

      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Teardown error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
