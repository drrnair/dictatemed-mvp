// src/infrastructure/deepgram/keyterms.ts
// Cardiology vocabulary list for Deepgram transcription enhancement
// 100+ medical terms organized by category

export interface Keyterm {
  term: string;
  boost?: number; // 0-5, default 2.5
  category: KeytermCategory;
}

export type KeytermCategory =
  | 'anatomy'
  | 'procedure'
  | 'measurement'
  | 'condition'
  | 'device'
  | 'medication'
  | 'imaging'
  | 'rhythm';

// ============ Anatomy Terms ============
// Coronary arteries and cardiac structures

const anatomyTerms: Keyterm[] = [
  // Coronary arteries
  { term: 'LAD', category: 'anatomy', boost: 4 },
  { term: 'left anterior descending', category: 'anatomy' },
  { term: 'LCx', category: 'anatomy', boost: 4 },
  { term: 'left circumflex', category: 'anatomy' },
  { term: 'RCA', category: 'anatomy', boost: 4 },
  { term: 'right coronary artery', category: 'anatomy' },
  { term: 'LMCA', category: 'anatomy', boost: 4 },
  { term: 'left main coronary artery', category: 'anatomy' },
  { term: 'D1', category: 'anatomy', boost: 3 },
  { term: 'D2', category: 'anatomy', boost: 3 },
  { term: 'OM1', category: 'anatomy', boost: 3 },
  { term: 'OM2', category: 'anatomy', boost: 3 },
  { term: 'PDA', category: 'anatomy', boost: 3 },
  { term: 'posterior descending artery', category: 'anatomy' },
  { term: 'PLV', category: 'anatomy', boost: 3 },
  { term: 'posterolateral ventricular', category: 'anatomy' },
  { term: 'diagonal branch', category: 'anatomy' },
  { term: 'obtuse marginal', category: 'anatomy' },
  { term: 'ramus intermedius', category: 'anatomy' },

  // Cardiac chambers and structures
  { term: 'left ventricle', category: 'anatomy' },
  { term: 'right ventricle', category: 'anatomy' },
  { term: 'left atrium', category: 'anatomy' },
  { term: 'right atrium', category: 'anatomy' },
  { term: 'interventricular septum', category: 'anatomy' },
  { term: 'left atrial appendage', category: 'anatomy' },
  { term: 'LAA', category: 'anatomy', boost: 3 },
  { term: 'tricuspid valve', category: 'anatomy' },
  { term: 'mitral valve', category: 'anatomy' },
  { term: 'aortic valve', category: 'anatomy' },
  { term: 'pulmonary valve', category: 'anatomy' },
];

// ============ Procedure Terms ============
// Interventional and surgical procedures

const procedureTerms: Keyterm[] = [
  { term: 'TAVI', category: 'procedure', boost: 4 },
  { term: 'TAVR', category: 'procedure', boost: 4 },
  { term: 'transcatheter aortic valve implantation', category: 'procedure' },
  { term: 'TEER', category: 'procedure', boost: 4 },
  { term: 'transcatheter edge-to-edge repair', category: 'procedure' },
  { term: 'PCI', category: 'procedure', boost: 4 },
  { term: 'percutaneous coronary intervention', category: 'procedure' },
  { term: 'CABG', category: 'procedure', boost: 4 },
  { term: 'coronary artery bypass graft', category: 'procedure' },
  { term: 'ICD', category: 'procedure', boost: 3 },
  { term: 'implantable cardioverter defibrillator', category: 'procedure' },
  { term: 'CRT-D', category: 'procedure', boost: 4 },
  { term: 'CRT-P', category: 'procedure', boost: 4 },
  { term: 'cardiac resynchronization therapy', category: 'procedure' },
  { term: 'PPM', category: 'procedure', boost: 3 },
  { term: 'permanent pacemaker', category: 'procedure' },
  { term: 'angioplasty', category: 'procedure' },
  { term: 'angiogram', category: 'procedure' },
  { term: 'coronary angiography', category: 'procedure' },
  { term: 'ablation', category: 'procedure' },
  { term: 'catheter ablation', category: 'procedure' },
  { term: 'cardioversion', category: 'procedure' },
  { term: 'left atrial appendage closure', category: 'procedure' },
  { term: 'LAAC', category: 'procedure', boost: 3 },
];

