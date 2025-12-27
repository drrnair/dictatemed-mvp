// src/infrastructure/uptodate/index.ts
// UpToDate OAuth integration (stub implementation)

// Client
export { getUpToDateClient, UpToDateClient } from './client';

// Service
export { getUpToDateService, UpToDateService } from './uptodate.service';

// Types
export type {
  UpToDateConfig,
  UpToDateTokens,
  UpToDateSubscription,
  UpToDateSearchParams,
  UpToDateSearchResult,
  UpToDateTopic,
  UpToDateStatus,
} from './types';

export { DEFAULT_UPTODATE_CONFIG, isUpToDateConfigured } from './types';
