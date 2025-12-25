# Technical Specification: E2E Testing Suite for DictateMED

## Difficulty Assessment: **Medium-Hard**

This task involves:
- Complex multi-workflow E2E test coverage
- Auth0 authentication integration
- Test database seeding with encrypted PHI
- Page Object pattern implementation
- CI/CD pipeline configuration
- Multiple browser testing

---

## Technical Context

### Language & Framework
- **Runtime**: Node.js 20+
- **Framework**: Next.js 14.2 (App Router)
- **Language**: TypeScript 5.3 (strict mode)
- **Testing**: Playwright 1.41, Vitest 1.2
- **Database**: PostgreSQL with Prisma 6.19
- **Auth**: Auth0 (nextjs-auth0 3.5)

### Key Dependencies
```json
{
  "@playwright/test": "^1.41.0",
  "@axe-core/playwright": "^4.8.0",
  "@testing-library/react": "^14.2.0",
  "prisma": "^6.19.1"
}
```

### Current Test Infrastructure
- **E2E Tests**: `tests/e2e/` - 6 existing spec files
- **Fixtures**: `tests/e2e/fixtures/auth.ts` - Auth state management
- **Setup**: `tests/e2e/setup/auth.setup.ts` - Auth0 login automation
- **Unit Tests**: `tests/unit/` - Domain and component tests
- **Integration Tests**: `tests/integration/` - API-level tests

---

## Implementation Approach

### Phase 1: Test Infrastructure Enhancement

#### 1.1 Test Database Setup
Create dedicated E2E test seeding that:
- Uses `TEST-` prefix for all identifiers (HIPAA compliance)
- Creates bulk data efficiently (not loops)
- Supports isolated test environments

**New Files:**
- `scripts/seed-e2e-test-data.ts` - E2E-specific seed script
- `scripts/teardown-e2e-test-data.ts` - Cleanup script

**Test Data Requirements:**
| Entity | Identifier | Purpose |
|--------|------------|---------|
| Clinician | `test.cardiologist+e2e@dictatemed.dev` | Primary test user |
| Patient 1 | MRN: `TEST-HF-001` | Heart failure case |
| Patient 2 | MRN: `TEST-PCI-002` | PCI procedure case |
| GP Contact | `TEST-GP-001` | Letter recipient |
| Referrer | `TEST-REF-001` | Referral source |

#### 1.2 Environment Configuration
Create `.env.test` template with:
```env
# Test Database
DATABASE_URL="postgresql://..."

# E2E Test Credentials
E2E_TEST_USER_EMAIL="test.cardiologist+e2e@dictatemed.dev"
E2E_TEST_USER_PASSWORD="..."

# Mock Services
MOCK_EMAIL_SERVICE="true"
MOCK_AI_SERVICE="true"
```

#### 1.3 Page Object Pattern
Create reusable page objects in `tests/e2e/page-objects/`:

```typescript
// LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}
  async login(email: string, password: string): Promise<void>
  async expectLoginSuccess(): Promise<void>
  async expectLoginError(message: string): Promise<void>
}

// DashboardPage.ts
export class DashboardPage {
  constructor(private page: Page) {}
  async navigateToNewConsultation(): Promise<void>
  async getRecentLetters(): Promise<LetterSummary[]>
  async searchPatient(query: string): Promise<void>
}

// NewConsultationPage.ts
export class NewConsultationPage {
  constructor(private page: Page) {}
  async selectPatient(mrn: string): Promise<void>
  async fillClinicalContext(context: ClinicalContext): Promise<void>
  async startRecording(): Promise<void>
  async stopRecording(): Promise<void>
  async generateLetter(): Promise<void>
}

// ReferralUploadPage.ts
export class ReferralUploadPage {
  constructor(private page: Page) {}
  async uploadReferralPDF(filePath: string): Promise<void>
  async waitForExtraction(): Promise<void>
  async reviewExtractedData(): Promise<ExtractedReferral>
  async confirmAndProceed(): Promise<void>
}

// LetterDetailPage.ts
export class LetterDetailPage {
  constructor(private page: Page) {}
  async getLetterContent(): Promise<string>
  async editLetter(content: string): Promise<void>
  async approveLetter(): Promise<void>
  async openSendDialog(): Promise<void>
  async sendToRecipients(recipients: Recipient[]): Promise<void>
}
```

