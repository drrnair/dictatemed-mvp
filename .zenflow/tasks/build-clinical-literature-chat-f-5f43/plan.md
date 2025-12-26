# Clinical Literature Chat - Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/build-clinical-literature-chat-f-5f43`
- **Spec File**: `spec.md`

---

## Decisions Made

1. **UpToDate**: OAuth-ready stub with clear integration points (enable later with credentials)
2. **Tier System**: Hardcoded Professional tier for all users (swappable functions for future billing)
3. **Embeddings**: OpenAI `text-embedding-3-small` for vector search
4. **Scope**: Complete implementation with all three layout options

---

## Workflow Steps

### [x] Step: Technical Specification

- Created comprehensive spec at `spec.md`
- Assessed difficulty: HARD
- Identified all files to create/modify
- Defined API contracts and database models
- Documented verification approach

---

### [x] Step 1: Database Schema & Dependencies

**Goal**: Add database models and install new dependencies

**Completed**:
1. Added new models to `prisma/schema.prisma`:
   - `UpToDateConnection` - OAuth token storage (encrypted tokens, subscription tracking)
   - `LibraryDocument` - User's uploaded documents (title, category, pageCount, storagePath)
   - `DocumentChunk` - Vector embeddings for similarity search (pgvector 1536 dimensions)
   - `LiteratureQuery` - Query logging for analytics (sources, confidence, caching)
   - Updated `User` model with new relations
2. Created migration `20251227_add_clinical_literature_chat/migration.sql`:
   - Enables pgvector extension
   - Creates all tables with indexes
   - Adds IVFFlat index for fast vector similarity search
3. Added dependencies to `package.json`:
   - `openai@^4.77.0` for embeddings
   - `react-hotkeys-hook@^4.6.1` for keyboard shortcuts
4. Updated `.env.example` with:
   - `OPENAI_API_KEY` for embeddings
   - `UPTODATE_CLIENT_ID`, `UPTODATE_CLIENT_SECRET`, `UPTODATE_REDIRECT_URI` (optional)

**Verification**: ✅
```bash
npm install          # ✅ Success
npx prisma generate  # ✅ Success
npm run typecheck    # ✅ No errors
```

---

### [x] Step 2: Unified Anthropic Service Enhancement

**Goal**: Extend Anthropic infrastructure for chat + caching

**Completed**:
1. Created `src/infrastructure/anthropic/chat-types.ts`:
   - `ChatMessage`, `ChatRequest`, `ChatResponse` for multi-turn conversations
   - `ChatTool`, `ToolUseResult` for function calling support
   - `UnifiedTextRequest/Response`, `UnifiedImageRequest/Response` for unified API
   - `CachedPrompt`, `UnifiedUsageStats`, `UnifiedServiceConfig` for caching/tracking
   - `DEFAULT_UNIFIED_CONFIG` with sensible defaults (24h cache TTL)
2. Created `src/infrastructure/anthropic/unified-service.ts`:
   - `UnifiedAnthropicService` class with singleton pattern
   - `generateText()` - Text generation with system prompt caching
   - `chat()` - Multi-turn conversations with tool support
   - `analyzeImage()` - Vision/image analysis
   - `getUsageStats()` - Token and cost tracking
   - `getCacheStats()` - Cache hit rate monitoring
   - SHA-256 based prompt hashing for cache keys
3. Updated `src/infrastructure/anthropic/index.ts`:
   - Exported `unifiedAnthropicService` singleton
   - Exported `UnifiedAnthropicService` class for testing
   - Exported all new types and constants

**Verification**: ✅
```bash
npm run typecheck    # ✅ No errors
```

---

### [x] Step 3: PubMed Integration

**Goal**: Implement PubMed E-utilities search

