// src/domains/letters/templates/template.types.ts
// Type definitions for subspecialty-driven letter templates

/**
 * Cardiology subspecialty categories.
 * Extensible for future specialty additions.
 */
export type Subspecialty =
  | 'GENERAL_CARDIOLOGY'
  | 'INTERVENTIONAL'
  | 'STRUCTURAL'
  | 'ELECTROPHYSIOLOGY'
  | 'IMAGING'
  | 'HEART_FAILURE'
  | 'CARDIAC_SURGERY';

/**
 * Human-readable labels for subspecialties.
 */
export const SUBSPECIALTY_LABELS: Record<Subspecialty, string> = {
  GENERAL_CARDIOLOGY: 'General Cardiology',
  INTERVENTIONAL: 'Interventional Cardiology',
  STRUCTURAL: 'Structural Heart',
  ELECTROPHYSIOLOGY: 'Electrophysiology',
  IMAGING: 'Cardiac Imaging',
  HEART_FAILURE: 'Heart Failure',
  CARDIAC_SURGERY: 'Cardiac Surgery',
};

/**
 * Descriptions for each subspecialty.
 */
export const SUBSPECIALTY_DESCRIPTIONS: Record<Subspecialty, string> = {
  GENERAL_CARDIOLOGY:
    'Comprehensive cardiac care, risk assessment, and preventive cardiology',
  INTERVENTIONAL:
    'PCI, angiography, and catheter-based coronary interventions',
  STRUCTURAL:
    'TAVI, MitraClip, LAA occlusion, and structural heart procedures',
  ELECTROPHYSIOLOGY:
    'Arrhythmia management, ablation, device implantation (PPM, ICD, CRT)',
  IMAGING:
    'Echocardiography, cardiac CT, cardiac MRI, nuclear cardiology',
  HEART_FAILURE:
    'Advanced heart failure, LVAD, transplant evaluation, cardiomyopathy',
  CARDIAC_SURGERY:
    'CABG, valve surgery, aortic surgery, surgical consultation letters',
};

/**
 * Template category for grouping templates.
 */
export type TemplateCategory =
  | 'CONSULTATION'
  | 'PROCEDURE'
  | 'DIAGNOSTIC'
  | 'FOLLOW_UP'
  | 'DISCHARGE';

/**
 * Human-readable labels for template categories.
 */
export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure Report',
  DIAGNOSTIC: 'Diagnostic Report',
  FOLLOW_UP: 'Follow-up',
  DISCHARGE: 'Discharge Summary',
};

/**
 * Letter template definition.
 */
export interface LetterTemplate {
  id: string;
  name: string;
  description?: string;
  slug: string;

  // Categorization
  category: TemplateCategory;
  subspecialties: Subspecialty[];
  isGeneric: boolean;

  // Hierarchy for variants
  parentId?: string;
  variants?: LetterTemplate[];

  // Template content
  promptTemplate: string;
  sectionOrder: string[];
  requiredSections: string[];
  optionalSections: string[];

  // Preview
  sampleContent?: string;

  // Metadata
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User's preferences for a specific template.
 */
export interface UserTemplatePreference {
  id: string;
  userId: string;
  templateId: string;
  isFavorite: boolean;
  usageCount: number;
  styleOverrides: Partial<TemplateStyleOverrides>;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Style overrides that can be set per-template.
 * These extend the user's global style profile.
 */
export interface TemplateStyleOverrides {
  greetingStyle?: 'formal' | 'casual' | 'mixed';
  closingStyle?: 'formal' | 'casual' | 'mixed';
  paragraphStructure?: 'long' | 'short' | 'mixed';
  medicationFormat?: 'generic' | 'brand' | 'both';
  clinicalValueFormat?: 'concise' | 'verbose' | 'mixed';
  formalityLevel?: 'very-formal' | 'formal' | 'neutral' | 'casual';
  customSectionOrder?: string[];
}

/**
 * Template with user preference data for display.
 */
export interface TemplateWithPreference extends LetterTemplate {
  userPreference?: UserTemplatePreference;
  // Computed fields for recommendations
  relevanceScore?: number;
  recommendationReason?: string;
}

/**
 * Template recommendation with scoring metadata.
 */
export interface TemplateRecommendation {
  template: LetterTemplate;
  score: number;
  reasons: RecommendationReason[];
}

export type RecommendationReason =
  | { type: 'subspecialty_match'; subspecialty: Subspecialty }
  | { type: 'favorite' }
  | { type: 'recently_used'; lastUsedAt: Date }
  | { type: 'frequently_used'; usageCount: number }
  | { type: 'generic' };

/**
 * Input for creating a new template (admin only).
 */
export interface CreateTemplateInput {
  name: string;
  description?: string;
  slug: string;
  category: TemplateCategory;
  subspecialties: Subspecialty[];
  isGeneric?: boolean;
  parentId?: string;
  promptTemplate: string;
  sectionOrder: string[];
  requiredSections: string[];
  optionalSections?: string[];
  sampleContent?: string;
  sortOrder?: number;
}

/**
 * Input for updating template preferences.
 */
export interface UpdateTemplatePreferenceInput {
  isFavorite?: boolean;
  styleOverrides?: Partial<TemplateStyleOverrides>;
}

/**
 * Query parameters for template listing.
 */
export interface TemplateListQuery {
  category?: TemplateCategory;
  subspecialty?: Subspecialty;
  includeGeneric?: boolean;
  favoritesOnly?: boolean;
  includeInactive?: boolean;
  parentId?: string;
}
