# Technical Specification: Clinical Literature Chat System

## Overview

Build a clinical literature chat system integrating UpToDate, PubMed, and user-uploaded libraries into the existing DictateMED platform, with a unified Anthropic API service and intuitive frontend UI.

**Difficulty Assessment: HARD**
- Complex multi-source search orchestration
- New database models with pgvector for embeddings
- OAuth integration with UpToDate
- Three distinct frontend layout options
- Real-time streaming responses
- Security considerations for medical data

---

## Technical Context

### Language & Framework
- **Runtime**: Node.js with Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Prisma 6.19
- **Frontend**: React 18, Radix UI, Tailwind CSS, Framer Motion
- **State**: Zustand for client state
- **AI**: Anthropic SDK `@anthropic-ai/sdk` ^0.39.0

### Existing Architecture
- **AI Abstraction**: `src/infrastructure/ai/` provides unified exports
- **Anthropic Client**: Singleton at `src/infrastructure/anthropic/client.ts`
- **Text Generation**: `src/infrastructure/anthropic/text-generation.ts` with streaming
- **Domain Services**: `src/domains/` pattern with service layer
- **API Routes**: Next.js App Router at `src/app/api/`
- **Components**: `src/components/` with Radix UI primitives

### Key Dependencies (already installed)
- `@anthropic-ai/sdk` - Anthropic API
- `zustand` - State management
- `framer-motion` - Animations
- `zod` - Validation
- `pdf-parse` - PDF text extraction

### Dependencies to Add
- `openai` - For embeddings only (text-embedding-3-small)
- `react-hotkeys-hook` - Keyboard shortcuts (Cmd+K)

---

## Implementation Approach

### Phase 1: Backend Foundation

#### 1.1 Database Schema Extensions

**New Models to Add** (`prisma/schema.prisma`):

```prisma
// UpToDate OAuth connection
model UpToDateConnection {
  id                String   @id @default(uuid())
  userId            String   @unique
  accessToken       String   // Encrypted
  refreshToken      String   // Encrypted
  tokenExpiry       DateTime
  subscriptionType  String   // 'personal' | 'institutional'
  subscriptionValid Boolean  @default(true)
  queriesThisMonth  Int      @default(0)
  lastUsed          DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id])
  @@map("uptodate_connections")
}

// User's uploaded library documents
model LibraryDocument {
  id          String   @id @default(uuid())
  userId      String
  title       String
  category    String?  // 'guideline' | 'textbook' | 'reference'
  pageCount   Int
  fileSize    Int
  storagePath String?  // Supabase storage path
  uploadedAt  DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
  chunks      DocumentChunk[]
  @@index([userId])
  @@map("library_documents")
}

// Document chunks with vector embeddings (requires pgvector)
model DocumentChunk {
  id          String          @id @default(uuid())
  documentId  String
  chunkIndex  Int
  content     String          @db.Text
  embedding   Unsupported("vector(1536)")
  document    LibraryDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  @@index([documentId])
  @@map("document_chunks")
}

// Literature query log for analytics
model LiteratureQuery {
  id              String   @id @default(uuid())
  userId          String
  query           String
  context         String?  @db.Text
  sources         Json     // Array of source types used
  confidence      String   // 'high' | 'medium' | 'low'
  citationInserted Boolean @default(false)
  responseTime    Int      // milliseconds
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id])
  @@index([userId, createdAt])
  @@map("literature_queries")
}
```

**User Model Updates**:
- Add `upToDateConnection UpToDateConnection?` relation
- Add `libraryDocuments LibraryDocument[]` relation
- Add `literatureQueries LiteratureQuery[]` relation

**Migration Required**:
- Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- Create IVFFlat index for fast similarity search

#### 1.2 Unified Anthropic Service Enhancement

**File**: `src/infrastructure/anthropic/unified-service.ts`

Extend existing infrastructure to support:
- Multi-turn conversations (chat mode)
- System prompt caching
- Centralized usage tracking
- Tool use support (for future function calling)

Key methods:
- `generateText()` - Already exists, enhance with caching
- `chat()` - NEW: Multi-turn conversation support
- `getUsageStats()` - NEW: Token usage tracking

