/**
 * Popup side-effect gateway.
 *
 * Bridges Chrome APIs and cache lifecycle logic.
 */

import type {
  CachedTimesheetSnapshot,
  TimesheetSnapshot,
} from '../shared/types';
import {
  clearCachedTimesheetSnapshot,
  getCachedTimesheetSnapshot,
  isCacheStale,
  setCachedTimesheetSnapshot as setCachedTimesheetSnapshotToStorage,
} from '../shared/storage';
import { resolveValidationPeriod } from './popup-model';
import { readTimesheetSnapshotViaUi5 as readTimesheetSnapshotViaUi5FromScripting } from './ui5-scripting';

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function getValidCachedSnapshot(
  tab: chrome.tabs.Tab | undefined,
): Promise<CachedTimesheetSnapshot | undefined> {
  const cached = await getCachedTimesheetSnapshot();
  if (!cached) {
    return undefined;
  }

  if (isCacheStale(cached, resolveValidationPeriod(tab))) {
    await clearCachedTimesheetSnapshot();
    return undefined;
  }

  return cached;
}

export async function readTimesheetSnapshotViaUi5(
  tabId: number,
): Promise<TimesheetSnapshot> {
  return readTimesheetSnapshotViaUi5FromScripting(tabId);
}

export async function setCachedTimesheetSnapshot(
  cache: CachedTimesheetSnapshot,
): Promise<void> {
  await setCachedTimesheetSnapshotToStorage(cache);
}
