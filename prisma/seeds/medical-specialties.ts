// prisma/seeds/medical-specialties.ts
// Seed data for medical specialties and subspecialties
//
// Sources:
// - ABMS (American Board of Medical Specialties): https://www.abms.org/member-boards/
// - AHPRA (Australian Health Practitioner Regulation Agency): https://www.ahpra.gov.au/
// - RACGP (Royal Australian College of General Practitioners)
// - RACP (Royal Australasian College of Physicians)
//
// NOTE: Hardcoded UUIDs (00000000-0001-xxxx-xxxx-xxxxxxxxxxxx) are intentional.
// They enable reproducible seeding with upsert operations, ensuring the same
// reference data across all environments. Do not change to random UUIDs.

import { PrismaClient } from '@prisma/client';

// Helper to generate consistent UUIDs for seed data
// Format: 00000000-0001-{type}-{sequence}-000000000000
// type: 0001 = specialty, 0002 = subspecialty
function specialtyId(sequence: number): string {
  return `00000000-0001-0001-${sequence.toString().padStart(4, '0')}-000000000000`;
}

function subspecialtyId(specialtySeq: number, sequence: number): string {
  return `00000000-0001-0002-${specialtySeq.toString().padStart(2, '0')}${sequence.toString().padStart(2, '0')}-000000000000`;
}

// ============================================================================
// MEDICAL SPECIALTIES
// ============================================================================
// Curated list based on ABMS and AHPRA recognized specialties
// Ordered by category with priority areas first (Primary Care, Cardiology, Neurology, Surgery)

export interface SpecialtySeedData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  synonyms: string[];
}

export interface SubspecialtySeedData {
  id: string;
  specialtyId: string;
  name: string;
  slug: string;
  description?: string;
}

// Legacy Subspecialty enum values mapped to new model
// This mapping is used for data migration of existing users
export const LEGACY_SUBSPECIALTY_MAPPING: Record<string, { specialtyId: string; subspecialtyId: string }> = {
  GENERAL_CARDIOLOGY: { specialtyId: specialtyId(3), subspecialtyId: subspecialtyId(3, 1) },
  INTERVENTIONAL: { specialtyId: specialtyId(3), subspecialtyId: subspecialtyId(3, 2) },
  STRUCTURAL: { specialtyId: specialtyId(3), subspecialtyId: subspecialtyId(3, 3) },
  ELECTROPHYSIOLOGY: { specialtyId: specialtyId(3), subspecialtyId: subspecialtyId(3, 4) },
  IMAGING: { specialtyId: specialtyId(3), subspecialtyId: subspecialtyId(3, 5) },
  HEART_FAILURE: { specialtyId: specialtyId(3), subspecialtyId: subspecialtyId(3, 6) },
  // CARDIAC_SURGERY maps to Cardiothoracic Surgery specialty, not a subspecialty of Cardiology
  CARDIAC_SURGERY: { specialtyId: specialtyId(4), subspecialtyId: subspecialtyId(4, 1) },
};

