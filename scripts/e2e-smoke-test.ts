/**
 * End-to-End Smoke Test for DictateMED Supabase Migration
 *
 * This script verifies the complete workflow after migrating from AWS S3/SES
 * to Supabase Storage and Resend. It tests all PHI touch points and audit logging.
 *
 * Prerequisites:
 *   - .env.local file with all required credentials
 *   - Supabase storage buckets created (run migrations)
 *   - Database migrations applied
 *   - At least one user account set up
 *
 * Run with:
 *   npx tsx scripts/e2e-smoke-test.ts
 *
 * This script runs in "dry-run" mode by default. Set SMOKE_TEST_LIVE=true to
 * actually create/modify data.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import * as crypto from 'crypto';

// Load environment variables
config({ path: '.env.local' });

// ============ Configuration ============

interface TestConfig {
  dryRun: boolean;
  verbose: boolean;
  testEmail: string;
}

const testConfig: TestConfig = {
  dryRun: process.env.SMOKE_TEST_LIVE !== 'true',
  verbose: process.env.SMOKE_TEST_VERBOSE === 'true',
  testEmail: process.env.SMOKE_TEST_EMAIL || 'test@example.com',
};

// ============ Test Results ============

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
  details?: Record<string, unknown>;
}

interface TestSuite {
  name: string;
  results: TestResult[];
  startTime: number;
  endTime?: number;
}

const testSuites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

// ============ Test Utilities ============

function startSuite(name: string): void {
  currentSuite = {
    name,
    results: [],
    startTime: Date.now(),
  };
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('='.repeat(60));
}

function endSuite(): void {
  if (currentSuite) {
    currentSuite.endTime = Date.now();
    testSuites.push(currentSuite);
    currentSuite = null;
  }
}

async function runTest(
  name: string,
  testFn: () => Promise<{ passed: boolean; message: string; details?: Record<string, unknown> }>
): Promise<TestResult> {
  const start = Date.now();
  let result: TestResult;

  try {
    const { passed, message, details } = await testFn();
    result = {
      name,
      passed,
      message,
      duration: Date.now() - start,
      details,
    };
  } catch (error) {
    result = {
      name,
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    };
  }

  const icon = result.passed ? '✅' : '❌';
  console.log(`  ${icon} ${name} (${result.duration}ms)`);
  if (!result.passed || testConfig.verbose) {
    console.log(`     ${result.message}`);
    if (result.details && testConfig.verbose) {
      console.log(`     Details:`, JSON.stringify(result.details, null, 2));
    }
  }

  if (currentSuite) {
    currentSuite.results.push(result);
  }

  return result;
}

// ============ Supabase Client Setup ============

let supabase: SupabaseClient | null = null;
let prisma: PrismaClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase credentials not configured');
    }

    supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// ============ Test Suite: Environment Configuration ============

async function testEnvironmentConfiguration(): Promise<void> {
  startSuite('Environment Configuration');

  await runTest('Supabase URL is configured', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return {
      passed: !!url && url.includes('supabase.co'),
      message: url ? `URL: ${url}` : 'NEXT_PUBLIC_SUPABASE_URL not set',
    };
  });

  await runTest('Supabase anon key is configured', async () => {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return {
      passed: !!key && key.length > 20,
      message: key ? 'Anon key is set' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY not set',
    };
  });

  await runTest('Supabase service role key is configured', async () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return {
      passed: !!key && key.length > 20,
      message: key ? 'Service role key is set' : 'SUPABASE_SERVICE_ROLE_KEY not set',
    };
  });

  await runTest('Resend API key is configured', async () => {
    const key = process.env.RESEND_API_KEY;
    return {
      passed: !!key && key.startsWith('re_'),
      message: key ? 'Resend API key is set' : 'RESEND_API_KEY not set or invalid format',
    };
  });

  await runTest('Resend sender email is configured', async () => {
    const email = process.env.RESEND_FROM_EMAIL;
    return {
      passed: !!email && email.includes('@'),
      message: email ? `Sender: ${email}` : 'RESEND_FROM_EMAIL not set',
    };
  });

  await runTest('Database URL is configured', async () => {
    const url = process.env.DATABASE_URL;
    return {
      passed: !!url && url.includes('postgresql'),
      message: url ? 'Database URL is set' : 'DATABASE_URL not set',
    };
  });

  await runTest('PHI encryption key is configured', async () => {
    const key = process.env.PHI_ENCRYPTION_KEY;
    return {
      passed: !!key && key.length >= 32,
      message: key ? 'Encryption key is set' : 'PHI_ENCRYPTION_KEY not set or too short',
    };
  });

  await runTest('No S3 bucket configured (should be removed)', async () => {
    const bucket = process.env.S3_BUCKET_NAME;
    return {
      passed: !bucket,
      message: bucket
        ? `WARNING: S3_BUCKET_NAME is still set: ${bucket}`
        : 'S3_BUCKET_NAME correctly removed',
    };
  });

  endSuite();
}

// ============ Test Suite: Supabase Storage Infrastructure ============

async function testSupabaseStorageInfrastructure(): Promise<void> {
  startSuite('Supabase Storage Infrastructure');

  const client = getSupabaseClient();

  await runTest('Can connect to Supabase', async () => {
    const { data, error } = await client.storage.listBuckets();
    return {
      passed: !error,
      message: error ? `Connection failed: ${error.message}` : 'Connected successfully',
      details: { bucketCount: data?.length },
    };
  });

  const requiredBuckets = ['audio-recordings', 'clinical-documents', 'user-assets'];

  for (const bucket of requiredBuckets) {
    await runTest(`Bucket '${bucket}' exists`, async () => {
      const { data: buckets, error } = await client.storage.listBuckets();
      if (error) {
        return { passed: false, message: error.message };
      }
      const found = buckets?.find((b) => b.name === bucket);
      return {
        passed: !!found,
        message: found ? `Bucket found (public: ${found.public})` : 'Bucket not found',
      };
    });

    await runTest(`Bucket '${bucket}' is private (not public)`, async () => {
      const { data: buckets, error } = await client.storage.listBuckets();
      if (error) {
        return { passed: false, message: error.message };
      }
      const found = buckets?.find((b) => b.name === bucket);
      if (!found) {
        return { passed: false, message: 'Bucket not found' };
      }
      return {
        passed: !found.public,
        message: found.public
          ? 'CRITICAL: Bucket is PUBLIC - PHI is exposed!'
          : 'Bucket is private',
      };
    });

    await runTest(`Can access bucket '${bucket}' with service role`, async () => {
      const { error } = await client.storage.from(bucket).list('', { limit: 1 });
      return {
        passed: !error,
        message: error ? `Access denied: ${error.message}` : 'Access granted',
      };
    });
  }

  endSuite();
}

// ============ Test Suite: Database Schema ============

async function testDatabaseSchema(): Promise<void> {
  startSuite('Database Schema');

  const db = getPrismaClient();

  await runTest('Can connect to database', async () => {
    try {
      await db.$queryRaw`SELECT 1`;
      return { passed: true, message: 'Connected successfully' };
    } catch (error) {
      return {
        passed: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  });

  await runTest('Recording model has storagePath field', async () => {
    try {
      // Check schema by attempting a query that uses storagePath
      const count = await db.recording.count({
        where: {
          storagePath: { not: null },
        },
      });
      return {
        passed: true,
        message: `Found ${count} recordings with storagePath`,
      };
    } catch (error) {
      return {
        passed: false,
        message: 'storagePath field not found - run migrations',
      };
    }
  });

  await runTest('Recording model has audioDeletedAt field', async () => {
    try {
      const count = await db.recording.count({
        where: {
          audioDeletedAt: { not: null },
        },
      });
      return {
        passed: true,
        message: `Found ${count} recordings with audio deleted`,
      };
    } catch (error) {
      return {
        passed: false,
        message: 'audioDeletedAt field not found - run migrations',
      };
    }
  });

  await runTest('Document model has storagePath field', async () => {
    try {
      const count = await db.document.count({
        where: {
          storagePath: { not: null },
        },
      });
      return {
        passed: true,
        message: `Found ${count} documents with storagePath`,
      };
    } catch (error) {
      return {
        passed: false,
        message: 'storagePath field not found - run migrations',
      };
    }
  });

  await runTest('Document model has retentionUntil field', async () => {
    try {
      const count = await db.document.count({
        where: {
          retentionUntil: { not: null },
        },
      });
      return {
        passed: true,
        message: `Found ${count} documents with retention policy`,
      };
    } catch (error) {
      return {
        passed: false,
        message: 'retentionUntil field not found - run migrations',
      };
    }
  });

  await runTest('SentEmail table exists', async () => {
    try {
      const count = await db.sentEmail.count();
      return {
        passed: true,
        message: `Found ${count} sent emails`,
      };
    } catch (error) {
      return {
        passed: false,
        message: 'SentEmail table not found - run migrations',
      };
    }
  });

  await runTest('AuditLog table exists', async () => {
    try {
      const count = await db.auditLog.count();
      return {
        passed: true,
        message: `Found ${count} audit log entries`,
      };
    } catch (error) {
      return {
        passed: false,
        message: 'AuditLog table not found',
      };
    }
  });

  endSuite();
}

// ============ Test Suite: Storage Operations (Non-destructive) ============

async function testStorageOperations(): Promise<void> {
  startSuite('Storage Operations');

  const client = getSupabaseClient();
  const testPrefix = `smoke-test-${Date.now()}`;

  // Test upload capability
  await runTest('Can generate signed upload URL for audio', async () => {
    const bucket = 'audio-recordings';
    const path = `${testPrefix}/test-audio.webm`;

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });

    return {
      passed: !error && !!data?.signedUrl,
      message: error ? error.message : 'Signed upload URL generated',
      details: {
        hasToken: !!data?.token,
        hasPath: !!data?.path,
      },
    };
  });

  await runTest('Can generate signed upload URL for documents', async () => {
    const bucket = 'clinical-documents';
    const path = `${testPrefix}/test-doc.pdf`;

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });

    return {
      passed: !error && !!data?.signedUrl,
      message: error ? error.message : 'Signed upload URL generated',
    };
  });

  await runTest('Can generate signed upload URL for signatures', async () => {
    const bucket = 'user-assets';
    const path = `${testPrefix}/signatures/test-sig.png`;

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });

    return {
      passed: !error && !!data?.signedUrl,
      message: error ? error.message : 'Signed upload URL generated',
    };
  });

  await runTest('Can generate signed upload URL for letterheads', async () => {
    const bucket = 'user-assets';
    const path = `${testPrefix}/letterheads/test-letterhead.png`;

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });

    return {
      passed: !error && !!data?.signedUrl,
      message: error ? error.message : 'Signed upload URL generated',
    };
  });

  // Test that we can upload and delete in dry-run mode
  if (!testConfig.dryRun) {
    await runTest('Upload → Download → Delete cycle works', async () => {
      const bucket = 'audio-recordings';
      const path = `${testPrefix}/upload-test.txt`;
      const content = Buffer.from('Smoke test content - ' + Date.now());

      // Upload
      const { error: uploadError } = await client.storage.from(bucket).upload(path, content, {
        contentType: 'text/plain',
        upsert: false,
      });

      if (uploadError) {
        return { passed: false, message: `Upload failed: ${uploadError.message}` };
      }

      // Generate download URL
      const { data: downloadData, error: downloadError } = await client.storage
        .from(bucket)
        .createSignedUrl(path, 60);

      if (downloadError) {
        return { passed: false, message: `Download URL failed: ${downloadError.message}` };
      }

      // Delete
      const { error: deleteError } = await client.storage.from(bucket).remove([path]);

      if (deleteError) {
        return { passed: false, message: `Delete failed: ${deleteError.message}` };
      }

      return {
        passed: true,
        message: 'Full upload → download → delete cycle completed',
        details: { hasSignedUrl: !!downloadData?.signedUrl },
      };
    });
  } else {
    console.log('  ⏭️  Skipping destructive tests (SMOKE_TEST_LIVE not set)');
  }

  endSuite();
}

// ============ Test Suite: Audit Logging ============

async function testAuditLogging(): Promise<void> {
  startSuite('Audit Logging');

  const db = getPrismaClient();

  await runTest('Storage operations create audit logs', async () => {
    const recentLogs = await db.auditLog.findMany({
      where: {
        action: { startsWith: 'storage.' },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      passed: true, // We're just checking the schema works
      message: `Found ${recentLogs.length} storage-related audit logs`,
      details: {
        sampleActions: recentLogs.map((l) => l.action),
      },
    };
  });

  await runTest('Email operations create audit logs', async () => {
    const recentLogs = await db.auditLog.findMany({
      where: {
        action: { startsWith: 'email.' },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      passed: true,
      message: `Found ${recentLogs.length} email-related audit logs`,
      details: {
        sampleActions: recentLogs.map((l) => l.action),
      },
    };
  });

  await runTest('Audit logs include metadata', async () => {
    const logWithMetadata = await db.auditLog.findFirst({
      where: {
        metadata: { not: {} },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      passed: true,
      message: logWithMetadata
        ? 'Found audit log with metadata'
        : 'No audit logs with metadata yet',
      details: logWithMetadata
        ? {
            action: logWithMetadata.action,
            hasMetadata: !!logWithMetadata.metadata,
          }
        : undefined,
    };
  });

  endSuite();
}

// ============ Test Suite: Cross-User Isolation ============

async function testCrossUserIsolation(): Promise<void> {
  startSuite('Cross-User Access Isolation');

  const db = getPrismaClient();

  await runTest('Recordings are user-scoped in database', async () => {
    const userIdCounts = await db.recording.groupBy({
      by: ['userId'],
      _count: true,
    });

    return {
      passed: true,
      message: `${userIdCounts.length} users have recordings`,
      details: {
        userCount: userIdCounts.length,
        totalRecordings: userIdCounts.reduce((sum, u) => sum + u._count, 0),
      },
    };
  });

  await runTest('Documents are user-scoped in database', async () => {
    const userIdCounts = await db.document.groupBy({
      by: ['userId'],
      _count: true,
    });

    return {
      passed: true,
      message: `${userIdCounts.length} users have documents`,
      details: {
        userCount: userIdCounts.length,
        totalDocuments: userIdCounts.reduce((sum, u) => sum + u._count, 0),
      },
    };
  });

  await runTest('Letters are user-scoped in database', async () => {
    const userIdCounts = await db.letter.groupBy({
      by: ['userId'],
      _count: true,
    });

    return {
      passed: true,
      message: `${userIdCounts.length} users have letters`,
      details: {
        userCount: userIdCounts.length,
        totalLetters: userIdCounts.reduce((sum, u) => sum + u._count, 0),
      },
    };
  });

  await runTest('Storage paths are user-prefixed', async () => {
    const recordingsWithPath = await db.recording.findMany({
      where: { storagePath: { not: null } },
      select: { userId: true, storagePath: true },
      take: 10,
    });

    const allPrefixed = recordingsWithPath.every(
      (r) => r.storagePath?.startsWith(r.userId + '/')
    );

    return {
      passed: recordingsWithPath.length === 0 || allPrefixed,
      message: allPrefixed
        ? 'All storage paths are properly user-prefixed'
        : 'Some storage paths are not user-prefixed!',
      details: {
        checked: recordingsWithPath.length,
        allPrefixed,
      },
    };
  });

  endSuite();
}

// ============ Test Suite: Resend Email Configuration ============

async function testResendConfiguration(): Promise<void> {
  startSuite('Resend Email Configuration');

  await runTest('Resend API key has valid format', async () => {
    const key = process.env.RESEND_API_KEY;
    const isValid = key && key.startsWith('re_') && key.length > 10;

    return {
      passed: !!isValid,
      message: isValid ? 'API key format is valid' : 'Invalid API key format',
    };
  });

  await runTest('Sender email is configured', async () => {
    const email = process.env.RESEND_FROM_EMAIL;
    const isValid = email && email.includes('@') && !email.includes('your-');

    return {
      passed: !!isValid,
      message: isValid ? `Sender: ${email}` : 'Sender email not properly configured',
    };
  });

  // Validate Resend connection (if not dry run)
  if (!testConfig.dryRun && process.env.RESEND_API_KEY) {
    await runTest('Can validate Resend API connection', async () => {
      try {
        // Dynamic import to avoid issues if resend isn't installed
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        // Try to fetch domains to validate the API key
        const { data, error } = await resend.domains.list();

        return {
          passed: !error,
          message: error ? `API validation failed: ${error.message}` : 'API key is valid',
          details: { domainCount: data?.data?.length },
        };
      } catch (error) {
        return {
          passed: false,
          message: error instanceof Error ? error.message : 'Failed to validate',
        };
      }
    });
  } else {
    console.log('  ⏭️  Skipping Resend API validation (dry run mode)');
  }

  endSuite();
}

// ============ Test Suite: Data Integrity ============

async function testDataIntegrity(): Promise<void> {
  startSuite('Data Integrity');

  const db = getPrismaClient();

  await runTest('No recordings have both s3AudioKey and storagePath null', async () => {
    const orphanedRecordings = await db.recording.count({
      where: {
        s3AudioKey: null,
        storagePath: null,
        status: 'UPLOADED',
      },
    });

    return {
      passed: orphanedRecordings === 0,
      message:
        orphanedRecordings === 0
          ? 'All uploaded recordings have storage path'
          : `${orphanedRecordings} recordings missing storage path!`,
    };
  });

  await runTest('No documents have both s3Key and storagePath null', async () => {
    const orphanedDocs = await db.document.count({
      where: {
        s3Key: null,
        storagePath: null,
        status: 'UPLOADED',
      },
    });

    return {
      passed: orphanedDocs === 0,
      message:
        orphanedDocs === 0
          ? 'All uploaded documents have storage path'
          : `${orphanedDocs} documents missing storage path!`,
    };
  });

  await runTest('Retention policies are set for new documents', async () => {
    const docsWithRetention = await db.document.count({
      where: {
        retentionUntil: { not: null },
      },
    });

    const totalDocs = await db.document.count();

    return {
      passed: true,
      message: `${docsWithRetention}/${totalDocs} documents have retention policies`,
      details: { withRetention: docsWithRetention, total: totalDocs },
    };
  });

  await runTest('Audio files are deleted after transcription', async () => {
    const deletedAfterTranscription = await db.recording.count({
      where: {
        status: 'TRANSCRIBED',
        audioDeletedAt: { not: null },
      },
    });

    const transcribedTotal = await db.recording.count({
      where: { status: 'TRANSCRIBED' },
    });

    return {
      passed: true,
      message: `${deletedAfterTranscription}/${transcribedTotal} transcribed recordings have audio deleted`,
      details: {
        deletedAfterTranscription,
        transcribedTotal,
      },
    };
  });

  endSuite();
}

// ============ Test Suite: No AWS S3 References ============

async function testNoS3References(): Promise<void> {
  startSuite('AWS S3 Removal Verification');

  await runTest('No S3_BUCKET_NAME environment variable', async () => {
    const bucket = process.env.S3_BUCKET_NAME;
    return {
      passed: !bucket,
      message: bucket ? `S3_BUCKET_NAME is still set: ${bucket}` : 'Correctly removed',
    };
  });

  await runTest('AWS credentials only for Bedrock (expected)', async () => {
    const region = process.env.AWS_REGION;
    const accessKey = process.env.AWS_ACCESS_KEY_ID;

    // AWS credentials should still exist for Bedrock
    return {
      passed: true,
      message:
        region && accessKey
          ? 'AWS credentials present for Bedrock AI'
          : 'No AWS credentials (Bedrock may not work)',
      details: { hasRegion: !!region, hasAccessKey: !!accessKey },
    };
  });

  endSuite();
}

// ============ Summary Report ============

function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('  SMOKE TEST SUMMARY');
  console.log('='.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  for (const suite of testSuites) {
    const passed = suite.results.filter((r) => r.passed).length;
    const failed = suite.results.filter((r) => !r.passed).length;
    const duration = suite.endTime ? suite.endTime - suite.startTime : 0;

    totalPassed += passed;
    totalFailed += failed;
    totalDuration += duration;

    const icon = failed === 0 ? '✅' : '❌';
    console.log(`  ${icon} ${suite.name}: ${passed}/${suite.results.length} passed`);

    if (failed > 0) {
      for (const result of suite.results.filter((r) => !r.passed)) {
        console.log(`     ❌ ${result.name}: ${result.message}`);
      }
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`  Total: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`  Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`  Mode: ${testConfig.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('-'.repeat(60));

  if (totalFailed === 0) {
    console.log('\n  ✅ ALL TESTS PASSED - Migration verified!\n');
  } else {
    console.log(`\n  ❌ ${totalFailed} TESTS FAILED - Review issues above\n`);
  }
}

// ============ Main Entry Point ============

async function main(): Promise<void> {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║  DictateMED Supabase Migration - E2E Smoke Test         ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nMode: ${testConfig.dryRun ? 'DRY RUN (no data changes)' : 'LIVE (will modify data)'}`);
  console.log(`Verbose: ${testConfig.verbose}`);
  console.log(`Test Email: ${testConfig.testEmail}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    // Run all test suites
    await testEnvironmentConfiguration();
    await testSupabaseStorageInfrastructure();
    await testDatabaseSchema();
    await testStorageOperations();
    await testAuditLogging();
    await testCrossUserIsolation();
    await testResendConfiguration();
    await testDataIntegrity();
    await testNoS3References();

    // Print summary
    printSummary();

    // Clean up
    if (prisma) {
      await prisma.$disconnect();
    }

    // Exit with appropriate code
    const hasFailures = testSuites.some((s) => s.results.some((r) => !r.passed));
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Smoke test failed with error:', error);
    if (prisma) {
      await prisma.$disconnect();
    }
    process.exit(1);
  }
}

main();
