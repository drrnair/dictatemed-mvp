// src/stores/literature.store.ts
// Zustand store for clinical literature chat state management

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import type {
  LiteratureSearchResult,
  Citation,
  LiteratureSourceType,
  ConfidenceLevel,
} from '@/domains/literature';

/**
 * Chat message in the literature conversation.
 */
interface LiteratureMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  confidence?: ConfidenceLevel;
  responseTimeMs?: number;
}

/**
 * Layout mode for the literature panel.
 */
type LiteraturePanelLayout = 'side' | 'popup' | 'drawer';

/**
 * Literature chat state.
 */
interface LiteratureState {
  // Panel state
  isOpen: boolean;
  layout: LiteraturePanelLayout;

  // Chat state
  messages: LiteratureMessage[];
  isSearching: boolean;
  error: string | null;

  // Current search context
  letterId: string | null;
  letterContext: string | null;

  // Search preferences
  activeSources: LiteratureSourceType[];

  // Citation insertion
  selectedCitation: Citation | null;

  // Usage tracking
  queriesThisMonth: number;
  queryLimit: number;

  // Actions - Panel
  openPanel: (layout?: LiteraturePanelLayout) => void;
  closePanel: () => void;
  togglePanel: () => void;
  setLayout: (layout: LiteraturePanelLayout) => void;

  // Actions - Chat
  addMessage: (message: Omit<LiteratureMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setSearching: (isSearching: boolean) => void;
  setError: (error: string | null) => void;

  // Actions - Context
  setLetterContext: (letterId: string | null, context: string | null) => void;
  clearContext: () => void;

  // Actions - Sources
  setActiveSources: (sources: LiteratureSourceType[]) => void;
  toggleSource: (source: LiteratureSourceType) => void;

  // Actions - Citation
  selectCitation: (citation: Citation | null) => void;

  // Actions - Usage
  setUsage: (queriesThisMonth: number, queryLimit: number) => void;
  incrementQueryCount: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  isOpen: false,
  layout: 'side' as LiteraturePanelLayout,
  messages: [],
  isSearching: false,
  error: null,
  letterId: null,
  letterContext: null,
  activeSources: ['pubmed', 'uptodate', 'user_library'] as LiteratureSourceType[],
  selectedCitation: null,
  queriesThisMonth: 0,
  queryLimit: 500, // Professional tier default
};

/**
 * Generate unique message ID.
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const useLiteratureStore = create<LiteratureState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        ...initialState,

        // Panel actions
        openPanel: (layout) =>
          set((state) => ({
            isOpen: true,
            layout: layout ?? state.layout,
          })),

        closePanel: () =>
          set({
            isOpen: false,
            selectedCitation: null,
          }),

        togglePanel: () =>
          set((state) => ({
            isOpen: !state.isOpen,
            selectedCitation: state.isOpen ? null : state.selectedCitation,
          })),

        setLayout: (layout) => set({ layout }),

        // Chat actions
        addMessage: (message) =>
          set((state) => ({
            messages: [
              ...state.messages,
              {
                ...message,
                id: generateMessageId(),
                timestamp: new Date(),
              },
            ],
          })),

        clearMessages: () =>
          set({
            messages: [],
            error: null,
          }),

        setSearching: (isSearching) => set({ isSearching }),

        setError: (error) =>
          set({
            error,
            isSearching: false,
          }),

        // Context actions
        setLetterContext: (letterId, letterContext) =>
          set({
            letterId,
            letterContext,
          }),

        clearContext: () =>
          set({
            letterId: null,
            letterContext: null,
          }),

        // Source actions
        setActiveSources: (activeSources) => set({ activeSources }),

        toggleSource: (source) =>
          set((state) => {
            const isActive = state.activeSources.includes(source);
            if (isActive && state.activeSources.length === 1) {
              // Don't allow removing the last source
              return state;
            }
            return {
              activeSources: isActive
                ? state.activeSources.filter((s) => s !== source)
                : [...state.activeSources, source],
            };
          }),

        // Citation actions
        selectCitation: (selectedCitation) => set({ selectedCitation }),

        // Usage actions
        setUsage: (queriesThisMonth, queryLimit) =>
          set({ queriesThisMonth, queryLimit }),

        incrementQueryCount: () =>
          set((state) => ({
            queriesThisMonth: state.queriesThisMonth + 1,
          })),

        // Reset
        reset: () => set(initialState),
      }),
      {
        name: 'literature-chat-storage',
        partialize: (state) => ({
          layout: state.layout,
          activeSources: state.activeSources,
        }),
      }
    )
  )
);

// Selectors
export const selectIsOpen = (state: LiteratureState) => state.isOpen;
export const selectLayout = (state: LiteratureState) => state.layout;
export const selectMessages = (state: LiteratureState) => state.messages;
export const selectIsSearching = (state: LiteratureState) => state.isSearching;
export const selectError = (state: LiteratureState) => state.error;
export const selectActiveSources = (state: LiteratureState) => state.activeSources;
export const selectSelectedCitation = (state: LiteratureState) => state.selectedCitation;
export const selectHasReachedLimit = (state: LiteratureState) =>
  state.queriesThisMonth >= state.queryLimit;
export const selectRemainingQueries = (state: LiteratureState) =>
  Math.max(0, state.queryLimit - state.queriesThisMonth);
