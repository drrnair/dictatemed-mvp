// tests/e2e/fixtures/test-data.ts
// Test data constants for E2E tests
//
// This file contains all constant test data used across E2E tests.
// All test data uses TEST- prefix for PHI compliance and easy cleanup.
// These constants must match the data seeded by scripts/seed-e2e-test-data.ts

// ============================================
// Environment Configuration
// ============================================

/**
 * Get test user credentials from environment
 */
export function getTestCredentials(): {
  email: string;
  password: string;
} {
  const email = process.env.E2E_TEST_USER_EMAIL;
  const password = process.env.E2E_TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E test credentials not configured. ' +
        'Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD environment variables.'
    );
  }

  return { email, password };
}

/**
 * Check if mock auth token is available
 */
export function hasMockAuthToken(): boolean {
  return !!process.env.E2E_MOCK_AUTH_TOKEN;
}

/**
 * Get mock auth token (for API-level tests)
 */
export function getMockAuthToken(): string | undefined {
  return process.env.E2E_MOCK_AUTH_TOKEN;
}

// ============================================
// Fixed Test Entity IDs
// ============================================

/**
 * Fixed UUIDs for E2E test entities
 * These match the IDs in scripts/seed-e2e-test-data.ts
 */
export const TEST_IDS = {
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

// ============================================
// Test Practice
// ============================================

export const TEST_PRACTICE = {
  id: TEST_IDS.practice,
  name: 'TEST-PRACTICE-E2E Sydney Heart Specialists',
  timezone: 'Australia/Sydney',
} as const;

// ============================================
// Test Clinician
// ============================================

export const TEST_CLINICIAN = {
  id: TEST_IDS.clinician,
  auth0Id: 'auth0|e2e-test-clinician',
  email: 'test.cardiologist+e2e@dictatemed.dev',
  name: 'Dr. TEST E2E Cardiologist',
  role: 'SPECIALIST',
  clinicianRole: 'MEDICAL',
  subspecialties: ['HEART_FAILURE', 'INTERVENTIONAL'],
} as const;

// ============================================
// Test Patients
// ============================================

export const TEST_PATIENTS = {
  heartFailure: {
    id: TEST_IDS.patientHF,
    mrn: 'TEST-HF-001',
    name: 'TEST Patient - Heart Failure',
    dateOfBirth: '1958-06-15',
    medicareNumber: 'TEST-1234567890',
    address: 'TEST Address - 100 George Street, Sydney NSW 2000',
    phone: '+61 400 000 001',
    email: 'test.patient.hf@test.dictatemed.dev',
  },
  pci: {
    id: TEST_IDS.patientPCI,
    mrn: 'TEST-PCI-002',
    name: 'TEST Patient - PCI Intervention',
    dateOfBirth: '1965-11-22',
    medicareNumber: 'TEST-2345678901',
    address: 'TEST Address - 200 Pitt Street, Sydney NSW 2000',
    phone: '+61 400 000 002',
    email: 'test.patient.pci@test.dictatemed.dev',
  },
} as const;

// ============================================
// Test Referrers
// ============================================

export const TEST_REFERRERS = {
  gp: {
    id: TEST_IDS.referrerGP,
    name: 'Dr. TEST GP Smith',
    practiceName: 'TEST Sydney Medical Centre',
    email: 'test.gp.smith@test.dictatemed.dev',
    phone: '+61 2 9000 0001',
    fax: '+61 2 9000 0002',
    address: 'TEST Address - 50 Martin Place, Sydney NSW 2000',
  },
  cardiologist: {
    id: TEST_IDS.referrerCardiologist,
    name: 'Dr. TEST Cardiologist Jones',
    practiceName: 'TEST Heart Specialists',
    email: 'test.cardiologist.jones@test.dictatemed.dev',
    phone: '+61 2 9000 0003',
    fax: '+61 2 9000 0004',
    address: 'TEST Address - 123 Macquarie Street, Sydney NSW 2000',
  },
} as const;

// ============================================
// Test Patient Contacts
// ============================================

export const TEST_CONTACTS = {
  gpForHF: {
    id: TEST_IDS.contactGP1,
    patientId: TEST_IDS.patientHF,
    type: 'GP',
    fullName: 'Dr. TEST GP Smith',
    organisation: 'TEST Sydney Medical Centre',
    email: 'test.gp.smith@test.dictatemed.dev',
    phone: '+61 2 9000 0001',
    fax: '+61 2 9000 0002',
    address: 'TEST Address - 50 Martin Place, Sydney NSW 2000',
    preferredChannel: 'EMAIL',
    isDefaultForPatient: true,
  },
  gpForPCI: {
    id: TEST_IDS.contactGP2,
    patientId: TEST_IDS.patientPCI,
    type: 'GP',
    fullName: 'Dr. TEST GP Brown',
    organisation: 'TEST Harbour Medical Practice',
    email: 'test.gp.brown@test.dictatemed.dev',
    phone: '+61 2 9000 0005',
    fax: '+61 2 9000 0006',
    address: 'TEST Address - 100 Circular Quay, Sydney NSW 2000',
    preferredChannel: 'EMAIL',
    isDefaultForPatient: true,
  },
} as const;

// ============================================
// Expected Referral Extraction Results
// ============================================

/**
 * Expected extraction results for sample referral PDFs
 * Used to verify extraction accuracy in tests
 */
export const EXPECTED_REFERRAL_EXTRACTIONS = {
  'cardiology-referral-001.pdf': {
    patient: {
      name: 'TEST Patient - Referral HF',
      dateOfBirth: '1960-03-20',
      mrn: 'TEST-REF-HF-001',
    },
    referrer: {
      name: 'Dr. TEST Referring GP Melbourne',
      practice: 'TEST Melbourne Medical Centre',
      email: 'test.gp.melbourne@test.dictatemed.dev',
      phone: '+61 3 9000 0001',
    },
    reasonForReferral: 'Progressive dyspnoea on exertion with ankle swelling for cardiology assessment',
    urgency: 'routine',
  },
  'cardiology-referral-002.pdf': {
    patient: {
      name: 'TEST Patient - Referral Chest Pain',
      dateOfBirth: '1955-07-10',
      mrn: 'TEST-REF-CP-002',
    },
    referrer: {
      name: 'Dr. TEST Referring GP Brisbane',
      practice: 'TEST Brisbane Family Practice',
      email: 'test.gp.brisbane@test.dictatemed.dev',
      phone: '+61 7 9000 0001',
    },
    reasonForReferral: 'Exertional chest pain with positive stress test for urgent cardiology review',
    urgency: 'urgent',
  },
} as const;

// ============================================
// Test Letter Content
// ============================================

/**
 * Sample letter content for different subspecialties
 */
export const SAMPLE_LETTER_CONTENT = {
  heartFailure: {
    greeting: 'Dear Dr. TEST GP Smith,\n\nThank you for referring TEST Patient - Heart Failure.',
    body: `**History of Presenting Complaint:**
The patient presents with a 6-month history of progressive exertional dyspnoea with orthopnoea and ankle swelling.

**Examination:**
Blood pressure 130/80 mmHg, heart rate 72 bpm regular.
JVP elevated 4cm above sternal angle.
Heart sounds: S1, S2 with S3 gallop.
Bibasal crackles on auscultation.
Mild bilateral ankle oedema.

**Investigations:**
ECG: Sinus rhythm, no acute changes.
Echocardiography: LVEF 35%, moderate LV systolic dysfunction with grade II diastolic dysfunction.
BNP: 450 pg/mL (elevated).

**Impression:**
Heart failure with reduced ejection fraction (HFrEF), NYHA Class II.

**Plan:**
1. Commenced on Entresto 24/26mg BD (sacubitril/valsartan)
2. Continue Bisoprolol 5mg daily
3. Added Spironolactone 25mg daily
4. Lifestyle modifications discussed including fluid and salt restriction
5. Heart failure education and action plan provided
6. Follow-up in 6 weeks with repeat echocardiogram`,
    closing:
      'Kind regards,\n\nDr. TEST E2E Cardiologist\nCardiologist\nTEST-PRACTICE-E2E Sydney Heart Specialists',
    extractedValues: [
      { key: 'lvef', value: '35%', source: 'Echocardiography' },
      { key: 'bp', value: '130/80 mmHg', source: 'Examination' },
      { key: 'hr', value: '72 bpm', source: 'Examination' },
      { key: 'bnp', value: '450 pg/mL', source: 'BNP' },
    ],
  },
  pci: {
    greeting:
      'Dear Dr. TEST GP Smith,\n\nThank you for referring TEST Patient - PCI Intervention.',
    body: `**History of Presenting Complaint:**
The patient presented with acute chest pain at rest and was diagnosed with NSTEMI requiring urgent coronary angiography.

**Examination:**
Blood pressure 145/90 mmHg, heart rate 88 bpm regular.
Heart sounds normal, nil murmurs.
Lungs clear to auscultation.
Right radial access site clean and dry, no haematoma.

**Procedure:**
Coronary angiography via right radial approach.
Findings: 90% stenosis of mid-LAD, 50% stenosis of Cx.
Successful PCI to LAD with 3.0 x 18mm drug-eluting stent (Xience).
Excellent angiographic result with TIMI 3 flow.

**Post-Procedure:**
Troponin I peaked at 2.5 ng/mL.
ECG: Resolution of ST depression.

**Impression:**
NSTEMI - successful PCI to LAD with drug-eluting stent.

**Plan:**
1. Dual antiplatelet therapy (Aspirin 100mg + Ticagrelor 90mg BD) for 12 months
2. High-intensity statin (Atorvastatin 80mg nocte)
3. Cardiac rehabilitation referral
4. Risk factor modification including smoking cessation, BP control
5. Follow-up in 4 weeks post-procedure`,
    closing:
      'Kind regards,\n\nDr. TEST E2E Cardiologist\nInterventional Cardiologist\nTEST-PRACTICE-E2E Sydney Heart Specialists',
    extractedValues: [
      { key: 'bp', value: '145/90 mmHg', source: 'Examination' },
      { key: 'hr', value: '88 bpm', source: 'Examination' },
      { key: 'troponin', value: '2.5 ng/mL', source: 'Post-Procedure' },
      { key: 'stent', value: '3.0 x 18mm Xience DES', source: 'Procedure' },
    ],
  },
} as const;

// ============================================
// Test URLs and Routes
// ============================================

export const TEST_ROUTES = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  dashboard: '/dashboard',
  newConsultation: '/record',
  letters: '/letters',
  settings: '/settings',
  referralUpload: '/referrals/upload',
} as const;

