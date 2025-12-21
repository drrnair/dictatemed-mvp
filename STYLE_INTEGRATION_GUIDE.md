# Style Learning System - Integration Guide

This guide shows exactly how to integrate the Style Learning System into the existing DictateMED codebase.

## Step 1: Run Database Migration

```bash
# Generate Prisma client with new StyleEdit model
npx prisma generate

# Apply migration to database
npx prisma migrate deploy

# Or for development
npx prisma migrate dev
```

This creates the `style_edits` table and updates the Prisma client.

## Step 2: Update Letter Generation

Modify `/src/domains/letters/letter.service.ts` to apply style hints during generation.

### Find this code (around line 100):

```typescript
// Step 3: Build prompt
const promptBuilder = LETTER_PROMPTS[input.letterType];
if (!promptBuilder) {
  throw new Error(`No prompt builder for letter type: ${input.letterType}`);
}

const prompt = promptBuilder(
  obfuscatedSources,
  {
    nameToken: obfuscatedSources.deobfuscationMap.tokens.nameToken,
    dobToken: obfuscatedSources.deobfuscationMap.tokens.dobToken,
    medicareToken: obfuscatedSources.deobfuscationMap.tokens.medicareToken,
    genderToken: obfuscatedSources.deobfuscationMap.tokens.genderToken,
  },
  null // No style context for MVP
);
```

### Replace with:

```typescript
// Step 3: Build prompt
const promptBuilder = LETTER_PROMPTS[input.letterType];
if (!promptBuilder) {
  throw new Error(`No prompt builder for letter type: ${input.letterType}`);
}

const basePrompt = promptBuilder(
  obfuscatedSources,
  {
    nameToken: obfuscatedSources.deobfuscationMap.tokens.nameToken,
    dobToken: obfuscatedSources.deobfuscationMap.tokens.dobToken,
    medicareToken: obfuscatedSources.deobfuscationMap.tokens.medicareToken,
    genderToken: obfuscatedSources.deobfuscationMap.tokens.genderToken,
  },
  null
);

// Apply learned style preferences
const { enhancedPrompt } = await applyStyleHints(userId, basePrompt);
const prompt = enhancedPrompt;
```

### Add import at top of file:

```typescript
import { applyStyleHints } from '@/domains/style';
```

## Step 3: Record Edits When Physician Saves

Modify the letter content update function to record edits for learning.

### Update in `/src/domains/letters/letter.service.ts`:

Find the `updateLetterContent` function (around line 334):

```typescript
export async function updateLetterContent(
  userId: string,
  letterId: string,
  content: string
): Promise<Letter> {
  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId },
  });

  if (!letter) {
    throw new Error('Letter not found');
  }

  if (letter.status === 'APPROVED') {
    throw new Error('Cannot edit approved letter');
  }

  const updated = await prisma.letter.update({
    where: { id: letterId },
    data: {
      contentDraft: content,
      status: 'IN_REVIEW',
      reviewStartedAt: letter.reviewStartedAt ?? new Date(),
    },
  });

  logger.info('Letter content updated', { letterId, userId });

  return mapPrismaLetter(updated);
}
```

### Add style edit recording:

```typescript
import { recordEdit } from '@/domains/style';

export async function updateLetterContent(
  userId: string,
  letterId: string,
  content: string
): Promise<Letter> {
  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId },
  });

  if (!letter) {
    throw new Error('Letter not found');
  }

  if (letter.status === 'APPROVED') {
    throw new Error('Cannot edit approved letter');
  }

  // Record edit for style learning (if there's a draft to compare against)
  if (letter.contentDraft && letter.contentDraft !== content) {
    try {
      await recordEdit(
        userId,
        letterId,
        letter.contentDraft,
        content,
        'other' // Can be enhanced to detect section type
      );
    } catch (error) {
      // Don't fail the update if style recording fails
      logger.warn('Failed to record style edit', { letterId, userId }, error instanceof Error ? error : undefined);
    }
  }

  const updated = await prisma.letter.update({
    where: { id: letterId },
    data: {
      contentDraft: content,
      status: 'IN_REVIEW',
      reviewStartedAt: letter.reviewStartedAt ?? new Date(),
    },
  });

  logger.info('Letter content updated', { letterId, userId });

  return mapPrismaLetter(updated);
}
```

