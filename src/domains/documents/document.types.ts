// src/domains/documents/document.types.ts
// Document domain type definitions

export type DocumentType = 'ECHO_REPORT' | 'ANGIOGRAM_REPORT' | 'LAB_RESULT' | 'REFERRAL' | 'OTHER';

export type DocumentStatus = 'UPLOADING' | 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface Document {
  id: string;
  userId: string;
  patientId?: string | undefined;
  name: string;
  mimeType: string;
  size: number;
  type: DocumentType;
  status: DocumentStatus;
  s3Key?: string | undefined;
  url?: string | undefined;
  thumbnailUrl?: string | undefined;
  extractedData?: ExtractedData | undefined;
  processingError?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentInput {
  name: string;
  mimeType: string;
  size: number;
  type?: DocumentType | undefined;
  patientId?: string | undefined;
}

export interface CreateDocumentResult {
  id: string;
  uploadUrl: string;
  expiresAt: Date;
}

export interface ConfirmUploadInput {
  size: number;
}

export interface DocumentListQuery {
  patientId?: string | undefined;
  type?: DocumentType | undefined;
  status?: DocumentStatus | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface DocumentListResult {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Extracted clinical data structures
export interface ExtractedData {
  type: DocumentType;
  confidence: number;
  extractedAt: Date;
  data: EchoReportData | AngiogramReportData | LabResultData | GenericData;
}

export interface EchoReportData {
  type: 'ECHO_REPORT';

  // Left ventricular function
  lvef?: number | undefined; // e.g., 45 for 45%
  lvefMethod?: string | undefined; // e.g., "biplane Simpson's"
  lvedv?: number | undefined; // mL
  lvesv?: number | undefined; // mL
  gls?: number | undefined; // Global longitudinal strain, e.g., -18

  // LV dimensions
  lvedd?: number | undefined; // mm
  lvesd?: number | undefined; // mm
  ivs?: number | undefined; // Interventricular septum, mm
  pw?: number | undefined; // Posterior wall, mm
  lvMass?: number | undefined; // g
  lvMassIndex?: number | undefined; // g/m²

  // Right ventricle
  rvef?: number | undefined;
  tapse?: number | undefined; // mm
  rvs?: number | undefined; // cm/s (RV S' TDI)
  rvBasalDiameter?: number | undefined; // mm

  // Valvular data
  aorticValve?: ValveData | undefined;
  mitralValve?: ValveData | undefined;
  tricuspidValve?: ValveData | undefined;
  pulmonicValve?: ValveData | undefined;

  // Diastolic function
  eVelocity?: number | undefined; // cm/s
  aVelocity?: number | undefined; // cm/s
  eaRatio?: number | undefined;
  ePrime?: number | undefined; // cm/s (septal e')
  eePrime?: number | undefined; // E/e' ratio
  decelTime?: number | undefined; // ms
  laPressure?: string | undefined; // "normal", "elevated", "indeterminate"

  // Other findings
  pericardialEffusion?: string | undefined;
  regionalWallMotion?: string[] | undefined;
  conclusions?: string[] | undefined;

  rawText?: string | undefined;
}

export interface ValveData {
  // Stenosis
  peakVelocity?: number | undefined; // m/s
  meanGradient?: number | undefined; // mmHg
  peakGradient?: number | undefined; // mmHg
  valveArea?: number | undefined; // cm²
  avi?: number | undefined; // Aortic valve index
  stenosisSeverity?: 'none' | 'mild' | 'moderate' | 'severe' | undefined;

  // Regurgitation
  regurgitationSeverity?: 'none' | 'trace' | 'mild' | 'moderate' | 'severe' | undefined;
  regurgitantVolume?: number | undefined; // mL
  regurgitantFraction?: number | undefined; // %
  ero?: number | undefined; // Effective regurgitant orifice, cm²
  vcWidth?: number | undefined; // Vena contracta width, mm

  // Morphology
  morphology?: string | undefined;
  calcification?: string | undefined;
  prosthetic?: boolean | undefined;
  prostheticType?: string | undefined;
}

export interface AngiogramReportData {
  type: 'ANGIOGRAM_REPORT';

  // Coronary vessels
  lmca?: VesselData | undefined;
  lad?: VesselData | undefined;
  lcx?: VesselData | undefined;
  rca?: VesselData | undefined;

  // Branches
  d1?: VesselData | undefined;
  d2?: VesselData | undefined;
  om1?: VesselData | undefined;
  om2?: VesselData | undefined;
  pda?: VesselData | undefined;
  plv?: VesselData | undefined;
  ramus?: VesselData | undefined;

  // Overall assessment
  dominance?: 'right' | 'left' | 'codominant' | undefined;
  overallImpression?: string | undefined;
  recommendations?: string[] | undefined;

  // Procedures performed
  pciPerformed?: boolean | undefined;
  pciDetails?: PciDetails[] | undefined;

  // Hemodynamics
  lvedp?: number | undefined; // mmHg
  aorticPressure?: string | undefined;
  cardiacOutput?: number | undefined; // L/min

  rawText?: string | undefined;
}

export interface VesselData {
  stenosis?: number | undefined; // Percentage, e.g., 80 for 80%
  stenosisLocation?: string | undefined; // e.g., "proximal", "mid", "distal"
  calcification?: string | undefined;
  thrombus?: boolean | undefined;
  dissection?: boolean | undefined;
  description?: string | undefined;
  previousStent?: boolean | undefined;
  stentPatent?: boolean | undefined;
  graftType?: string | undefined; // For bypass grafts
  graftStatus?: string | undefined;
}

export interface PciDetails {
  vessel: string;
  stentType?: string | undefined;
  stentSize?: string | undefined; // e.g., "3.0 x 28mm"
  preDilatation?: boolean | undefined;
  postDilatation?: boolean | undefined;
  timiFlow?: number | undefined; // 0-3
  result?: string | undefined;
}

export interface LabResultData {
  type: 'LAB_RESULT';

  testDate?: Date | undefined;

  // Cardiac markers
  troponin?: LabValue | undefined;
  bnp?: LabValue | undefined;
  ntProBnp?: LabValue | undefined;

  // Lipid panel
  totalCholesterol?: LabValue | undefined;
  ldl?: LabValue | undefined;
  hdl?: LabValue | undefined;
  triglycerides?: LabValue | undefined;

  // Renal function
  creatinine?: LabValue | undefined;
  egfr?: LabValue | undefined;
  bun?: LabValue | undefined;

  // Electrolytes
  potassium?: LabValue | undefined;
  sodium?: LabValue | undefined;
  magnesium?: LabValue | undefined;

  // Hematology
  hemoglobin?: LabValue | undefined;
  hematocrit?: LabValue | undefined;
  platelets?: LabValue | undefined;
  inr?: LabValue | undefined;

  // Thyroid
  tsh?: LabValue | undefined;

  // Glucose
  hba1c?: LabValue | undefined;
  glucose?: LabValue | undefined;

  rawText?: string | undefined;
}

export interface LabValue {
  value: number;
  unit: string;
  referenceRange?: string | undefined;
  flag?: 'high' | 'low' | 'critical' | undefined;
}

export interface GenericData {
  type: 'REFERRAL' | 'OTHER';
  summary?: string | undefined;
  keyFindings?: string[] | undefined;
  recommendations?: string[] | undefined;
  rawText?: string | undefined;
}

// Document processing job
export interface ProcessingJob {
  documentId: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
  error?: string | undefined;
}
