// scripts/generate-referral-pdfs.ts
// Generates PDF files from text referral templates for E2E testing
//
// Usage: npx tsx scripts/generate-referral-pdfs.ts
//        npm run generate:referral-pdfs
//
// This script converts the .txt referral templates in tests/e2e/fixtures/referrals/
// to PDF files that can be used in E2E tests for the referral upload workflow.
//
// Note: This script uses pdf-lib (already a project dependency).

import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function generatePDFs(): Promise<void> {
  const fixturesDir = path.join(__dirname, '../tests/e2e/fixtures/referrals');
  const txtFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.txt') && !f.includes('README'));

  if (txtFiles.length === 0) {
    console.log('No .txt files found in fixtures/referrals/');
    return;
  }

  console.log('Generating PDF files from text templates...\n');

  for (const txtFile of txtFiles) {
    const txtPath = path.join(fixturesDir, txtFile);
    const pdfFile = txtFile.replace('.txt', '.pdf');
    const pdfPath = path.join(fixturesDir, pdfFile);

    try {
      const content = fs.readFileSync(txtPath, 'utf-8');

      // Create PDF using pdf-lib (already a project dependency)
      const pdfDoc = await PDFDocument.create();
      const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

      // A4 size in points: 595.28 x 841.89
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 50;
      const fontSize = 10;
      const lineHeight = fontSize * 1.4;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let yPosition = pageHeight - margin;

      const lines = content.split('\n');

      for (const line of lines) {
        // Check if we need a new page
        if (yPosition < margin + lineHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          yPosition = pageHeight - margin;
        }

        // Draw the line
        const displayLine = line.length > 80 ? line.substring(0, 77) + '...' : line;
        page.drawText(displayLine, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: courierFont,
          color: rgb(0, 0, 0),
        });

        yPosition -= lineHeight;
      }

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(pdfPath, pdfBytes);

      console.log(`✓ Generated: ${pdfFile}`);
    } catch (error) {
      console.error(`✗ Failed to generate ${pdfFile}:`, error);
    }
  }

  console.log('\nPDF generation complete!');
}

// CLI execution
generatePDFs().catch((error) => {
  console.error('PDF generation failed:', error);
  process.exit(1);
});