// ============================================
// Test Timeouts
// ============================================

export const TEST_TIMEOUTS = {
  navigation: 10000,
  networkIdle: 5000,
  letterGeneration: 60000,
  transcription: 30000,
  referralExtraction: 30000,
  animation: 500,
  debounce: 300,
} as const;

// ============================================
// Selector Constants
// ============================================

/**
 * Common data-testid selectors used across tests
 */
export const TEST_SELECTORS = {
  // Dashboard
  dashboardStats: 'dashboard-stats',
  recentLetters: 'recent-letters',

  // Navigation
  navNewConsultation: 'nav-new-consultation',
  navLetters: 'nav-letters',
  navSettings: 'nav-settings',

  // Patient selection
  patientSearchInput: 'patient-search-input',
  patientSearchResults: 'patient-search-results',
  selectedPatient: 'selected-patient',

  // Referrer selection
  referrerSearchInput: 'referrer-search-input',
  referrerSearchResults: 'referrer-search-results',
  selectedReferrer: 'selected-referrer',

  // Letter type
  letterTypeSelector: 'letter-type-selector',

  // Recording
  recordingSection: 'recording-section',
  recordingModeSelector: 'recording-mode-selector',
  startRecording: 'start-recording',
  stopRecording: 'stop-recording',
  recordingTimer: 'recording-timer',

  // Letter editor
  letterEditor: 'letter-editor',
  letterContent: 'letter-content',
  verificationPanel: 'verification-panel',
  sourcePanel: 'source-panel',

  // Actions
  generateLetterButton: 'generate-letter-button',
  approveLetter: 'approve-letter',
  sendLetter: 'send-letter',

  // Send dialog
  sendDialog: 'send-dialog',
  recipientList: 'recipient-list',
  confirmSend: 'confirm-send',

  // Referral upload
  referralDropzone: 'referral-dropzone',
  extractionProgress: 'extraction-progress',
  extractedData: 'extracted-data',
} as const;

