// tests/unit/domains/contacts/contact.service.test.ts
// Tests for contact service (unit tests with mocked Prisma)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as contactService from '@/domains/contacts/contact.service';
import { prisma } from '@/infrastructure/db/client';
import type { ContactType, ChannelType } from '@/domains/contacts/contact.types';

// Mock Prisma
vi.mock('@/infrastructure/db/client', () => ({
  prisma: {
    patient: {
      findUnique: vi.fn(),
    },
    patientContact: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('contact.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockContact = {
    id: 'contact-1',
    patientId: 'patient-1',
    type: 'GP' as ContactType,
    fullName: 'Dr. John Smith',
    organisation: 'Sydney Medical Centre',
    role: 'General Practitioner',
    email: 'john.smith@example.com',
    phone: '+61 2 9876 5432',
    fax: null,
    address: '123 Medical St, Sydney NSW 2000',
    secureMessagingId: null,
    preferredChannel: 'EMAIL' as ChannelType,
    isDefaultForPatient: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('createContact', () => {
    it('should create a contact when patient exists', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.patientContact.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.patientContact.create).mockResolvedValue(mockContact);

      const result = await contactService.createContact({
        patientId: 'patient-1',
        type: 'GP',
        fullName: 'Dr. John Smith',
        organisation: 'Sydney Medical Centre',
        email: 'john.smith@example.com',
        isDefaultForPatient: true,
      });

      expect(prisma.patient.findUnique).toHaveBeenCalledWith({
        where: { id: 'patient-1' },
        select: { id: true },
      });
      expect(prisma.patientContact.create).toHaveBeenCalled();
      expect(result.id).toBe('contact-1');
      expect(result.fullName).toBe('Dr. John Smith');
      expect(result.type).toBe('GP');
    });

    it('should throw error when patient does not exist', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue(null);

      await expect(
        contactService.createContact({
          patientId: 'non-existent',
          type: 'GP',
          fullName: 'Dr. John Smith',
          email: 'john@example.com',
        })
      ).rejects.toThrow('Patient not found');
    });

    it('should unset existing defaults when creating new default contact', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.patientContact.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.patientContact.create).mockResolvedValue(mockContact);

      await contactService.createContact({
        patientId: 'patient-1',
        type: 'GP',
        fullName: 'Dr. John Smith',
        email: 'john@example.com',
        isDefaultForPatient: true,
      });

      expect(prisma.patientContact.updateMany).toHaveBeenCalledWith({
        where: {
          patientId: 'patient-1',
          type: 'GP',
          isDefaultForPatient: true,
        },
        data: {
          isDefaultForPatient: false,
        },
      });
    });

    it('should not unset defaults when isDefaultForPatient is false', async () => {
      vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.patientContact.create).mockResolvedValue({
        ...mockContact,
        isDefaultForPatient: false,
      });

      await contactService.createContact({
        patientId: 'patient-1',
        type: 'GP',
        fullName: 'Dr. John Smith',
        email: 'john@example.com',
        isDefaultForPatient: false,
      });

      expect(prisma.patientContact.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getContact', () => {
    it('should return contact when found', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(mockContact);

      const result = await contactService.getContact('contact-1');

      expect(prisma.patientContact.findUnique).toHaveBeenCalledWith({
        where: { id: 'contact-1' },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe('contact-1');
    });

    it('should return null when contact not found', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(null);

      const result = await contactService.getContact('non-existent');

      expect(result).toBeNull();
    });

    it('should return null when patientId does not match', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(mockContact);

      const result = await contactService.getContact('contact-1', 'different-patient');

      expect(result).toBeNull();
    });

    it('should return contact when patientId matches', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(mockContact);

      const result = await contactService.getContact('contact-1', 'patient-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('contact-1');
    });
  });

  describe('listContactsForPatient', () => {
    it('should return paginated contacts for patient', async () => {
      const contacts = [mockContact, { ...mockContact, id: 'contact-2', fullName: 'Dr. Jane Doe' }];
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue(contacts);
      vi.mocked(prisma.patientContact.count).mockResolvedValue(5);

      const result = await contactService.listContactsForPatient({
        patientId: 'patient-1',
        page: 1,
        limit: 2,
      });

      expect(prisma.patientContact.findMany).toHaveBeenCalledWith({
        where: { patientId: 'patient-1' },
        orderBy: [
          { isDefaultForPatient: 'desc' },
          { type: 'asc' },
          { fullName: 'asc' },
        ],
        skip: 0,
        take: 2,
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should apply type filter', async () => {
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(prisma.patientContact.count).mockResolvedValue(1);

      await contactService.listContactsForPatient({
        patientId: 'patient-1',
        type: 'GP',
      });

      expect(prisma.patientContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: 'patient-1', type: 'GP' },
        })
      );
    });

    it('should apply isDefaultForPatient filter', async () => {
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(prisma.patientContact.count).mockResolvedValue(1);

      await contactService.listContactsForPatient({
        patientId: 'patient-1',
        isDefaultForPatient: true,
      });

      expect(prisma.patientContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: 'patient-1', isDefaultForPatient: true },
        })
      );
    });

    it('should calculate hasMore correctly when no more results', async () => {
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(prisma.patientContact.count).mockResolvedValue(1);

      const result = await contactService.listContactsForPatient({
        patientId: 'patient-1',
        page: 1,
        limit: 20,
      });

      expect(result.hasMore).toBe(false);
    });
  });

  describe('updateContact', () => {
    it('should update contact when found', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue({
        id: 'contact-1',
        patientId: 'patient-1',
        type: 'GP',
      } as any);
      vi.mocked(prisma.patientContact.update).mockResolvedValue({
        ...mockContact,
        fullName: 'Dr. Updated Name',
      });

      const result = await contactService.updateContact('contact-1', {
        fullName: 'Dr. Updated Name',
      });

      expect(prisma.patientContact.update).toHaveBeenCalledWith({
        where: { id: 'contact-1' },
        data: { fullName: 'Dr. Updated Name' },
      });
      expect(result.fullName).toBe('Dr. Updated Name');
    });

    it('should throw error when contact not found', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(null);

      await expect(
        contactService.updateContact('non-existent', { fullName: 'New Name' })
      ).rejects.toThrow('Contact not found');
    });

    it('should throw error when patientId does not match', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue({
        id: 'contact-1',
        patientId: 'patient-1',
        type: 'GP',
      } as any);

      await expect(
        contactService.updateContact('contact-1', { fullName: 'New Name' }, 'different-patient')
      ).rejects.toThrow('Unauthorized: contact belongs to another patient');
    });

    it('should unset other defaults when setting as default', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue({
        id: 'contact-1',
        patientId: 'patient-1',
        type: 'GP',
      } as any);
      vi.mocked(prisma.patientContact.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.patientContact.update).mockResolvedValue({
        ...mockContact,
        isDefaultForPatient: true,
      });

      await contactService.updateContact('contact-1', { isDefaultForPatient: true });

      expect(prisma.patientContact.updateMany).toHaveBeenCalledWith({
        where: {
          patientId: 'patient-1',
          type: 'GP',
          isDefaultForPatient: true,
          id: { not: 'contact-1' },
        },
        data: { isDefaultForPatient: false },
      });
    });

    it('should use new type when unsetting defaults for type change', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue({
        id: 'contact-1',
        patientId: 'patient-1',
        type: 'GP',
      } as any);
      vi.mocked(prisma.patientContact.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.patientContact.update).mockResolvedValue({
        ...mockContact,
        type: 'SPECIALIST',
        isDefaultForPatient: true,
      });

      await contactService.updateContact('contact-1', {
        type: 'SPECIALIST',
        isDefaultForPatient: true,
      });

      expect(prisma.patientContact.updateMany).toHaveBeenCalledWith({
        where: {
          patientId: 'patient-1',
          type: 'SPECIALIST', // New type, not old
          isDefaultForPatient: true,
          id: { not: 'contact-1' },
        },
        data: { isDefaultForPatient: false },
      });
    });
  });

  describe('deleteContact', () => {
    it('should delete contact when found', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue({
        id: 'contact-1',
        patientId: 'patient-1',
      } as any);
      vi.mocked(prisma.patientContact.delete).mockResolvedValue(mockContact);

      await contactService.deleteContact('contact-1');

      expect(prisma.patientContact.delete).toHaveBeenCalledWith({
        where: { id: 'contact-1' },
      });
    });

    it('should throw error when contact not found', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue(null);

      await expect(contactService.deleteContact('non-existent')).rejects.toThrow(
        'Contact not found'
      );
    });

    it('should throw error when patientId does not match', async () => {
      vi.mocked(prisma.patientContact.findUnique).mockResolvedValue({
        id: 'contact-1',
        patientId: 'patient-1',
      } as any);

      await expect(
        contactService.deleteContact('contact-1', 'different-patient')
      ).rejects.toThrow('Unauthorized: contact belongs to another patient');
    });
  });

  describe('getDefaultContactForPatient', () => {
    it('should return default contact of specified type', async () => {
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(mockContact);

      const result = await contactService.getDefaultContactForPatient('patient-1', 'GP');

      expect(prisma.patientContact.findFirst).toHaveBeenCalledWith({
        where: {
          patientId: 'patient-1',
          type: 'GP',
          isDefaultForPatient: true,
        },
      });
      expect(result).not.toBeNull();
      expect(result?.type).toBe('GP');
    });

    it('should return null when no default exists', async () => {
      vi.mocked(prisma.patientContact.findFirst).mockResolvedValue(null);

      const result = await contactService.getDefaultContactForPatient('patient-1', 'GP');

      expect(result).toBeNull();
    });
  });

  describe('getDefaultContactsForPatient', () => {
    it('should return all default contacts for patient', async () => {
      const defaults = [
        mockContact,
        { ...mockContact, id: 'contact-2', type: 'REFERRER' as ContactType },
      ];
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue(defaults);

      const result = await contactService.getDefaultContactsForPatient('patient-1');

      expect(prisma.patientContact.findMany).toHaveBeenCalledWith({
        where: {
          patientId: 'patient-1',
          isDefaultForPatient: true,
        },
        orderBy: { type: 'asc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getContactsByIds', () => {
    it('should return contacts matching provided IDs', async () => {
      const contacts = [mockContact, { ...mockContact, id: 'contact-2' }];
      vi.mocked(prisma.patientContact.findMany).mockResolvedValue(contacts);

      const result = await contactService.getContactsByIds(['contact-1', 'contact-2']);

      expect(prisma.patientContact.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['contact-1', 'contact-2'] } },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await contactService.getContactsByIds([]);

      expect(prisma.patientContact.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('hasContacts', () => {
    it('should return true when patient has contacts', async () => {
      vi.mocked(prisma.patientContact.count).mockResolvedValue(3);

      const result = await contactService.hasContacts('patient-1');

      expect(prisma.patientContact.count).toHaveBeenCalledWith({
        where: { patientId: 'patient-1' },
      });
      expect(result).toBe(true);
    });

    it('should return false when patient has no contacts', async () => {
      vi.mocked(prisma.patientContact.count).mockResolvedValue(0);

      const result = await contactService.hasContacts('patient-1');

      expect(result).toBe(false);
    });
  });
});
