// tests/integration/api/recordings.test.ts
// Integration tests for recording API endpoints with user-scoped access

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/recordings/route';
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from '@/app/api/recordings/[id]/route';
import * as auth from '@/lib/auth';
import * as recordingService from '@/domains/recording/recording.service';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock rate limit
const mockCheckRateLimit = vi.fn();
const mockCreateRateLimitKey = vi.fn();
const mockGetRateLimitHeaders = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (key: string, resource: string) =>
    mockCheckRateLimit(key, resource),
  createRateLimitKey: (userId: string, resource: string) =>
    mockCreateRateLimitKey(userId, resource),
  getRateLimitHeaders: (result: unknown) => mockGetRateLimitHeaders(result),
}));

// Mock recording service
vi.mock('@/domains/recording/recording.service', () => ({
  createRecording: vi.fn(),
  listRecordings: vi.fn(),
  getRecording: vi.fn(),
  updateRecording: vi.fn(),
  deleteRecording: vi.fn(),
}));

// Test fixtures - Using valid UUIDs
const mockUserA = {
  id: '11111111-1111-1111-1111-111111111111',
  auth0Id: 'auth0|user-a',
  email: 'user-a@example.com',
  name: 'Dr. Alice',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
};

const mockUserB = {
  id: '22222222-2222-2222-2222-222222222222',
  auth0Id: 'auth0|user-b',
  email: 'user-b@example.com',
  name: 'Dr. Bob',
  role: 'SPECIALIST' as const,
  clinicianRole: 'MEDICAL' as const,
  practiceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  subspecialties: ['Cardiology'],
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
};

