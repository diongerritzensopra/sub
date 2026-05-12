/**
 * chrome.storage helper — typed wrappers around chrome.storage.local.
 */

import type { CachedTimesheetSnapshot } from './types';

export const STORAGE_KEYS = {
  timesheetSnapshotCache: 'timesheetSnapshotCache',
} as const;

async function storageGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

async function storageSet(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

async function storageRemove(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve);
  });
}

export async function getCachedTimesheetSnapshot(): Promise<CachedTimesheetSnapshot | undefined> {
  return storageGet<CachedTimesheetSnapshot>(STORAGE_KEYS.timesheetSnapshotCache);
}

export async function setCachedTimesheetSnapshot(cache: CachedTimesheetSnapshot): Promise<void> {
  await storageSet(STORAGE_KEYS.timesheetSnapshotCache, cache);
}

export async function clearCachedTimesheetSnapshot(): Promise<void> {
  await storageRemove(STORAGE_KEYS.timesheetSnapshotCache);
}