export const SPECIALTIES: SpecialtySeedData[] = [
  // ========== PRIMARY CARE ==========
  {
    id: specialtyId(1),
    name: 'General Practice',
    slug: 'general-practice',
    description: 'Primary care medicine providing comprehensive healthcare across all ages and conditions',
    synonyms: ['GP', 'family medicine', 'family doctor', 'primary care', 'family physician'],
  },
  {
    id: specialtyId(2),
    name: 'Internal Medicine',
    slug: 'internal-medicine',
    description: 'Diagnosis and non-surgical treatment of diseases affecting internal organs',
    synonyms: ['internist', 'general medicine', 'physician', 'general physician'],
  },

  // ========== CARDIOLOGY & CARDIOVASCULAR ==========
  {
    id: specialtyId(3),
    name: 'Cardiology',
    slug: 'cardiology',
    description: 'Diagnosis and treatment of heart and blood vessel disorders',
    synonyms: ['cardiologist', 'heart doctor', 'cardiac medicine', 'cardiovascular medicine'],
  },
  {
    id: specialtyId(4),
    name: 'Cardiothoracic Surgery',
    slug: 'cardiothoracic-surgery',
    description: 'Surgical treatment of diseases affecting the heart, lungs, and chest',
    synonyms: ['cardiac surgery', 'heart surgery', 'CT surgery', 'cardiovascular surgery'],
  },
  {
    id: specialtyId(5),
    name: 'Vascular Surgery',
    slug: 'vascular-surgery',
    description: 'Surgical treatment of diseases affecting arteries and veins',
    synonyms: ['vascular surgeon', 'blood vessel surgery'],
  },

  // ========== NEUROSCIENCES ==========
  {
    id: specialtyId(6),
    name: 'Neurology',
    slug: 'neurology',
    description: 'Diagnosis and treatment of disorders of the nervous system',
    synonyms: ['neurologist', 'brain doctor', 'nerve doctor', 'neurological medicine'],
  },
  {
    id: specialtyId(7),
    name: 'Neurosurgery',
    slug: 'neurosurgery',
    description: 'Surgical treatment of disorders affecting the brain, spine, and nervous system',
    synonyms: ['neurosurgeon', 'brain surgery', 'spine surgery'],
  },

  // ========== SURGICAL SPECIALTIES ==========
  {
    id: specialtyId(8),
    name: 'General Surgery',
    slug: 'general-surgery',
    description: 'Surgical treatment of abdominal organs, trauma, and soft tissue',
    synonyms: ['general surgeon', 'surgeon'],
  },
  {
    id: specialtyId(9),
    name: 'Orthopaedic Surgery',
    slug: 'orthopaedic-surgery',
    description: 'Surgical treatment of musculoskeletal system disorders',
    synonyms: ['orthopaedics', 'orthopedics', 'ortho', 'bone doctor', 'bone surgery', 'orthopedic surgery'],
  },
  {
    id: specialtyId(10),
    name: 'Thoracic Surgery',
    slug: 'thoracic-surgery',
    description: 'Surgical treatment of diseases affecting the chest, excluding the heart',
    synonyms: ['thoracic surgeon', 'lung surgery', 'chest surgery'],
  },
  {
    id: specialtyId(11),
    name: 'Plastic Surgery',
    slug: 'plastic-surgery',
    description: 'Reconstructive and cosmetic surgery',
    synonyms: ['plastic surgeon', 'reconstructive surgery', 'cosmetic surgery'],
  },
  {
    id: specialtyId(12),
    name: 'Urology',
    slug: 'urology',
    description: 'Diagnosis and treatment of urinary tract and male reproductive system disorders',
    synonyms: ['urologist', 'urological surgery'],
  },

  // ========== MEDICAL SUBSPECIALTIES ==========
  {
    id: specialtyId(13),
    name: 'Gastroenterology',
    slug: 'gastroenterology',
    description: 'Diagnosis and treatment of digestive system disorders',
    synonyms: ['gastroenterologist', 'GI', 'gut doctor', 'digestive medicine'],
  },
  {
    id: specialtyId(14),
    name: 'Respiratory Medicine',
    slug: 'respiratory-medicine',
    description: 'Diagnosis and treatment of lung and respiratory disorders',
    synonyms: ['pulmonology', 'pulmonologist', 'lung doctor', 'thoracic medicine', 'chest medicine'],
  },
  {
    id: specialtyId(15),
    name: 'Endocrinology',
    slug: 'endocrinology',
    description: 'Diagnosis and treatment of hormone and metabolic disorders',
    synonyms: ['endocrinologist', 'diabetes doctor', 'thyroid doctor', 'hormone doctor'],
  },
  {
    id: specialtyId(16),
    name: 'Rheumatology',
    slug: 'rheumatology',
    description: 'Diagnosis and treatment of autoimmune and musculoskeletal disorders',
    synonyms: ['rheumatologist', 'arthritis doctor', 'autoimmune specialist'],
  },
  {
    id: specialtyId(17),
    name: 'Nephrology',
    slug: 'nephrology',
    description: 'Diagnosis and treatment of kidney disorders',
    synonyms: ['nephrologist', 'kidney doctor', 'renal medicine'],
  },
  {
    id: specialtyId(18),
    name: 'Infectious Diseases',
    slug: 'infectious-diseases',
    description: 'Diagnosis and treatment of infections caused by bacteria, viruses, fungi, and parasites',
    synonyms: ['ID', 'infection specialist'],
  },

  // ========== ONCOLOGY & HAEMATOLOGY ==========
  {
    id: specialtyId(19),
    name: 'Medical Oncology',
    slug: 'medical-oncology',
    description: 'Non-surgical treatment of cancer using chemotherapy and targeted therapies',
    synonyms: ['oncologist', 'cancer doctor', 'oncology'],
  },
  {
    id: specialtyId(20),
    name: 'Radiation Oncology',
    slug: 'radiation-oncology',
    description: 'Treatment of cancer using radiation therapy',
    synonyms: ['radiation oncologist', 'radiotherapy'],
  },
  {
    id: specialtyId(21),
    name: 'Haematology',
    slug: 'haematology',
    description: 'Diagnosis and treatment of blood disorders',
    synonyms: ['hematology', 'haematologist', 'hematologist', 'blood doctor'],
  },

  // ========== HEAD & SENSORY ==========
  {
    id: specialtyId(22),
    name: 'Otolaryngology',
    slug: 'otolaryngology',
    description: 'Diagnosis and treatment of ear, nose, and throat disorders',
    synonyms: ['ENT', 'ear nose throat', 'head and neck surgery', 'ENT surgeon'],
  },
  {
    id: specialtyId(23),
    name: 'Ophthalmology',
    slug: 'ophthalmology',
    description: 'Diagnosis and treatment of eye disorders',
    synonyms: ['ophthalmologist', 'eye doctor', 'eye surgery', 'eye surgeon'],
  },
  {
    id: specialtyId(24),
    name: 'Dermatology',
    slug: 'dermatology',
    description: 'Diagnosis and treatment of skin, hair, and nail disorders',
    synonyms: ['dermatologist', 'skin doctor', 'skin specialist'],
  },

  // ========== CRITICAL CARE & ANAESTHESIA ==========
  {
    id: specialtyId(25),
    name: 'Anaesthesiology',
    slug: 'anaesthesiology',
    description: 'Perioperative care, anaesthesia, and pain management',
    synonyms: ['anesthesiology', 'anaesthetist', 'anesthesiologist', 'anaesthetics'],
  },
  {
    id: specialtyId(26),
    name: 'Intensive Care Medicine',
    slug: 'intensive-care-medicine',
    description: 'Care of critically ill patients in intensive care units',
    synonyms: ['ICU', 'critical care', 'intensivist', 'ICU doctor'],
  },
  {
    id: specialtyId(27),
    name: 'Emergency Medicine',
    slug: 'emergency-medicine',
    description: 'Acute care for patients with urgent medical conditions',
    synonyms: ['EM', 'emergency doctor', 'ED', 'emergency room', 'A&E'],
  },

  // ========== WOMEN'S & CHILDREN'S HEALTH ==========
  {
    id: specialtyId(28),
    name: 'Obstetrics & Gynaecology',
    slug: 'obstetrics-gynaecology',
    description: 'Healthcare for women including pregnancy, childbirth, and reproductive health',
    synonyms: ['O&G', 'OB-GYN', 'obstetrician', 'gynaecologist', 'gynecologist', 'womens health'],
  },
  {
    id: specialtyId(29),
    name: 'Paediatrics',
    slug: 'paediatrics',
    description: 'Medical care for infants, children, and adolescents',
    synonyms: ['pediatrics', 'paediatrician', 'pediatrician', 'child health', 'kids doctor'],
  },
  {
    id: specialtyId(30),
    name: 'Neonatology',
    slug: 'neonatology',
    description: 'Care of newborn infants, especially premature and critically ill neonates',
    synonyms: ['neonatologist', 'newborn medicine', 'NICU'],
  },

  // ========== MENTAL HEALTH ==========
  {
    id: specialtyId(31),
    name: 'Psychiatry',
    slug: 'psychiatry',
    description: 'Diagnosis and treatment of mental health disorders',
    synonyms: ['psychiatrist', 'mental health doctor', 'psych'],
  },

  // ========== RADIOLOGY ==========
  {
    id: specialtyId(32),
    name: 'Diagnostic Radiology',
    slug: 'diagnostic-radiology',
    description: 'Medical imaging for diagnosis of diseases',
    synonyms: ['radiologist', 'imaging', 'radiology', 'X-ray doctor'],
  },
  {
    id: specialtyId(33),
    name: 'Interventional Radiology',
    slug: 'interventional-radiology',
    description: 'Minimally invasive image-guided procedures for diagnosis and treatment',
    synonyms: ['IR', 'interventional radiologist'],
  },
  {
    id: specialtyId(34),
    name: 'Nuclear Medicine',
    slug: 'nuclear-medicine',
    description: 'Use of radioactive materials for diagnosis and treatment',
    synonyms: ['nuclear medicine physician'],
  },

  // ========== OTHER SPECIALTIES ==========
  {
    id: specialtyId(35),
    name: 'Geriatric Medicine',
    slug: 'geriatric-medicine',
    description: 'Healthcare for elderly patients',
    synonyms: ['geriatrician', 'aged care', 'elderly medicine', 'geriatrics'],
  },
  {
    id: specialtyId(36),
    name: 'Palliative Medicine',
    slug: 'palliative-medicine',
    description: 'Care focused on comfort and quality of life for patients with serious illness',
    synonyms: ['palliative care', 'hospice', 'end of life care'],
  },
  {
    id: specialtyId(37),
    name: 'Rehabilitation Medicine',
    slug: 'rehabilitation-medicine',
    description: 'Physical medicine and rehabilitation after injury or illness',
    synonyms: ['physiatry', 'PM&R', 'rehab medicine', 'physical medicine'],
  },
  {
    id: specialtyId(38),
    name: 'Sports Medicine',
    slug: 'sports-medicine',
    description: 'Prevention and treatment of sports-related injuries',
    synonyms: ['sports doctor', 'sports physician'],
  },
  {
    id: specialtyId(39),
    name: 'Pain Medicine',
    slug: 'pain-medicine',
    description: 'Diagnosis and treatment of chronic pain conditions',
    synonyms: ['pain specialist', 'pain management', 'pain doctor'],
  },
  {
    id: specialtyId(40),
    name: 'Pathology',
    slug: 'pathology',
    description: 'Laboratory diagnosis of disease through examination of tissues and fluids',
    synonyms: ['pathologist', 'laboratory medicine'],
  },
  {
    id: specialtyId(41),
    name: 'Clinical Genetics',
    slug: 'clinical-genetics',
    description: 'Diagnosis and management of genetic disorders',
    synonyms: ['geneticist', 'genetic medicine', 'medical genetics'],
  },
  {
    id: specialtyId(42),
    name: 'Immunology & Allergy',
    slug: 'immunology-allergy',
    description: 'Diagnosis and treatment of immune system disorders and allergies',
    synonyms: ['immunologist', 'allergist', 'allergy doctor', 'clinical immunology'],
  },
];

