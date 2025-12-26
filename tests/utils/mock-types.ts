/**
 * Type utilities for creating partial mocks of Prisma models in tests.
 *
 * These types allow tests to create mock data with only the fields they need,
 * while still maintaining type safety for the fields that are specified.
 *
 * CURRENT STATUS:
 * This utility file is provided for future test improvements. Currently, the
 * integration test files use @ts-nocheck because:
 * - Tests specify only fields relevant to behavior being tested
 * - Full Prisma types have 30+ required fields
 *
 * FUTURE MIGRATION PATH:
 * When migrating away from @ts-nocheck, import and use these helpers:
 *
 * @example
 * // Before (with @ts-nocheck):
 * vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: '123' });
 *
 * // After (type-safe):
 * import { asMock } from '../../utils/mock-types';
 * vi.mocked(prisma.patient.findFirst).mockResolvedValue(asMock({ id: '123' }));
 */

import type {
  Patient,
  Letter,
  Consultation,
  Document,
  Recording,
  User,
  Practice,
  AuditLog,
} from '@prisma/client';

/**
 * DeepPartial makes all properties optional recursively.
 * Useful for creating mock objects with only the fields needed for a test.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * MockData<T> represents a partial mock that can be used in place of T.
 * Use this for creating test fixtures that don't need all fields.
 */
export type MockData<T> = DeepPartial<T>;

// Specific mock types for common models
export type MockPatient = MockData<Patient>;
export type MockLetter = MockData<Letter> & { patient?: MockPatient };
export type MockConsultation = MockData<Consultation>;
export type MockDocument = MockData<Document>;
export type MockRecording = MockData<Recording>;
export type MockUser = MockData<User>;
export type MockPractice = MockData<Practice>;
export type MockAuditLog = MockData<AuditLog>;

/**
 * Helper to cast a partial mock to the full type for use with vi.mocked().
 * This is type-safe because we're explicitly acknowledging the mock is partial.
 *
 * The function accepts `unknown` to allow any mock object shape and casts it
 * to the target type T. This is intentional for test mocking where we often
 * don't have all required fields.
 *
 * @example
 * const mockPatient = asMock<Patient>({ id: '123', name: 'Test' });
 * vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient);
 *
 * // Can also be used without explicit type when type is inferred:
 * vi.mocked(prisma.patient.findFirst).mockResolvedValue(asMock({ id: '123' }));
 */
export function asMock<T = unknown>(partial: unknown): T {
  return partial as T;
}

/**
 * Helper to cast an array of partial mocks to the full type array.
 *
 * @example
 * const mockPatients = asMockArray<Patient>([{ id: '1' }, { id: '2' }]);
 * vi.mocked(prisma.patient.findMany).mockResolvedValue(mockPatients);
 */
export function asMockArray<T = unknown>(partials: unknown[]): T[] {
  return partials as T[];
}
