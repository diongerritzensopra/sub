/**
 * chrome.storage helper — typed wrappers around chrome.storage.local.
 */

import type { CachedStatusMessage, CachedTimesheetSnapshot, WeeklySchedule } from './types';

export const STORAGE_KEYS = {
  timesheetSnapshotCache: 'timesheetSnapshotCache',
  projectSchedules: 'projectSchedules',
  statusMessageCache: 'statusMessageCache',
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

export async function getSchedules(): Promise<WeeklySchedule[]> {
  const schedules = await storageGet<WeeklySchedule[]>(STORAGE_KEYS.projectSchedules);
  if (!Array.isArray(schedules)) {
    return [];
  }

  return schedules;
}

export async function saveSchedule(schedule: WeeklySchedule): Promise<void> {
  const existing = await getSchedules();
  const existingIndex = existing.findIndex((item) => item.id === schedule.id);

  if (existingIndex === -1) {
    await storageSet(STORAGE_KEYS.projectSchedules, [...existing, schedule]);
    return;
  }

  const updated = [...existing];
  updated[existingIndex] = schedule;
  await storageSet(STORAGE_KEYS.projectSchedules, updated);
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const existing = await getSchedules();
  const filtered = existing.filter((schedule) => schedule.id !== scheduleId);

  await storageSet(STORAGE_KEYS.projectSchedules, filtered);
}

export async function getCachedStatusMessage(): Promise<CachedStatusMessage | undefined> {
  return storageGet<CachedStatusMessage>(STORAGE_KEYS.statusMessageCache);
}

export async function setCachedStatusMessage(cache: CachedStatusMessage): Promise<void> {
  await storageSet(STORAGE_KEYS.statusMessageCache, cache);
}

export async function clearCachedStatusMessage(): Promise<void> {
  await storageRemove(STORAGE_KEYS.statusMessageCache);
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