## Step 4: Add Automatic Analysis Trigger

Add automatic style analysis after every N edits.

### Create a new function in `/src/domains/letters/letter.service.ts`:

```typescript
import { recordEdit, analyzeStyle, getEditStatistics } from '@/domains/style';

/**
 * Check if style analysis should run and trigger if needed.
 * Run this after recording an edit.
 */
async function maybeRunStyleAnalysis(userId: string): Promise<void> {
  try {
    const stats = await getEditStatistics(userId);

    // Run analysis every 10 edits (minimum 5 to start)
    if (stats.totalEdits >= 5 && stats.totalEdits % 10 === 0) {
      logger.info('Triggering automatic style analysis', {
        userId,
        totalEdits: stats.totalEdits,
      });

      // Run in background (don't await)
      analyzeStyle({ userId, minEdits: 5, maxEdits: 50 })
        .then(() => {
          logger.info('Automatic style analysis completed', { userId });
        })
        .catch((error) => {
          logger.error('Automatic style analysis failed', { userId }, error instanceof Error ? error : undefined);
        });
    }
  } catch (error) {
    // Don't fail if analysis check fails
    logger.warn('Failed to check for style analysis', { userId }, error instanceof Error ? error : undefined);
  }
}
```

### Call it after recording an edit:

```typescript
// In updateLetterContent, after recording edit
if (letter.contentDraft && letter.contentDraft !== content) {
  try {
    await recordEdit(
      userId,
      letterId,
      letter.contentDraft,
      content,
      'other'
    );

    // Trigger analysis if needed (runs in background)
    maybeRunStyleAnalysis(userId);
  } catch (error) {
    logger.warn('Failed to record style edit', { letterId, userId }, error instanceof Error ? error : undefined);
  }
}
```

## Step 5: Add UI Navigation

Add a link to the style settings page in the main settings navigation.

### In your settings layout or navigation component:

```tsx
// Example: src/app/(dashboard)/settings/layout.tsx or nav component
<nav>
  <Link href="/settings/profile">Profile</Link>
  <Link href="/settings/practice">Practice</Link>
  <Link href="/settings/style">Writing Style</Link>  {/* NEW */}
  <Link href="/settings/billing">Billing</Link>
</nav>
```

## Step 6: Test the Integration

### 1. Test Edit Recording

```typescript
// Create a test letter
const letter = await generateLetter(userId, {
  patientId,
  letterType: 'FOLLOW_UP',
  sources: { /* ... */ },
  phi: { /* ... */ },
});

// Edit the letter
await updateLetterContent(
  userId,
  letter.id,
  letter.letterText.replace('Dear Dr.', 'Dear')
);

// Check that edit was recorded
const stats = await getEditStatistics(userId);
expect(stats.totalEdits).toBe(1);
```

### 2. Test Style Analysis

```typescript
// Record 10 edits
for (let i = 0; i < 10; i++) {
  await recordEdit(
    userId,
    letterIds[i],
    'Dear Dr. Smith,',
    'Dear John,',
    'greeting'
  );
}

// Trigger analysis
const profile = await analyzeStyle({ userId });

// Verify profile
expect(profile.greetingStyle).toBeDefined();
expect(profile.confidence.greetingStyle).toBeGreaterThan(0);
```

### 3. Test Style Application

```typescript
// Generate letter with style hints
const letter = await generateLetter(userId, {
  patientId,
  letterType: 'FOLLOW_UP',
  sources: { /* ... */ },
  phi: { /* ... */ },
});

// Letter should reflect learned style preferences
// (verify manually or with pattern matching)
```

## Step 7: Monitoring and Debugging

### Add CloudWatch Metrics

```typescript
// In style.service.ts

import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({ region: 'ap-southeast-2' });

// After recording edit
await cloudwatch.putMetricData({
  Namespace: 'DictateMED/StyleLearning',
  MetricData: [
    {
      MetricName: 'EditsRecorded',
      Value: 1,
      Unit: 'Count',
      Dimensions: [{ Name: 'UserId', Value: userId }],
    },
  ],
});

// After analysis
await cloudwatch.putMetricData({
  Namespace: 'DictateMED/StyleLearning',
  MetricData: [
    {
      MetricName: 'AnalysisCompleted',
      Value: 1,
      Unit: 'Count',
    },
    {
      MetricName: 'AverageConfidence',
      Value: calculateAverageConfidence(profile.confidence),
      Unit: 'None',
    },
  ],
});
```

