/**
 * Migration Script: Migrate Legacy Subspecialties to New Medical Specialty Model
 *
 * This script migrates existing users who have subspecialties stored in the legacy
 * `User.subspecialties` string array (containing Subspecialty enum values) to the
 * new normalized model using:
 * - `ClinicianSpecialty` (junction table linking users to MedicalSpecialty)
 * - `ClinicianSubspecialty` (junction table linking users to MedicalSubspecialty)
 *
 * The legacy subspecialties are all cardiology-related, so this migration:
 * 1. Creates a ClinicianSpecialty record for Cardiology (or Cardiothoracic Surgery for CARDIAC_SURGERY)
 * 2. Creates ClinicianSubspecialty records for each mapped subspecialty
 * 3. Sets onboardingCompletedAt for migrated users (they've already onboarded)
 *
 * Usage:
 *   npx tsx prisma/migrations/scripts/migrate-subspecialties.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 */

import { PrismaClient } from '@prisma/client';
import { LEGACY_SUBSPECIALTY_MAPPING } from '../../seeds/medical-specialties';

const prisma = new PrismaClient();

interface MigrationResult {
  userId: string;
  userEmail: string;
  legacySubspecialties: string[];
  specialtiesCreated: string[];
  subspecialtiesCreated: string[];
  onboardingMarked: boolean;
  errors: string[];
}

interface MigrationSummary {
  totalUsers: number;
  migratedUsers: number;
  skippedUsers: number;
  specialtiesCreated: number;
  subspecialtiesCreated: number;
  errors: string[];
  results: MigrationResult[];
}

/**
 * Verify that required seed data exists before running migration.
 * This ensures MedicalSpecialty and MedicalSubspecialty records exist
 * for all legacy subspecialty mappings.
 */
