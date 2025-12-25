// scripts/seed-e2e-test-data.ts
// E2E Test Data Seeding Script
//
// Creates test data for automated E2E tests with the following entities:
// - 1 test practice (TEST-PRACTICE-E2E)
// - 1 test clinician (test.cardiologist+e2e@dictatemed.dev)
// - 2 test patients (MRN: TEST-HF-001, TEST-PCI-002)
// - 2 test GP/referrer contacts
// - Required medical specialties (Cardiology + subspecialties)
//
// All test data uses TEST- prefix identifiers for easy identification and cleanup.
// Optimized for performance (<3 seconds) using bulk inserts.
//
// Usage: npm run db:seed:e2e

import { PrismaClient, Subspecialty, LetterType, ConsultationStatus } from '@prisma/client';
import { encryptPatientData } from '../src/infrastructure/db/encryption';

const prisma = new PrismaClient();

// Fixed UUIDs for reproducible E2E test data (easily identifiable with E2E pattern)
const TEST_IDS = {
  practice: 'e2e00000-0000-0000-0000-000000000001',
  clinician: 'e2e00000-0000-0000-0000-000000000010',
  patientHF: 'e2e00000-0000-0000-0000-000000000100', // Heart Failure patient
  patientPCI: 'e2e00000-0000-0000-0000-000000000101', // PCI patient
  referrerGP: 'e2e00000-0000-0000-0000-000000000200',
  referrerCardiologist: 'e2e00000-0000-0000-0000-000000000201',
  contactGP1: 'e2e00000-0000-0000-0000-000000000300',
  contactGP2: 'e2e00000-0000-0000-0000-000000000301',
  styleProfile: 'e2e00000-0000-0000-0000-000000000400',
  consultation1: 'e2e00000-0000-0000-0000-000000000500',
  consultation2: 'e2e00000-0000-0000-0000-000000000501',
} as const;

// Test patient data with TEST- prefix for PHI compliance
// NOTE: The API returns medicareNumber as the 'mrn' field in search results.
// So we use the MRN value as medicareNumber to enable searching by MRN.
const TEST_PATIENTS = [
  {
    id: TEST_IDS.patientHF,
    name: 'TEST Patient - Heart Failure',
    dateOfBirth: '1958-06-15',
    // Using MRN as medicareNumber since API returns medicareNumber as 'mrn'
    medicareNumber: 'TEST-HF-001',
    address: 'TEST Address - 100 George Street, Sydney NSW 2000',
    phone: '+61 400 000 001',
    email: 'test.patient.hf@test.dictatemed.dev',
  },
  {
    id: TEST_IDS.patientPCI,
    name: 'TEST Patient - PCI Intervention',
    dateOfBirth: '1965-11-22',
    // Using MRN as medicareNumber since API returns medicareNumber as 'mrn'
    medicareNumber: 'TEST-PCI-002',
    address: 'TEST Address - 200 Pitt Street, Sydney NSW 2000',
    phone: '+61 400 000 002',
    email: 'test.patient.pci@test.dictatemed.dev',
  },
];

// Test referrers (GPs and specialists)
const TEST_REFERRERS = [
  {
    id: TEST_IDS.referrerGP,
    name: 'Dr. TEST GP Smith',
    practiceName: 'TEST Sydney Medical Centre',
    email: 'test.gp.smith@test.dictatemed.dev',
    phone: '+61 2 9000 0001',
    fax: '+61 2 9000 0002',
    address: 'TEST Address - 50 Martin Place, Sydney NSW 2000',
  },
  {
    id: TEST_IDS.referrerCardiologist,
    name: 'Dr. TEST Cardiologist Jones',
    practiceName: 'TEST Heart Specialists',
    email: 'test.cardiologist.jones@test.dictatemed.dev',
    phone: '+61 2 9000 0003',
    fax: '+61 2 9000 0004',
    address: 'TEST Address - 123 Macquarie Street, Sydney NSW 2000',
  },
];

