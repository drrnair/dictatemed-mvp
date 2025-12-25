// tests/e2e/utils/index.ts
// Central export for all E2E test utilities

// Helper functions
export {
  waitForNetworkIdle,
  waitForApiResponse,
  expectToast,
  waitForToastDismiss,
  assertNoConsoleErrors,
  setupConsoleErrorCollection,
  mockApiResponse,
  mockLetterGeneration,
  mockTranscription,
  mockReferralExtraction,
  clearApiMocks,
  debugScreenshot,
  retryWithBackoff,
  waitForStable,
  generateTestId,
  formatDateForInput,
  formatAustralianPhone,
  validateClinicalContent,
  waitForUrl,
  getCurrentSession,
  clearBrowserStorage,
} from './helpers';

// Factory functions
export {
  // Types
  type TestPatient,
  type TestContact,
  type TestReferrer,
  type TestClinicalContext,
  type TestLetterContent,
  type TestReferralDocument,
  type Subspecialty,
  // Patient factories
  createTestPatient,
  createHeartFailurePatient,
  createPCIPatient,
  createTestPatients,
  // Contact factories
  createTestContact,
  createGPContact,
  createSpecialistContact,
  // Referrer factories
  createTestReferrer,
  // Clinical context factories
  createTestClinicalContext,
  // Letter content factories
  createTestLetterContent,
  assembleLetterContent,
  // Referral document factories
  createTestReferralDocument,
  // Combined factories
  createConsultationTestData,
} from './factory';