**Completed**:
1. Created `src/infrastructure/pubmed/`:
   - `types.ts` - Complete type definitions for E-utilities API
     - `PubMedSearchParams` - Search request parameters
     - `ESearchResponse` - NCBI E-utilities search response
     - `PubMedArticle`, `PubMedAuthor`, `PubMedJournal` - Article data models
     - `PubMedSearchResult`, `PubMedArticleResult` - Processed results
     - `PubMedConfig`, `DEFAULT_PUBMED_CONFIG` - Configuration
   - `client.ts` - E-utilities API client with singleton pattern
     - `search()` - Search PubMed with year filters, free full-text filter
     - `fetchArticles()` - Fetch article details as XML by PMIDs
     - `checkFreeFullText()` - Check PMC availability via ID converter
   - `pubmed.service.ts` - High-level search service
     - `search()` - Complete search with XML parsing and formatting
     - XML parsing for articles, authors, abstracts, journals
     - Author formatting (single, two, or "et al.")
     - Journal citation formatting
   - `index.ts` - Module exports
2. Created `tests/unit/infrastructure/pubmed/pubmed.test.ts`:
   - 18 unit tests covering all functionality
   - Tests for client search, fetch, and PMC availability
   - Tests for service search, author formatting, journal citations
   - Tests for abstract parsing with structured labels

**Verification**: ✅
```bash
npm run typecheck    # ✅ No errors
npm run test -- pubmed  # ✅ 18 tests passed
```

---

### [x] Step 4: User Library Service (Vector Search)

**Goal**: PDF upload with embedding-based search

**Completed**:
1. Created `src/infrastructure/openai/`:
   - `types.ts` - Type definitions for embeddings
     - `EmbeddingConfig`, `EmbeddingModel`, `EmbeddingRequest/Response`
     - `ChunkingConfig`, `TextChunk` for document chunking
     - `DEFAULT_EMBEDDING_CONFIG`, `DEFAULT_CHUNKING_CONFIG`
     - `EMBEDDING_PRICING` for cost tracking
   - `embeddings.ts` - OpenAI embeddings service
     - `EmbeddingsService` class with singleton pattern
     - `generateEmbeddings()` - Batch embedding generation
     - `generateEmbedding()` - Single text embedding
     - `generateEmbeddingsBatched()` - Handles large inputs with batching
     - Token usage tracking and cost estimation
     - `TextChunker` class for intelligent text splitting
   - `index.ts` - Module exports
2. Created `src/domains/literature/`:
   - `types.ts` - Shared types for literature chat
     - `Citation`, `LiteratureSearchResult`, `LiteratureSearchParams`
     - `UserLibraryDocument`, `UserLibrarySearchResult`, `UserLibraryChunkResult`
     - `UploadDocumentRequest/Result`
     - `TierConfig`, `TIER_LIMITS` (Essential/Professional/Enterprise)
   - `user-library.service.ts` - User library service
     - `uploadDocument()` - PDF text extraction, chunking, embeddings, storage
     - `search()` - Vector similarity search using pgvector
     - `listDocuments()` - Get user's documents with chunk counts
     - `getDocument()` - Get single document by ID
     - `deleteDocument()` - Remove document and chunks
     - Tier-based limits enforcement
   - `index.ts` - Module exports
3. Added generic `encrypt()` and `decrypt()` functions to `src/infrastructure/db/encryption.ts`
4. Fixed UpToDate client to use local encryption functions
5. Created unit tests:
   - `tests/unit/domains/literature/user-library.service.test.ts` - 16 tests
   - `tests/unit/infrastructure/openai/embeddings.test.ts` - 22 tests

**Verification**: ✅
```bash
npm run typecheck                    # ✅ No errors
npm run test -- literature           # ✅ 16 tests passed
npm run test -- openai/embeddings    # ✅ 22 tests passed
```

---

### [x] Step 5: UpToDate OAuth Stub

**Goal**: OAuth-ready infrastructure (stub for later activation)

