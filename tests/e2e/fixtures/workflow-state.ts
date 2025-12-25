// tests/e2e/fixtures/workflow-state.ts
// Fixtures for managing state between serial tests in workflow specs
//
// This module provides a proper way to share state between serial tests
// without using mutable module-level variables.
//
// Usage:
//   import { workflowTest, WorkflowState } from '../fixtures/workflow-state';
//
//   workflowTest.describe('My Workflow', () => {
//     workflowTest('generate letter', async ({ page, workflowState }) => {
//       // ... generate letter ...
//       workflowState.letterId = 'generated-id';
//     });
//
//     workflowTest('review letter', async ({ page, workflowState }) => {
//       const letterId = workflowState.letterId;
//       // ... use letterId ...
//     });
//   });

import { test as base, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * State that can be shared between serial tests in a workflow
 */
export interface WorkflowState {
  /** ID of the most recently generated letter */
  letterId: string | null;
  /** ID of the most recently created consultation */
  consultationId: string | null;
  /** ID of the most recently uploaded referral */
  referralId: string | null;
  /** Any custom data needed by the workflow */
  customData: Record<string, unknown>;
}

// File-based state storage for cross-test persistence
const STATE_FILE = path.join(__dirname, '../.workflow-state.json');

/**
 * Load workflow state from file
 */
function loadWorkflowState(): WorkflowState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Ignore errors, return default state
  }
  return createDefaultState();
}

/**
 * Save workflow state to file
 */
function saveWorkflowState(state: WorkflowState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.warn('Failed to save workflow state:', error);
  }
}

/**
 * Clear workflow state file
 */
export function clearWorkflowState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Create default empty state
 */
function createDefaultState(): WorkflowState {
  return {
    letterId: null,
    consultationId: null,
    referralId: null,
    customData: {},
  };
}

/**
 * Extended test fixture with workflow state management
 *
 * This fixture provides a WorkflowState object that persists across
 * serial tests within a workflow describe block.
 *
 * IMPORTANT: Tests using this fixture MUST run serially (test.describe.serial)
 * for the state to be meaningful.
 */
export const workflowTest = base.extend<{
  workflowState: WorkflowState;
  saveState: () => void;
}>({
  // Provide workflow state to tests
  workflowState: async ({}, use) => {
    // Load existing state or create new
    const state = loadWorkflowState();

    // Provide state to test
    await use(state);

    // Save state after test completes
    saveWorkflowState(state);
  },

  // Helper to explicitly save state (useful mid-test)
  saveState: async ({ workflowState }, use) => {
    const save = () => saveWorkflowState(workflowState);
    await use(save);
  },
});

/**
 * Helper to extract letter ID from URL
 */
export function extractLetterIdFromUrl(url: string): string | null {
  const match = url.match(/\/letters\/([a-zA-Z0-9-]+)/);
  return match?.[1] ?? null;
}

/**
 * Helper to extract consultation ID from URL
 */
export function extractConsultationIdFromUrl(url: string): string | null {
  const match = url.match(/\/consultations\/([a-zA-Z0-9-]+)/);
  return match?.[1] ?? null;
}

/**
 * Helper to extract referral ID from URL
 */
export function extractReferralIdFromUrl(url: string): string | null {
  const match = url.match(/\/referrals\/([a-zA-Z0-9-]+)/);
  return match?.[1] ?? null;
}

/**
 * Utility type for tests that need workflow state
 */
export type WorkflowTestArgs = {
  page: Page;
  workflowState: WorkflowState;
  saveState: () => void;
};
