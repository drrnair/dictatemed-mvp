// src/domains/letters/prompts/generation.ts
// Letter generation prompts for each letter type

import { buildBasePrompt, type StyleContext } from './base';

/**
 * Sources provided to the model for letter generation.
 */
export interface LetterSources {
  transcript?: {
    id: string;
    text: string;
    speakers?: Array<{ speaker: string; text: string; timestamp: number }> | undefined;
    mode: 'AMBIENT' | 'DICTATION';
  } | undefined;
  documents?: Array<{
    id: string;
    type: string;
    name: string;
    extractedData: Record<string, unknown>;
    rawText?: string | undefined;
  }> | undefined;
  userInput?: {
    id: string;
    text: string;
  } | undefined;
}

/**
 * Patient information (obfuscated before sending to LLM).
 */
export interface PatientInfo {
  nameToken: string; // Obfuscated, e.g., "PATIENT_001"
  dobToken: string; // Obfuscated
  medicareToken: string; // Obfuscated
  genderToken: string; // Obfuscated
}

/**
 * New patient consultation letter prompt.
 */
export function buildNewPatientPrompt(
  sources: LetterSources,
  patient: PatientInfo,
  styleContext: StyleContext | null = null
): string {
  const basePrompt = buildBasePrompt(styleContext);

  return `${basePrompt}

## Task: Generate New Patient Consultation Letter

You are drafting a letter to a referring GP about a NEW PATIENT cardiology consultation.

### Required Sections:

1. **Salutation and Re: Line**
   - "Dear Dr [Referring Doctor]," (if available in sources)
   - "Re: ${patient.nameToken}, DOB: ${patient.dobToken}, Medicare: ${patient.medicareToken}"

2. **Opening/Introduction**
   - Thank the GP for the referral
   - Briefly state the reason for referral (from sources)

3. **History of Presenting Complaint**
   - Detailed description of current cardiac symptoms
   - Onset, duration, character, aggravating/relieving factors
   - Associated symptoms
   - Impact on functional status

4. **Past Medical History**
   - Relevant cardiac history
   - Other significant medical conditions
   - Previous procedures/surgeries

5. **Medications**
   - Current cardiac medications with doses and frequencies
   - Other relevant medications
   - Allergies (if mentioned)

6. **Family History**
   - Relevant family cardiac history (if discussed)

7. **Social History**
   - Smoking status
   - Alcohol consumption
   - Occupation (if relevant to cardiac risk)
   - Exercise tolerance

8. **Examination Findings**
   - Vital signs (BP, HR, if recorded)
   - Cardiovascular examination findings
   - Relevant findings from other systems

9. **Investigations**
   - Results from any tests discussed or reviewed
   - Echo findings (if document provided)
   - Angiogram results (if document provided)
   - ECG, blood tests, etc.

10. **Assessment**
    - Clinical impression/diagnosis
    - Risk stratification (if applicable)

11. **Management Plan**
    - Medications started/changed
    - Procedures planned or performed
    - Lifestyle modifications discussed
    - Follow-up arrangements

12. **Closing**
    - "Please don't hesitate to contact me if you have any questions."
    - "Yours sincerely," or "Kind regards,"

### Sources Available:

${formatSources(sources)}

### Instructions:

- Use ALL information from the sources to create a comprehensive letter
- For ambient mode transcripts, extract clinical information from the physician's statements to the patient
- Include exact measurements and values from documents
- If key information is missing (e.g., no family history discussed), you may omit that section entirely or state "[Not discussed]"
- Focus on information relevant to the referring GP's ongoing care

Generate the complete letter now, ensuring every clinical fact has a {{SOURCE:id:excerpt}} anchor.
`;
}

/**
 * Follow-up consultation letter prompt.
 */
