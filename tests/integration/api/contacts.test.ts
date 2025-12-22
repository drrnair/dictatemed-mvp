// tests/integration/api/contacts.test.ts
// Integration tests for patient contacts API endpoints

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/contacts/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/contacts/[id]/route';
import * as auth from '@/lib/auth';
import { prisma } from '@/infrastructure/db/client';
import type { ContactType, ChannelType } from '@prisma/client';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock rate limit - dynamically return values
const mockCheckRateLimit = vi.fn();
const mockCreateRateLimitKey = vi.fn();
const mockGetRateLimitHeaders = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (key: string, resource: string) => mockCheckRateLimit(key, resource),
  createRateLimitKey: (userId: string, resource: string) => mockCreateRateLimitKey(userId, resource),
  getRateLimitHeaders: (result: unknown) => mockGetRateLimitHeaders(result),
}));

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    patient: {
      findUnique: vi.fn(),
    },
    patientContact: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockPatient = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  practiceId: 'practice-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  encryptedData: 'encrypted-data',
};

const mockUser = {
  id: 'user-123',
  auth0Id: 'auth0|123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'SPECIALIST' as const,
  practiceId: 'practice-123',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
};

const mockContact = {
  id: 'contact-123',
  patientId: mockPatient.id,
  type: 'GP' as ContactType,
  fullName: 'Dr. John Smith',
  organisation: 'Sydney Medical Centre',
  role: 'General Practitioner',
  email: 'john.smith@example.com',
  phone: '+61 2 9876 5432',
  fax: null,
  address: null,
  secureMessagingId: null,
  preferredChannel: 'EMAIL' as ChannelType,
  isDefaultForPatient: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function createRequest(url: string, options: { method?: string; body?: string } = {}) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Contacts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUser });
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient);
    // Default rate limit mock - allow requests
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetAt: new Date() });
    mockCreateRateLimitKey.mockImplementation((userId: string, resource: string) => `${userId}:${resource}`);
    mockGetRateLimitHeaders.mockReturnValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/contacts', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/contacts?patientId=' + mockPatient.id);
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 400 when patientId is missing', async () => {
      const request = createRequest('/api/contacts');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid query parameters');
    });

    it('should return 404 when patient does not exist', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/contacts?patientId=' + mockPatient.id);
      const response = await GET(request);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Patient not found');
    });

    it('should return 403 when patient belongs to different practice', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...mockPatient,
        practiceId: 'other-practice',
      });

      const request = createRequest('/api/contacts?patientId=' + mockPatient.id);
      const response = await GET(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return paginated contacts list', async () => {
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(prisma.patientContact.count).mockResolvedValue(1);

      const request = createRequest('/api/contacts?patientId=' + mockPatient.id);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.items).toHaveLength(1);
      expect(json.items[0].fullName).toBe('Dr. John Smith');
      expect(json.total).toBe(1);
      expect(json.page).toBe(1);
      expect(json.limit).toBe(20);
    });

    it('should filter by type', async () => {
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(prisma.patientContact.count).mockResolvedValue(1);

      const request = createRequest('/api/contacts?patientId=' + mockPatient.id + '&type=GP');
      await GET(request);

      expect(prisma.patientContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'GP' }),
        })
      );
    });

    it('should filter by isDefaultForPatient', async () => {
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(prisma.patientContact.count).mockResolvedValue(1);

      const request = createRequest(
        '/api/contacts?patientId=' + mockPatient.id + '&isDefaultForPatient=true'
      );
      await GET(request);

      expect(prisma.patientContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isDefaultForPatient: true }),
        })
      );
    });

    it('should handle pagination parameters', async () => {
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(prisma.patientContact.count).mockResolvedValue(50);

      const request = createRequest(
        '/api/contacts?patientId=' + mockPatient.id + '&page=3&limit=10'
      );
      await GET(request);

      expect(prisma.patientContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        })
      );
    });
  });

  describe('POST /api/contacts', () => {
    const validInput = {
      patientId: mockPatient.id,
      type: 'GP',
      fullName: 'Dr. John Smith',
      email: 'john.smith@example.com',
      preferredChannel: 'EMAIL',
      isDefaultForPatient: true,
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(validInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(validInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe('Rate limit exceeded');
    });

    it('should return 400 for invalid input', async () => {
      const request = createRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ patientId: 'not-a-uuid' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });

    it('should return 404 when patient does not exist', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(validInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Patient not found');
    });

    it('should return 403 when patient belongs to different practice', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...mockPatient,
        practiceId: 'other-practice',
      });

      const request = createRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(validInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it('should create contact and return 201', async () => {
      vi.mocked(prisma.patientContact.create).mockResolvedValue(mockContact);

      const request = createRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(validInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.contact.fullName).toBe('Dr. John Smith');
    });

    it('should unset existing default when setting new default', async () => {
      vi.mocked(prisma.patientContact.create).mockResolvedValue(mockContact);
      vi.mocked(prisma.patientContact.updateMany).mockResolvedValue({ count: 1 });

      const request = createRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ ...validInput, isDefaultForPatient: true }),
      });
      await POST(request);

      expect(prisma.patientContact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: mockPatient.id,
            type: 'GP',
            isDefaultForPatient: true,
          }),
          data: { isDefaultForPatient: false },
        })
      );
    });
  });

  describe('GET /api/contacts/:id', () => {
    const routeParams = { params: Promise.resolve({ id: mockContact.id }) };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/contacts/' + mockContact.id);
      const response = await GET_BY_ID(request, routeParams);

      expect(response.status).toBe(401);
    });

    it('should return 404 when contact does not exist', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/contacts/' + mockContact.id);
      const response = await GET_BY_ID(request, routeParams);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Contact not found');
    });

    it('should return 403 when contact belongs to patient in different practice', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...mockPatient,
        practiceId: 'other-practice',
      });

      const request = createRequest('/api/contacts/' + mockContact.id);
      const response = await GET_BY_ID(request, routeParams);

      expect(response.status).toBe(403);
    });

    it('should return contact successfully', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(mockContact);

      const request = createRequest('/api/contacts/' + mockContact.id);
      const response = await GET_BY_ID(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.contact.id).toBe(mockContact.id);
    });
  });

  describe('PUT /api/contacts/:id', () => {
    const routeParams = { params: Promise.resolve({ id: mockContact.id }) };
    const updateInput = { fullName: 'Dr. Jane Smith' };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, routeParams);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, routeParams);

      expect(response.status).toBe(429);
    });

    it('should return 400 for invalid input', async () => {
      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'PUT',
        body: JSON.stringify({}),
      });
      const response = await PUT(request, routeParams);

      expect(response.status).toBe(400);
    });

    it('should return 404 when contact does not exist', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, routeParams);

      expect(response.status).toBe(404);
    });

    it('should return 403 when contact belongs to patient in different practice', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...mockPatient,
        practiceId: 'other-practice',
      });

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, routeParams);

      expect(response.status).toBe(403);
    });

    it('should update contact successfully', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(prisma.patientContact.update).mockResolvedValue({
        ...mockContact,
        fullName: 'Dr. Jane Smith',
      });

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.contact.fullName).toBe('Dr. Jane Smith');
    });

    it('should unset existing default when setting as new default', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue({
        ...mockContact,
        isDefaultForPatient: false,
      });
      vi.mocked(prisma.patientContact.update).mockResolvedValue({
        ...mockContact,
        isDefaultForPatient: true,
      });
      vi.mocked(prisma.patientContact.updateMany).mockResolvedValue({ count: 1 });

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'PUT',
        body: JSON.stringify({ isDefaultForPatient: true }),
      });
      await PUT(request, routeParams);

      expect(prisma.patientContact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: mockContact.patientId,
            isDefaultForPatient: true,
            id: { not: mockContact.id },
          }),
          data: { isDefaultForPatient: false },
        })
      );
    });
  });

  describe('DELETE /api/contacts/:id', () => {
    const routeParams = { params: Promise.resolve({ id: mockContact.id }) };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, routeParams);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        retryAfterMs: 30000,
      });

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, routeParams);

      expect(response.status).toBe(429);
    });

    it('should return 404 when contact does not exist', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(null);

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, routeParams);

      expect(response.status).toBe(404);
    });

    it('should return 403 when contact belongs to patient in different practice', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({
        ...mockPatient,
        practiceId: 'other-practice',
      });

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, routeParams);

      expect(response.status).toBe(403);
    });

    it('should delete contact successfully', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(prisma.patientContact.delete).mockResolvedValue(mockContact);

      const request = createRequest('/api/contacts/' + mockContact.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, routeParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(prisma.patientContact.delete).toHaveBeenCalledWith({
        where: { id: mockContact.id },
      });
    });
  });
});