**Completed**:
1. Verified existing `src/infrastructure/uptodate/` implementation:
   - `types.ts` - Type definitions
     - `UpToDateConfig` - OAuth configuration
     - `UpToDateTokens` - OAuth tokens
     - `UpToDateSubscription` - Subscription info
     - `UpToDateSearchParams`, `UpToDateSearchResult`, `UpToDateTopic` - Search types
     - `UpToDateStatus` - Connection status
     - `isUpToDateConfigured()` - Env check function
   - `client.ts` - OAuth client (stub)
     - `getAuthorizationUrl()` - Generate OAuth URL with CSRF state
     - `exchangeCodeForTokens()` - Exchange code (stub returns mock tokens)
     - `refreshToken()` - Refresh logic (stub returns mock tokens)
     - `validateSubscription()` - Subscription check (stub)
     - `encryptTokens()`/`decryptTokens()` - Token encryption for storage
   - `uptodate.service.ts` - Search service (stub returns empty)
     - `isEnabled()` - Check if credentials configured
     - `getStatus()` - User connection status
     - `getAuthorizationUrl()` - Delegate to client
     - `connectAccount()` - Complete OAuth flow
     - `disconnectAccount()` - Remove connection
     - `search()` - Returns empty when not configured/connected
   - `index.ts` - Module exports
2. Env check: `UPTODATE_CLIENT_ID` + `UPTODATE_CLIENT_SECRET` = enabled
3. Created comprehensive unit tests `tests/unit/infrastructure/uptodate/uptodate.test.ts`:
   - 32 unit tests covering all functionality
   - Tests for types, client, and service
   - Tests for unconfigured, configured, and connected states

**Verification**: ✅
```bash
npm run typecheck          # ✅ No errors
npm run test -- uptodate   # ✅ 32 tests passed
```

---

### [x] Step 6: Literature Orchestration Service

**Goal**: Main service that aggregates all sources

**Completed**:
1. Verified existing `src/domains/literature/orchestration.service.ts`:
   - `LiteratureOrchestrationService` class with singleton pattern
   - `search()` - Main search method with parallel source searches
   - `determineSources()` - Filter sources based on tier and request
   - `executeSearches()` - Parallel execution across PubMed, UpToDate, User Library
   - `searchPubMed()` - Format PubMed results to SourceResult
   - `searchUpToDate()` - Format UpToDate results (when connected)
   - `searchUserLibrary()` - Format user library results
   - `synthesizeResults()` - Claude synthesis with clinical system prompt
   - `buildContext()` - Format sources for Claude context
   - `parseAIResponse()` - Extract recommendations, dosing, warnings, citations
   - `buildCitations()` - Create citations from source results
   - `determineConfidence()` - High/medium/low based on source types
   - `checkQueryLimits()` - Enforce tier-based query limits
   - `recordQuery()` - Store query in database for analytics
2. Added `LITERATURE_SYSTEM_PROMPT` for clinical synthesis:
   - Role definition for clinical literature assistant
   - Guidelines for prioritizing evidence
   - Output format specification
3. Fixed schema and API route issues:
   - Added `letterId` field to `LiteratureQuery` model
   - Updated migration file
   - Fixed API route to use `subspecialties` instead of `specialty`
4. Created comprehensive unit tests `tests/unit/domains/literature/orchestration.service.test.ts`:
   - 14 unit tests covering all functionality
   - Tests for empty results, PubMed synthesis, UpToDate integration
   - Tests for user library search, query limits, source failures
   - Tests for context passing, source filtering, confidence levels
   - Tests for error handling and query recording

**Verification**: ✅
```bash
npm run typecheck              # ✅ No errors
npm run test -- domains/literature  # ✅ 30 tests passed (16 user-library + 14 orchestration)
```

### [ ] Step 7: API Routes

**Goal**: REST endpoints for literature features

**Tasks**:
1. Create literature routes:
   - `POST /api/literature/search` - Execute search
   - `POST /api/literature/upload` - Upload document
   - `GET /api/literature/library` - List documents
   - `DELETE /api/literature/library/[id]` - Remove document