// ============ Measurement Terms ============
// Cardiac function measurements and indices

const measurementTerms: Keyterm[] = [
  { term: 'LVEF', category: 'measurement', boost: 4 },
  { term: 'left ventricular ejection fraction', category: 'measurement' },
  { term: 'RVEF', category: 'measurement', boost: 3 },
  { term: 'right ventricular ejection fraction', category: 'measurement' },
  { term: 'GLS', category: 'measurement', boost: 3 },
  { term: 'global longitudinal strain', category: 'measurement' },
  { term: 'TAPSE', category: 'measurement', boost: 3 },
  { term: 'E/e prime', category: 'measurement', boost: 3 },
  { term: 'E/A ratio', category: 'measurement' },
  { term: 'LVEDP', category: 'measurement', boost: 3 },
  { term: 'left ventricular end-diastolic pressure', category: 'measurement' },
  { term: 'LVEDV', category: 'measurement', boost: 3 },
  { term: 'LVESV', category: 'measurement', boost: 3 },
  { term: 'PASP', category: 'measurement', boost: 3 },
  { term: 'pulmonary artery systolic pressure', category: 'measurement' },
  { term: 'cardiac output', category: 'measurement' },
  { term: 'stroke volume', category: 'measurement' },
  { term: 'fractional shortening', category: 'measurement' },
  { term: 'aortic valve area', category: 'measurement' },
  { term: 'AVA', category: 'measurement', boost: 3 },
  { term: 'mean gradient', category: 'measurement' },
  { term: 'peak gradient', category: 'measurement' },
  { term: 'troponin', category: 'measurement' },
  { term: 'BNP', category: 'measurement', boost: 3 },
  { term: 'NT-proBNP', category: 'measurement', boost: 3 },
];

// ============ Condition Terms ============
// Cardiac diagnoses and conditions

const conditionTerms: Keyterm[] = [
  { term: 'NSTEMI', category: 'condition', boost: 4 },
  { term: 'non-ST elevation myocardial infarction', category: 'condition' },
  { term: 'STEMI', category: 'condition', boost: 4 },
  { term: 'ST elevation myocardial infarction', category: 'condition' },
  { term: 'HFrEF', category: 'condition', boost: 4 },
  { term: 'heart failure with reduced ejection fraction', category: 'condition' },
  { term: 'HFpEF', category: 'condition', boost: 4 },
  { term: 'heart failure with preserved ejection fraction', category: 'condition' },
  { term: 'HFmrEF', category: 'condition', boost: 4 },
  { term: 'heart failure with mildly reduced ejection fraction', category: 'condition' },
  { term: 'atrial fibrillation', category: 'condition' },
  { term: 'AF', category: 'condition', boost: 3 },
  { term: 'AFib', category: 'condition', boost: 3 },
  { term: 'atrial flutter', category: 'condition' },
  { term: 'AFL', category: 'condition', boost: 3 },
  { term: 'aortic stenosis', category: 'condition' },
  { term: 'AS', category: 'condition' },
  { term: 'aortic regurgitation', category: 'condition' },
  { term: 'AR', category: 'condition' },
  { term: 'mitral regurgitation', category: 'condition' },
  { term: 'MR', category: 'condition' },
  { term: 'mitral stenosis', category: 'condition' },
  { term: 'MS', category: 'condition' },
  { term: 'tricuspid regurgitation', category: 'condition' },
  { term: 'TR', category: 'condition' },
  { term: 'cardiomyopathy', category: 'condition' },
  { term: 'hypertrophic cardiomyopathy', category: 'condition' },
  { term: 'HCM', category: 'condition', boost: 3 },
  { term: 'dilated cardiomyopathy', category: 'condition' },
  { term: 'DCM', category: 'condition', boost: 3 },
  { term: 'pericarditis', category: 'condition' },
  { term: 'endocarditis', category: 'condition' },
  { term: 'myocarditis', category: 'condition' },
];