#### 1.3 Literature Service Layer

**New Directory**: `src/domains/literature/`

Files to create:
- `literature.service.ts` - Main orchestration service
- `uptodate.service.ts` - UpToDate OAuth and API integration
- `pubmed.service.ts` - PubMed E-utilities integration
- `user-library.service.ts` - Vector search on uploaded docs
- `types.ts` - Shared type definitions

#### 1.4 API Routes

**New Routes**:
- `POST /api/literature/search` - Execute literature search
- `POST /api/literature/upload` - Upload library document
- `GET /api/literature/library` - List user's library
- `DELETE /api/literature/library/[id]` - Remove document
- `GET /api/uptodate/connect` - Initiate OAuth flow
- `GET /api/uptodate/callback` - OAuth callback
- `DELETE /api/uptodate/disconnect` - Remove connection
- `GET /api/uptodate/status` - Check connection status

---

### Phase 2: External Integrations

#### 2.1 UpToDate OAuth Integration

**Flow**:
1. User clicks "Connect UpToDate" in settings
2. Redirect to UpToDate authorization URL
3. User grants access
4. Callback receives auth code
5. Exchange for access/refresh tokens
6. Store encrypted tokens in database
7. Validate subscription type

**Environment Variables**:
```env
UPTODATE_CLIENT_ID=
UPTODATE_CLIENT_SECRET=
UPTODATE_REDIRECT_URI=
```

#### 2.2 PubMed E-utilities Integration

**Free API** - No authentication required, rate limited (3 requests/second).

Endpoints:
- `esearch.fcgi` - Search for PMIDs
- `efetch.fcgi` - Fetch article details
- PMC ID converter for free full-text

#### 2.3 User Library with Vector Search

**Flow**:
1. Upload PDF via Supabase Storage
2. Extract text with `pdf-parse`
3. Chunk text (1000 tokens, 200 overlap)
4. Generate embeddings via OpenAI `text-embedding-3-small`
5. Store chunks with embeddings in PostgreSQL (pgvector)
6. Query via cosine similarity

---

### Phase 3: Frontend Implementation

#### 3.1 Component Structure

**New Components** (`src/components/literature/`):
- `ClinicalAssistantPanel.tsx` - Main container for all layouts
- `LiteratureSearchInput.tsx` - Search input with suggestions
- `LiteratureSearchResults.tsx` - Results display
- `SourceCard.tsx` - Individual source rendering
- `ConfidenceBadge.tsx` - Confidence indicator
- `LayoutToggle.tsx` - Layout preference selector
- `TextHighlightMenu.tsx` - Menu on text selection

**Layout Components**:
- `SidePanelLayout.tsx` - Side-by-side (desktop default)
- `PopupLayout.tsx` - Centered modal (Cmd+K triggered)
- `DrawerLayout.tsx` - Bottom drawer (mobile/tablet)

#### 3.2 State Management

**New Store** (`src/stores/literature.store.ts`):
```typescript
interface LiteratureState {
  isOpen: boolean;
  layout: 'side' | 'popup' | 'drawer';
  query: string;
  results: LiteratureResult | null;
  loading: boolean;
  history: QueryHistoryItem[];
  selectedText: string;
  // Actions
  setOpen: (open: boolean) => void;
  setLayout: (layout: LayoutType) => void;
  search: (query: string, context?: string) => Promise<void>;
  insertCitation: (citation: Citation) => void;
  clearResults: () => void;
}
```

#### 3.3 Letter Editor Integration

Update `src/components/letters/LetterEditor.tsx`:
- Add text selection handler
- Show highlight menu on selection
- Pass context to clinical assistant
- Handle citation insertion

Update `src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx`:
- Add ClinicalAssistantPanel integration
- Layout toggle in toolbar
- Keyboard shortcut registration

---

### Phase 4: Testing

#### 4.1 Unit Tests (`tests/unit/`)
- `literature.service.test.ts`
- `pubmed.service.test.ts`
- `user-library.service.test.ts`
- `unified-service.test.ts`

