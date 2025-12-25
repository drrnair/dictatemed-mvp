// scripts/generate-referral-pdfs.ts
// Generates PDF files from text referral templates for E2E testing
//
// Usage: npx tsx scripts/generate-referral-pdfs.ts
//
// This script converts the .txt referral templates in tests/e2e/fixtures/referrals/
// to PDF files that can be used in E2E tests for the referral upload workflow.

import * as fs from 'fs';
import * as path from 'path';

// Try to use pdfkit if available, otherwise provide instructions
async function generatePDFs(): Promise<void> {
  const fixturesDir = path.join(__dirname, '../tests/e2e/fixtures/referrals');
  const txtFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.txt'));

  if (txtFiles.length === 0) {
    console.log('No .txt files found in fixtures/referrals/');
    return;
  }

  console.log('Generating PDF files from text templates...\n');

  // Check if pdfkit is available
  let PDFDocument: typeof import('pdfkit') | null = null;
  try {
    PDFDocument = (await import('pdfkit')).default;
  } catch {
    console.log('pdfkit not installed. To generate PDFs, run:');
    console.log('  npm install -D pdfkit');
    console.log('');
    console.log('Alternatively, convert the .txt files manually using:');
    console.log('  - LibreOffice: libreoffice --headless --convert-to pdf <file.txt>');
    console.log('  - macOS: textutil -convert pdf <file.txt>');
    console.log('  - Online: Any text-to-PDF converter');
    console.log('');
    console.log('Text files available:');
    txtFiles.forEach((f) => console.log(`  - ${f}`));
    return;
  }

  for (const txtFile of txtFiles) {
    const txtPath = path.join(fixturesDir, txtFile);
    const pdfFile = txtFile.replace('.txt', '.pdf');
    const pdfPath = path.join(fixturesDir, pdfFile);

    try {
      const content = fs.readFileSync(txtPath, 'utf-8');
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      // Set font
      doc.font('Courier');
      doc.fontSize(10);

      // Process content line by line
      const lines = content.split('\n');
      for (const line of lines) {
        // Check for headers (lines with dashes or all caps)
        if (line.match(/^-+$/) || line.match(/^\s*\*{3}.*\*{3}\s*$/)) {
          doc.fontSize(10).text(line);
        } else if (line.match(/^[A-Z][A-Z\s]+:$/)) {
          // Section headers
          doc.fontSize(11).text(line, { bold: true });
          doc.fontSize(10);
        } else if (line.includes('URGENT') || line.includes('SPECIALIST REFERRAL')) {
          // Emphasis
          doc.fontSize(12).text(line, { underline: true });
          doc.fontSize(10);
        } else {
          doc.text(line);
        }
      }

      doc.end();

      // Wait for stream to finish
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

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