// ============ Device Terms ============
// Implants, stents, and prosthetics

const deviceTerms: Keyterm[] = [
  { term: 'DES', category: 'device', boost: 3 },
  { term: 'drug-eluting stent', category: 'device' },
  { term: 'BMS', category: 'device', boost: 3 },
  { term: 'bare metal stent', category: 'device' },
  { term: 'Watchman', category: 'device', boost: 4 },
  { term: 'Amulet', category: 'device', boost: 4 },
  { term: 'MitraClip', category: 'device', boost: 4 },
  { term: 'TriClip', category: 'device', boost: 4 },
  { term: 'SAPIEN', category: 'device', boost: 4 },
  { term: 'SAPIEN 3', category: 'device', boost: 4 },
  { term: 'Evolut', category: 'device', boost: 4 },
  { term: 'Evolut Pro', category: 'device', boost: 4 },
  { term: 'Resolute', category: 'device', boost: 3 },
  { term: 'Xience', category: 'device', boost: 3 },
  { term: 'Synergy', category: 'device', boost: 3 },
  { term: 'Impella', category: 'device', boost: 4 },
  { term: 'IABP', category: 'device', boost: 3 },
  { term: 'intra-aortic balloon pump', category: 'device' },
  { term: 'ECMO', category: 'device', boost: 4 },
  { term: 'extracorporeal membrane oxygenation', category: 'device' },
  { term: 'LVAD', category: 'device', boost: 4 },
  { term: 'left ventricular assist device', category: 'device' },
];

// ============ Medication Terms ============
// Cardiac medications

const medicationTerms: Keyterm[] = [
  // Antiplatelet agents
  { term: 'Ticagrelor', category: 'medication', boost: 4 },
  { term: 'Prasugrel', category: 'medication', boost: 4 },
  { term: 'Clopidogrel', category: 'medication', boost: 3 },
  { term: 'Plavix', category: 'medication', boost: 3 },
  { term: 'Brilinta', category: 'medication', boost: 3 },
  { term: 'Effient', category: 'medication', boost: 3 },

  // Anticoagulants
  { term: 'Apixaban', category: 'medication', boost: 4 },
  { term: 'Rivaroxaban', category: 'medication', boost: 4 },
  { term: 'Dabigatran', category: 'medication', boost: 4 },
  { term: 'Edoxaban', category: 'medication', boost: 4 },
  { term: 'Eliquis', category: 'medication', boost: 3 },
  { term: 'Xarelto', category: 'medication', boost: 3 },
  { term: 'Pradaxa', category: 'medication', boost: 3 },
  { term: 'warfarin', category: 'medication' },

  // Heart failure medications
  { term: 'Entresto', category: 'medication', boost: 4 },
  { term: 'sacubitril valsartan', category: 'medication', boost: 4 },
  { term: 'Empagliflozin', category: 'medication', boost: 4 },
  { term: 'Dapagliflozin', category: 'medication', boost: 4 },
  { term: 'Jardiance', category: 'medication', boost: 3 },
  { term: 'Farxiga', category: 'medication', boost: 3 },
  { term: 'Spironolactone', category: 'medication' },
  { term: 'Eplerenone', category: 'medication' },

  // Beta blockers
  { term: 'Metoprolol', category: 'medication' },
  { term: 'Bisoprolol', category: 'medication' },
  { term: 'Carvedilol', category: 'medication' },

  // ACE inhibitors / ARBs
  { term: 'Ramipril', category: 'medication' },
  { term: 'Perindopril', category: 'medication' },
  { term: 'Candesartan', category: 'medication' },
  { term: 'Valsartan', category: 'medication' },
];

// ============ Imaging Terms ============
// Imaging modalities and findings

