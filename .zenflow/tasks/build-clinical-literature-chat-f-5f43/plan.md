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

### [ ] Step 2: Unified Anthropic Service Enhancement

**Goal**: Extend Anthropic infrastructure for chat + caching

**Tasks**:
1. Create `src/infrastructure/anthropic/unified-service.ts`:
   - System prompt caching with TTL
   - Multi-turn `chat()` method for conversations
   - Usage tracking with `getUsageStats()`
   - Export from `src/infrastructure/anthropic/index.ts`
2. Create shared types in `src/infrastructure/anthropic/chat-types.ts`

**Verification**:
```bash
npm run typecheck
npm run test -- src/infrastructure/anthropic
```

---

### [ ] Step 3: PubMed Integration

**Goal**: Implement PubMed E-utilities search

**Tasks**:
1. Create `src/infrastructure/pubmed/`:
   - `client.ts` - E-utilities API client
   - `pubmed.service.ts` - Search service
   - `types.ts` - Response types
2. Implement:
   - `search()` - Search for articles by query
   - `fetchArticleDetails()` - Get metadata by PMIDs
   - `checkFreeFullText()` - Check PMC availability
3. Add unit tests `tests/unit/infrastructure/pubmed.test.ts`

**Verification**:
```bash
npm run typecheck
npm run test -- pubmed
```

---

### [ ] Step 4: User Library Service (Vector Search)

**Goal**: PDF upload with embedding-based search

**Tasks**:
1. Create `src/domains/literature/user-library.service.ts`:
   - `uploadDocument()` - Extract text, chunk, embed, store
   - `search()` - Vector similarity search via pgvector
   - `listDocuments()` - Get user's library
   - `deleteDocument()` - Remove document and chunks
2. Create `src/infrastructure/openai/embeddings.ts`:
   - `generateEmbeddings()` - Batch embedding generation
3. Add helper for PDF text extraction + chunking
4. Add unit tests `tests/unit/domains/user-library.test.ts`

**Verification**:
```bash
npm run typecheck
npm run test -- user-library
```

---

### [ ] Step 5: UpToDate OAuth Stub

**Goal**: OAuth-ready infrastructure (stub for later activation)

**Tasks**:
1. Create `src/infrastructure/uptodate/`:
   - `client.ts` - OAuth client (stub)
   - `uptodate.service.ts` - Search service (stub returns empty)
   - `types.ts` - Type definitions
2. Implement OAuth flow structure:
   - `getAuthorizationUrl()` - Generate OAuth URL
   - `exchangeCodeForTokens()` - Exchange code (stub)
   - `refreshToken()` - Refresh logic (stub)
   - `search()` - Returns empty array when not configured
3. Add env check: `UPTODATE_CLIENT_ID` present = enabled

**Verification**:
```bash
npm run typecheck
```

---

### [ ] Step 6: Literature Orchestration Service

**Goal**: Main service that aggregates all sources

**Tasks**:
1. Create `src/domains/literature/`:
   - `literature.service.ts` - Main orchestration
   - `types.ts` - Shared types (Citation, SearchResult, etc.)
2. Implement:
   - `search()` - Parallel search across sources
   - `synthesizeResults()` - Claude synthesis with JSON response
   - `getTierLimits()` - Hardcoded Professional limits
   - `logQuery()` - Store query for analytics
3. Add system prompts for clinical synthesis
4. Add unit tests `tests/unit/domains/literature.test.ts`

**Verification**:
```bash
npm run typecheck
npm run test -- literature
```

---

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