export function buildFollowUpPrompt(
  sources: LetterSources,
  patient: PatientInfo,
  styleContext: StyleContext | null = null
): string {
  const basePrompt = buildBasePrompt(styleContext);

  return `${basePrompt}

## Task: Generate Follow-Up Consultation Letter

You are drafting a letter to a referring GP about a FOLLOW-UP cardiology consultation.

### Required Sections:

1. **Salutation and Re: Line**
   - "Dear Dr [Referring Doctor],"
   - "Re: ${patient.nameToken}, DOB: ${patient.dobToken}, Medicare: ${patient.medicareToken}"

2. **Opening**
   - "I reviewed ${patient.nameToken} in clinic on [date]" (use consultation date from sources)
   - Brief context of ongoing care

3. **Interval History**
   - Changes in symptoms since last review
   - Compliance with medications
   - Any cardiac events or hospitalizations
   - Current functional status

4. **Current Medications**
   - List of current cardiac medications
   - Any changes made since last visit

5. **Examination**
   - Key findings on today's examination
   - Changes from previous exam (if mentioned)

6. **Investigations**
   - Any new test results reviewed today
   - Comparison to previous results (if relevant)

7. **Assessment**
   - Current status of cardiac condition(s)
   - Response to treatment
   - Any new concerns

8. **Plan**
   - Medication changes
   - Additional investigations ordered
   - Follow-up timing
   - Any referrals made

9. **Closing**
   - Standard closing remarks
   - "Yours sincerely," or "Kind regards,"

### Sources Available:

${formatSources(sources)}

### Instructions:

- Focus on what has CHANGED since the last visit
- Be concise - GPs appreciate brevity for follow-up letters
- Highlight any new issues or changes in management
- If the patient is stable with no changes, state this clearly

Generate the complete follow-up letter now with source anchors.
`;
}

/**
 * Angiogram procedure letter prompt.
 */
export function buildAngiogramProcedurePrompt(
  sources: LetterSources,
  patient: PatientInfo,
  styleContext: StyleContext | null = null
): string {
  const basePrompt = buildBasePrompt(styleContext);

  return `${basePrompt}

## Task: Generate Angiogram Procedure Letter

You are drafting a letter to a referring GP about a coronary angiogram ± PCI procedure.

### Required Sections:

1. **Salutation and Re: Line**
   - "Dear Dr [Referring Doctor],"
   - "Re: ${patient.nameToken}, DOB: ${patient.dobToken}, Medicare: ${patient.medicareToken}"

2. **Opening**
   - "I performed a coronary angiogram on ${patient.nameToken} on [date]"
   - Brief indication for procedure

3. **Clinical Context**
   - Presentation (e.g., STEMI, NSTEMI, stable angina, positive stress test)
   - Relevant history leading to procedure

4. **Procedure Details**
   - Access site (radial/femoral)
   - Conscious sedation or local anesthesia
   - Complications (if any)

5. **Angiographic Findings**
   - Dominance (right, left, co-dominant)
   - LMCA: [description with % stenosis]
   - LAD: [description with % stenosis and location]
   - LCx: [description with % stenosis]
   - RCA: [description with % stenosis]
   - Branches (D1, D2, OM1, OM2, etc.) if significant disease
   - Graft assessment (if CABG patient)

6. **Intervention (if PCI performed)**
   - Vessel(s) treated
   - Lesion characteristics (calcification, thrombus, etc.)
   - Stent type, size, and number
   - Pre-dilatation, post-dilatation
   - Final TIMI flow
   - Result

7. **Hemodynamics** (if measured)
   - LVEDP
   - Aortic pressures
   - Cardiac output/index (if done)

8. **Post-Procedure Course**
   - Immediate recovery
   - Access site hemostasis
   - Any complications

9. **Medications**
   - Dual antiplatelet therapy (specify duration)
   - Other cardiac medications
   - Changes made

10. **Plan**
    - Follow-up arrangements
    - When to resume normal activities
    - Driving restrictions (if applicable)
    - When to stop DAPT (if relevant)

11. **Closing**
    - "Yours sincerely," or "Kind regards,"

### Sources Available:

${formatSources(sources)}

### Instructions:

- Be precise with vessel descriptions and stenosis percentages
- Use standard coronary anatomy nomenclature
- If PCI was performed, clearly describe what was done and why
- Include both pre- and post-intervention appearance if stenting done
- Use TIMI flow grades (0-3) if mentioned

Generate the complete procedure letter now with source anchors.
`;
}

/**
 * Echo report letter prompt.
 */
