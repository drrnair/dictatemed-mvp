/**
 * Interactive Migration Workflow Verification
 *
 * This script provides an interactive checklist to verify the complete
 * DictateMED workflow after the Supabase migration. Run it alongside
 * manual testing in the browser.
 *
 * Prerequisites:
 *   - App running locally (npm run dev)
 *   - .env.local configured with all credentials
 *   - Supabase storage buckets created
 *   - At least one test user account
 *
 * Run with:
 *   npx tsx scripts/verify-migration-workflow.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import * as readline from 'readline';

// Load environment variables
config({ path: '.env.local' });

// ============ Setup ============

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  verificationPrompt: string;
  autoCheck?: () => Promise<{ passed: boolean; message: string }>;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

let supabase: SupabaseClient | null = null;
let prisma: PrismaClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createClient(url, key, { auth: { persistSession: false } });
  }
  return supabase;
}

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// ============ Workflow Steps ============

const workflowSteps: VerificationStep[] = [
  // Step 1: Login
  {
    id: 'login',
    title: 'Login as Specialist User',
    description: `
    1. Open the app in your browser (usually http://localhost:3000)
    2. Log in with your test specialist account
    3. Verify you reach the dashboard without errors
    `,
    verificationPrompt: 'Did you successfully log in? (y/n): ',
  },

  // Step 2: Upload Signature
  {
    id: 'signature',
    title: 'Upload Signature Image',
    description: `
    1. Go to Settings → Profile
    2. Upload a signature image (PNG/JPEG)
    3. Verify the signature appears in the preview
    4. Save the changes
    `,
    verificationPrompt: 'Did the signature upload work? (y/n): ',
    autoCheck: async () => {
      const db = getPrismaClient();
      const client = getSupabaseClient();

      // Check if any user has a signature
      const usersWithSignature = await db.user.count({
        where: { signature: { not: null } },
      });

      // Check if signatures folder exists
      const { data } = await client.storage.from('user-assets').list('signatures', {
        limit: 5,
      });

      const hasSignatures = usersWithSignature > 0 || (data !== null && data.length > 0);

      return {
        passed: hasSignatures,
        message: `${usersWithSignature} users with signatures, ${data?.length || 0} files in storage`,
      };
    },
  },

  // Step 3: Upload Letterhead (Admin)
  {
    id: 'letterhead',
    title: 'Upload Practice Letterhead (Admin Only)',
    description: `
    1. If you have admin role, go to Settings → Practice
    2. Upload a letterhead image (PNG/JPEG)
    3. Verify the letterhead appears in the preview
    4. Save the changes

    Skip if you're not an admin.
    `,
    verificationPrompt: 'Did the letterhead upload work? (y/n/skip): ',
    autoCheck: async () => {
      const db = getPrismaClient();
      const client = getSupabaseClient();

      const practicesWithLetterhead = await db.practice.count({
        where: { letterhead: { not: null } },
      });

      const { data } = await client.storage.from('user-assets').list('letterheads', {
        limit: 5,
      });

      const hasLetterheads = practicesWithLetterhead > 0 || (data !== null && data.length > 0);

      return {
        passed: hasLetterheads,
        message: `${practicesWithLetterhead} practices with letterheads`,
      };
    },
  },

  // Step 4: Create Patient
  {
    id: 'patient',
    title: 'Create or Select a Patient',
    description: `
    1. Go to Patients
    2. Create a new test patient OR select an existing one
    3. Note the patient name for later steps
    `,
    verificationPrompt: 'Do you have a patient ready for testing? (y/n): ',
  },

  // Step 5: Start Consultation
  {
    id: 'consultation',
    title: 'Start a New Consultation',
    description: `
    1. Go to Consultations → New
    2. Select the test patient
    3. Select a letter template (e.g., "New Patient Consultation")
    4. Add a referrer
    `,
    verificationPrompt: 'Did you create the consultation? (y/n): ',
  },

  // Step 6: Record Audio
  {
    id: 'recording',
    title: 'Record Audio (Dictation or Ambient)',
    description: `
    1. Start recording (dictation or ambient mode)
    2. Speak for at least 30 seconds
    3. Stop recording
    4. Verify the upload completes without errors
    5. Check that the recording appears in the UI
    `,
    verificationPrompt: 'Did the audio upload successfully? (y/n): ',
    autoCheck: async () => {
      const db = getPrismaClient();

      // Check recent recordings
      const recentRecording = await db.recording.findFirst({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // Last 30 min
          storagePath: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        passed: !!recentRecording,
        message: recentRecording
          ? `Recent recording found: ${recentRecording.id} (${recentRecording.status})`
          : 'No recent recordings with Supabase storage path',
      };
    },
  },

  // Step 7: Verify Transcription
  {
    id: 'transcription',
    title: 'Verify Transcription Works',
    description: `
    1. Wait for transcription to complete (may take 1-2 minutes)
    2. Verify the transcript appears in the UI
    3. Check that the transcription quality is acceptable
    `,
    verificationPrompt: 'Did transcription complete successfully? (y/n): ',
    autoCheck: async () => {
      const db = getPrismaClient();

      const transcribedRecording = await db.recording.findFirst({
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          status: 'TRANSCRIBED',
          transcriptText: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        passed: !!transcribedRecording,
        message: transcribedRecording
          ? `Transcription found (${transcribedRecording.transcriptText?.substring(0, 50)}...)`
          : 'No recent transcriptions',
      };
    },
  },

  // Step 8: Verify Audio Deletion
  {
    id: 'audio-deletion',
    title: 'Verify Audio Deleted After Transcription',
    description: `
    After transcription, the audio file should be automatically deleted
    from storage for PHI compliance. The transcript remains.

    This step verifies the retention policy is working.
    `,
    verificationPrompt: 'Checking audio deletion status...',
    autoCheck: async () => {
      const db = getPrismaClient();
      const client = getSupabaseClient();

      const transcribedWithDeletion = await db.recording.findFirst({
        where: {
          status: 'TRANSCRIBED',
          audioDeletedAt: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!transcribedWithDeletion) {
        return {
          passed: false,
          message: 'No recordings with audio deleted after transcription',
        };
      }

      // Verify file is actually gone from storage
      if (transcribedWithDeletion.storagePath) {
        const { error } = await client.storage
          .from('audio-recordings')
          .createSignedUrl(transcribedWithDeletion.storagePath, 10);

        const fileGone = !!error; // Error means file is gone

        return {
          passed: fileGone,
          message: fileGone
            ? 'Audio file confirmed deleted from storage'
            : 'WARNING: Audio file still exists in storage after deletion marked',
        };
      }

      return {
        passed: true,
        message: `Audio deleted at ${transcribedWithDeletion.audioDeletedAt}`,
      };
    },
  },

  // Step 9: Upload Clinical Document
  {
    id: 'document',
    title: 'Upload a Clinical Document (PDF)',
    description: `
    1. In the consultation, go to Documents section
    2. Upload a clinical PDF (e.g., echo report, ECG)
    3. Select the document type
    4. Verify the upload completes
    5. Wait for AI extraction to process
    `,
    verificationPrompt: 'Did the document upload work? (y/n): ',
    autoCheck: async () => {
      const db = getPrismaClient();

      const recentDoc = await db.document.findFirst({
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          storagePath: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        passed: !!recentDoc,
        message: recentDoc
          ? `Document found: ${recentDoc.filename} (${recentDoc.status})`
          : 'No recent documents with Supabase storage path',
      };
    },
  },

  // Step 10: Generate Letter
  {
    id: 'letter-generation',
    title: 'Generate Draft Letter',
    description: `
    1. With transcript and documents ready, generate a letter
    2. Verify the AI generates a draft without errors
    3. Check that source-anchored facts link to documents
    4. Review the clinical values extracted
    `,
    verificationPrompt: 'Did letter generation work? (y/n): ',
    autoCheck: async () => {
      const db = getPrismaClient();

      const recentLetter = await db.letter.findFirst({
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          contentDraft: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        passed: !!recentLetter,
        message: recentLetter
          ? `Letter found: ${recentLetter.letterType} (${recentLetter.status})`
          : 'No recent letters with draft content',
      };
    },
  },

  // Step 11: Source-Anchored Documentation
  {
    id: 'source-anchor',
    title: 'Verify Source-Anchored Documentation',
    description: `
    1. In the letter editor, look for highlighted values (LVEF, etc.)
    2. Click on a highlighted value
    3. Verify it shows the source document
    4. Confirm you can view the original PDF snippet
    `,
    verificationPrompt: 'Did source-anchored documentation work? (y/n): ',
  },

  // Step 12: Approve Letter
  {
    id: 'approve',
    title: 'Approve the Letter',
    description: `
    1. Review the letter for accuracy
    2. Make any edits needed
    3. Click Approve
    4. Verify the letter status changes to APPROVED
    `,
    verificationPrompt: 'Did you successfully approve the letter? (y/n): ',
  },

  // Step 13: Send Email
  {
    id: 'email',
    title: 'Send Letter via Email',
    description: `
    1. From the approved letter, click Send Email
    2. Enter your test email address: ${process.env.SMOKE_TEST_EMAIL || 'your email'}
    3. Click Send
    4. Verify you receive the email with PDF attachment
    `,
    verificationPrompt: 'Did you receive the email with PDF attachment? (y/n): ',
    autoCheck: async () => {
      const db = getPrismaClient();

      const recentEmail = await db.sentEmail.findFirst({
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        passed: !!recentEmail,
        message: recentEmail
          ? `Email sent to ${recentEmail.recipientEmail} (${recentEmail.status})`
          : 'No recent sent emails',
      };
    },
  },

  // Step 14: Verify Audit Logs
  {
    id: 'audit',
    title: 'Verify Audit Logs',
    description: `
    This step automatically checks that audit logs were created for
    all PHI access operations during this workflow.
    `,
    verificationPrompt: 'Checking audit logs...',
    autoCheck: async () => {
      const db = getPrismaClient();

      const recentLogs = await db.auditLog.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const actions = recentLogs.map((l) => l.action);
      const storageActions = actions.filter((a) => a.startsWith('storage.'));
      const emailActions = actions.filter((a) => a.startsWith('email.'));

      return {
        passed: recentLogs.length > 0,
        message: `Found ${recentLogs.length} audit entries: ${storageActions.length} storage, ${emailActions.length} email`,
      };
    },
  },

  // Step 15: No Public PHI
  {
    id: 'no-public-phi',
    title: 'Verify No Public PHI Exposure',
    description: `
    This step verifies that all storage buckets are private
    and no PHI is publicly accessible.
    `,
    verificationPrompt: 'Checking bucket privacy...',
    autoCheck: async () => {
      const client = getSupabaseClient();
      const { data: buckets, error } = await client.storage.listBuckets();

      if (error) {
        return { passed: false, message: `Error: ${error.message}` };
      }

      const phiBuckets = ['audio-recordings', 'clinical-documents', 'user-assets'];
      const publicBuckets = buckets
        ?.filter((b) => phiBuckets.includes(b.name) && b.public)
        .map((b) => b.name);

      return {
        passed: !publicBuckets || publicBuckets.length === 0,
        message:
          publicBuckets && publicBuckets.length > 0
            ? `CRITICAL: Public buckets found: ${publicBuckets.join(', ')}`
            : 'All PHI buckets are private',
      };
    },
  },
];

// ============ Run Workflow ============

async function runWorkflow(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  DictateMED Migration Verification Workflow              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('This interactive script guides you through verifying the');
  console.log('complete DictateMED workflow after the Supabase migration.\n');

  console.log('Make sure the app is running (npm run dev) before starting.\n');

  const ready = await prompt('Are you ready to begin? (y/n): ');
  if (ready.toLowerCase() !== 'y') {
    console.log('Exiting. Run again when ready.');
    rl.close();
    return;
  }

  const results: { step: string; passed: boolean; note?: string }[] = [];

  for (const step of workflowSteps) {
    console.log('\n' + '─'.repeat(60));
    console.log(`\n📋 Step: ${step.title}\n`);
    console.log(step.description);

    // Run auto-check if available
    if (step.autoCheck) {
      console.log('\n  🔍 Running automatic verification...');
      try {
        const result = await step.autoCheck();
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.message}`);
      } catch (error) {
        console.log(`  ❌ Auto-check failed: ${error}`);
      }
    }

    // Get user confirmation
    const answer = await prompt(`\n${step.verificationPrompt}`);
    const passed = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    const skipped = answer.toLowerCase() === 'skip' || answer.toLowerCase() === 's';

    if (skipped) {
      results.push({ step: step.id, passed: true, note: 'skipped' });
      console.log('  ⏭️  Skipped');
    } else if (passed) {
      results.push({ step: step.id, passed: true });
      console.log('  ✅ Verified');
    } else {
      const note = await prompt('What went wrong? (brief description): ');
      results.push({ step: step.id, passed: false, note });
      console.log('  ❌ Failed');
    }
  }

  // Print Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  VERIFICATION SUMMARY');
  console.log('═'.repeat(60) + '\n');

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  for (const result of results) {
    const step = workflowSteps.find((s) => s.id === result.step);
    const icon = result.passed ? '✅' : '❌';
    const note = result.note ? ` (${result.note})` : '';
    console.log(`  ${icon} ${step?.title}${note}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`  Passed: ${passed.length}/${results.length}`);
  console.log(`  Failed: ${failed.length}/${results.length}`);
  console.log('─'.repeat(60));

  if (failed.length === 0) {
    console.log('\n  🎉 ALL STEPS VERIFIED - Migration successful!\n');
  } else {
    console.log('\n  ⚠️  Some steps failed. Review issues above.\n');
    console.log('  Failed steps:');
    for (const f of failed) {
      console.log(`    - ${f.step}: ${f.note}`);
    }
    console.log('');
  }

  // Clean up
  rl.close();
  if (prisma) {
    await prisma.$disconnect();
  }
}

// Run
runWorkflow().catch((error) => {
  console.error('Workflow failed:', error);
  rl.close();
  process.exit(1);
});
