// src/components/literature/index.ts
// Clinical literature chat components

// Core panel components
export { LiteratureChatPanel } from './LiteratureChatPanel';
export { ClinicalAssistantPanel } from './ClinicalAssistantPanel';
export { LiteratureToolbarButton } from './LiteratureToolbarButton';

// Layout components
export { SidePanelLayout } from './layouts/SidePanelLayout';
export { PopupLayout } from './layouts/PopupLayout';
export { DrawerLayout } from './layouts/DrawerLayout';

// Search components
export { LiteratureSearchInput } from './LiteratureSearchInput';
export { LiteratureSearchResults, LiteratureResultSummary } from './LiteratureSearchResults';

// UI components
export { LiteratureSourceBadge } from './LiteratureSourceBadge';
export { CitationCard, formatCitationText } from './CitationCard';
export { ConfidenceBadge, getConfidenceVariant } from './ConfidenceBadge';
export { LayoutToggle, LayoutSelector } from './LayoutToggle';
