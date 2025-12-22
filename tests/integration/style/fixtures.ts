// tests/integration/style/fixtures.ts
// Shared test fixtures for style integration tests

import type { Subspecialty } from '@prisma/client';
import type {
  SubspecialtyStyleProfile,
  SubspecialtyConfidenceScores,
} from '@/domains/style/subspecialty-profile.types';

// ============ Mock User Data ============

export const mockUsers = {
  cardiologist: {
    id: 'user-cardiologist-001',
    name: 'Dr. Sarah Chen',
    email: 'sarah.chen@clinic.test',
    subspecialty: 'HEART_FAILURE' as Subspecialty,
  },
  epSpecialist: {
    id: 'user-ep-specialist-002',
    name: 'Dr. James Wilson',
    email: 'james.wilson@clinic.test',
    subspecialty: 'ELECTROPHYSIOLOGY' as Subspecialty,
  },
  surgeon: {
    id: 'user-surgeon-003',
    name: 'Dr. Maria Garcia',
    email: 'maria.garcia@clinic.test',
    subspecialty: 'CARDIAC_SURGERY' as Subspecialty,
  },
};

// ============ Mock Letter Data ============

export const mockLetterDrafts = {
  initialConsult: {
    id: 'letter-001',
    draft: `Dear Dr. Smith,

Thank you for the referral of [PATIENT_NAME].

History:
The patient presents with breathlessness on exertion.

Examination:
Heart sounds are dual with no murmurs.

Plan:
Order echocardiogram.
Follow up in 4 weeks.

Yours sincerely,
Dr. Chen`,
    final: `Dear Dr. Smith,

Thank you for the referral of [PATIENT_NAME]. I was pleased to review this patient in clinic today.

History:
The patient presents with breathlessness on exertion, which has been progressive over the past 3 months. They report orthopnoea and occasional PND. No chest pain.

Past Medical History:
- Hypertension (on treatment)
- Type 2 diabetes mellitus
- Hyperlipidaemia

Examination:
Heart sounds are dual with no murmurs. JVP not elevated. Chest is clear to auscultation. Mild bilateral ankle oedema noted.

Investigations:
ECG shows sinus rhythm with LVH.

Impression:
New onset heart failure with preserved ejection fraction, likely secondary to hypertensive heart disease.

Plan:
1. Commence low-dose diuretic (frusemide 20mg daily)
2. Optimise hypertension management
3. Order echocardiogram to assess LV function
4. Follow up in 4 weeks with results

Kind regards,
Dr. Sarah Chen
MBBS FRACP
Consultant Cardiologist`,
  },

  followUp: {
    id: 'letter-002',
    draft: `Dear Dr. Smith,

Review of [PATIENT_NAME].

History:
Patient doing well.

Plan:
Continue current medications.

Yours sincerely,
Dr. Chen`,
    final: `Dear Dr. Smith,

I reviewed [PATIENT_NAME] in follow-up clinic today regarding their heart failure management.

History:
The patient reports significant improvement in symptoms since commencing diuretic therapy. Breathlessness has improved from NYHA class III to class II. No further episodes of orthopnoea or PND. Good exercise tolerance with ability to walk 500 metres on flat ground.

Examination:
Well-appearing. Heart sounds dual, no murmurs. JVP normal. Chest clear. No peripheral oedema.

Investigations:
Recent echo shows preserved EF at 55% with mild diastolic dysfunction. BNP has normalised.

Impression:
Heart failure with preserved EF - well controlled on current therapy.

Plan:
1. Continue frusemide 20mg daily
2. Continue current antihypertensive regimen
3. Repeat echo in 12 months
4. Follow up in 6 months or earlier if symptoms recur

Kind regards,
Dr. Sarah Chen
MBBS FRACP
Consultant Cardiologist`,
  },
};

// ============ Mock Style Profiles ============

export const mockEmptyConfidence: SubspecialtyConfidenceScores = {
  sectionOrder: 0,
  sectionInclusion: 0,
  sectionVerbosity: 0,
  phrasingPreferences: 0,
  avoidedPhrases: 0,
  vocabularyMap: 0,
  terminologyLevel: 0,
  greetingStyle: 0,
  closingStyle: 0,
  signoffTemplate: 0,
  formalityLevel: 0,
  paragraphStructure: 0,
};

