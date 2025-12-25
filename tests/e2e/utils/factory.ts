// tests/e2e/utils/factory.ts
// Test data factory functions for generating realistic test data
//
// All test data uses TEST- prefix for PHI compliance and easy cleanup.
// These factories generate data structures matching the application's models.

import { generateTestId, formatDateForInput } from './helpers';

// ============================================
// Type Definitions
// ============================================

export interface TestPatient {
  id?: string;
  mrn: string;
  name: string;
  dateOfBirth: string;
  medicareNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface TestContact {
  id?: string;
  type: 'GP' | 'REFERRER' | 'SPECIALIST' | 'OTHER';
  fullName: string;
  organisation?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
  preferredChannel?: 'EMAIL' | 'SECURE_MESSAGING' | 'FAX' | 'POST';
  isDefaultForPatient?: boolean;
}

export interface TestReferrer {
  id?: string;
  name: string;
  practiceName?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
}

export interface TestClinicalContext {
  patientMrn: string;
  referrerName?: string;
  letterType: 'NEW_PATIENT' | 'FOLLOW_UP' | 'ANGIOGRAM_PROCEDURE' | 'ECHO_REPORT';
  subspecialty?: string;
  presentingComplaint?: string;
  clinicalHistory?: string;
  medications?: string[];
  allergies?: string[];
  examination?: Record<string, string>;
  investigations?: Array<{ name: string; result: string; date?: string }>;
  impression?: string;
  plan?: string[];
}

export interface TestLetterContent {
  greeting?: string;
  historyOfPresentingComplaint?: string;
  examination?: string;
  investigations?: string;
  impression?: string;
  plan?: string;
  closing?: string;
}

// Subspecialty enum matching Prisma schema
export type Subspecialty =
  | 'GENERAL_CARDIOLOGY'
  | 'INTERVENTIONAL'
  | 'STRUCTURAL'
  | 'ELECTROPHYSIOLOGY'
  | 'IMAGING'
  | 'HEART_FAILURE'
  | 'CARDIAC_SURGERY';

// ============================================
// Patient Factory
// ============================================

const DEFAULT_PATIENT: Omit<TestPatient, 'mrn' | 'name' | 'dateOfBirth'> = {
  medicareNumber: 'TEST-1234567890',
  address: 'TEST Address - 123 Test Street, Sydney NSW 2000',
  phone: '+61 400 000 000',
  email: 'test.patient@test.dictatemed.dev',
};

/**
 * Create a test patient with realistic cardiology data
 * All patients have TEST- prefix for PHI compliance
 */
export function createTestPatient(
  overrides: Partial<TestPatient> = {}
): TestPatient {
  const id = generateTestId('PT');
  const mrn = overrides.mrn ?? `TEST-${id}`;

  return {
    ...DEFAULT_PATIENT,
    mrn,
    name: overrides.name ?? `TEST Patient ${id}`,
    dateOfBirth: overrides.dateOfBirth ?? '1960-06-15',
    ...overrides,
  };
}

/**
 * Create a heart failure test patient
 */
export function createHeartFailurePatient(
  overrides: Partial<TestPatient> = {}
): TestPatient {
  return createTestPatient({
    mrn: 'TEST-HF-001',
    name: 'TEST Patient - Heart Failure',
    dateOfBirth: '1958-06-15',
    ...overrides,
  });
}

/**
 * Create a PCI intervention test patient
 */
export function createPCIPatient(
  overrides: Partial<TestPatient> = {}
): TestPatient {
  return createTestPatient({
    mrn: 'TEST-PCI-002',
    name: 'TEST Patient - PCI Intervention',
    dateOfBirth: '1965-11-22',
    ...overrides,
  });
}

// ============================================
// Contact Factory
// ============================================

const DEFAULT_CONTACT: Omit<TestContact, 'type' | 'fullName'> = {
  organisation: 'TEST Medical Centre',
  email: 'test.contact@test.dictatemed.dev',
  phone: '+61 2 9000 0000',
  fax: '+61 2 9000 0001',
  address: 'TEST Address - 100 Test Street, Sydney NSW 2000',
  preferredChannel: 'EMAIL',
  isDefaultForPatient: false,
};

/**
 * Create a test contact
 */
export function createTestContact(
  overrides: Partial<TestContact> = {}
): TestContact {
  const id = generateTestId('CT');

  return {
    ...DEFAULT_CONTACT,
    type: overrides.type ?? 'GP',
    fullName: overrides.fullName ?? `Dr. TEST Contact ${id}`,
    ...overrides,
  };
}

/**
 * Create a GP contact
 */
export function createGPContact(
  overrides: Partial<TestContact> = {}
): TestContact {
  return createTestContact({
    type: 'GP',
    fullName: 'Dr. TEST GP Smith',
    organisation: 'TEST Sydney Medical Centre',
    email: 'test.gp.smith@test.dictatemed.dev',
    isDefaultForPatient: true,
    ...overrides,
  });
}

/**
 * Create a specialist contact
 */
export function createSpecialistContact(
  overrides: Partial<TestContact> = {}
): TestContact {
  return createTestContact({
    type: 'SPECIALIST',
    fullName: 'Dr. TEST Cardiologist Jones',
    organisation: 'TEST Heart Specialists',
    email: 'test.cardiologist.jones@test.dictatemed.dev',
    ...overrides,
  });
}

// ============================================
// Referrer Factory
// ============================================

const DEFAULT_REFERRER: Omit<TestReferrer, 'name'> = {
  practiceName: 'TEST Medical Centre',
  email: 'test.referrer@test.dictatemed.dev',
  phone: '+61 2 9000 0000',
  fax: '+61 2 9000 0001',
  address: 'TEST Address - 100 Test Street, Sydney NSW 2000',
};

/**
 * Create a test referrer
 */
export function createTestReferrer(
  overrides: Partial<TestReferrer> = {}
): TestReferrer {
  const id = generateTestId('RF');

  return {
    ...DEFAULT_REFERRER,
    name: overrides.name ?? `Dr. TEST Referrer ${id}`,
    ...overrides,
  };
}

// ============================================
// Clinical Context Factory
// ============================================

/**
 * Create clinical context for a specific subspecialty
 */
export function createTestClinicalContext(
  subspecialty: Subspecialty,
  overrides: Partial<TestClinicalContext> = {}
): TestClinicalContext {
  const baseContext: TestClinicalContext = {
    patientMrn: overrides.patientMrn ?? 'TEST-HF-001',
    letterType: overrides.letterType ?? 'NEW_PATIENT',
    subspecialty,
    ...overrides,
  };

  // Add subspecialty-specific defaults
  switch (subspecialty) {
    case 'HEART_FAILURE':
      return {
        ...baseContext,
        presentingComplaint:
          overrides.presentingComplaint ??
          'Progressive exertional dyspnoea over 6 months with orthopnoea and ankle swelling',
        medications: overrides.medications ?? [
          'Entresto 24/26mg BD',
          'Bisoprolol 5mg daily',
          'Spironolactone 25mg daily',
          'Frusemide 40mg mane',
        ],
        examination: overrides.examination ?? {
          BP: '130/80 mmHg',
          HR: '72 bpm regular',
          JVP: 'Elevated 4cm',
          Heart: 'S1, S2, S3 gallop',
          Lungs: 'Bibasal crackles',
          Oedema: 'Mild ankle oedema',
        },
        investigations: overrides.investigations ?? [
          { name: 'TTE', result: 'LVEF 35%, moderate LV systolic dysfunction', date: formatDateForInput(new Date()) },
          { name: 'BNP', result: '450 pg/mL (elevated)', date: formatDateForInput(new Date()) },
        ],
        impression:
          overrides.impression ?? 'Heart failure with reduced ejection fraction (HFrEF), NYHA Class II',
        plan: overrides.plan ?? [
          'Optimise GDMT',
          'Consider CRT-D if no improvement',
          'Heart failure education',
          'Follow-up in 6 weeks',
        ],
      };

    case 'INTERVENTIONAL':
      return {
        ...baseContext,
        patientMrn: overrides.patientMrn ?? 'TEST-PCI-002',
        presentingComplaint:
          overrides.presentingComplaint ??
          'Acute coronary syndrome with NSTEMI requiring urgent angiography',
        medications: overrides.medications ?? [
          'Aspirin 100mg daily',
          'Ticagrelor 90mg BD',
          'Atorvastatin 80mg nocte',
          'Metoprolol 25mg BD',
        ],
        examination: overrides.examination ?? {
          BP: '145/90 mmHg',
          HR: '88 bpm regular',
          Heart: 'Normal S1, S2, nil murmurs',
          Lungs: 'Clear',
          Access: 'Right radial puncture site - no haematoma',
        },
        investigations: overrides.investigations ?? [
          {
            name: 'Coronary angiography',
            result: '90% stenosis LAD, PCI with DES successful',
            date: formatDateForInput(new Date()),
          },
          { name: 'Troponin', result: 'Peak 2.5 ng/mL', date: formatDateForInput(new Date()) },
        ],
        impression: overrides.impression ?? 'NSTEMI - successful PCI to LAD with drug-eluting stent',
        plan: overrides.plan ?? [
          'DAPT for 12 months',
          'Cardiac rehabilitation',
          'Risk factor modification',
          'Follow-up in 4 weeks',
        ],
      };

    case 'ELECTROPHYSIOLOGY':
      return {
        ...baseContext,
        presentingComplaint:
          overrides.presentingComplaint ?? 'Recurrent palpitations with documented paroxysmal AF',
        medications: overrides.medications ?? [
          'Apixaban 5mg BD',
          'Flecainide 100mg BD',
          'Bisoprolol 2.5mg daily',
        ],
        examination: overrides.examination ?? {
          BP: '125/78 mmHg',
          HR: '68 bpm regular',
          Heart: 'Normal S1, S2',
          Lungs: 'Clear',
        },
        investigations: overrides.investigations ?? [
          { name: 'ECG', result: 'Sinus rhythm, no pre-excitation', date: formatDateForInput(new Date()) },
          { name: 'Holter', result: 'Multiple PAF episodes, max duration 4 hours', date: formatDateForInput(new Date()) },
        ],
        impression: overrides.impression ?? 'Paroxysmal atrial fibrillation, symptomatic despite AAD',
        plan: overrides.plan ?? [
          'AF ablation offered - patient keen',
          'Continue anticoagulation',
          'Pre-ablation TOE arranged',
          'Follow-up post-procedure',
        ],
      };

    case 'IMAGING':
      return {
        ...baseContext,
        letterType: overrides.letterType ?? 'ECHO_REPORT',
        presentingComplaint:
          overrides.presentingComplaint ?? 'Routine surveillance echocardiogram for bicuspid aortic valve',
        examination: overrides.examination ?? {
          BP: '120/75 mmHg',
          HR: '65 bpm regular',
          Heart: 'Ejection systolic murmur grade 2/6',
        },
        investigations: overrides.investigations ?? [
          {
            name: 'TTE',
            result:
              'BAV with mild AS (Vmax 2.5 m/s, mean gradient 12 mmHg). Ascending aorta 40mm. LV normal.',
            date: formatDateForInput(new Date()),
          },
        ],
        impression: overrides.impression ?? 'Bicuspid aortic valve with mild stenosis, stable ascending aortopathy',
        plan: overrides.plan ?? [
          'Annual surveillance echo',
          'CT aortogram if aorta >42mm',
          'Exercise restriction discussed',
        ],
      };

    case 'STRUCTURAL':
      return {
        ...baseContext,
        presentingComplaint:
          overrides.presentingComplaint ?? 'Severe symptomatic aortic stenosis for TAVI assessment',
        medications: overrides.medications ?? ['Aspirin 100mg daily', 'Perindopril 2.5mg daily'],
        examination: overrides.examination ?? {
          BP: '110/70 mmHg',
          HR: '78 bpm regular',
          Heart: 'Harsh ejection systolic murmur grade 4/6',
          Lungs: 'Clear',
        },
        investigations: overrides.investigations ?? [
          {
            name: 'TTE',
            result: 'Severe AS (AVA 0.7cm², mean gradient 48mmHg). LVEF 55%.',
            date: formatDateForInput(new Date()),
          },
          { name: 'CT Aortogram', result: 'Suitable for TAVI, annulus 23mm', date: formatDateForInput(new Date()) },
        ],
        impression:
          overrides.impression ?? 'Severe symptomatic aortic stenosis, suitable for transfemoral TAVI',
        plan: overrides.plan ?? [
          'Heart team discussion',
          'TAVI scheduled for next week',
          'Pre-procedure DAPT',
        ],
      };

    case 'CARDIAC_SURGERY':
      return {
        ...baseContext,
        presentingComplaint:
          overrides.presentingComplaint ?? 'Triple vessel disease for CABG assessment',
        medications: overrides.medications ?? [
          'Aspirin 100mg daily',
          'Clopidogrel 75mg daily',
          'Atorvastatin 80mg nocte',
          'Metoprolol 50mg BD',
          'GTN SL prn',
        ],
        examination: overrides.examination ?? {
          BP: '135/85 mmHg',
          HR: '72 bpm regular',
          Heart: 'Normal S1, S2',
          Lungs: 'Clear',
          'Peripheral pulses': 'Present and equal',
        },
        investigations: overrides.investigations ?? [
          {
            name: 'Coronary angiography',
            result: 'LM 50%, LAD 90%, Cx 80%, RCA 70% - SYNTAX score 28',
            date: formatDateForInput(new Date()),
          },
          { name: 'LVEF', result: '50%', date: formatDateForInput(new Date()) },
        ],
        impression: overrides.impression ?? 'Triple vessel CAD with intermediate SYNTAX score, suitable for CABG',
        plan: overrides.plan ?? [
          'Referred to cardiothoracic surgery',
          'Pre-op work-up arranged',
          'Hold clopidogrel 5 days pre-op',
        ],
      };

    default:
      return {
        ...baseContext,
        subspecialty: 'GENERAL_CARDIOLOGY',
        presentingComplaint: overrides.presentingComplaint ?? 'Chest pain for cardiac evaluation',
        examination: overrides.examination ?? {
          BP: '130/80 mmHg',
          HR: '75 bpm regular',
          Heart: 'Normal S1, S2',
          Lungs: 'Clear',
        },
        investigations: overrides.investigations ?? [
          { name: 'ECG', result: 'Sinus rhythm, no acute changes', date: formatDateForInput(new Date()) },
        ],
        impression: overrides.impression ?? 'Low risk chest pain, likely non-cardiac',
        plan: overrides.plan ?? ['Reassurance', 'Follow-up PRN'],
      };
  }
}

// ============================================
// Letter Content Factory
// ============================================

/**
 * Create test letter content
 */
export function createTestLetterContent(
  overrides: Partial<TestLetterContent> = {}
): TestLetterContent {
  return {
    greeting: overrides.greeting ?? 'Dear Dr. TEST GP Smith,\n\nThank you for referring TEST Patient.',
    historyOfPresentingComplaint:
      overrides.historyOfPresentingComplaint ??
      'The patient presents with a 6-month history of progressive symptoms.',
    examination:
      overrides.examination ??
      'Blood pressure 130/80 mmHg, heart rate 72 bpm regular. Cardiovascular examination unremarkable.',
    investigations:
      overrides.investigations ?? 'ECG: Sinus rhythm. Echocardiogram: Normal LV function (LVEF 60%).',
    impression: overrides.impression ?? 'Benign presentation with no significant pathology.',
    plan: overrides.plan ?? '1. Reassurance\n2. Lifestyle advice\n3. Follow-up as required',
    closing:
      overrides.closing ??
      'Kind regards,\n\nDr. TEST E2E Cardiologist\nCardiologist\nTEST-PRACTICE-E2E Sydney Heart Specialists',
  };
}

/**
 * Assemble full letter from content parts
 */
export function assembleLetterContent(content: TestLetterContent): string {
  const sections = [
    content.greeting,
    '',
    '**History of Presenting Complaint:**',
    content.historyOfPresentingComplaint,
    '',
    '**Examination:**',
    content.examination,
    '',
    '**Investigations:**',
    content.investigations,
    '',
    '**Impression:**',
    content.impression,
    '',
    '**Plan:**',
    content.plan,
    '',
    content.closing,
  ];

  return sections.filter(Boolean).join('\n');
}

// ============================================
// Referral Document Factory
// ============================================

export interface TestReferralDocument {
  patientName: string;
  patientDob: string;
  patientMrn?: string;
  referrerName: string;
  referrerPractice: string;
  referrerEmail?: string;
  referrerPhone?: string;
  referrerFax?: string;
  reasonForReferral: string;
  clinicalHistory?: string;
  urgency?: 'routine' | 'urgent' | 'emergency';
}

/**
 * Create test referral document data
 */
export function createTestReferralDocument(
  overrides: Partial<TestReferralDocument> = {}
): TestReferralDocument {
  const id = generateTestId('REF');

  return {
    patientName: overrides.patientName ?? `TEST Patient ${id}`,
    patientDob: overrides.patientDob ?? '1965-08-20',
    patientMrn: overrides.patientMrn ?? `TEST-${id}`,
    referrerName: overrides.referrerName ?? 'Dr. TEST Referring GP',
    referrerPractice: overrides.referrerPractice ?? 'TEST Referral Medical Centre',
    referrerEmail: overrides.referrerEmail ?? 'test.referring.gp@test.dictatemed.dev',
    referrerPhone: overrides.referrerPhone ?? '+61 2 9000 0010',
    referrerFax: overrides.referrerFax ?? '+61 2 9000 0011',
    reasonForReferral:
      overrides.reasonForReferral ?? 'Chest pain and shortness of breath for cardiology review',
    clinicalHistory:
      overrides.clinicalHistory ??
      'Hypertension, Type 2 Diabetes. Non-smoker. Family history of IHD.',
    urgency: overrides.urgency ?? 'routine',
  };
}

// ============================================
// Batch Factories
// ============================================

/**
 * Create multiple test patients
 */
export function createTestPatients(count: number): TestPatient[] {
  return Array.from({ length: count }, (_, i) =>
    createTestPatient({
      name: `TEST Patient ${i + 1}`,
      mrn: `TEST-BATCH-${String(i + 1).padStart(3, '0')}`,
    })
  );
}

/**
 * Create a complete test dataset for a consultation
 */
export function createConsultationTestData(subspecialty: Subspecialty = 'HEART_FAILURE'): {
  patient: TestPatient;
  referrer: TestReferrer;
  gpContact: TestContact;
  clinicalContext: TestClinicalContext;
} {
  const patient =
    subspecialty === 'HEART_FAILURE' ? createHeartFailurePatient() : createPCIPatient();

  return {
    patient,
    referrer: createTestReferrer({
      name: 'Dr. TEST GP Smith',
      practiceName: 'TEST Sydney Medical Centre',
    }),
    gpContact: createGPContact(),
    clinicalContext: createTestClinicalContext(subspecialty, {
      patientMrn: patient.mrn,
      referrerName: 'Dr. TEST GP Smith',
    }),
  };
}