async function verifySeedData(): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];

  // Get unique specialty and subspecialty IDs from the mapping
  const requiredSpecialtyIds = new Set<string>();
  const requiredSubspecialtyIds = new Set<string>();

  for (const mapping of Object.values(LEGACY_SUBSPECIALTY_MAPPING)) {
    requiredSpecialtyIds.add(mapping.specialtyId);
    requiredSubspecialtyIds.add(mapping.subspecialtyId);
  }

  // Check specialties exist
  for (const specialtyId of Array.from(requiredSpecialtyIds)) {
    const specialty = await prisma.medicalSpecialty.findUnique({
      where: { id: specialtyId },
      select: { id: true, name: true },
    });
    if (!specialty) {
      missing.push(`MedicalSpecialty with id ${specialtyId}`);
    }
  }

  // Check subspecialties exist
  for (const subspecialtyId of Array.from(requiredSubspecialtyIds)) {
    const subspecialty = await prisma.medicalSubspecialty.findUnique({
      where: { id: subspecialtyId },
      select: { id: true, name: true },
    });
    if (!subspecialty) {
      missing.push(`MedicalSubspecialty with id ${subspecialtyId}`);
    }
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Get all users with legacy subspecialties that need migration
 */
async function getUsersToMigrate(): Promise<
  Array<{
    id: string;
    email: string;
    subspecialties: string[];
    onboardingCompletedAt: Date | null;
    clinicianSpecialties: Array<{ specialtyId: string }>;
    clinicianSubspecialties: Array<{ subspecialtyId: string }>;
  }>
> {
  const users = await prisma.user.findMany({
    where: {
      subspecialties: {
        isEmpty: false,
      },
    },
    select: {
      id: true,
      email: true,
      subspecialties: true,
      onboardingCompletedAt: true,
      clinicianSpecialties: {
        select: { specialtyId: true },
      },
      clinicianSubspecialties: {
        select: { subspecialtyId: true },
      },
    },
  });

  return users;
}

/**
 * Migrate a single user's subspecialties to the new model
 */
async function migrateUser(
  user: {
    id: string;
    email: string;
    subspecialties: string[];
    onboardingCompletedAt: Date | null;
    clinicianSpecialties: Array<{ specialtyId: string }>;
    clinicianSubspecialties: Array<{ subspecialtyId: string }>;
  },
  dryRun: boolean
): Promise<MigrationResult> {
  const result: MigrationResult = {
    userId: user.id,
    userEmail: user.email,
    legacySubspecialties: user.subspecialties,
    specialtiesCreated: [],
    subspecialtiesCreated: [],
    onboardingMarked: false,
    errors: [],
  };

  // Track which specialties and subspecialties need to be created
  const specialtiesToCreate = new Set<string>();
  const subspecialtiesToCreate = new Map<string, string>(); // subspecialtyId -> specialtyId

  // Existing IDs for deduplication
  const existingSpecialtyIds = new Set(user.clinicianSpecialties.map((cs) => cs.specialtyId));
  const existingSubspecialtyIds = new Set(
    user.clinicianSubspecialties.map((cs) => cs.subspecialtyId)
  );

  // Map legacy subspecialties to new model
  for (const legacySubspecialty of user.subspecialties) {
    const mapping = LEGACY_SUBSPECIALTY_MAPPING[legacySubspecialty];

    if (!mapping) {
      result.errors.push(`Unknown legacy subspecialty: ${legacySubspecialty}`);
      continue;
    }

    // Add specialty if not already present
    if (!existingSpecialtyIds.has(mapping.specialtyId)) {
      specialtiesToCreate.add(mapping.specialtyId);
    }

    // Add subspecialty if not already present
    if (!existingSubspecialtyIds.has(mapping.subspecialtyId)) {
      subspecialtiesToCreate.set(mapping.subspecialtyId, mapping.specialtyId);
    }
  }

  if (dryRun) {
    // Report what would be created
    result.specialtiesCreated = Array.from(specialtiesToCreate);
    result.subspecialtiesCreated = Array.from(subspecialtiesToCreate.keys());
    result.onboardingMarked = user.onboardingCompletedAt === null;
    return result;
  }

  // Perform the migration in a transaction
  try {
    await prisma.$transaction(async (tx) => {
      // Create ClinicianSpecialty records
      const specialtyIds = Array.from(specialtiesToCreate);
      for (const specialtyId of specialtyIds) {
        await tx.clinicianSpecialty.create({
          data: {
            userId: user.id,
            specialtyId: specialtyId,
          },
        });
        result.specialtiesCreated.push(specialtyId);
      }

      // Create ClinicianSubspecialty records
      const subspecialtyIds = Array.from(subspecialtiesToCreate.keys());
      for (const subspecialtyId of subspecialtyIds) {
        await tx.clinicianSubspecialty.create({
          data: {
            userId: user.id,
            subspecialtyId: subspecialtyId,
          },
        });
        result.subspecialtiesCreated.push(subspecialtyId);
      }

      // Mark onboarding as completed if not already done
      if (user.onboardingCompletedAt === null) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            onboardingCompletedAt: new Date(),
          },
        });
        result.onboardingMarked = true;
      }
    });
  } catch (error) {
    result.errors.push(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Run the migration for all users with legacy subspecialties
 */
async function runMigration(dryRun: boolean): Promise<MigrationSummary> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Legacy Subspecialty Migration${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  const summary: MigrationSummary = {
    totalUsers: 0,
    migratedUsers: 0,
    skippedUsers: 0,
    specialtiesCreated: 0,
    subspecialtiesCreated: 0,
    errors: [],
    results: [],
  };

  // Verify seed data exists before proceeding
  console.log('Verifying seed data...');
  const seedCheck = await verifySeedData();
  if (!seedCheck.valid) {
    console.error('\n❌ Missing required seed data:');
    for (const item of seedCheck.missing) {
      console.error(`   - ${item}`);
    }
    console.error('\nPlease run the database seed first:');
    console.error('  npx prisma db seed\n');
    summary.errors.push(`Missing seed data: ${seedCheck.missing.join(', ')}`);
    return summary;
  }
  console.log('✅ Seed data verified.\n');

  // Get users to migrate
  const users = await getUsersToMigrate();
  summary.totalUsers = users.length;

  if (users.length === 0) {
    console.log('No users found with legacy subspecialties to migrate.\n');
    return summary;
  }

  console.log(`Found ${users.length} user(s) with legacy subspecialties.\n`);

  // Verify mapping coverage
  const allLegacyValues = new Set(users.flatMap((u) => u.subspecialties));
  const unmappedValues = Array.from(allLegacyValues).filter(
    (v) => !LEGACY_SUBSPECIALTY_MAPPING[v]
  );

  if (unmappedValues.length > 0) {
    console.log(`⚠️  Warning: Unmapped legacy subspecialty values: ${unmappedValues.join(', ')}\n`);
    summary.errors.push(`Unmapped values: ${unmappedValues.join(', ')}`);
  }

  // Migrate each user
  for (const user of users) {
    console.log(`Processing user: ${user.email}`);
    console.log(`  Legacy subspecialties: ${user.subspecialties.join(', ')}`);

    const result = await migrateUser(user, dryRun);
    summary.results.push(result);

    if (result.errors.length > 0) {
      console.log(`  ❌ Errors: ${result.errors.join(', ')}`);
      summary.errors.push(...result.errors);
      summary.skippedUsers++;
    } else if (result.specialtiesCreated.length === 0 && result.subspecialtiesCreated.length === 0) {
      console.log('  ⏭️  Already migrated, skipping.');
      summary.skippedUsers++;
    } else {
      console.log(`  ✅ ${dryRun ? 'Would create' : 'Created'}:`);
      console.log(`     - ${result.specialtiesCreated.length} specialty link(s)`);
      console.log(`     - ${result.subspecialtiesCreated.length} subspecialty link(s)`);
      if (result.onboardingMarked) {
        console.log(`     - Marked onboarding as completed`);
      }
      summary.migratedUsers++;
      summary.specialtiesCreated += result.specialtiesCreated.length;
      summary.subspecialtiesCreated += result.subspecialtiesCreated.length;
    }

    console.log('');
  }

  // Print summary
  console.log(`${'='.repeat(60)}`);
  console.log('Migration Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total users with legacy subspecialties: ${summary.totalUsers}`);
  console.log(`Users migrated: ${summary.migratedUsers}`);
  console.log(`Users skipped (already migrated or errors): ${summary.skippedUsers}`);
  console.log(`Specialty links ${dryRun ? 'to create' : 'created'}: ${summary.specialtiesCreated}`);
  console.log(`Subspecialty links ${dryRun ? 'to create' : 'created'}: ${summary.subspecialtiesCreated}`);

  if (summary.errors.length > 0) {
    console.log(`\n⚠️  ${summary.errors.length} error(s) encountered.`);
  }

  if (dryRun) {
    console.log(`\n📝 This was a dry run. No changes were made.`);
    console.log(`   Run without --dry-run to apply changes.`);
  } else {
    console.log(`\n✅ Migration completed successfully.`);
  }

  console.log('');

  return summary;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    const summary = await runMigration(dryRun);

    // Exit with non-zero code if there were errors
    if (summary.errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
main();