export const mockHighConfidence: SubspecialtyConfidenceScores = {
  sectionOrder: 0.85,
  sectionInclusion: 0.8,
  sectionVerbosity: 0.75,
  phrasingPreferences: 0.7,
  avoidedPhrases: 0.65,
  vocabularyMap: 0.7,
  terminologyLevel: 0.75,
  greetingStyle: 0.85,
  closingStyle: 0.85,
  signoffTemplate: 0.9,
  formalityLevel: 0.8,
  paragraphStructure: 0.7,
};

export function createMockProfile(
  userId: string,
  subspecialty: Subspecialty,
  overrides?: Partial<SubspecialtyStyleProfile>
): SubspecialtyStyleProfile {
  return {
    id: `profile-${userId}-${subspecialty}`,
    userId,
    subspecialty,
    sectionOrder: ['greeting', 'history', 'pmh', 'examination', 'investigations', 'impression', 'plan', 'signoff'],
    sectionInclusion: {
      pmh: 0.9,
      medications: 0.85,
      family_history: 0.3,
      social_history: 0.4,
    },
    sectionVerbosity: {
      history: 'detailed',
      examination: 'normal',
      plan: 'detailed',
    },
    phrasingPreferences: {
      greeting: ['I was pleased to review', 'Thank you for referring'],
      impression: ['In summary', 'The impression is'],
    },
    avoidedPhrases: {
      plan: ['patient should', 'it is felt that'],
    },
    vocabularyMap: {
      'utilise': 'use',
      'commence': 'start',
      'terminate': 'stop',
    },
    terminologyLevel: 'specialist',
    greetingStyle: 'formal',
    closingStyle: 'formal',
    signoffTemplate: 'Kind regards,\nDr. Sarah Chen\nMBBS FRACP\nConsultant Cardiologist',
    formalityLevel: 'formal',
    paragraphStructure: 'short',
    confidence: mockHighConfidence,
    learningStrength: 1.0,
    totalEditsAnalyzed: 25,
    lastAnalyzedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    ...overrides,
  };
}

// ============ Claude Response Mocks ============

export const mockClaudeAnalysisResponse = {
  content: `\`\`\`json
{
  "detectedSectionOrder": ["greeting", "history", "pmh", "examination", "investigations", "impression", "plan", "signoff"],
  "detectedSectionInclusion": {
    "pmh": 0.95,
    "medications": 0.85,
    "family_history": 0.3
  },
  "detectedSectionVerbosity": {
    "history": "detailed",
    "examination": "normal",
    "plan": "detailed"
  },
  "detectedPhrasing": {
    "greeting": ["I was pleased to review", "Thank you for referring"],
    "impression": ["In summary"]
  },
  "detectedAvoidedPhrases": {
    "plan": ["patient should"]
  },
  "detectedVocabulary": {
    "utilise": "use",
    "commence": "start"
  },
  "detectedTerminologyLevel": "specialist",
  "detectedGreetingStyle": "formal",
  "detectedClosingStyle": "formal",
  "detectedSignoff": "Kind regards,\\nDr. Sarah Chen",
  "detectedFormalityLevel": "formal",
  "detectedParagraphStructure": "short",
  "confidence": {
    "sectionOrder": 0.85,
    "sectionInclusion": 0.8,
    "sectionVerbosity": 0.75,
    "phrasingPreferences": 0.7,
    "avoidedPhrases": 0.6,
    "vocabularyMap": 0.65,
    "terminologyLevel": 0.75,
    "greetingStyle": 0.85,
    "closingStyle": 0.85,
    "signoffTemplate": 0.9,
    "formalityLevel": 0.8,
    "paragraphStructure": 0.7
  },
  "phrasePatterns": [
    {
      "phrase": "I was pleased to review",
      "sectionType": "greeting",
      "frequency": 8,
      "action": "preferred"
    }
  ],
  "sectionOrderPatterns": [
    {
      "order": ["greeting", "history", "pmh", "examination", "impression", "plan"],
      "frequency": 10
    }
  ],
  "insights": [
    "Physician consistently uses formal greetings and closings",
    "Detailed history and plan sections preferred",
    "PMH section always included"
  ]
}
\`\`\``,
  inputTokens: 2500,
  outputTokens: 800,
  modelId: 'claude-sonnet',
};

// ============ Prisma Mock Helpers ============

export function createMockPrisma() {
  return {
    styleProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    styleEdit: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    styleSeedLetter: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    letter: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    letterTemplate: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback({
      letter: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    })),
  };
}

// Import vi for mock helpers
import { vi } from 'vitest';
