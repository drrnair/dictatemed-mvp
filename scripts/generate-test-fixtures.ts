// scripts/generate-test-fixtures.ts
// Generates test fixtures for E2E testing of extended file upload types
//
// Usage: npx tsx scripts/generate-test-fixtures.ts
//        npm run generate:test-fixtures
//
// This script creates sample JPEG, PNG, and DOCX files for testing
// the extended file upload feature.

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

const FIXTURES_DIR = path.join(__dirname, '../tests/e2e/fixtures/referrals');

// Sample referral content for image fixtures
const IMAGE_REFERRAL_CONTENT = `
TEST Melbourne Medical Centre
456 Collins Street, Melbourne VIC 3000
Phone: +61 3 9000 0003

SPECIALIST REFERRAL

Date: 20 December 2024

To: Cardiology Department

RE: TEST Patient - Image Referral
DOB: 15 May 1965
MRN: TEST-REF-IMG-001

REASON FOR REFERRAL:
Chest discomfort on exertion requiring cardiology review

Kind regards,
Dr. TEST Referring GP Melbourne
`;

// Sample referral content for DOCX fixture
const DOCX_REFERRAL_CONTENT = {
  practice: {
    name: 'TEST Brisbane Medical Practice',
    address: '100 Queen Street, Brisbane QLD 4000',
    phone: '+61 7 9000 0003',
    email: 'test.gp.brisbane.docx@test.dictatemed.dev',
  },
  patient: {
    name: 'TEST Patient - DOCX Referral',
    dob: '10 August 1970',
    mrn: 'TEST-REF-DOCX-001',
    address: 'TEST Address - 200 Adelaide Street, Brisbane QLD 4000',
    phone: '+61 400 000 200',
  },
  referral: {
    date: '22 December 2024',
    to: 'Cardiology Department',
    reason: 'Palpitations and dizziness for cardiology assessment',
    urgency: 'Routine',
    history: `I am referring the above patient for cardiology review. They have been
experiencing episodes of palpitations lasting 10-15 minutes, associated with
light-headedness. No syncope. Episodes occurring 2-3 times per week.

Past Medical History:
- Hypertension (controlled on Amlodipine 5mg daily)
- No previous cardiac history

Current Medications:
1. Amlodipine 5mg daily

Allergies: Nil known

Examination:
- BP: 128/82 mmHg
- HR: 78 bpm, regular
- Heart sounds: Dual, no murmurs

Investigations:
- ECG: Sinus rhythm, no abnormalities`,
    impression: 'Recurrent palpitations - ?SVT. Would appreciate Holter monitor and cardiology opinion.',
  },
  doctor: {
    name: 'Dr. TEST Referring GP Brisbane DOCX',
    credentials: 'MBBS, FRACGP',
    providerNumber: 'TEST-7654321',
  },
};

