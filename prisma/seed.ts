// prisma/seed.ts
// Development seed data for DictateMED MVP

import { PrismaClient } from '@prisma/client';
import { encryptPatientData } from '../src/infrastructure/db/encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo practice
  const practice = await prisma.practice.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Sydney Heart Specialists',
      settings: {
        timezone: 'Australia/Sydney',
        letterheadEnabled: true,
      },
    },
  });

  console.log(`Created practice: ${practice.name}`);

  // Create demo admin user
  const adminUser = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      auth0Id: 'auth0|demo-admin',
      email: 'admin@demo.dictatemed.local',
      name: 'Dr. Admin Demo',
      role: 'ADMIN',
      practiceId: practice.id,
      settings: {
        preferredMode: 'AMBIENT',
        notificationsEnabled: true,
      },
    },
  });

  console.log(`Created admin user: ${adminUser.name}`);

  // Create demo specialist user
  const specialistUser = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      auth0Id: 'auth0|demo-specialist',
      email: 'specialist@demo.dictatemed.local',
      name: 'Dr. Jane Cardiologist',
      role: 'SPECIALIST',
      practiceId: practice.id,
      styleProfile: {
        formality: 'formal',
        verbosity: 'concise',
        letterCount: 0,
      },
      settings: {
        preferredMode: 'DICTATION',
        notificationsEnabled: true,
      },
    },
  });

  console.log(`Created specialist user: ${specialistUser.name}`);

  // Create demo patients (with encrypted PHI)
  // Note: PHI_ENCRYPTION_KEY must be set in environment
  if (!process.env.PHI_ENCRYPTION_KEY) {
    console.warn(
      'Warning: PHI_ENCRYPTION_KEY not set. Skipping patient seeding.'
    );
    console.warn(
      'To generate a key, run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  } else {
    const patients = [
      {
        id: '00000000-0000-0000-0000-000000000100',
        name: 'John Smith',
        dateOfBirth: '1955-03-15',
        medicareNumber: '1234567890',
        address: '123 George Street, Sydney NSW 2000',
        phone: '+61 412 345 678',
      },
      {
        id: '00000000-0000-0000-0000-000000000101',
        name: 'Margaret Johnson',
        dateOfBirth: '1962-08-22',
        medicareNumber: '2345678901',
        address: '456 Pitt Street, Sydney NSW 2000',
        phone: '+61 423 456 789',
      },
      {
        id: '00000000-0000-0000-0000-000000000102',
        name: 'Robert Williams',
        dateOfBirth: '1948-11-30',
        medicareNumber: '3456789012',
        address: '789 Martin Place, Sydney NSW 2000',
      },
    ];

    for (const patientData of patients) {
      const { id, ...phi } = patientData;
      const encryptedData = encryptPatientData(phi);

      await prisma.patient.upsert({
        where: { id },
        update: {},
        create: {
          id,
          encryptedData,
          practiceId: practice.id,
        },
      });

      console.log(`Created patient: ${phi.name}`);
    }
  }

  // Create sample audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'user.login',
        metadata: { method: 'auth0', mfa: true },
      },
      {
        userId: specialistUser.id,
        action: 'user.login',
        metadata: { method: 'auth0', mfa: true },
      },
    ],
    skipDuplicates: true,
  });

  console.log('Created sample audit logs');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
