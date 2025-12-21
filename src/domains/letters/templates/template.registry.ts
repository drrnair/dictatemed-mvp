// src/domains/letters/templates/template.registry.ts
// Registry of available letter templates with subspecialty tagging

import type {
  LetterTemplate,
  Subspecialty,
  TemplateCategory,
  CreateTemplateInput,
} from './template.types';

/**
 * Default section order for consultation letters.
 */
const CONSULTATION_SECTIONS = [
  'greeting',
  'introduction',
  'history',
  'examination',
  'investigations',
  'impression',
  'plan',
  'closing',
];

/**
 * Default section order for procedure reports.
 */
const PROCEDURE_SECTIONS = [
  'greeting',
  'procedure_summary',
  'indication',
  'procedure_details',
  'findings',
  'complications',
  'post_procedure_care',
  'recommendations',
  'closing',
];

/**
 * Default section order for diagnostic reports.
 */
const DIAGNOSTIC_SECTIONS = [
  'greeting',
  'indication',
  'technique',
  'findings',
  'measurements',
  'impression',
  'recommendations',
  'closing',
];

/**
 * Seed template definitions for initial database population.
 * These are used by the migration script to populate the letter_templates table.
 */
export const SEED_TEMPLATES: CreateTemplateInput[] = [
  // ============ GENERIC TEMPLATES ============
  {
    name: 'New Patient Consultation',
    description:
      'Comprehensive initial consultation letter for new cardiac patients',
    slug: 'new-patient-consultation',
    category: 'CONSULTATION',
    subspecialties: [],
    isGeneric: true,
    promptTemplate: `Generate a comprehensive new patient consultation letter. Include:
- Patient's presenting complaint and referral reason
- Relevant cardiac and medical history
- Cardiovascular risk factors
- Physical examination findings with vital signs
- Investigation results with interpretation
- Differential diagnoses or working diagnosis
- Management plan with medications, investigations, and follow-up
- Patient education provided`,
    sectionOrder: CONSULTATION_SECTIONS,
    requiredSections: ['greeting', 'history', 'examination', 'impression', 'plan', 'closing'],
    optionalSections: ['investigations', 'introduction'],
    sortOrder: 1,
  },
  {
    name: 'Follow-up Consultation',
    description: 'Follow-up letter for ongoing cardiac care',
    slug: 'follow-up-consultation',
    category: 'FOLLOW_UP',
    subspecialties: [],
    isGeneric: true,
    promptTemplate: `Generate a follow-up consultation letter. Include:
- Reason for follow-up and interval since last review
- Changes in symptoms or functional status
- Medication review and compliance
- Relevant investigation results
- Updated examination findings
- Progress assessment
- Updated management plan`,
    sectionOrder: CONSULTATION_SECTIONS,
    requiredSections: ['greeting', 'history', 'impression', 'plan', 'closing'],
    optionalSections: ['examination', 'investigations'],
    sortOrder: 2,
  },

  // ============ INTERVENTIONAL TEMPLATES ============
  {
    name: 'Coronary Angiogram Report',
    description: 'Diagnostic coronary angiography procedure report',
    slug: 'coronary-angiogram',
    category: 'PROCEDURE',
    subspecialties: ['INTERVENTIONAL'],
    isGeneric: false,
    promptTemplate: `Generate a coronary angiogram procedure report. Include:
- Indication for angiography
- Access site and technique
- Detailed coronary anatomy description using standard nomenclature:
  * Left main coronary artery (LMCA)
  * Left anterior descending (LAD) with diagonals
  * Left circumflex (LCx) with obtuse marginals
  * Right coronary artery (RCA) with branches
- Stenosis severity using visual or QCA estimation
- Dominance (right/left/co-dominant)
- LVEF if ventriculography performed
- Complications or access site issues
- Recommendations (PCI, CABG, medical management)`,
    sectionOrder: PROCEDURE_SECTIONS,
    requiredSections: ['indication', 'procedure_details', 'findings', 'recommendations'],
    optionalSections: ['complications', 'post_procedure_care'],
    sortOrder: 10,
  },
  {
    name: 'PCI Procedure Report',
    description: 'Percutaneous coronary intervention procedure report',
    slug: 'pci-procedure',
    category: 'PROCEDURE',
    subspecialties: ['INTERVENTIONAL'],
    isGeneric: false,
    promptTemplate: `Generate a PCI procedure report. Include:
- Indication and target lesion(s)
- Access site, sheath size, guide catheter
- Pre-intervention lesion characteristics
- Intervention details:
  * Predilation (balloon size, pressures)
  * Stent(s) deployed (type, size, deployment pressure)
  * Post-dilation if performed
  * Final TIMI flow
- Antithrombotic regimen used
- Complications or issues
- Post-procedure care instructions
- DAPT duration recommendation`,
    sectionOrder: PROCEDURE_SECTIONS,
    requiredSections: ['indication', 'procedure_details', 'findings', 'post_procedure_care', 'recommendations'],
    optionalSections: ['complications'],
    sortOrder: 11,
  },

  // ============ STRUCTURAL TEMPLATES ============
  {
    name: 'TAVI Procedure Report',
    description: 'Transcatheter aortic valve implantation report',
    slug: 'tavi-procedure',
    category: 'PROCEDURE',
    subspecialties: ['STRUCTURAL'],
    isGeneric: false,
    promptTemplate: `Generate a TAVI procedure report. Include:
- Indication (severe AS) with pre-procedure evaluation summary
- Valve type and size (e.g., Evolut PRO 29mm, SAPIEN 3 26mm)
- Access approach (transfemoral, transapical, subclavian)
- Procedural details:
  * Valve positioning and deployment
  * Pre/post-dilation if performed
  * Final gradients and paravalvular leak assessment
- Haemodynamic outcomes
- Conduction disturbances (new LBBB, high-grade AV block)
- Vascular complications
- Post-procedure echocardiography summary
- Follow-up plan including device clinic`,
    sectionOrder: PROCEDURE_SECTIONS,
    requiredSections: ['indication', 'procedure_details', 'findings', 'post_procedure_care', 'recommendations'],
    optionalSections: ['complications'],
    sortOrder: 20,
  },
  {
    name: 'LAA Occlusion Report',
    description: 'Left atrial appendage occlusion procedure report',
    slug: 'laa-occlusion',
    category: 'PROCEDURE',
    subspecialties: ['STRUCTURAL'],
    isGeneric: false,
    promptTemplate: `Generate an LAA occlusion procedure report. Include:
- Indication (AF with contraindication to anticoagulation)
- CHA2DS2-VASc and HAS-BLED scores
- Device type and size
- Procedural details with imaging guidance (TOE/ICE)
- Final device position and seal assessment
- Antiplatelet/anticoagulation plan post-procedure
- Follow-up imaging schedule`,
    sectionOrder: PROCEDURE_SECTIONS,
    requiredSections: ['indication', 'procedure_details', 'findings', 'recommendations'],
    optionalSections: ['complications', 'post_procedure_care'],
    sortOrder: 21,
  },

  // ============ ELECTROPHYSIOLOGY TEMPLATES ============
  {
    name: 'EP Study and Ablation Report',
    description: 'Electrophysiology study with/without ablation',
    slug: 'ep-study-ablation',
    category: 'PROCEDURE',
    subspecialties: ['ELECTROPHYSIOLOGY'],
    isGeneric: false,
    promptTemplate: `Generate an EP study and ablation report. Include:
- Indication (arrhythmia type, symptoms, prior management)
- Baseline intervals and conduction
- Arrhythmia inducibility and mechanism
- Ablation details if performed:
  * Target site(s)
  * Energy source (RF/cryo) and parameters
  * Endpoints achieved
- Fluoroscopy time and radiation dose
- Complications
- Antiarrhythmic medication changes
- Follow-up monitoring plan`,
    sectionOrder: PROCEDURE_SECTIONS,
    requiredSections: ['indication', 'procedure_details', 'findings', 'recommendations'],
    optionalSections: ['complications', 'post_procedure_care'],
    sortOrder: 30,
  },
  {
    name: 'Device Implant Report',
    description: 'Pacemaker, ICD, or CRT device implantation report',
    slug: 'device-implant',
    category: 'PROCEDURE',
    subspecialties: ['ELECTROPHYSIOLOGY'],
    isGeneric: false,
    promptTemplate: `Generate a cardiac device implantation report. Include:
- Indication (bradycardia, SCD prevention, HFrEF with LBBB, etc.)
- Device type (PPM, ICD, CRT-P, CRT-D) and manufacturer/model
- Lead positions and parameters:
  * Threshold, sensing, impedance for each lead
  * Defibrillation testing if performed
- Programming summary
- Wound assessment
- Driving and activity restrictions
- Device clinic follow-up schedule
- Remote monitoring setup`,
    sectionOrder: PROCEDURE_SECTIONS,
    requiredSections: ['indication', 'procedure_details', 'findings', 'post_procedure_care', 'recommendations'],
    optionalSections: ['complications'],
    sortOrder: 31,
  },
  {
    name: 'Device Check Report',
    description: 'Routine or symptom-driven device interrogation report',
    slug: 'device-check',
    category: 'FOLLOW_UP',
    subspecialties: ['ELECTROPHYSIOLOGY'],
    isGeneric: false,
    promptTemplate: `Generate a device check report. Include:
- Device type, manufacturer, model, implant date
- Battery status and estimated longevity
- Lead parameters (threshold, sensing, impedance)
- Pacing percentage (atrial and ventricular)
- Arrhythmia log review:
  * AT/AF burden
  * VT/VF episodes (for ICD/CRT-D)
  * Therapy delivered
- Programming changes made
- Clinical recommendations
- Next follow-up schedule`,
    sectionOrder: ['greeting', 'device_summary', 'parameters', 'arrhythmia_log', 'programming', 'recommendations', 'closing'],
    requiredSections: ['device_summary', 'parameters', 'recommendations'],
    optionalSections: ['arrhythmia_log', 'programming'],
    sortOrder: 32,
  },

  // ============ IMAGING TEMPLATES ============
  {
    name: 'Transthoracic Echocardiogram Report',
    description: 'TTE diagnostic report',
    slug: 'tte-report',
    category: 'DIAGNOSTIC',
    subspecialties: ['IMAGING'],
    isGeneric: false,
    promptTemplate: `Generate a transthoracic echocardiogram report. Include:
- Indication
- Image quality (good/fair/poor, limited views)
- LV assessment:
  * Size (LVIDd, LVIDs)
  * Wall thickness (IVS, PW)
  * Systolic function (LVEF by Simpson's biplane or visual)
  * Regional wall motion abnormalities
  * Diastolic function (E/A, E/e', LAVI)
- RV assessment (size, function, TAPSE, S')
- Valvular assessment for each valve
- Pericardium
- IVC and estimated RAP
- Comparison with prior studies if available
- Conclusion with key findings`,
    sectionOrder: DIAGNOSTIC_SECTIONS,
    requiredSections: ['indication', 'findings', 'measurements', 'impression'],
    optionalSections: ['technique', 'recommendations'],
    sortOrder: 40,
  },
  {
    name: 'Stress Echocardiogram Report',
    description: 'Exercise or pharmacological stress echo report',
    slug: 'stress-echo',
    category: 'DIAGNOSTIC',
    subspecialties: ['IMAGING'],
    isGeneric: false,
    parentId: undefined, // Set after creation
    promptTemplate: `Generate a stress echocardiogram report. Include:
- Indication
- Stress modality (treadmill, bike, dobutamine, adenosine)
- Protocol used (Bruce, modified Bruce, etc.)
- Exercise capacity (METs, duration, % predicted HR)
- Symptoms during test
- ECG changes
- Blood pressure response
- Wall motion at rest and peak stress by segment
- Change in LVEF from rest to peak
- Conclusion (positive/negative/equivocal for ischaemia)`,
    sectionOrder: [...DIAGNOSTIC_SECTIONS.slice(0, 2), 'protocol', 'exercise_data', ...DIAGNOSTIC_SECTIONS.slice(3)],
    requiredSections: ['indication', 'protocol', 'exercise_data', 'findings', 'impression'],
    optionalSections: ['technique', 'recommendations'],
    sortOrder: 41,
  },
  {
    name: 'Transoesophageal Echocardiogram Report',
    description: 'TOE diagnostic report',
    slug: 'toe-report',
    category: 'DIAGNOSTIC',
    subspecialties: ['IMAGING'],
    isGeneric: false,
    promptTemplate: `Generate a transoesophageal echocardiogram report. Include:
- Indication (endocarditis, LAA thrombus, valvular assessment, PFO, etc.)
- Sedation used
- Image quality
- Focused assessment based on indication
- Detailed valvular assessment if relevant
- LAA assessment (thrombus, flow velocities) if for AF
- Interatrial septum (PFO, ASD) if relevant
- Aortic assessment if indicated
- Conclusion addressing clinical question`,
    sectionOrder: DIAGNOSTIC_SECTIONS,
    requiredSections: ['indication', 'findings', 'impression'],
    optionalSections: ['technique', 'measurements', 'recommendations'],
    sortOrder: 42,
  },

  // ============ HEART FAILURE TEMPLATES ============
  {
    name: 'Heart Failure Consultation',
    description: 'Comprehensive heart failure assessment and management letter',
    slug: 'heart-failure-consultation',
    category: 'CONSULTATION',
    subspecialties: ['HEART_FAILURE'],
    isGeneric: false,
    promptTemplate: `Generate a heart failure consultation letter. Include:
- HF classification (HFrEF, HFmrEF, HFpEF) with LVEF
- NYHA functional class
- Aetiology of cardiomyopathy
- Volume status assessment
- Congestion markers (BNP/NT-proBNP, JVP, oedema)
- Haemodynamic profile (warm/cold, wet/dry)
- Current medications with target doses achieved
- Device therapy status/eligibility (ICD, CRT)
- Advanced therapies consideration (LVAD, transplant) if relevant
- Optimisation plan
- Monitoring schedule`,
    sectionOrder: CONSULTATION_SECTIONS,
    requiredSections: ['history', 'examination', 'impression', 'plan'],
    optionalSections: ['investigations', 'introduction'],
    sortOrder: 50,
  },
  {
    name: 'Heart Failure Discharge Summary',
    description: 'Discharge summary for heart failure admission',
    slug: 'hf-discharge-summary',
    category: 'DISCHARGE',
    subspecialties: ['HEART_FAILURE'],
    isGeneric: false,
    promptTemplate: `Generate a heart failure discharge summary. Include:
- Admission reason and presenting symptoms
- Working diagnosis with HF classification
- Key investigations during admission
- Treatment provided (diuretics, inotropes, device therapy)
- Discharge medications with dose changes highlighted
- Target weight and daily weight monitoring
- Fluid restriction advice
- Warning symptoms requiring medical review
- Follow-up appointments
- Heart failure nurse contact details`,
    sectionOrder: ['admission_summary', 'investigations', 'treatment', 'discharge_medications', 'patient_education', 'follow_up'],
    requiredSections: ['admission_summary', 'treatment', 'discharge_medications', 'follow_up'],
    optionalSections: ['investigations', 'patient_education'],
    sortOrder: 51,
  },

  // ============ CARDIAC SURGERY TEMPLATES ============
  {
    name: 'Pre-operative Cardiac Surgery Consultation',
    description: 'Pre-operative assessment for cardiac surgery',
    slug: 'preop-cardiac-surgery',
    category: 'CONSULTATION',
    subspecialties: ['CARDIAC_SURGERY'],
    isGeneric: false,
    promptTemplate: `Generate a pre-operative cardiac surgery consultation letter. Include:
- Planned procedure (CABG, valve surgery, combined)
- Indication and urgency
- Coronary anatomy if relevant
- Valve pathology details
- LV function and haemodynamics
- Surgical risk scores (EuroSCORE II, STS)
- Comorbidities affecting surgical risk
- Pre-operative investigations checklist
- Blood product requirements
- Antiplatelet/anticoagulation management
- Patient consent discussion summary`,
    sectionOrder: CONSULTATION_SECTIONS,
    requiredSections: ['history', 'examination', 'investigations', 'impression', 'plan'],
    optionalSections: ['introduction'],
    sortOrder: 60,
  },
  {
    name: 'Post-operative Cardiac Surgery Review',
    description: 'Post-operative follow-up after cardiac surgery',
    slug: 'postop-cardiac-surgery',
    category: 'FOLLOW_UP',
    subspecialties: ['CARDIAC_SURGERY'],
    isGeneric: false,
    promptTemplate: `Generate a post-operative cardiac surgery review letter. Include:
- Operation performed and date
- Post-operative course summary
- Wound healing assessment
- Current symptoms and functional status
- Post-operative echocardiogram results
- Current medications including anticoagulation
- Cardiac rehabilitation status
- Return to work/driving advice
- Follow-up investigations required
- Next review appointment`,
    sectionOrder: CONSULTATION_SECTIONS,
    requiredSections: ['history', 'examination', 'impression', 'plan'],
    optionalSections: ['investigations'],
    sortOrder: 61,
  },
];