### Phase 2: Core Workflow Tests

#### 2.1 Workflow 1: Manual Consultation
**File**: `tests/e2e/workflows/manual-consultation.spec.ts`

Test Steps:
1. Login as test clinician
2. Navigate to new consultation
3. Select test patient (MRN: `TEST-HF-001`)
4. Fill clinical context (presenting complaint, history, examination)
5. Mock recording/transcription (or skip for now)
6. Generate letter using AI
7. Review and approve letter
8. Send to GP and self

**Data-testid Requirements:**
- `patient-search-input`
- `patient-select-{mrn}`
- `clinical-context-input`
- `generate-letter-button`
- `letter-content-editor`
- `approve-letter-button`
- `send-letter-button`

#### 2.2 Workflow 2: Referral Upload
**File**: `tests/e2e/workflows/referral-upload.spec.ts`

Test Steps:
1. Login as test clinician
2. Navigate to referral upload
3. Upload sample referral PDF
4. Wait for text extraction
5. Wait for AI structured extraction
6. Review extracted patient/GP details
7. Confirm and create consultation
8. Generate letter from context
9. Send to referrer

**Test Fixtures:**
- `tests/e2e/fixtures/referrals/cardiology-referral-001.pdf`
- `tests/e2e/fixtures/referrals/cardiology-referral-002.pdf`

#### 2.3 Workflow 3: Style Profile
**File**: `tests/e2e/workflows/style-profile.spec.ts`

Test Steps:
1. Login as test clinician
2. Generate first letter (baseline)
3. Make specific edits (formal greeting, structured plan)
4. Approve letter
5. Generate second letter
6. Verify style learning applied
7. Check settings page for profile
8. Logout and login again
9. Generate third letter
10. Verify style persists

### Phase 3: Test Utilities

#### 3.1 Custom Helpers
**File**: `tests/e2e/utils/helpers.ts`

```typescript
// Wait for network idle with timeout
async function waitForNetworkIdle(page: Page, timeout?: number): Promise<void>

// Wait for toast notification
async function expectToast(page: Page, message: string | RegExp): Promise<void>

// Screenshot on failure (already in config, but helper for manual)
async function captureScreenshot(page: Page, name: string): Promise<void>

// Mock AI response for letter generation
async function mockLetterGeneration(page: Page, content: string): Promise<void>

// Assert no console errors
async function assertNoConsoleErrors(page: Page): Promise<void>
```

#### 3.2 Test Data Factory
**File**: `tests/e2e/utils/factory.ts`

```typescript
// Generate realistic test data with TEST- prefix
function createTestPatient(overrides?: Partial<Patient>): Patient
function createTestGPContact(overrides?: Partial<Contact>): Contact
function createTestReferral(overrides?: Partial<Referral>): Referral
function createTestClinicalContext(subspecialty: Subspecialty): ClinicalContext
```

### Phase 4: CI/CD Integration