async function seedE2ETestData(): Promise<void> {
  const startTime = Date.now();
  console.log('🧪 Seeding E2E test data...\n');

  // Validate encryption key is available
  if (!process.env.PHI_ENCRYPTION_KEY) {
    throw new Error(
      'PHI_ENCRYPTION_KEY environment variable is required.\n' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  // Use transaction for atomicity (increased timeout for CI environments)
  await prisma.$transaction(
    async (tx) => {
      // 1. Create test practice
    console.log('  Creating test practice...');
    await tx.practice.upsert({
      where: { id: TEST_IDS.practice },
      update: {},
      create: {
        id: TEST_IDS.practice,
        name: 'TEST-PRACTICE-E2E Sydney Heart Specialists',
        settings: {
          timezone: 'Australia/Sydney',
          letterheadEnabled: true,
          isTestPractice: true,
        },
      },
    });

    // 2. Create test clinician
    console.log('  Creating test clinician...');
    await tx.user.upsert({
      where: { id: TEST_IDS.clinician },
      update: {},
      create: {
        id: TEST_IDS.clinician,
        auth0Id: 'auth0|e2e-test-clinician',
        email: 'test.cardiologist+e2e@dictatemed.dev',
        name: 'Dr. TEST E2E Cardiologist',
        role: 'SPECIALIST',
        clinicianRole: 'MEDICAL',
        practiceId: TEST_IDS.practice,
        subspecialties: ['HEART_FAILURE', 'INTERVENTIONAL'],
        styleProfile: {
          formality: 'formal',
          verbosity: 'concise',
          letterCount: 0,
          isTestProfile: true,
        },
        settings: {
          preferredMode: 'DICTATION',
          notificationsEnabled: true,
          isTestUser: true,
        },
      },
    });

    // 3. Create test patients (bulk insert with encrypted PHI)
    console.log('  Creating test patients...');
    for (const patientData of TEST_PATIENTS) {
      const { id, ...phi } = patientData;
      // medicareNumber is used as MRN - the API returns it as 'mrn' in search results
      const encryptedData = encryptPatientData(phi);

      await tx.patient.upsert({
        where: { id },
        update: {},
        create: {
          id,
          encryptedData,
          practiceId: TEST_IDS.practice,
        },
      });
    }

    // 4. Create test referrers (bulk)
    console.log('  Creating test referrers...');
    for (const referrer of TEST_REFERRERS) {
      await tx.referrer.upsert({
        where: { id: referrer.id },
        update: {},
        create: {
          ...referrer,
          practiceId: TEST_IDS.practice,
        },
      });
    }

    // 5. Create patient contacts (GP contacts for each patient)
    console.log('  Creating patient contacts...');
    const patientContacts = [
      {
        id: TEST_IDS.contactGP1,
        patientId: TEST_IDS.patientHF,
        type: 'GP' as const,
        fullName: 'Dr. TEST GP Smith',
        organisation: 'TEST Sydney Medical Centre',
        email: 'test.gp.smith@test.dictatemed.dev',
        phone: '+61 2 9000 0001',
        fax: '+61 2 9000 0002',
        address: 'TEST Address - 50 Martin Place, Sydney NSW 2000',
        preferredChannel: 'EMAIL' as const,
        isDefaultForPatient: true,
      },
      {
        id: TEST_IDS.contactGP2,
        patientId: TEST_IDS.patientPCI,
        type: 'GP' as const,
        fullName: 'Dr. TEST GP Brown',
        organisation: 'TEST Harbour Medical Practice',
        email: 'test.gp.brown@test.dictatemed.dev',
        phone: '+61 2 9000 0005',
        fax: '+61 2 9000 0006',
        address: 'TEST Address - 100 Circular Quay, Sydney NSW 2000',
        preferredChannel: 'EMAIL' as const,
        isDefaultForPatient: true,
      },
    ];

    for (const contact of patientContacts) {
      await tx.patientContact.upsert({
        where: { id: contact.id },
        update: {},
        create: contact,
      });
    }

    // 6. Create style profile for test clinician
    console.log('  Creating style profile...');
    await tx.styleProfile.upsert({
      where: {
        userId_subspecialty: {
          userId: TEST_IDS.clinician,
          subspecialty: Subspecialty.HEART_FAILURE,
        },
      },
      update: {},
      create: {
        id: TEST_IDS.styleProfile,
        userId: TEST_IDS.clinician,
        subspecialty: Subspecialty.HEART_FAILURE,
        sectionOrder: ['History', 'Examination', 'Investigations', 'Impression', 'Plan'],
        sectionInclusion: { Medications: 0.95, FamilyHistory: 0.4 },
        sectionVerbosity: { History: 'detailed', Plan: 'concise' },
        phrasingPreferences: { greeting: 'Thank you for referring' },
        greetingStyle: 'formal',
        closingStyle: 'formal',
        formalityLevel: 'formal',
        learningStrength: 1.0,
        totalEditsAnalyzed: 0,
      },
    });

    // 7. Create sample consultations for testing
    console.log('  Creating sample consultations...');
    const consultations = [
      {
        id: TEST_IDS.consultation1,
        userId: TEST_IDS.clinician,
        patientId: TEST_IDS.patientHF,
        referrerId: TEST_IDS.referrerGP,
        letterType: LetterType.NEW_PATIENT,
        status: ConsultationStatus.DRAFT,
      },
      {
        id: TEST_IDS.consultation2,
        userId: TEST_IDS.clinician,
        patientId: TEST_IDS.patientPCI,
        referrerId: TEST_IDS.referrerGP,
        letterType: LetterType.ANGIOGRAM_PROCEDURE,
        status: ConsultationStatus.DRAFT,
      },
    ];

    for (const consultation of consultations) {
      await tx.consultation.upsert({
        where: { id: consultation.id },
        update: {},
        create: consultation,
      });
    }

    // 8. Create audit log entries for test user activity
    console.log('  Creating audit log entries...');
    await tx.auditLog.createMany({
      data: [
        {
          userId: TEST_IDS.clinician,
          action: 'e2e_test.seed',
          resourceType: 'system',
          metadata: {
            testRun: true,
            seededAt: new Date().toISOString(),
          },
        },
      ],
      skipDuplicates: true,
    });
    },
    {
      maxWait: 30000, // 30 seconds max wait to acquire connection
      timeout: 30000, // 30 seconds transaction timeout
    }
  );

  const duration = Date.now() - startTime;
  console.log(`\n✅ E2E test data seeded successfully in ${duration}ms`);
  console.log('\nTest entities created:');
  console.log(`  • Practice: TEST-PRACTICE-E2E Sydney Heart Specialists`);
  console.log(`  • Clinician: test.cardiologist+e2e@dictatemed.dev`);
  console.log(`  • Patients: TEST-HF-001, TEST-PCI-002`);
  console.log(`  • Referrers: 2 (GP + Cardiologist)`);
  console.log(`  • Patient Contacts: 2`);
  console.log(`  • Style Profile: Heart Failure subspecialty`);
  console.log(`  • Consultations: 2 (draft)`);

  if (duration > 3000) {
    console.warn(`\n⚠️ Warning: Seeding took ${duration}ms (target: <3000ms)`);
  }
}

// Export for programmatic use
export { seedE2ETestData, TEST_IDS, TEST_PATIENTS, TEST_REFERRERS };

// CLI execution
if (require.main === module) {
  seedE2ETestData()
    .catch((error) => {
      console.error('❌ E2E seed failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
