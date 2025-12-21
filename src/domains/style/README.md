# Style Learning System

The Style Learning System analyzes physician edits to AI-generated letters to learn their writing preferences and automatically apply these preferences to future letter generation.

## Architecture

### Components

1. **style.types.ts** - Type definitions for style profiles, edits, and analysis results
2. **style-analyzer.ts** - Claude-powered analyzer that detects patterns in edits
3. **style.service.ts** - Service layer for recording edits and managing style profiles
4. **API Route** - `/api/style/analyze` for triggering analysis and retrieving statistics
5. **UI** - Settings page at `/settings/style` for viewing and managing style profile

### Database Schema

```sql
CREATE TABLE style_edits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  letter_id UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  before_text TEXT NOT NULL,
  after_text TEXT NOT NULL,
  edit_type VARCHAR NOT NULL, -- addition, deletion, modification, formatting
  section_type VARCHAR, -- greeting, history, examination, impression, plan, closing, other
  character_changes INT NOT NULL,
  word_changes INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_style_edits_user_created ON style_edits(user_id, created_at);
CREATE INDEX idx_style_edits_letter ON style_edits(letter_id);
```

The User model's `styleProfile` JSON field stores the learned preferences:

```typescript
{
  greetingStyle: 'formal' | 'casual' | 'mixed',
  closingStyle: 'formal' | 'casual' | 'mixed',
  paragraphStructure: 'long' | 'short' | 'mixed',
  medicationFormat: 'generic' | 'brand' | 'both',
  clinicalValueFormat: 'concise' | 'verbose' | 'mixed',
  formalityLevel: 'very-formal' | 'formal' | 'neutral' | 'casual',
  sentenceComplexity: 'simple' | 'moderate' | 'complex',
  vocabularyPreferences: { 'utilize': 'use', ... },
  confidence: { greetingStyle: 0.8, ... },
  totalEditsAnalyzed: 42,
  lastAnalyzedAt: '2025-01-15T10:30:00Z',
  lastAnalysis: { /* full StyleAnalysisResult */ }
}
```

## Workflow

### 1. Recording Edits

When a physician edits a letter, call `recordEdit()`:

```typescript
import { recordEdit } from '@/domains/style';

// After physician saves edits
await recordEdit(
  userId,
  letterId,
  originalAIText,
  editedText,
  'greeting' // optional section type
);
```

This stores the edit in the database for future analysis.

### 2. Analyzing Style

Analysis can be triggered:
- **Manually** by the physician via the settings UI
- **Automatically** after N edits (recommended: every 10-20 edits)

```typescript
import { analyzeStyle } from '@/domains/style';

const profile = await analyzeStyle({
  userId,
  minEdits: 5,  // minimum edits required
  maxEdits: 50, // analyze last N edits
});
```

The analyzer:
1. Fetches recent edits from database
2. Groups edits by section type
3. Sends to Claude Sonnet with analysis prompt
4. Parses structured JSON response
5. Merges with existing profile (weighted by edit count)
6. Updates user's `styleProfile` field

### 3. Applying Style Hints

During letter generation, enhance prompts with learned preferences:

```typescript
import { applyStyleHints } from '@/domains/style';

const { enhancedPrompt, hints } = await applyStyleHints(
  userId,
  basePrompt
);

// Use enhancedPrompt for generation
const letter = await generateText({
  prompt: enhancedPrompt,
  modelId: MODELS.SONNET,
});
```

The system automatically adds style guidance like:

```
# PHYSICIAN STYLE PREFERENCES

• Use a formal greeting like: Dear Dr. Smith,
• Use a formal closing like: Yours sincerely,
• Keep paragraphs concise (2-3 sentences each)
• Use generic medication names only (e.g., "atorvastatin" not "Lipitor")
• Use concise clinical value format (e.g., "LVEF 55%" not "LVEF of 55%")
• Maintain a formal tone throughout
• Vocabulary preferences: use "use" instead of "utilize", "start" instead of "commence"
```

## Confidence Scoring

Each preference has a confidence score (0-1):

- **0.9-1.0**: Very consistent pattern across all edits
- **0.7-0.9**: Consistent pattern with minor variations
- **0.5-0.7**: Moderate pattern, some variation
- **0.3-0.5**: Weak pattern, significant variation
- **0.0-0.3**: No clear pattern detected

Only preferences with confidence >= 0.6 are applied to prompts.

## Example Analysis Flow

1. **Edit Recording**
   ```typescript
   // Physician changes "Dear Dr. Jones," to "Dear John,"
   await recordEdit(userId, letterId, "Dear Dr. Jones,", "Dear John,", "greeting");

   // Physician changes "utilize" to "use" throughout
   await recordEdit(userId, letterId, "We will utilize...", "We will use...", "plan");
   ```