#### 4.2 Integration Tests (`tests/integration/api/`)
- `literature-search.test.ts`
- `literature-upload.test.ts`
- `uptodate-oauth.test.ts`

#### 4.3 E2E Tests (`tests/e2e/`)
- `clinical-literature.spec.ts` - Full workflow test

---

## Source Code Structure Changes

### New Files to Create

```
src/
├── infrastructure/
│   ├── anthropic/
│   │   └── unified-service.ts        # Enhanced with chat + caching
│   ├── pubmed/
│   │   ├── client.ts                 # PubMed API client
│   │   ├── pubmed.service.ts         # Search service
│   │   └── types.ts                  # PubMed types
│   └── uptodate/
│       ├── client.ts                 # OAuth client
│       ├── uptodate.service.ts       # Search service
│       └── types.ts                  # UpToDate types
├── domains/
│   └── literature/
│       ├── literature.service.ts     # Main orchestration
│       ├── user-library.service.ts   # Vector search
│       └── types.ts                  # Shared types
├── app/
│   └── api/
│       ├── literature/
│       │   ├── search/route.ts       # POST search
│       │   ├── upload/route.ts       # POST upload
│       │   └── library/
│       │       ├── route.ts          # GET list
│       │       └── [id]/route.ts     # DELETE
│       └── uptodate/
│           ├── connect/route.ts      # GET OAuth start
│           ├── callback/route.ts     # GET OAuth callback
│           ├── disconnect/route.ts   # DELETE
│           └── status/route.ts       # GET status
├── components/
│   └── literature/
│       ├── ClinicalAssistantPanel.tsx
│       ├── LiteratureSearchInput.tsx
│       ├── LiteratureSearchResults.tsx
│       ├── SourceCard.tsx
│       ├── ConfidenceBadge.tsx
│       ├── LayoutToggle.tsx
│       ├── TextHighlightMenu.tsx
│       ├── SidePanelLayout.tsx
│       ├── PopupLayout.tsx
│       └── DrawerLayout.tsx
└── stores/
    └── literature.store.ts
```

### Files to Modify

```
prisma/schema.prisma                   # Add new models
src/infrastructure/anthropic/index.ts  # Export unified service
src/components/letters/LetterEditor.tsx # Text selection + highlight menu
src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx # Add panel integration
src/app/(dashboard)/settings/page.tsx  # Add UpToDate connection UI
package.json                           # Add dependencies
.env.example                           # Add new env vars
```

---

## Data Model / API / Interface Changes

### API Contracts

#### POST /api/literature/search
```typescript
// Request
interface LiteratureSearchRequest {
  query: string;
  context?: string;      // Letter excerpt for context
  letterId?: string;     // Link to letter
  sources?: ('uptodate' | 'pubmed' | 'library')[];
}

// Response
interface LiteratureSearchResponse {
  answer: string;
  recommendations: string[];
  dosing?: string;
  warnings?: string[];
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
  responseTime: number;
}

interface Citation {
  source: 'uptodate' | 'pubmed' | 'user_library';
  title: string;
  authors?: string;
  year?: string;
  url?: string;
  pmid?: string;
  confidence: 'high' | 'medium' | 'low';
}
```

#### POST /api/literature/upload
```typescript
// Request: FormData
// - file: File (PDF)
// - title: string
// - category?: string

// Response
interface UploadResponse {
  id: string;
  title: string;
  pageCount: number;
  chunksCreated: number;
  processingTime: number;
}
```

#### GET /api/uptodate/status
```typescript
// Response
interface UpToDateStatus {
  connected: boolean;
  subscriptionType?: 'personal' | 'institutional';
  subscriptionValid?: boolean;
  queriesThisMonth?: number;
  expiresAt?: string;
}
```

---

## Verification Approach

### Development Verification

1. **TypeScript Compilation**
   ```bash
   npm run typecheck
   ```

2. **Linting**
   ```bash
   npm run lint
   ```

3. **Unit Tests**
   ```bash
   npm run test
   ```

4. **Integration Tests**
   ```bash
   npm run test:integration
   ```

5. **E2E Tests**
   ```bash
   npm run test:e2e
   ```

