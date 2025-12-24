/**
 * Supabase Connection Verification Script
 *
 * Run this script to verify that Supabase is properly configured:
 *   npx tsx scripts/verify-supabase.ts
 *
 * Prerequisites:
 *   - .env.local file with Supabase credentials
 *   - Storage buckets created via the migration SQL
 */

import { createClient } from '@supabase/supabase-js';

async function verifySupabaseConnection(): Promise<void> {
  console.log('\n🔍 Verifying Supabase Configuration...\n');

  // Check environment variables
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('1. Checking environment variables...');

  if (!url) {
    console.error('   ❌ NEXT_PUBLIC_SUPABASE_URL is not set');
    process.exit(1);
  }
  console.log(`   ✅ NEXT_PUBLIC_SUPABASE_URL: ${url}`);

  if (!anonKey) {
    console.error('   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
    process.exit(1);
  }
  console.log('   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: [set]');

  if (!serviceRoleKey) {
    console.error('   ❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    process.exit(1);
  }
  console.log('   ✅ SUPABASE_SERVICE_ROLE_KEY: [set]');

  // Test connection with service role key
  console.log('\n2. Testing Supabase connection...');

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // List storage buckets to verify connection
    const { data: buckets, error: bucketsError } =
      await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error(`   ❌ Connection failed: ${bucketsError.message}`);
      process.exit(1);
    }

    console.log('   ✅ Successfully connected to Supabase');

    // Check for required buckets
    console.log('\n3. Checking storage buckets...');

    const requiredBuckets = ['audio-recordings', 'clinical-documents', 'user-assets'];
    const existingBuckets = buckets?.map((b) => b.name) || [];

    for (const bucket of requiredBuckets) {
      if (existingBuckets.includes(bucket)) {
        const bucketInfo = buckets?.find((b) => b.name === bucket);
        const isPublic = bucketInfo?.public ? '(PUBLIC)' : '(private)';
        console.log(`   ✅ ${bucket} ${isPublic}`);

        if (bucketInfo?.public) {
          console.warn(
            `   ⚠️  WARNING: ${bucket} is PUBLIC - should be private for PHI!`
          );
        }
      } else {
        console.error(`   ❌ ${bucket} - NOT FOUND`);
        console.log(
          '      Run the SQL migration: supabase/migrations/001_create_storage_buckets.sql'
        );
      }
    }

    // Try to list files in a bucket (should work with service role)
    console.log('\n4. Testing bucket access...');

    for (const bucket of requiredBuckets) {
      if (existingBuckets.includes(bucket)) {
        const { error: listError } = await supabase.storage
          .from(bucket)
          .list('', { limit: 1 });

        if (listError) {
          console.error(`   ❌ Cannot access ${bucket}: ${listError.message}`);
        } else {
          console.log(`   ✅ ${bucket} - accessible`);
        }
      }
    }

    console.log('\n✅ Supabase configuration verified successfully!\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`\n❌ Verification failed: ${message}\n`);
    process.exit(1);
  }
}

// Load environment variables from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

verifySupabaseConnection();