const mockRecordingUserA = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  userId: '11111111-1111-1111-1111-111111111111',
  consultationId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  patientId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  mode: 'DICTATION' as const,
  status: 'UPLOADING' as const,
  consentType: 'VERBAL' as const,
  durationSeconds: undefined,
  audioUrl: undefined,
  transcriptId: undefined,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockRecordingUserB = {
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  userId: '22222222-2222-2222-2222-222222222222',
  consultationId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  patientId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  mode: 'AMBIENT' as const,
  status: 'UPLOADING' as const,
  consentType: 'VERBAL' as const,
  durationSeconds: undefined,
  audioUrl: undefined,
  transcriptId: undefined,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function createRequest(
  url: string,
  options: { method?: string; body?: string } = {}
) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('Recordings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 59,
      resetAt: new Date(),
    });
    mockCreateRateLimitKey.mockImplementation(
      (userId: string, resource: string) => `${userId}:${resource}`
    );
    mockGetRateLimitHeaders.mockReturnValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/recordings', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/recordings');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return recordings for authenticated user only', async () => {
      vi.mocked(recordingService.listRecordings).mockResolvedValue({
        recordings: [mockRecordingUserA],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const request = createRequest('/api/recordings');
      const response = await GET(request);

      expect(response.status).toBe(200);

      // Verify user scoping
      expect(recordingService.listRecordings).toHaveBeenCalledWith(
        mockUserA.id,
        expect.any(Object)
      );
    });

    it('should filter by status', async () => {
      vi.mocked(recordingService.listRecordings).mockResolvedValue({
        recordings: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      // Valid recording statuses: UPLOADING, UPLOADED, TRANSCRIBING, TRANSCRIBED, FAILED
      const request = createRequest('/api/recordings?status=TRANSCRIBED');
      await GET(request);

      expect(recordingService.listRecordings).toHaveBeenCalledWith(
        mockUserA.id,
        expect.objectContaining({
          status: 'TRANSCRIBED',
        })
      );
    });

    it('should filter by mode', async () => {
      vi.mocked(recordingService.listRecordings).mockResolvedValue({
        recordings: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const request = createRequest('/api/recordings?mode=DICTATION');
      await GET(request);

      expect(recordingService.listRecordings).toHaveBeenCalledWith(
        mockUserA.id,
        expect.objectContaining({
          mode: 'DICTATION',
        })
      );
    });

    it('should handle pagination', async () => {
      vi.mocked(recordingService.listRecordings).mockResolvedValue({
        recordings: [],
        total: 100,
        page: 3,
        limit: 10,
        hasMore: true,
      });

      const request = createRequest('/api/recordings?page=3&limit=10');
      await GET(request);

      expect(recordingService.listRecordings).toHaveBeenCalledWith(
        mockUserA.id,
        expect.objectContaining({
          page: 3,
          limit: 10,
        })
      );
    });
  });

  describe('POST /api/recordings', () => {
    const validRecordingInput = {
      consultationId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      patientId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      mode: 'DICTATION',
      consentType: 'VERBAL',
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/recordings', {
        method: 'POST',
        body: JSON.stringify(validRecordingInput),
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

      const request = createRequest('/api/recordings', {
        method: 'POST',
        body: JSON.stringify(validRecordingInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe('Rate limit exceeded');
    });

    it('should create recording with correct userId', async () => {
      vi.mocked(recordingService.createRecording).mockResolvedValue({
        id: mockRecordingUserA.id,
        uploadUrl: 'https://upload.example.com/recording',
        expiresAt: new Date('2024-01-02'),
      });

      const request = createRequest('/api/recordings', {
        method: 'POST',
        body: JSON.stringify(validRecordingInput),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(recordingService.createRecording).toHaveBeenCalledWith(
        mockUserA.id,
        expect.objectContaining({
          consultationId: validRecordingInput.consultationId,
          mode: validRecordingInput.mode,
        })
      );
    });

    it('should return 400 for invalid input', async () => {
      const request = createRequest('/api/recordings', {
        method: 'POST',
        body: JSON.stringify({ mode: 'INVALID_MODE' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });
  });

  describe('GET /api/recordings/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/recordings/' + mockRecordingUserA.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockRecordingUserA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when recording belongs to different user', async () => {
      vi.mocked(recordingService.getRecording).mockResolvedValue(null);

      const request = createRequest('/api/recordings/' + mockRecordingUserB.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockRecordingUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('should return recording when user is owner', async () => {
      vi.mocked(recordingService.getRecording).mockResolvedValue(
        mockRecordingUserA
      );

      const request = createRequest('/api/recordings/' + mockRecordingUserA.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockRecordingUserA.id }),
      });

      expect(response.status).toBe(200);
      expect(recordingService.getRecording).toHaveBeenCalledWith(
        mockUserA.id,
        mockRecordingUserA.id
      );
    });
  });

  describe('PUT /api/recordings/[id]', () => {
    // Use valid fields from updateRecordingSchema: patientId, mode, consentType, audioQuality
    const updateInput = { mode: 'AMBIENT', audioQuality: 'excellent' };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/recordings/' + mockRecordingUserA.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockRecordingUserA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when recording belongs to different user', async () => {
      vi.mocked(recordingService.updateRecording).mockRejectedValue(
        new Error('Recording not found')
      );

      const request = createRequest('/api/recordings/' + mockRecordingUserB.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockRecordingUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('should update recording when user is owner', async () => {
      vi.mocked(recordingService.updateRecording).mockResolvedValue({
        ...mockRecordingUserA,
        mode: 'AMBIENT',
      });

      const request = createRequest('/api/recordings/' + mockRecordingUserA.id, {
        method: 'PUT',
        body: JSON.stringify(updateInput),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockRecordingUserA.id }),
      });

      expect(response.status).toBe(200);
      expect(recordingService.updateRecording).toHaveBeenCalledWith(
        mockUserA.id,
        mockRecordingUserA.id,
        expect.objectContaining({
          mode: 'AMBIENT',
          audioQuality: 'excellent',
        })
      );
    });

    it('should return 400 for invalid input', async () => {
      const request = createRequest('/api/recordings/' + mockRecordingUserA.id, {
        method: 'PUT',
        body: JSON.stringify({ mode: 'INVALID_MODE' }),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockRecordingUserA.id }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Validation failed');
    });
  });

  describe('DELETE /api/recordings/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(null);

      const request = createRequest('/api/recordings/' + mockRecordingUserA.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockRecordingUserA.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 404 when recording belongs to different user', async () => {
      vi.mocked(recordingService.deleteRecording).mockRejectedValue(
        new Error('Recording not found')
      );

      const request = createRequest('/api/recordings/' + mockRecordingUserB.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockRecordingUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('should delete recording when user is owner', async () => {
      vi.mocked(recordingService.deleteRecording).mockResolvedValue(undefined);

      const request = createRequest('/api/recordings/' + mockRecordingUserA.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockRecordingUserA.id }),
      });

      expect(response.status).toBe(204);
      expect(recordingService.deleteRecording).toHaveBeenCalledWith(
        mockUserA.id,
        mockRecordingUserA.id
      );
    });
  });

  describe('User Isolation', () => {
    it('User A cannot list User B recordings', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(recordingService.listRecordings).mockResolvedValue({
        recordings: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const request = createRequest('/api/recordings');
      await GET(request);

      // Verify only User A's recordings are requested
      expect(recordingService.listRecordings).toHaveBeenCalledWith(
        mockUserA.id,
        expect.any(Object)
      );
    });

    it('User A cannot access User B recording by ID', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(recordingService.getRecording).mockResolvedValue(null);

      const request = createRequest('/api/recordings/' + mockRecordingUserB.id);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: mockRecordingUserB.id }),
      });

      expect(response.status).toBe(404);
      expect(recordingService.getRecording).toHaveBeenCalledWith(
        mockUserA.id,
        mockRecordingUserB.id
      );
    });

    it('User A cannot modify User B recording', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(recordingService.updateRecording).mockRejectedValue(
        new Error('Recording not found')
      );

      const request = createRequest('/api/recordings/' + mockRecordingUserB.id, {
        method: 'PUT',
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockRecordingUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('User A cannot delete User B recording', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserA });
      vi.mocked(recordingService.deleteRecording).mockRejectedValue(
        new Error('Recording not found')
      );

      const request = createRequest('/api/recordings/' + mockRecordingUserB.id, {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockRecordingUserB.id }),
      });

      expect(response.status).toBe(404);
    });

    it('User B sees different recordings in list', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({ user: mockUserB });
      vi.mocked(recordingService.listRecordings).mockResolvedValue({
        recordings: [mockRecordingUserB],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const request = createRequest('/api/recordings');
      await GET(request);

      expect(recordingService.listRecordings).toHaveBeenCalledWith(
        mockUserB.id,
        expect.any(Object)
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to POST requests', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: true,
        remaining: 5,
        resetAt: new Date(),
      });

      vi.mocked(recordingService.createRecording).mockResolvedValue({
        id: mockRecordingUserA.id,
        uploadUrl: 'https://upload.example.com/recording',
        expiresAt: new Date('2024-01-02'),
      });

      const request = createRequest('/api/recordings', {
        method: 'POST',
        body: JSON.stringify({
          consultationId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          patientId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          mode: 'DICTATION',
          consentType: 'VERBAL',
        }),
      });
      await POST(request);

      expect(mockCreateRateLimitKey).toHaveBeenCalledWith(
        mockUserA.id,
        'recordings'
      );
      expect(mockCheckRateLimit).toHaveBeenCalled();
    });

    it('should return rate limit headers on success', async () => {
      mockCheckRateLimit.mockReturnValue({
        allowed: true,
        remaining: 5,
        resetAt: new Date(),
      });
      mockGetRateLimitHeaders.mockReturnValue({
        'X-RateLimit-Remaining': '5',
        'X-RateLimit-Reset': '1234567890',
      });

      vi.mocked(recordingService.createRecording).mockResolvedValue({
        id: mockRecordingUserA.id,
        uploadUrl: 'https://upload.example.com/recording',
        expiresAt: new Date('2024-01-02'),
      });

      const request = createRequest('/api/recordings', {
        method: 'POST',
        body: JSON.stringify({
          consultationId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          patientId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          mode: 'DICTATION',
          consentType: 'VERBAL',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockGetRateLimitHeaders).toHaveBeenCalled();
    });
  });
});