export function buildEchoReportPrompt(
  sources: LetterSources,
  patient: PatientInfo,
  styleContext: StyleContext | null = null
): string {
  const basePrompt = buildBasePrompt(styleContext);

  return `${basePrompt}

## Task: Generate Echocardiogram Report Letter

You are drafting a letter to a referring GP summarizing an echocardiogram report.

### Required Sections:

1. **Salutation and Re: Line**
   - "Dear Dr [Referring Doctor],"
   - "Re: ${patient.nameToken}, DOB: ${patient.dobToken}, Medicare: ${patient.medicareToken}"
   - "Echocardiogram Report - [Date]"

2. **Opening**
   - Brief indication for echo
   - Comparison to previous echo (if mentioned)

3. **Left Ventricular Function**
   - LVEF (with method, e.g., "45% by biplane Simpson's")
   - LV dimensions (LVEDD, LVESD, IVS, PW)
   - Regional wall motion abnormalities (if any)
   - Global longitudinal strain (if available)

4. **Right Ventricular Function**
   - RV function (qualitative or RVEF)
   - TAPSE
   - RV S' velocity
   - RV dimensions

5. **Valvular Assessment**
   For each valve with significant findings:
   - **Aortic Valve**: Stenosis (mean/peak gradient, valve area, severity), Regurgitation (severity, mechanism)
   - **Mitral Valve**: Stenosis (mean gradient, valve area), Regurgitation (severity, ERO, mechanism)
   - **Tricuspid Valve**: Regurgitation severity, RVSP estimate
   - **Pulmonary Valve**: Any significant findings

6. **Diastolic Function**
   - E/A ratio
   - E/e' (septal and lateral)
   - LA pressure estimate
   - Deceleration time

7. **Other Findings**
   - Pericardial effusion (if present)
   - Intracardiac masses or thrombi
   - Aortic root dimensions
   - Any other significant findings

8. **Summary/Impression**
   - Key findings in 2-3 sentences
   - Comparison to previous studies (if available)
   - Clinical significance

9. **Recommendations**
   - Follow-up echo timing (if indicated)
   - Other investigations suggested
   - Clinical correlation

10. **Closing**
    - "Yours sincerely," or "Kind regards,"

### Sources Available:

${formatSources(sources)}

### Instructions:

- Extract exact measurements from the echo document
- Use standard echo terminology and abbreviations
- Report valve findings as both quantitative (gradients, areas) and qualitative (severity grading)
- Include units for all measurements
- If echo is normal, state this clearly and concisely

Generate the complete echo report letter now with source anchors.
`;
}

/**
 * Format sources for inclusion in prompt.
 */
function formatSources(sources: LetterSources): string {
  let formatted = '';

  if (sources.transcript) {
    formatted += `**Transcript** (ID: ${sources.transcript.id}, Mode: ${sources.transcript.mode})\n`;
    formatted += '```\n';
    if (sources.transcript.speakers && sources.transcript.speakers.length > 0) {
      // Ambient mode with speakers
      for (const segment of sources.transcript.speakers) {
        formatted += `[${segment.speaker} at ${Math.floor(segment.timestamp / 60)}:${String(segment.timestamp % 60).padStart(2, '0')}] ${segment.text}\n`;
      }
    } else {
      // Dictation mode or no speakers
      formatted += sources.transcript.text + '\n';
    }
    formatted += '```\n\n';
  }

  if (sources.documents && sources.documents.length > 0) {
    for (const doc of sources.documents) {
      formatted += `**Document** (ID: ${doc.id}, Type: ${doc.type}, Name: ${doc.name})\n`;
      formatted += '```json\n';
      formatted += JSON.stringify(doc.extractedData, null, 2) + '\n';
      formatted += '```\n';
      if (doc.rawText) {
        formatted += `Raw text: ${doc.rawText.substring(0, 500)}${doc.rawText.length > 500 ? '...' : ''}\n`;
      }
      formatted += '\n';
    }
  }

  if (sources.userInput) {
    formatted += `**User Input** (ID: ${sources.userInput.id})\n`;
    formatted += '```\n';
    formatted += sources.userInput.text + '\n';
    formatted += '```\n\n';
  }

  if (!formatted) {
    formatted = '(No sources provided - this should not happen)\n';
  }

  return formatted;
}

/**
 * Export all prompt builders.
 */
export const LETTER_PROMPTS = {
  NEW_PATIENT: buildNewPatientPrompt,
  FOLLOW_UP: buildFollowUpPrompt,
  ANGIOGRAM_PROCEDURE: buildAngiogramProcedurePrompt,
  ECHO_REPORT: buildEchoReportPrompt,
};