### Check Logs

```bash
# View edit recording logs
grep "Style edit recorded" /var/log/dictatemed.log

# View analysis logs
grep "Style analysis" /var/log/dictatemed.log

# View errors
grep "ERROR.*style" /var/log/dictatemed.log
```

## Step 8: Optional Enhancements

### A. Section Detection

Enhance edit recording with automatic section detection:

```typescript
function detectSectionType(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes('dear ') || lower.includes('hello')) return 'greeting';
  if (lower.includes('sincerely') || lower.includes('regards')) return 'closing';
  if (lower.includes('history') || lower.includes('background')) return 'history';
  if (lower.includes('examination') || lower.includes('findings')) return 'examination';
  if (lower.includes('impression') || lower.includes('assessment')) return 'impression';
  if (lower.includes('plan') || lower.includes('management')) return 'plan';

  return 'other';
}

// Use in updateLetterContent
await recordEdit(
  userId,
  letterId,
  letter.contentDraft,
  content,
  detectSectionType(content)
);
```

### B. Fine-grained Edit Tracking

Track edits at paragraph or sentence level instead of whole letter:

```typescript
import { diffWords, diffSentences } from 'diff';

// Compute fine-grained diffs
const diffs = diffSentences(before, after);

for (const diff of diffs) {
  if (diff.added || diff.removed) {
    await recordEdit(
      userId,
      letterId,
      diff.removed ? diff.value : '',
      diff.added ? diff.value : '',
      detectSectionType(diff.value)
    );
  }
}
```

### C. Real-time Style Suggestions

Show style suggestions while editing (requires WebSocket):

```typescript
// In letter editor component
const [styleSuggestions, setStyleSuggestions] = useState<string[]>([]);

useEffect(() => {
  const checkStyle = async () => {
    const profile = await fetch('/api/style/profile').then(r => r.json());

    if (profile.greetingStyle === 'formal' && editedText.includes('Hello')) {
      setStyleSuggestions(['Consider using a formal greeting like "Dear Dr. Smith,"']);
    }
  };

  const debounced = debounce(checkStyle, 1000);
  debounced();
}, [editedText]);
```

## Common Issues

### Issue: Edit not recorded
**Cause**: Error in recordEdit function
**Fix**: Check logs for error details, verify database connection

### Issue: Analysis fails with "insufficient edits"
**Cause**: Less than 5 edits recorded
**Fix**: Record more edits before triggering analysis

### Issue: Style hints not applied
**Cause**: No style profile or low confidence
**Fix**: Run analysis manually, check profile in settings

### Issue: Performance degradation
**Cause**: Too many edits analyzed at once
**Fix**: Reduce maxEdits parameter (default 50)

## Performance Tips

1. **Batch Edit Recording**: Record edits after final save, not on every keystroke
2. **Limit Analysis Frequency**: Don't analyze on every edit, use modulo (% 10)
3. **Background Processing**: Run analysis asynchronously, don't block UI
4. **Cache Profile**: Store in memory, refresh periodically
5. **Index Optimization**: Ensure indexes on (userId, createdAt) exist

## Security Checklist

- [ ] Auth0 authentication on all /api/style/* endpoints
- [ ] Verify userId matches authenticated user
- [ ] Don't expose other users' style data
- [ ] Rate limit analysis endpoint (max 1/minute per user)
- [ ] Sanitize edit text before storing (remove XSS)
- [ ] Audit log all analysis operations
- [ ] Consider encrypting style edits if PHI present

## Complete Integration Summary

1. **Database**: Migration applied, StyleEdit table created
2. **Letter Generation**: Style hints applied to prompts
3. **Letter Editing**: Edits recorded automatically
4. **Automatic Analysis**: Triggers every 10 edits
5. **UI**: Settings page accessible at /settings/style
6. **API**: Endpoints working at /api/style/analyze
7. **Monitoring**: Logs and metrics in place
8. **Testing**: Unit and integration tests pass

Once all steps are complete, the Style Learning System is fully integrated and will continuously improve letter generation based on physician preferences.
