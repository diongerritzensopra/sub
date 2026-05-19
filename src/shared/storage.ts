/**
 * chrome.storage helper — typed wrappers around chrome.storage.local.
 */

import type { CachedTimesheetSnapshot } from './types';

export const STORAGE_KEYS = {
  timesheetSnapshotCache: 'timesheetSnapshotCache',
} as const;

export interface CachePeriod {
  month: number;
  year: number;
}

const CACHE_MAX_AGE_MONTHS = 3;

function isCacheTooOld(cachedAt: string, now: Date): boolean {
  const cachedAtDate = new Date(cachedAt);
  if (Number.isNaN(cachedAtDate.getTime())) {
    return true;
  }

  const maxAgeThreshold = new Date(now);
  maxAgeThreshold.setMonth(maxAgeThreshold.getMonth() - CACHE_MAX_AGE_MONTHS);
  return cachedAtDate < maxAgeThreshold;
}

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

/**
 * Returns true when the cached snapshot belongs to a different month/year than
 * the requested reference period, or when the cache is older than 3 months.
 * A cache entry without month/year info is not considered stale, but can
 * still become stale by age.
 */
export function isCacheStale(
  cache: CachedTimesheetSnapshot,
  referencePeriod: CachePeriod = { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
  now: Date = new Date(),
): boolean {
  if (isCacheTooOld(cache.cachedAt, now)) {
    return true;
  }

  const { month, year } = cache.snapshot;
  if (month === null || year === null) {
    return false;
  }
  return month !== referencePeriod.month || year !== referencePeriod.year;
}

