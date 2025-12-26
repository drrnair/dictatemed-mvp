// tests/unit/domains/documents/extractors/echo-report.test.ts
// Unit tests for echo report extraction

import { describe, it, expect } from 'vitest';
import {
  parseEchoExtraction,
  ECHO_EXTRACTION_PROMPT,
} from '@/domains/documents/extractors/echo-report';

describe('echo-report extractor', () => {
  describe('parseEchoExtraction', () => {
    it('should parse valid echo report JSON', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        lvef: 45,
        lvefMethod: "biplane Simpson's",
        lvedv: 120,
        lvesv: 66,
        gls: -18,
      });

      const result = parseEchoExtraction(json);

      expect(result.type).toBe('ECHO_REPORT');
      expect(result.lvef).toBe(45);
      expect(result.lvefMethod).toBe("biplane Simpson's");
      expect(result.lvedv).toBe(120);
      expect(result.lvesv).toBe(66);
      expect(result.gls).toBe(-18);
    });

    it('should parse LV dimensions', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        lvedd: 55,
        lvesd: 38,
        ivs: 12,
        pw: 11,
        lvMass: 200,
        lvMassIndex: 105,
      });

      const result = parseEchoExtraction(json);

      expect(result.lvedd).toBe(55);
      expect(result.lvesd).toBe(38);
      expect(result.ivs).toBe(12);
      expect(result.pw).toBe(11);
      expect(result.lvMass).toBe(200);
      expect(result.lvMassIndex).toBe(105);
    });

    it('should parse RV function', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        rvef: 55,
        tapse: 22,
        rvs: 12,
        rvBasalDiameter: 38,
      });

      const result = parseEchoExtraction(json);

      expect(result.rvef).toBe(55);
      expect(result.tapse).toBe(22);
      expect(result.rvs).toBe(12);
      expect(result.rvBasalDiameter).toBe(38);
    });

    it('should parse aortic valve data', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        aorticValve: {
          peakVelocity: 4.2,
          meanGradient: 40,
          peakGradient: 65,
          valveArea: 0.8,
          stenosisSeverity: 'severe',
          regurgitationSeverity: 'mild',
          morphology: 'bicuspid',
          calcification: 'moderate',
        },
      });

      const result = parseEchoExtraction(json);

      expect(result.aorticValve?.peakVelocity).toBe(4.2);
      expect(result.aorticValve?.meanGradient).toBe(40);
      expect(result.aorticValve?.peakGradient).toBe(65);
      expect(result.aorticValve?.valveArea).toBe(0.8);
      expect(result.aorticValve?.stenosisSeverity).toBe('severe');
      expect(result.aorticValve?.regurgitationSeverity).toBe('mild');
      expect(result.aorticValve?.morphology).toBe('bicuspid');
    });

    it('should parse mitral valve data', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        mitralValve: {
          regurgitationSeverity: 'moderate',
          regurgitantVolume: 45,
          ero: 0.3,
          vcWidth: 5,
        },
      });

      const result = parseEchoExtraction(json);

      expect(result.mitralValve?.regurgitationSeverity).toBe('moderate');
      expect(result.mitralValve?.regurgitantVolume).toBe(45);
      expect(result.mitralValve?.ero).toBe(0.3);
      expect(result.mitralValve?.vcWidth).toBe(5);
    });

    it('should parse tricuspid valve with RVSP', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        tricuspidValve: {
          regurgitationSeverity: 'mild',
          rvsp: 35,
        },
      });

      const result = parseEchoExtraction(json);

      expect(result.tricuspidValve?.regurgitationSeverity).toBe('mild');
    });

    it('should parse diastolic function', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        eVelocity: 80,
        aVelocity: 60,
        eaRatio: 1.33,
        ePrime: 8,
        eePrime: 10,
        decelTime: 200,
        laPressure: 'elevated',
      });

      const result = parseEchoExtraction(json);

      expect(result.eVelocity).toBe(80);
      expect(result.aVelocity).toBe(60);
      expect(result.eaRatio).toBe(1.33);
      expect(result.ePrime).toBe(8);
      expect(result.eePrime).toBe(10);
      expect(result.decelTime).toBe(200);
      expect(result.laPressure).toBe('elevated');
    });

    it('should parse pericardial effusion and wall motion', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        pericardialEffusion: 'small',
        regionalWallMotion: ['Anterior wall hypokinesis', 'Apical akinesis'],
        conclusions: ['Reduced LVEF', 'Severe AS'],
      });

      const result = parseEchoExtraction(json);

      expect(result.pericardialEffusion).toBe('small');
      expect(result.regionalWallMotion).toEqual(['Anterior wall hypokinesis', 'Apical akinesis']);
      expect(result.conclusions).toEqual(['Reduced LVEF', 'Severe AS']);
    });

    it('should strip markdown code blocks', () => {
      const json = '```json\n' + JSON.stringify({
        type: 'ECHO_REPORT',
        lvef: 55,
      }) + '\n```';

      const result = parseEchoExtraction(json);

      expect(result.type).toBe('ECHO_REPORT');
      expect(result.lvef).toBe(55);
    });

    it('should strip generic code blocks', () => {
      const json = '```\n' + JSON.stringify({
        type: 'ECHO_REPORT',
        lvef: 60,
      }) + '\n```';

      const result = parseEchoExtraction(json);

      expect(result.lvef).toBe(60);
    });

    it('should handle null values', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        lvef: null,
        lvedv: null,
        aorticValve: null,
      });

      const result = parseEchoExtraction(json);

      expect(result.type).toBe('ECHO_REPORT');
      expect(result.lvef).toBeUndefined();
      expect(result.lvedv).toBeUndefined();
      expect(result.aorticValve).toBeUndefined();
    });

    it('should handle invalid numeric values', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        lvef: 'not a number',
        tapse: 'invalid',
      });

      const result = parseEchoExtraction(json);

      expect(result.lvef).toBeUndefined();
      expect(result.tapse).toBeUndefined();
    });

    it('should handle invalid severity values', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        aorticValve: {
          stenosisSeverity: 'invalid',
          regurgitationSeverity: 'unknown',
        },
        laPressure: 'invalid',
      });

      const result = parseEchoExtraction(json);

      expect(result.aorticValve?.stenosisSeverity).toBeUndefined();
      expect(result.aorticValve?.regurgitationSeverity).toBeUndefined();
      expect(result.laPressure).toBeUndefined();
    });

    it('should filter non-string values from arrays', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        conclusions: ['Valid conclusion', 123, null, 'Another conclusion'],
        regionalWallMotion: ['Finding', true, 'Another finding'],
      });

      const result = parseEchoExtraction(json);

      expect(result.conclusions).toEqual(['Valid conclusion', 'Another conclusion']);
      expect(result.regionalWallMotion).toEqual(['Finding', 'Another finding']);
    });

    it('should parse all LA pressure values', () => {
      // Test 'normal'
      let result = parseEchoExtraction(JSON.stringify({
        type: 'ECHO_REPORT',
        laPressure: 'normal',
      }));
      expect(result.laPressure).toBe('normal');

      // Test 'elevated'
      result = parseEchoExtraction(JSON.stringify({
        type: 'ECHO_REPORT',
        laPressure: 'elevated',
      }));
      expect(result.laPressure).toBe('elevated');

      // Test 'indeterminate'
      result = parseEchoExtraction(JSON.stringify({
        type: 'ECHO_REPORT',
        laPressure: 'indeterminate',
      }));
      expect(result.laPressure).toBe('indeterminate');
    });

    it('should parse prosthetic valve data', () => {
      const json = JSON.stringify({
        type: 'ECHO_REPORT',
        aorticValve: {
          prosthetic: true,
          prostheticType: 'mechanical',
          meanGradient: 15,
        },
      });

      const result = parseEchoExtraction(json);

      expect(result.aorticValve?.prosthetic).toBe(true);
      expect(result.aorticValve?.prostheticType).toBe('mechanical');
    });
  });

  describe('ECHO_EXTRACTION_PROMPT', () => {
    it('should be defined', () => {
      expect(ECHO_EXTRACTION_PROMPT).toBeDefined();
      expect(ECHO_EXTRACTION_PROMPT.length).toBeGreaterThan(100);
    });

    it('should include key fields', () => {
      expect(ECHO_EXTRACTION_PROMPT).toContain('lvef');
      expect(ECHO_EXTRACTION_PROMPT).toContain('aorticValve');
      expect(ECHO_EXTRACTION_PROMPT).toContain('mitralValve');
      expect(ECHO_EXTRACTION_PROMPT).toContain('ECHO_REPORT');
    });
  });
});
