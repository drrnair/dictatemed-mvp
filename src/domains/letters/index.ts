// src/domains/letters/index.ts
// Letters domain exports

// Core letter service
export {
  generateLetter,
  getLetter,
  listLetters,
  updateLetterContent,
  approveLetter,
  type GenerateLetterInput,
  type GenerateLetterResult,
} from './letter.service';

// Approval workflow
export {
  approveLetter as approveLetterWithProvenance,
  validateApprovalRequirements,
  getApprovalStatus,
  calculateContentDiff,
  type ApprovalInput,
  type ApprovalResult,
} from './approval.service';

// PDF generation
export { generateLetterPdf, generateSimplePdf } from './pdf.service';

// Types
export type {
  Letter,
  LetterType,
  LetterStatus,
  SourceAnchor,
  ClinicalValue,
  HallucinationFlag,
  ClinicalConcepts,
  ConceptItem,
  MedicationItem,
  FollowUpItem,
  ContentDiff,
  TextChange,
  Provenance,
  ProvenanceSource,
  CreateLetterInput,
  UpdateLetterInput,
  ApproveLetterInput,
  LetterListQuery,
  LetterListResult,
} from './letter.types';
