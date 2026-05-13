import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CachedTimesheetSnapshot } from './types';
import {
  clearCachedTimesheetSnapshot,
  getCachedTimesheetSnapshot,
  setCachedTimesheetSnapshot,
  STORAGE_KEYS,
} from './storage';

type StorageMap = Record<string, unknown>;

const localState: StorageMap = {};
const mockGet = vi.fn((keys: string[], callback: (result: StorageMap) => void) => {
  const key = keys[0];
  callback({ [key]: localState[key] });
});
const mockSet = vi.fn((values: StorageMap, callback: () => void) => {
  Object.assign(localState, values);
  callback();
});
const mockRemove = vi.fn((key: string, callback: () => void) => {
  delete localState[key];
  callback();
});

globalThis.chrome = {
  storage: {
    local: {
      get: mockGet,
      set: mockSet,
      remove: mockRemove,
    },
  },
} as unknown as typeof chrome;

describe('storage helpers', () => {
  beforeEach(() => {
    Object.keys(localState).forEach((key) => delete localState[key]);
    mockGet.mockClear();
    mockSet.mockClear();
    mockRemove.mockClear();
  });

  it('stores and retrieves cached timesheet snapshot via typed helpers', async () => {
    const cache: CachedTimesheetSnapshot = {
      snapshot: {
        month: 5,
        year: 2026,
        projectCodes: ['C0007012.1.1'],
        totals: {
          worked: 120,
          absent: 8,
          toBePerformed: 160,
        },
      },
      cachedAt: '2026-05-12T10:00:00.000Z',
    };

    await setCachedTimesheetSnapshot(cache);
    const value = await getCachedTimesheetSnapshot();

    expect(value).toEqual(cache);
    expect(mockSet).toHaveBeenCalledWith({ [STORAGE_KEYS.timesheetSnapshotCache]: cache }, expect.any(Function));
    expect(mockGet).toHaveBeenCalledWith([STORAGE_KEYS.timesheetSnapshotCache], expect.any(Function));
  });

  it('clears cached timesheet snapshot', async () => {
    localState[STORAGE_KEYS.timesheetSnapshotCache] = { cachedAt: '2026-05-12T10:00:00.000Z' };

    await clearCachedTimesheetSnapshot();
    const value = await getCachedTimesheetSnapshot();

    expect(value).toBeUndefined();
    expect(mockRemove).toHaveBeenCalledWith(STORAGE_KEYS.timesheetSnapshotCache, expect.any(Function));
  });
});