#### 4.1 GitHub Actions Workflow
**File**: `.github/workflows/e2e-tests.yml`

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: dictatemed_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Setup test database
        run: |
          npx prisma migrate deploy
          npm run db:seed:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/dictatemed_test

      - name: Run E2E tests
        run: npx playwright test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/dictatemed_test
          E2E_TEST_USER_EMAIL: ${{ secrets.E2E_TEST_USER_EMAIL }}
          E2E_TEST_USER_PASSWORD: ${{ secrets.E2E_TEST_USER_PASSWORD }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Upload screenshots
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: failure-screenshots
          path: test-results/
          retention-days: 7
```

#### 4.2 Updated Playwright Config
**File**: `playwright.config.ts` (modifications)

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['github'],  // GitHub annotations
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    // Auth setup (runs first)
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    // Tablet testing
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  // Global timeout
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});
```

---

## Source Code Structure Changes

### New Files
```
tests/
├── e2e/
│   ├── page-objects/
│   │   ├── index.ts
│   │   ├── LoginPage.ts
│   │   ├── DashboardPage.ts
│   │   ├── NewConsultationPage.ts
│   │   ├── ReferralUploadPage.ts
│   │   └── LetterDetailPage.ts
│   ├── workflows/
│   │   ├── manual-consultation.spec.ts
│   │   ├── referral-upload.spec.ts
│   │   └── style-profile.spec.ts
│   ├── fixtures/
│   │   ├── auth.ts (existing)
│   │   ├── referrals/
│   │   │   ├── cardiology-referral-001.pdf
│   │   │   └── cardiology-referral-002.pdf
│   │   └── test-data.ts
│   └── utils/
│       ├── helpers.ts
│       └── factory.ts
scripts/
├── seed-e2e-test-data.ts
└── teardown-e2e-test-data.ts

.github/
└── workflows/
    └── e2e-tests.yml

.env.test.example
README-E2E.md
```

### Modified Files
- `playwright.config.ts` - Enhanced configuration
- `package.json` - New scripts for E2E seeding

---

## Data Model / API / Interface Changes

### No Schema Changes Required
The existing Prisma schema supports all test scenarios.

### API Routes Tested
| Route | Method | Workflow |
|-------|--------|----------|
| `/api/auth/[...auth0]` | GET/POST | Login/Logout |
| `/api/patients` | GET/POST | Patient selection |
| `/api/patients/search` | GET | Patient search |
| `/api/referrals` | POST | Referral upload |
| `/api/referrals/[id]/extract-structured` | POST | AI extraction |
| `/api/letters` | POST | Letter generation |
| `/api/letters/[id]` | GET/PATCH | Letter review |
| `/api/letters/[id]/approve` | POST | Letter approval |
| `/api/letters/[id]/send` | POST | Letter sending |
| `/api/style/profiles` | GET | Style profiles |

---

## Verification Approach

### Local Verification
```bash
# Install dependencies
npm ci

# Setup test database
npm run db:seed:e2e

# Run E2E tests locally
npm run test:e2e

# Run with UI mode for debugging
npm run test:e2e:ui

# Run specific workflow
npx playwright test workflows/manual-consultation.spec.ts
```

### CI Verification
- All E2E tests pass (≥95% pass rate)
- No critical accessibility violations
- Screenshot/video artifacts on failure
- Test execution < 5 minutes

### Quality Gates
1. **Lint**: `npm run lint` passes
2. **TypeScript**: `npm run typecheck` passes
3. **Unit Tests**: `npm test` passes
4. **E2E Tests**: `npm run test:e2e` passes
5. **PHI Scan**: All test data uses `TEST-` prefix

---

## Security Considerations

### PHI Compliance
- All test patient MRNs: `TEST-*` prefix
- All test emails: `+e2e@dictatemed.dev` suffix
- Encryption key required for patient data seeding
- No real clinical data in test fixtures

### Test Data Isolation
- Separate seed script for E2E tests
- Teardown script removes all `TEST-*` data
- Database transactions for test isolation

### Secret Management
- Auth credentials via GitHub Secrets
- `.env.test` template (no real values)
- Encryption keys generated per environment

---

## Risk Assessment

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Flaky Auth0 tests | Use saved auth state, retry logic |
| Slow AI responses | Mock AI service in tests |
| Database state pollution | Transaction-based isolation |
| Browser inconsistencies | Cross-browser testing matrix |

### Complexity Hotspots
1. **Auth0 Integration**: Requires careful timing/waits
2. **PDF Upload/Extraction**: File handling + async processing
3. **Style Learning**: Requires multiple letter generations
4. **Email Sending**: Needs mock or test mode

---

## Out of Scope
- Load/performance testing
- Mobile device testing (beyond tablet)
- Real email delivery verification
- Real AI model testing (mocked)
- Visual regression testing
