// tests/unit/hooks/queries/react-query.test.ts
// Unit tests for React Query configuration and query key factory

import { describe, it, expect } from 'vitest';
import {
  queryKeys,
  DEFAULT_STALE_TIME,
  DEFAULT_GC_TIME,
  createQueryClient,
} from '@/lib/react-query';

describe('React Query Configuration', () => {
  describe('queryKeys factory', () => {
    describe('letters', () => {
      it('should generate correct base key', () => {
        expect(queryKeys.letters.all).toEqual(['letters']);
      });

      it('should generate correct lists key', () => {
        expect(queryKeys.letters.lists()).toEqual(['letters', 'list']);
      });

      it('should generate correct list key with filters', () => {
        const filters = { status: 'DRAFT', page: 1 };
        expect(queryKeys.letters.list(filters)).toEqual([
          'letters',
          'list',
          filters,
        ]);
      });

      it('should generate correct details key', () => {
        expect(queryKeys.letters.details()).toEqual(['letters', 'detail']);
      });

      it('should generate correct detail key with id', () => {
        const id = 'letter-123';
        expect(queryKeys.letters.detail(id)).toEqual([
          'letters',
          'detail',
          id,
        ]);
      });

      it('should generate correct provenance key', () => {
        const id = 'letter-123';
        expect(queryKeys.letters.provenance(id)).toEqual([
          'letters',
          'detail',
          id,
          'provenance',
        ]);
      });

      it('should generate correct stats key', () => {
        expect(queryKeys.letters.stats()).toEqual(['letters', 'stats']);
      });
    });

    describe('recordings', () => {
      it('should generate correct base key', () => {
        expect(queryKeys.recordings.all).toEqual(['recordings']);
      });

      it('should generate correct list key with filters', () => {
        const filters = { status: 'TRANSCRIBED', mode: 'AMBIENT' };
        expect(queryKeys.recordings.list(filters)).toEqual([
          'recordings',
          'list',
          filters,
        ]);
      });

      it('should generate correct detail key', () => {
        const id = 'rec-456';
        expect(queryKeys.recordings.detail(id)).toEqual([
          'recordings',
          'detail',
          id,
        ]);
      });
    });

    describe('documents', () => {
      it('should generate correct base key', () => {
        expect(queryKeys.documents.all).toEqual(['documents']);
      });

      it('should generate correct list key with filters', () => {
        const filters = { type: 'REFERRAL', patientId: 'patient-123' };
        expect(queryKeys.documents.list(filters)).toEqual([
          'documents',
          'list',
          filters,
        ]);
      });

      it('should generate correct detail key', () => {
        const id = 'doc-789';
        expect(queryKeys.documents.detail(id)).toEqual([
          'documents',
          'detail',
          id,
        ]);
      });
    });

    describe('patients', () => {
      it('should generate correct base key', () => {
        expect(queryKeys.patients.all).toEqual(['patients']);
      });

      it('should generate correct recent key', () => {
        expect(queryKeys.patients.recent()).toEqual(['patients', 'recent']);
      });

      it('should generate correct list key with search', () => {
        const filters = { search: 'John', page: 2 };
        expect(queryKeys.patients.list(filters)).toEqual([
          'patients',
          'list',
          filters,
        ]);
      });
    });

    describe('user', () => {
      it('should generate correct practice profile key', () => {
        expect(queryKeys.user.practiceProfile()).toEqual([
          'user',
          'practice-profile',
        ]);
      });

      it('should generate correct settings key', () => {
        expect(queryKeys.user.settings()).toEqual(['user', 'settings']);
      });

      it('should generate correct usage key', () => {
        expect(queryKeys.user.usage()).toEqual(['user', 'usage']);
      });
    });

    describe('specialties', () => {
      it('should generate correct list key', () => {
        expect(queryKeys.specialties.list()).toEqual(['specialties', 'list']);
      });

      it('should generate correct subspecialties key', () => {
        const specialtyId = 'cardiology-123';
        expect(queryKeys.specialties.subspecialties(specialtyId)).toEqual([
          'specialties',
          'subspecialties',
          specialtyId,
        ]);
      });
    });

    describe('styleProfiles', () => {
      it('should generate correct list key without subspecialty', () => {
        expect(queryKeys.styleProfiles.list()).toEqual([
          'style-profiles',
          'list',
          undefined,
        ]);
      });

      it('should generate correct list key with subspecialty', () => {
        const subspecialtyId = 'interventional-123';
        expect(queryKeys.styleProfiles.list(subspecialtyId)).toEqual([
          'style-profiles',
          'list',
          subspecialtyId,
        ]);
      });

      it('should generate correct active key', () => {
        const subspecialtyId = 'interventional-123';
        expect(queryKeys.styleProfiles.active(subspecialtyId)).toEqual([
          'style-profiles',
          'active',
          subspecialtyId,
        ]);
      });
    });
  });

  describe('constants', () => {
    it('should have correct DEFAULT_STALE_TIME (5 minutes)', () => {
      expect(DEFAULT_STALE_TIME).toBe(5 * 60 * 1000);
    });

    it('should have correct DEFAULT_GC_TIME (10 minutes)', () => {
      expect(DEFAULT_GC_TIME).toBe(10 * 60 * 1000);
    });
  });

  describe('createQueryClient', () => {
    it('should create a new QueryClient instance', () => {
      const client = createQueryClient();
      expect(client).toBeDefined();
      expect(typeof client.getQueryCache).toBe('function');
      expect(typeof client.getMutationCache).toBe('function');
    });

    it('should create independent instances', () => {
      const client1 = createQueryClient();
      const client2 = createQueryClient();
      expect(client1).not.toBe(client2);
    });

    it('should have default options configured', () => {
      const client = createQueryClient();
      const defaults = client.getDefaultOptions();

      expect(defaults.queries?.staleTime).toBe(DEFAULT_STALE_TIME);
      expect(defaults.queries?.gcTime).toBe(DEFAULT_GC_TIME);
      expect(defaults.queries?.retry).toBe(2);
      expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
      expect(defaults.mutations?.retry).toBe(1);
    });
  });

  describe('query key hierarchy', () => {
    it('lists key should be a subset of all key', () => {
      const allKey = queryKeys.letters.all;
      const listsKey = queryKeys.letters.lists();

      expect(listsKey.slice(0, allKey.length)).toEqual(allKey);
    });

    it('list key should be a subset of lists key', () => {
      const listsKey = queryKeys.letters.lists();
      const listKey = queryKeys.letters.list({ page: 1 });

      expect(listKey.slice(0, listsKey.length)).toEqual(listsKey);
    });

    it('detail key should be a subset of details key', () => {
      const detailsKey = queryKeys.letters.details();
      const detailKey = queryKeys.letters.detail('id-123');

      expect(detailKey.slice(0, detailsKey.length)).toEqual(detailsKey);
    });

    it('provenance key should be a subset of detail key', () => {
      const detailKey = queryKeys.letters.detail('id-123');
      const provenanceKey = queryKeys.letters.provenance('id-123');

      expect(provenanceKey.slice(0, detailKey.length)).toEqual(detailKey);
    });
  });
});