6. **Full Verification**
   ```bash
   npm run verify  # lint + typecheck + tests
   ```

### Manual Testing Checklist

- [ ] Literature search returns results from all configured sources
- [ ] UpToDate OAuth flow completes successfully
- [ ] PDF upload extracts text and creates chunks
- [ ] Vector similarity search returns relevant results
- [ ] Cmd+K opens popup layout
- [ ] Side panel resizes correctly
- [ ] Citation insertion works in letter editor
- [ ] Keyboard shortcuts (Cmd+K, Esc) function properly
- [ ] Loading states display correctly
- [ ] Error states show meaningful messages
- [ ] Mobile drawer layout works on tablet

### Performance Targets

| Operation | Target |
|-----------|--------|
| User library search | < 2s |
| UpToDate API call | < 3s |
| PubMed search | < 4s |
| Anthropic synthesis | < 3s |
| **Total (hybrid search)** | **< 6s** |

---

## Security Considerations

1. **OAuth Token Storage**: Encrypt UpToDate tokens at rest using existing PHI encryption utilities
2. **API Key Protection**: All external API keys in environment variables only
3. **Rate Limiting**: Apply existing rate limiting to literature endpoints
4. **Input Validation**: Use Zod schemas for all API inputs
5. **PHI Handling**: Letter context passed to Claude should follow existing obfuscation patterns
6. **User Isolation**: Vector search scoped to user's own documents

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| UpToDate API unavailable | Graceful fallback to PubMed + user library |
| PubMed rate limit exceeded | Implement request queue with backoff |
| Large PDF processing | Background processing with status updates |
| pgvector not available | Fallback to keyword search |
| High token costs | Implement query limits per tier, prompt caching |

---

## Implementation Milestones

### Milestone 1: Database & Infrastructure (Est. 3-4 hours)
- [ ] Add database models to schema
- [ ] Create migration with pgvector extension
- [ ] Implement unified Anthropic service enhancements
- [ ] Add OpenAI dependency for embeddings

### Milestone 2: PubMed Integration (Est. 2-3 hours)
- [ ] Implement PubMed client
- [ ] Create search service
- [ ] Add unit tests

### Milestone 3: User Library Service (Est. 3-4 hours)
- [ ] Implement PDF upload endpoint
- [ ] Create text extraction + chunking
- [ ] Implement embedding generation
- [ ] Create vector similarity search
- [ ] Add unit tests

### Milestone 4: Literature Orchestration Service (Est. 2-3 hours)
- [ ] Create main literature service
- [ ] Implement source aggregation
- [ ] Add Claude synthesis
- [ ] Create search API endpoint
- [ ] Add integration tests

### Milestone 5: UpToDate OAuth (Est. 2-3 hours)
- [ ] Implement OAuth flow endpoints
- [ ] Create UpToDate search service
- [ ] Add settings UI for connection
- [ ] Add integration tests

### Milestone 6: Frontend - Core Components (Est. 4-5 hours)
- [ ] Create literature store
- [ ] Implement ClinicalAssistantPanel
- [ ] Create search input + results components
- [ ] Implement three layout variants

### Milestone 7: Frontend - Editor Integration (Est. 2-3 hours)
- [ ] Add text selection handling to LetterEditor
- [ ] Implement highlight menu
- [ ] Add keyboard shortcuts
- [ ] Integrate with LetterReviewClient

### Milestone 8: Testing & Polish (Est. 2-3 hours)
- [ ] Complete E2E test suite
- [ ] Performance optimization
- [ ] Error handling polish
- [ ] Documentation

---

## Open Questions for User

1. **UpToDate API Access**: Do you have UpToDate API credentials, or should I implement this as a stub for now?

2. **Tier/Subscription System**: The task mentions Essential/Professional/Enterprise tiers with different query limits. Does this exist in the current codebase, or should I create a basic implementation?

3. **OpenAI for Embeddings**: The spec uses OpenAI's `text-embedding-3-small` for vector embeddings. Is this acceptable, or should I explore using Anthropic/Voyage AI embeddings instead?

4. **UpToDate OAuth Details**: Do you have the OAuth flow documentation for UpToDate, or should I design this generically?