/**
 * Get all subspecialties as an array.
 */
export function getAllSubspecialties(): Subspecialty[] {
  return [
    'GENERAL_CARDIOLOGY',
    'INTERVENTIONAL',
    'STRUCTURAL',
    'ELECTROPHYSIOLOGY',
    'IMAGING',
    'HEART_FAILURE',
    'CARDIAC_SURGERY',
  ];
}

/**
 * Get all template categories as an array.
 */
export function getAllTemplateCategories(): TemplateCategory[] {
  return ['CONSULTATION', 'PROCEDURE', 'DIAGNOSTIC', 'FOLLOW_UP', 'DISCHARGE'];
}

/**
 * Get templates for a specific subspecialty (including generic templates).
 */
export function filterTemplatesBySubspecialty(
  templates: LetterTemplate[],
  subspecialty: Subspecialty
): LetterTemplate[] {
  return templates.filter(
    (t) => t.isGeneric || t.subspecialties.includes(subspecialty)
  );
}

/**
 * Get templates by category.
 */
export function filterTemplatesByCategory(
  templates: LetterTemplate[],
  category: TemplateCategory
): LetterTemplate[] {
  return templates.filter((t) => t.category === category);
}

/**
 * Sort templates by relevance for a user based on their subspecialties.
 */
export function sortTemplatesByRelevance(
  templates: LetterTemplate[],
  userSubspecialties: Subspecialty[]
): LetterTemplate[] {
  return [...templates].sort((a, b) => {
    // Favorites first (handled externally with preference data)

    // Then by subspecialty match count
    const aMatches = a.subspecialties.filter((s) =>
      userSubspecialties.includes(s)
    ).length;
    const bMatches = b.subspecialties.filter((s) =>
      userSubspecialties.includes(s)
    ).length;

    if (aMatches !== bMatches) {
      return bMatches - aMatches; // More matches first
    }

    // Then generic templates
    if (a.isGeneric !== b.isGeneric) {
      return a.isGeneric ? 1 : -1; // Specific templates before generic
    }

    // Finally by sort order
    return a.sortOrder - b.sortOrder;
  });
}