const imagingTerms: Keyterm[] = [
  { term: 'echocardiogram', category: 'imaging' },
  { term: 'transthoracic echo', category: 'imaging' },
  { term: 'TTE', category: 'imaging', boost: 3 },
  { term: 'transoesophageal echo', category: 'imaging' },
  { term: 'TOE', category: 'imaging', boost: 3 },
  { term: 'TEE', category: 'imaging', boost: 3 },
  { term: 'cardiac MRI', category: 'imaging' },
  { term: 'CMR', category: 'imaging', boost: 3 },
  { term: 'CT coronary angiogram', category: 'imaging' },
  { term: 'CTCA', category: 'imaging', boost: 3 },
  { term: 'myocardial perfusion scan', category: 'imaging' },
  { term: 'stress test', category: 'imaging' },
  { term: 'exercise stress test', category: 'imaging' },
  { term: 'dobutamine stress', category: 'imaging' },
  { term: 'wall motion abnormality', category: 'imaging' },
  { term: 'hypokinesis', category: 'imaging' },
  { term: 'akinesis', category: 'imaging' },
  { term: 'dyskinesis', category: 'imaging' },
];

// ============ Rhythm Terms ============
// Arrhythmias and conduction

const rhythmTerms: Keyterm[] = [
  { term: 'sinus rhythm', category: 'rhythm' },
  { term: 'NSR', category: 'rhythm' },
  { term: 'sinus bradycardia', category: 'rhythm' },
  { term: 'sinus tachycardia', category: 'rhythm' },
  { term: 'ventricular tachycardia', category: 'rhythm' },
  { term: 'VT', category: 'rhythm', boost: 3 },
  { term: 'ventricular fibrillation', category: 'rhythm' },
  { term: 'VF', category: 'rhythm', boost: 3 },
  { term: 'supraventricular tachycardia', category: 'rhythm' },
  { term: 'SVT', category: 'rhythm', boost: 3 },
  { term: 'AV block', category: 'rhythm' },
  { term: 'first degree AV block', category: 'rhythm' },
  { term: 'second degree AV block', category: 'rhythm' },
  { term: 'Mobitz type 1', category: 'rhythm' },
  { term: 'Mobitz type 2', category: 'rhythm' },
  { term: 'third degree AV block', category: 'rhythm' },
  { term: 'complete heart block', category: 'rhythm' },
  { term: 'LBBB', category: 'rhythm', boost: 3 },
  { term: 'left bundle branch block', category: 'rhythm' },
  { term: 'RBBB', category: 'rhythm', boost: 3 },
  { term: 'right bundle branch block', category: 'rhythm' },
  { term: 'premature ventricular contraction', category: 'rhythm' },
  { term: 'PVC', category: 'rhythm', boost: 3 },
  { term: 'premature atrial contraction', category: 'rhythm' },
  { term: 'PAC', category: 'rhythm', boost: 3 },
];

// ============ Export All Keyterms ============

export const allKeyterms: Keyterm[] = [
  ...anatomyTerms,
  ...procedureTerms,
  ...measurementTerms,
  ...conditionTerms,
  ...deviceTerms,
  ...medicationTerms,
  ...imagingTerms,
  ...rhythmTerms,
];

/**
 * Get keyterms formatted for Deepgram API.
 * Format: array of strings or { term: string, boost: number }
 */
export function getDeepgramKeyterms(): Array<string | { term: string; boost: number }> {
  return allKeyterms.map((k) =>
    k.boost !== undefined ? { term: k.term, boost: k.boost } : k.term
  );
}

/**
 * Get keyterms by category.
 */
export function getKeytermsByCategory(category: KeytermCategory): Keyterm[] {
  return allKeyterms.filter((k) => k.category === category);
}

/**
 * Get count of keyterms by category.
 */
export function getKeytermStats(): Record<KeytermCategory, number> {
  const stats = {} as Record<KeytermCategory, number>;
  for (const term of allKeyterms) {
    stats[term.category] = (stats[term.category] || 0) + 1;
  }
  return stats;
}

// Log keyterm count on module load (development only)
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.log(`Cardiology keyterms loaded: ${allKeyterms.length} terms`);
}