2. Create UpToDate routes (stubs):
   - `GET /api/uptodate/connect` - Start OAuth
   - `GET /api/uptodate/callback` - OAuth callback
   - `DELETE /api/uptodate/disconnect` - Remove connection
   - `GET /api/uptodate/status` - Connection status
3. Add Zod schemas for request validation
4. Add integration tests `tests/integration/api/literature.test.ts`

**Verification**:
```bash
npm run typecheck
npm run test:integration -- literature
```

---

### [ ] Step 8: Frontend - Literature Store & Core Components

**Goal**: State management and base UI components

**Tasks**:
1. Create `src/stores/literature.store.ts`:
   - State: isOpen, layout, query, results, loading, history
   - Actions: search, setLayout, insertCitation, clearResults
   - Persist layout preference to localStorage
2. Create `src/components/literature/`:
   - `LiteratureSearchInput.tsx` - Input with suggestions
   - `LiteratureSearchResults.tsx` - Results display
   - `SourceCard.tsx` - Individual source card
   - `ConfidenceBadge.tsx` - High/medium/low indicator
   - `LayoutToggle.tsx` - Layout selector

**Verification**:
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 9: Frontend - Layout Components

**Goal**: Three layout options for clinical assistant

**Tasks**:
1. Create layout components:
   - `SidePanelLayout.tsx` - Resizable side panel (desktop)
   - `PopupLayout.tsx` - Centered modal (Cmd+K)
   - `DrawerLayout.tsx` - Bottom drawer (mobile)
2. Create `ClinicalAssistantPanel.tsx`:
   - Renders correct layout based on preference
   - Handles keyboard shortcuts (Cmd+K, Esc)
   - Passes search context from selected text
3. Add Framer Motion animations

**Verification**:
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 10: Frontend - Letter Editor Integration

**Goal**: Connect literature chat to letter editing

**Tasks**:
1. Update `src/components/letters/LetterEditor.tsx`:
   - Add text selection detection
   - Show highlight menu on selection
2. Create `TextHighlightMenu.tsx`:
   - "Ask" button to open assistant with context
   - "Cite" button for quick citation search
   - Quick action dropdown
3. Update `LetterReviewClient.tsx`:
   - Add ClinicalAssistantPanel
   - Add LayoutToggle to toolbar
   - Wire up citation insertion

**Verification**:
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 11: Settings UI for UpToDate & Library

**Goal**: User can manage UpToDate connection and library

**Tasks**:
1. Create `src/app/(dashboard)/settings/literature/page.tsx`:
   - UpToDate connection status card
   - Connect/disconnect buttons
   - Library document list
   - Upload button with drag-drop
2. Add navigation link in settings layout

**Verification**:
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 12: E2E Tests & Final Verification

**Goal**: Full workflow testing and polish

**Tasks**:
1. Create `tests/e2e/clinical-literature.spec.ts`:
   - Search flow with PubMed
   - Upload document to library
   - Search user library
   - Citation insertion in letter
   - Layout switching
   - Keyboard shortcuts
2. Run full verification suite
3. Write implementation report

**Verification**:
```bash
npm run verify
npm run test:e2e -- clinical-literature
```

---

## Summary

| Step | Description | Est. Time |
|------|-------------|-----------|
| 1 | Database Schema & Dependencies | 1-2h |
| 2 | Unified Anthropic Service | 1-2h |
| 3 | PubMed Integration | 2h |
| 4 | User Library Service | 3h |
| 5 | UpToDate OAuth Stub | 1h |
| 6 | Literature Orchestration | 2h |
| 7 | API Routes | 2h |
| 8 | Frontend Store & Components | 2h |
| 9 | Layout Components | 2h |
| 10 | Letter Editor Integration | 2h |
| 11 | Settings UI | 1h |
| 12 | E2E Tests & Report | 2h |
| **Total** | | **~20h** |