// ============================================================================
// SUBSPECIALTIES
// ============================================================================
// Focus on priority areas: Cardiology, Cardiothoracic Surgery, Neurology, GP
// Other specialties have minimal subspecialties for now

export const SUBSPECIALTIES: SubspecialtySeedData[] = [
  // ========== GENERAL PRACTICE SUBSPECIALTIES ==========
  {
    id: subspecialtyId(1, 1),
    specialtyId: specialtyId(1),
    name: "Women's Health",
    slug: 'womens-health',
    description: 'Focus on health issues specific to women',
  },
  {
    id: subspecialtyId(1, 2),
    specialtyId: specialtyId(1),
    name: 'Sexual Health',
    slug: 'sexual-health',
    description: 'Focus on sexual and reproductive health',
  },
  {
    id: subspecialtyId(1, 3),
    specialtyId: specialtyId(1),
    name: 'Chronic Disease Management',
    slug: 'chronic-disease-management',
    description: 'Ongoing management of chronic conditions like diabetes, hypertension',
  },
  {
    id: subspecialtyId(1, 4),
    specialtyId: specialtyId(1),
    name: 'Mental Health',
    slug: 'gp-mental-health',
    description: 'Primary care mental health including anxiety and depression',
  },
  {
    id: subspecialtyId(1, 5),
    specialtyId: specialtyId(1),
    name: 'Aged Care',
    slug: 'aged-care',
    description: 'Primary care for elderly patients',
  },
  {
    id: subspecialtyId(1, 6),
    specialtyId: specialtyId(1),
    name: 'Sports Medicine',
    slug: 'gp-sports-medicine',
    description: 'Sports injuries and exercise medicine in primary care',
  },
  {
    id: subspecialtyId(1, 7),
    specialtyId: specialtyId(1),
    name: 'Addiction Medicine',
    slug: 'addiction-medicine',
    description: 'Treatment of substance use disorders in primary care',
  },
  {
    id: subspecialtyId(1, 8),
    specialtyId: specialtyId(1),
    name: 'Paediatrics',
    slug: 'gp-paediatrics',
    description: 'Primary care for children and adolescents',
  },

  // ========== CARDIOLOGY SUBSPECIALTIES ==========
  // These map to the legacy Subspecialty enum values
  {
    id: subspecialtyId(3, 1),
    specialtyId: specialtyId(3),
    name: 'General Cardiology',
    slug: 'general-cardiology',
    description: 'Comprehensive cardiac care including diagnosis and medical management',
  },
  {
    id: subspecialtyId(3, 2),
    specialtyId: specialtyId(3),
    name: 'Interventional Cardiology',
    slug: 'interventional-cardiology',
    description: 'Catheter-based procedures including PCI, stenting, and structural interventions',
  },
  {
    id: subspecialtyId(3, 3),
    specialtyId: specialtyId(3),
    name: 'Structural Heart',
    slug: 'structural-heart',
    description: 'Transcatheter treatment of structural heart disease including TAVI, MitraClip',
  },
  {
    id: subspecialtyId(3, 4),
    specialtyId: specialtyId(3),
    name: 'Electrophysiology',
    slug: 'electrophysiology',
    description: 'Diagnosis and treatment of cardiac arrhythmias including ablation and device implantation',
  },
  {
    id: subspecialtyId(3, 5),
    specialtyId: specialtyId(3),
    name: 'Cardiac Imaging',
    slug: 'cardiac-imaging',
    description: 'Advanced cardiac imaging including echocardiography, CT, and MRI',
  },
  {
    id: subspecialtyId(3, 6),
    specialtyId: specialtyId(3),
    name: 'Heart Failure & Transplant',
    slug: 'heart-failure-transplant',
    description: 'Advanced heart failure management including mechanical support and transplantation',
  },
  {
    id: subspecialtyId(3, 7),
    specialtyId: specialtyId(3),
    name: 'Adult Congenital Heart Disease',
    slug: 'adult-congenital-heart-disease',
    description: 'Care of adults with congenital heart defects',
  },
  {
    id: subspecialtyId(3, 8),
    specialtyId: specialtyId(3),
    name: 'Preventive Cardiology',
    slug: 'preventive-cardiology',
    description: 'Cardiovascular risk assessment and prevention',
  },

  // ========== CARDIOTHORACIC SURGERY SUBSPECIALTIES ==========
  {
    id: subspecialtyId(4, 1),
    specialtyId: specialtyId(4),
    name: 'Adult Cardiac Surgery',
    slug: 'adult-cardiac-surgery',
    description: 'CABG, valve surgery, and aortic surgery in adults',
  },
  {
    id: subspecialtyId(4, 2),
    specialtyId: specialtyId(4),
    name: 'General Thoracic Surgery',
    slug: 'general-thoracic-surgery',
    description: 'Lung resection, esophageal surgery, and chest wall surgery',
  },
  {
    id: subspecialtyId(4, 3),
    specialtyId: specialtyId(4),
    name: 'Congenital Cardiac Surgery',
    slug: 'congenital-cardiac-surgery',
    description: 'Surgical repair of congenital heart defects in children and adults',
  },
  {
    id: subspecialtyId(4, 4),
    specialtyId: specialtyId(4),
    name: 'Heart & Lung Transplant',
    slug: 'heart-lung-transplant',
    description: 'Heart and lung transplantation surgery',
  },
  {
    id: subspecialtyId(4, 5),
    specialtyId: specialtyId(4),
    name: 'Mechanical Circulatory Support',
    slug: 'mechanical-circulatory-support',
    description: 'VAD implantation and ECMO management',
  },

  // ========== NEUROLOGY SUBSPECIALTIES ==========
  {
    id: subspecialtyId(6, 1),
    specialtyId: specialtyId(6),
    name: 'Stroke & Vascular Neurology',
    slug: 'stroke-vascular-neurology',
    description: 'Prevention, acute treatment, and rehabilitation of stroke',
  },
  {
    id: subspecialtyId(6, 2),
    specialtyId: specialtyId(6),
    name: 'Epilepsy',
    slug: 'epilepsy',
    description: 'Diagnosis and management of seizure disorders',
  },
  {
    id: subspecialtyId(6, 3),
    specialtyId: specialtyId(6),
    name: 'Movement Disorders',
    slug: 'movement-disorders',
    description: "Parkinson's disease, dystonia, tremor, and other movement disorders",
  },
  {
    id: subspecialtyId(6, 4),
    specialtyId: specialtyId(6),
    name: 'Neuromuscular Medicine',
    slug: 'neuromuscular-medicine',
    description: 'Disorders of peripheral nerves, muscles, and neuromuscular junction',
  },
  {
    id: subspecialtyId(6, 5),
    specialtyId: specialtyId(6),
    name: 'Multiple Sclerosis & Neuroimmunology',
    slug: 'ms-neuroimmunology',
    description: 'MS and other autoimmune neurological conditions',
  },
  {
    id: subspecialtyId(6, 6),
    specialtyId: specialtyId(6),
    name: 'Cognitive & Behavioural Neurology',
    slug: 'cognitive-behavioural-neurology',
    description: 'Dementia, memory disorders, and neuropsychiatry',
  },
  {
    id: subspecialtyId(6, 7),
    specialtyId: specialtyId(6),
    name: 'Headache Medicine',
    slug: 'headache-medicine',
    description: 'Migraine and other headache disorders',
  },
  {
    id: subspecialtyId(6, 8),
    specialtyId: specialtyId(6),
    name: 'Neurophysiology',
    slug: 'neurophysiology',
    description: 'EEG, EMG, and nerve conduction studies',
  },

  // ========== GASTROENTEROLOGY SUBSPECIALTIES ==========
  {
    id: subspecialtyId(13, 1),
    specialtyId: specialtyId(13),
    name: 'Hepatology',
    slug: 'hepatology',
    description: 'Liver diseases including viral hepatitis, cirrhosis, and transplant',
  },
  {
    id: subspecialtyId(13, 2),
    specialtyId: specialtyId(13),
    name: 'Inflammatory Bowel Disease',
    slug: 'inflammatory-bowel-disease',
    description: "Crohn's disease and ulcerative colitis",
  },
  {
    id: subspecialtyId(13, 3),
    specialtyId: specialtyId(13),
    name: 'Therapeutic Endoscopy',
    slug: 'therapeutic-endoscopy',
    description: 'Advanced endoscopic procedures including ERCP and EUS',
  },

  // ========== RESPIRATORY MEDICINE SUBSPECIALTIES ==========
  {
    id: subspecialtyId(14, 1),
    specialtyId: specialtyId(14),
    name: 'Sleep Medicine',
    slug: 'sleep-medicine',
    description: 'Sleep disorders including sleep apnea and insomnia',
  },
  {
    id: subspecialtyId(14, 2),
    specialtyId: specialtyId(14),
    name: 'Interstitial Lung Disease',
    slug: 'interstitial-lung-disease',
    description: 'Pulmonary fibrosis and other interstitial lung diseases',
  },
  {
    id: subspecialtyId(14, 3),
    specialtyId: specialtyId(14),
    name: 'Interventional Pulmonology',
    slug: 'interventional-pulmonology',
    description: 'Bronchoscopy and pleural procedures',
  },

  // ========== ORTHOPAEDIC SURGERY SUBSPECIALTIES ==========
  {
    id: subspecialtyId(9, 1),
    specialtyId: specialtyId(9),
    name: 'Joint Replacement',
    slug: 'joint-replacement',
    description: 'Hip, knee, and other joint arthroplasty',
  },
  {
    id: subspecialtyId(9, 2),
    specialtyId: specialtyId(9),
    name: 'Spine Surgery',
    slug: 'ortho-spine-surgery',
    description: 'Surgical treatment of spinal disorders',
  },
  {
    id: subspecialtyId(9, 3),
    specialtyId: specialtyId(9),
    name: 'Sports Surgery',
    slug: 'sports-surgery',
    description: 'ACL reconstruction and sports-related injuries',
  },
  {
    id: subspecialtyId(9, 4),
    specialtyId: specialtyId(9),
    name: 'Hand & Upper Limb',
    slug: 'hand-upper-limb',
    description: 'Surgery of the hand, wrist, elbow, and shoulder',
  },
  {
    id: subspecialtyId(9, 5),
    specialtyId: specialtyId(9),
    name: 'Foot & Ankle',
    slug: 'foot-ankle',
    description: 'Surgery of the foot and ankle',
  },
  {
    id: subspecialtyId(9, 6),
    specialtyId: specialtyId(9),
    name: 'Trauma',
    slug: 'ortho-trauma',
    description: 'Fractures and orthopaedic trauma',
  },
  {
    id: subspecialtyId(9, 7),
    specialtyId: specialtyId(9),
    name: 'Paediatric Orthopaedics',
    slug: 'paediatric-orthopaedics',
    description: 'Musculoskeletal conditions in children',
  },

  // ========== PSYCHIATRY SUBSPECIALTIES ==========
  {
    id: subspecialtyId(31, 1),
    specialtyId: specialtyId(31),
    name: 'Child & Adolescent Psychiatry',
    slug: 'child-adolescent-psychiatry',
    description: 'Mental health care for children and adolescents',
  },
  {
    id: subspecialtyId(31, 2),
    specialtyId: specialtyId(31),
    name: 'Consultation-Liaison Psychiatry',
    slug: 'consultation-liaison-psychiatry',
    description: 'Psychiatric care in medical settings',
  },
  {
    id: subspecialtyId(31, 3),
    specialtyId: specialtyId(31),
    name: 'Addiction Psychiatry',
    slug: 'addiction-psychiatry',
    description: 'Treatment of substance use disorders',
  },
  {
    id: subspecialtyId(31, 4),
    specialtyId: specialtyId(31),
    name: 'Forensic Psychiatry',
    slug: 'forensic-psychiatry',
    description: 'Psychiatry at the intersection of mental health and law',
  },
  {
    id: subspecialtyId(31, 5),
    specialtyId: specialtyId(31),
    name: 'Geriatric Psychiatry',
    slug: 'geriatric-psychiatry',
    description: 'Mental health care for elderly patients',
  },

  // ========== OBSTETRICS & GYNAECOLOGY SUBSPECIALTIES ==========
  {
    id: subspecialtyId(28, 1),
    specialtyId: specialtyId(28),
    name: 'Maternal-Fetal Medicine',
    slug: 'maternal-fetal-medicine',
    description: 'High-risk pregnancy and fetal diagnosis',
  },
  {
    id: subspecialtyId(28, 2),
    specialtyId: specialtyId(28),
    name: 'Reproductive Endocrinology',
    slug: 'reproductive-endocrinology',
    description: 'Infertility and assisted reproduction',
  },
  {
    id: subspecialtyId(28, 3),
    specialtyId: specialtyId(28),
    name: 'Gynaecological Oncology',
    slug: 'gynaecological-oncology',
    description: 'Cancer of the female reproductive system',
  },
  {
    id: subspecialtyId(28, 4),
    specialtyId: specialtyId(28),
    name: 'Urogynaecology',
    slug: 'urogynaecology',
    description: 'Pelvic floor disorders and incontinence',
  },
];

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