2. **Analysis Trigger** (after 10 edits)
   ```typescript
   const profile = await analyzeStyle({ userId });
   // Claude analyzes all 10 edits and detects:
   // - Casual greeting style (confidence: 0.7)
   // - Vocabulary preference: "use" over "utilize" (confidence: 0.9)
   ```

3. **Style Application** (next letter)
   ```typescript
   const { enhancedPrompt } = await applyStyleHints(userId, basePrompt);
   // Adds hints: "Use a casual greeting", "Prefer 'use' over 'utilize'"
   ```

## API Endpoints

### POST /api/style/analyze
Trigger style analysis for current user.

**Request:**
```json
{
  "minEdits": 5,
  "maxEdits": 50
}
```

**Response:**
```json
{
  "success": true,
  "profile": { /* StyleProfile */ },
  "statistics": {
    "totalEdits": 25,
    "editsLast7Days": 5,
    "editsLast30Days": 18,
    "lastEditDate": "2025-01-15T10:30:00Z"
  }
}
```

### GET /api/style/analyze
Get edit statistics without triggering analysis.

**Response:**
```json
{
  "statistics": { /* EditStatistics */ },
  "canAnalyze": true
}
```

## UI Features

The settings page (`/settings/style`) displays:

- **Edit Statistics**: Total edits, recent activity
- **Profile Overview**: Total edits analyzed, last analysis date, overall confidence
- **Detected Preferences**: Each preference with confidence bar and examples
- **Vocabulary Preferences**: Word replacements (e.g., "utilize" → "use")
- **Section Order**: Preferred ordering of letter sections
- **Manual Trigger**: Button to run analysis on demand

## Integration with Letter Generation

To integrate with existing letter generation:

```typescript
// src/domains/letters/letter.service.ts

import { applyStyleHints } from '@/domains/style';

export async function generateLetter(userId: string, input: GenerateLetterInput) {
  // ... existing code ...

  // Build base prompt
  let prompt = promptBuilder(sources, tokens, null);

  // Apply style hints
  const { enhancedPrompt } = await applyStyleHints(userId, prompt);

  // Generate with enhanced prompt
  const response = await generateTextWithRetry({
    prompt: enhancedPrompt,
    modelId: modelSelection.modelId,
    maxTokens: modelSelection.maxTokens,
    temperature: modelSelection.temperature,
  });

  // ... rest of generation ...
}
```

## Performance Considerations

- **Storage**: Each edit is ~1-2KB. 1000 edits = ~1-2MB per user.
- **Analysis Cost**: Uses Sonnet (~$0.003-0.015 per analysis)
- **Analysis Time**: ~5-10 seconds for 50 edits
- **Caching**: Style profile is cached in User model (no query per generation)

## Future Enhancements

1. **Incremental Analysis**: Analyze only new edits since last analysis
2. **A/B Testing**: Track if style-enhanced letters require fewer edits
3. **Multi-Model Learning**: Use different models for different letter types
4. **Collaboration**: Share style profiles within a practice
5. **Temporal Patterns**: Detect if style changes over time
6. **Confidence Decay**: Reduce confidence of old patterns over time
7. **Section-Specific Styles**: Learn different styles for different sections
8. **Streaming Analysis**: Real-time feedback during editing

## Migration

To add the StyleEdit table to an existing database:

```bash
# Generate migration
npx prisma migrate dev --name add_style_edits

# Apply migration
npx prisma migrate deploy
```

## Testing

```typescript
// Example test for style recording
describe('recordEdit', () => {
  it('should record an edit with metadata', async () => {
    const edit = await recordEdit(
      userId,
      letterId,
      'Before text',
      'After text',
      'greeting'
    );

    expect(edit.editType).toBe('modification');
    expect(edit.characterChanges).toBeGreaterThan(0);
  });
});

// Example test for style analysis
describe('analyzeStyle', () => {
  it('should detect greeting style from edits', async () => {
    // Create 10 edits changing formal to casual greetings
    for (let i = 0; i < 10; i++) {
      await recordEdit(
        userId,
        letterIds[i],
        'Dear Dr. Smith,',
        'Dear John,',
        'greeting'
      );
    }

    const profile = await analyzeStyle({ userId });
    expect(profile.greetingStyle).toBe('casual');
    expect(profile.confidence.greetingStyle).toBeGreaterThan(0.7);
  });
});
```

## Security Considerations

- Style edits may contain PHI - ensure proper access controls
- Only physicians can view/analyze their own style profile
- Audit log all style analysis operations
- Consider encrypting sensitive edit text if required
- Rate limit analysis endpoint to prevent abuse

## Monitoring

Key metrics to track:
- Edit recording rate per user
- Analysis success/failure rate
- Average confidence scores
- Style hint application rate
- Edit reduction after style learning (requires A/B test)