// ============================================
// Validation Patterns
// ============================================

/**
 * Regular expressions for validating clinical content
 */
export const CLINICAL_PATTERNS = {
  bloodPressure: /\b\d{2,3}\/\d{2,3}\s*(?:mm\s*Hg|mmHg)\b/i,
  heartRate: /\b\d{2,3}\s*(?:bpm|beats?\s*per\s*minute)\b/i,
  ejectionFraction: /(?:EF|LVEF|ejection\s*fraction)\s*(?:of\s*)?\d{1,2}%/i,
  medicationDose: /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?)\b/i,
  labValue: /\b\d+(?:\.\d+)?\s*(?:pg\/mL|ng\/mL|mmol\/L|mg\/dL|IU\/L)\b/i,
  datePattern: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
} as const;

// ============================================
// Export All Constants
// ============================================

export const TEST_DATA = {
  ids: TEST_IDS,
  practice: TEST_PRACTICE,
  clinician: TEST_CLINICIAN,
  patients: TEST_PATIENTS,
  referrers: TEST_REFERRERS,
  contacts: TEST_CONTACTS,
  routes: TEST_ROUTES,
  timeouts: TEST_TIMEOUTS,
  selectors: TEST_SELECTORS,
  patterns: CLINICAL_PATTERNS,
  sampleLetters: SAMPLE_LETTER_CONTENT,
  expectedExtractions: EXPECTED_REFERRAL_EXTRACTIONS,
} as const;