// Singleton instance for direct execution; callers from seed.ts should pass their own client
let _prisma: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export async function seedMedicalSpecialties(prisma?: PrismaClient): Promise<void> {
  const client = prisma ?? getPrismaClient();
  console.log('Seeding medical specialties...');

  // Upsert specialties
  for (const specialty of SPECIALTIES) {
    await client.medicalSpecialty.upsert({
      where: { id: specialty.id },
      update: {
        name: specialty.name,
        slug: specialty.slug,
        description: specialty.description,
        synonyms: specialty.synonyms,
        active: true,
      },
      create: {
        id: specialty.id,
        name: specialty.name,
        slug: specialty.slug,
        description: specialty.description,
        synonyms: specialty.synonyms,
        active: true,
      },
    });
  }

  console.log(`Seeded ${SPECIALTIES.length} medical specialties`);

  // Upsert subspecialties
  for (const subspecialty of SUBSPECIALTIES) {
    await client.medicalSubspecialty.upsert({
      where: { id: subspecialty.id },
      update: {
        specialtyId: subspecialty.specialtyId,
        name: subspecialty.name,
        slug: subspecialty.slug,
        description: subspecialty.description,
        active: true,
      },
      create: {
        id: subspecialty.id,
        specialtyId: subspecialty.specialtyId,
        name: subspecialty.name,
        slug: subspecialty.slug,
        description: subspecialty.description,
        active: true,
      },
    });
  }

  console.log(`Seeded ${SUBSPECIALTIES.length} medical subspecialties`);

  // Summary by specialty
  const subspecialtyCounts = SUBSPECIALTIES.reduce(
    (acc, sub) => {
      const specialty = SPECIALTIES.find((s) => s.id === sub.specialtyId);
      if (specialty) {
        acc[specialty.name] = (acc[specialty.name] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('Subspecialty counts by specialty:');
  for (const [name, count] of Object.entries(subspecialtyCounts)) {
    console.log(`  - ${name}: ${count}`);
  }
}

// Export for direct execution
export async function main(): Promise<void> {
  try {
    await seedMedicalSpecialties();
    console.log('Medical specialty seeding complete!');
  } catch (error) {
    console.error('Error seeding medical specialties:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      if (_prisma) {
        await _prisma.$disconnect();
      }
    });
}
