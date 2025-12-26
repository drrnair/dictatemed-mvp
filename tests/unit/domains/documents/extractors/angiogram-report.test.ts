// tests/unit/domains/documents/extractors/angiogram-report.test.ts
// Unit tests for angiogram report extraction

import { describe, it, expect } from 'vitest';
import {
  parseAngiogramExtraction,
  ANGIOGRAM_EXTRACTION_PROMPT,
} from '@/domains/documents/extractors/angiogram-report';

describe('angiogram-report extractor', () => {
  describe('parseAngiogramExtraction', () => {
    it('should parse valid angiogram report JSON', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        lmca: { stenosis: 0, description: 'Normal' },
        lad: { stenosis: 70, stenosisLocation: 'mid', calcification: 'moderate' },
        dominance: 'right',
        lvedp: 15,
      });

      const result = parseAngiogramExtraction(json);

      expect(result.type).toBe('ANGIOGRAM_REPORT');
      expect(result.lmca?.stenosis).toBe(0);
      expect(result.lad?.stenosis).toBe(70);
      expect(result.lad?.stenosisLocation).toBe('mid');
      expect(result.dominance).toBe('right');
      expect(result.lvedp).toBe(15);
    });

    it('should parse all vessel data', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        lmca: { stenosis: 0 },
        lad: { stenosis: 80, thrombus: true },
        lcx: { stenosis: 50, previousStent: true, stentPatent: true },
        rca: { stenosis: 100, description: 'CTO' },
        d1: { stenosis: 60 },
        d2: { stenosis: 0 },
        om1: { stenosis: 70 },
        om2: { stenosis: 0 },
        pda: { stenosis: 0 },
        plv: { stenosis: 0 },
        ramus: { stenosis: 40 },
      });

      const result = parseAngiogramExtraction(json);

      expect(result.lad?.stenosis).toBe(80);
      expect(result.lad?.thrombus).toBe(true);
      expect(result.lcx?.previousStent).toBe(true);
      expect(result.lcx?.stentPatent).toBe(true);
      expect(result.rca?.stenosis).toBe(100);
      expect(result.d1?.stenosis).toBe(60);
      expect(result.om1?.stenosis).toBe(70);
      expect(result.ramus?.stenosis).toBe(40);
    });

    it('should parse hemodynamic data', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        lvedp: 22,
        aorticPressure: '140/85',
        cardiacOutput: 5.2,
      });

      const result = parseAngiogramExtraction(json);

      expect(result.lvedp).toBe(22);
      expect(result.aorticPressure).toBe('140/85');
      expect(result.cardiacOutput).toBe(5.2);
    });

    it('should parse PCI details', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        pciPerformed: true,
        pciDetails: [
          {
            vessel: 'LAD',
            stentType: 'DES',
            stentSize: '3.0 x 28mm',
            preDilatation: true,
            postDilatation: true,
            timiFlow: 3,
            result: 'Excellent',
          },
          {
            vessel: 'RCA',
            stentType: 'DES',
            stentSize: '3.5 x 18mm',
            timiFlow: 3,
          },
        ],
      });

      const result = parseAngiogramExtraction(json);

      expect(result.pciPerformed).toBe(true);
      expect(result.pciDetails).toHaveLength(2);
      expect(result.pciDetails?.[0].vessel).toBe('LAD');
      expect(result.pciDetails?.[0].stentType).toBe('DES');
      expect(result.pciDetails?.[0].stentSize).toBe('3.0 x 28mm');
      expect(result.pciDetails?.[0].preDilatation).toBe(true);
      expect(result.pciDetails?.[0].timiFlow).toBe(3);
      expect(result.pciDetails?.[1].vessel).toBe('RCA');
    });

    it('should parse dominance values', () => {
      // Right dominance
      let result = parseAngiogramExtraction(JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        dominance: 'right',
      }));
      expect(result.dominance).toBe('right');

      // Left dominance
      result = parseAngiogramExtraction(JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        dominance: 'left',
      }));
      expect(result.dominance).toBe('left');

      // Codominant
      result = parseAngiogramExtraction(JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        dominance: 'codominant',
      }));
      expect(result.dominance).toBe('codominant');
    });

    it('should strip markdown code blocks', () => {
      const json = '```json\n' + JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        lad: { stenosis: 90 },
      }) + '\n```';

      const result = parseAngiogramExtraction(json);

      expect(result.type).toBe('ANGIOGRAM_REPORT');
      expect(result.lad?.stenosis).toBe(90);
    });

    it('should strip generic code blocks', () => {
      const json = '```\n' + JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        rca: { stenosis: 100 },
      }) + '\n```';

      const result = parseAngiogramExtraction(json);

      expect(result.rca?.stenosis).toBe(100);
    });

    it('should handle null values', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        lad: null,
        lcx: null,
        pciDetails: null,
        dominance: null,
      });

      const result = parseAngiogramExtraction(json);

      expect(result.lad).toBeUndefined();
      expect(result.lcx).toBeUndefined();
      expect(result.pciDetails).toBeUndefined();
      expect(result.dominance).toBeUndefined();
    });

    it('should handle vessel data with all null values', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        lad: { stenosis: null, stenosisLocation: null, calcification: null },
      });

      const result = parseAngiogramExtraction(json);

      expect(result.lad).toBeUndefined();
    });

    it('should handle invalid numeric values', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        lvedp: 'not a number',
        cardiacOutput: 'invalid',
        lad: { stenosis: 'unknown' },
      });

      const result = parseAngiogramExtraction(json);

      expect(result.lvedp).toBeUndefined();
      expect(result.cardiacOutput).toBeUndefined();
      expect(result.lad?.stenosis).toBeUndefined();
    });

    it('should handle invalid TIMI flow values', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        pciDetails: [
          { vessel: 'LAD', timiFlow: 5 }, // Invalid - too high
          { vessel: 'RCA', timiFlow: -1 }, // Invalid - negative
          { vessel: 'LCX', timiFlow: 2.5 }, // Should round to 3
        ],
      });

      const result = parseAngiogramExtraction(json);

      expect(result.pciDetails?.[0].timiFlow).toBeUndefined();
      expect(result.pciDetails?.[1].timiFlow).toBeUndefined();
      expect(result.pciDetails?.[2].timiFlow).toBe(3);
    });

    it('should parse vessel with dissection', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        lad: { stenosis: 95, dissection: true, thrombus: true },
      });

      const result = parseAngiogramExtraction(json);

      expect(result.lad?.dissection).toBe(true);
      expect(result.lad?.thrombus).toBe(true);
    });

    it('should parse bypass graft data', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        lad: {
          stenosis: 100,
          graftType: 'LIMA',
          graftStatus: 'patent',
        },
      });

      const result = parseAngiogramExtraction(json);

      expect(result.lad?.graftType).toBe('LIMA');
      expect(result.lad?.graftStatus).toBe('patent');
    });

    it('should parse recommendations', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        overallImpression: 'Three-vessel disease',
        recommendations: ['CABG evaluation', 'Heart team discussion'],
      });

      const result = parseAngiogramExtraction(json);

      expect(result.overallImpression).toBe('Three-vessel disease');
      expect(result.recommendations).toEqual(['CABG evaluation', 'Heart team discussion']);
    });

    it('should filter non-string values from recommendations', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        recommendations: ['Valid', 123, null, 'Also valid'],
      });

      const result = parseAngiogramExtraction(json);

      expect(result.recommendations).toEqual(['Valid', 'Also valid']);
    });

    it('should handle PCI details with missing vessel', () => {
      const json = JSON.stringify({
        type: 'ANGIOGRAM_REPORT',
        pciDetails: [
          { stentType: 'DES', stentSize: '3.0mm' },
        ],
      });

      const result = parseAngiogramExtraction(json);

      expect(result.pciDetails?.[0].vessel).toBe('Unknown');
    });
  });

  describe('ANGIOGRAM_EXTRACTION_PROMPT', () => {
    it('should be defined', () => {
      expect(ANGIOGRAM_EXTRACTION_PROMPT).toBeDefined();
      expect(ANGIOGRAM_EXTRACTION_PROMPT.length).toBeGreaterThan(100);
    });

    it('should include key fields', () => {
      expect(ANGIOGRAM_EXTRACTION_PROMPT).toContain('lmca');
      expect(ANGIOGRAM_EXTRACTION_PROMPT).toContain('lad');
      expect(ANGIOGRAM_EXTRACTION_PROMPT).toContain('pciDetails');
      expect(ANGIOGRAM_EXTRACTION_PROMPT).toContain('ANGIOGRAM_REPORT');
    });
  });
});