async function generateImageFixtures(): Promise<void> {
  console.log('Generating image fixtures...\n');

  // Create a simple image with text overlay using sharp
  // We'll create a white background with the referral text rendered as an image
  const width = 800;
  const height = 1000;

  // Create SVG with text content
  const svgContent = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50" y="50" font-family="Courier, monospace" font-size="14" fill="black">
        <tspan x="50" dy="0">TEST Melbourne Medical Centre</tspan>
        <tspan x="50" dy="20">456 Collins Street, Melbourne VIC 3000</tspan>
        <tspan x="50" dy="20">Phone: +61 3 9000 0003</tspan>
        <tspan x="50" dy="40">SPECIALIST REFERRAL</tspan>
        <tspan x="50" dy="40">Date: 20 December 2024</tspan>
        <tspan x="50" dy="20">To: Cardiology Department</tspan>
        <tspan x="50" dy="40">RE: TEST Patient - Image Referral</tspan>
        <tspan x="50" dy="20">DOB: 15 May 1965</tspan>
        <tspan x="50" dy="20">MRN: TEST-REF-IMG-001</tspan>
        <tspan x="50" dy="40">REASON FOR REFERRAL:</tspan>
        <tspan x="50" dy="20">Chest discomfort on exertion requiring</tspan>
        <tspan x="50" dy="20">cardiology review</tspan>
        <tspan x="50" dy="60">CLINICAL HISTORY:</tspan>
        <tspan x="50" dy="20">Patient presents with intermittent chest</tspan>
        <tspan x="50" dy="20">discomfort on exertion, typically relieved</tspan>
        <tspan x="50" dy="20">by rest. No associated symptoms.</tspan>
        <tspan x="50" dy="40">Past Medical History:</tspan>
        <tspan x="50" dy="20">- Hypertension (on Ramipril 5mg)</tspan>
        <tspan x="50" dy="20">- Type 2 Diabetes (on Metformin 500mg BD)</tspan>
        <tspan x="50" dy="40">Examination:</tspan>
        <tspan x="50" dy="20">- BP: 138/85 mmHg</tspan>
        <tspan x="50" dy="20">- HR: 72 bpm, regular</tspan>
        <tspan x="50" dy="20">- Heart sounds: Normal S1 S2</tspan>
        <tspan x="50" dy="40">ECG: Sinus rhythm, T wave changes V4-V6</tspan>
        <tspan x="50" dy="60">Kind regards,</tspan>
        <tspan x="50" dy="30">Dr. TEST Referring GP Melbourne</tspan>
        <tspan x="50" dy="20">TEST Melbourne Medical Centre</tspan>
        <tspan x="50" dy="60">-------------------------------------------</tspan>
        <tspan x="50" dy="20">TEST referral for E2E testing purposes</tspan>
      </text>
    </svg>
  `;

  const svgBuffer = Buffer.from(svgContent);

  // Generate JPEG
  const jpegPath = path.join(FIXTURES_DIR, 'image-referral-001.jpg');
  await sharp(svgBuffer)
    .jpeg({ quality: 90 })
    .toFile(jpegPath);
  console.log(`✓ Generated: image-referral-001.jpg`);

  // Generate PNG
  const pngPath = path.join(FIXTURES_DIR, 'image-referral-001.png');
  await sharp(svgBuffer)
    .png()
    .toFile(pngPath);
  console.log(`✓ Generated: image-referral-001.png`);
}

async function generateDocxFixture(): Promise<void> {
  console.log('\nGenerating DOCX fixture...\n');

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Practice header
        new Paragraph({
          children: [
            new TextRun({ text: DOCX_REFERRAL_CONTENT.practice.name, bold: true, size: 28 }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: DOCX_REFERRAL_CONTENT.practice.address }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Phone: ${DOCX_REFERRAL_CONTENT.practice.phone}` }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Email: ${DOCX_REFERRAL_CONTENT.practice.email}` }),
          ],
        }),
        new Paragraph({ children: [] }), // Empty line

        // Title
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({ text: 'SPECIALIST REFERRAL', bold: true }),
          ],
        }),
        new Paragraph({ children: [] }),

        // Date and recipient
        new Paragraph({
          children: [
            new TextRun({ text: `Date: ${DOCX_REFERRAL_CONTENT.referral.date}` }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `To: ${DOCX_REFERRAL_CONTENT.referral.to}` }),
          ],
        }),
        new Paragraph({ children: [] }),

        // Patient details
        new Paragraph({
          children: [
            new TextRun({ text: `RE: ${DOCX_REFERRAL_CONTENT.patient.name}`, bold: true }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `DOB: ${DOCX_REFERRAL_CONTENT.patient.dob}` }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `MRN: ${DOCX_REFERRAL_CONTENT.patient.mrn}` }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Address: ${DOCX_REFERRAL_CONTENT.patient.address}` }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Phone: ${DOCX_REFERRAL_CONTENT.patient.phone}` }),
          ],
        }),
        new Paragraph({ children: [] }),

        // Reason for referral
        new Paragraph({
          children: [
            new TextRun({ text: 'REASON FOR REFERRAL:', bold: true }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: DOCX_REFERRAL_CONTENT.referral.reason }),
          ],
        }),
        new Paragraph({ children: [] }),

        new Paragraph({
          children: [
            new TextRun({ text: `URGENCY: ${DOCX_REFERRAL_CONTENT.referral.urgency}` }),
          ],
        }),
        new Paragraph({ children: [] }),

        // Clinical history
        new Paragraph({
          children: [
            new TextRun({ text: 'CLINICAL HISTORY:', bold: true }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: DOCX_REFERRAL_CONTENT.referral.history }),
          ],
        }),
        new Paragraph({ children: [] }),

        // Impression
        new Paragraph({
          children: [
            new TextRun({ text: 'CLINICAL IMPRESSION:', bold: true }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: DOCX_REFERRAL_CONTENT.referral.impression }),
          ],
        }),
        new Paragraph({ children: [] }),

        // Signature
        new Paragraph({
          children: [
            new TextRun({ text: 'Kind regards,' }),
          ],
        }),
        new Paragraph({ children: [] }),
        new Paragraph({
          children: [
            new TextRun({ text: DOCX_REFERRAL_CONTENT.doctor.name, bold: true }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: DOCX_REFERRAL_CONTENT.doctor.credentials }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Provider Number: ${DOCX_REFERRAL_CONTENT.doctor.providerNumber}` }),
          ],
        }),
        new Paragraph({ children: [] }),

        // Footer
        new Paragraph({
          children: [
            new TextRun({ text: '-------------------------------------------', color: '888888' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'This is a TEST referral document for E2E testing purposes only.',
              italics: true,
              color: '888888',
            }),
          ],
        }),
      ],
    }],
  });

  const docxPath = path.join(FIXTURES_DIR, 'docx-referral-001.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(docxPath, buffer);
  console.log(`✓ Generated: docx-referral-001.docx`);
}

async function main(): Promise<void> {
  console.log('Generating test fixtures for extended file upload types...\n');
  console.log(`Output directory: ${FIXTURES_DIR}\n`);

  // Ensure fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  try {
    await generateImageFixtures();
    await generateDocxFixture();
    console.log('\n✓ All test fixtures generated successfully!');
  } catch (error) {
    console.error('\n✗ Error generating fixtures:', error);
    process.exit(1);
  }
}

main();
