import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CachedTimesheetSnapshot, WeeklySchedule } from './types';
import {
  clearCachedTimesheetSnapshot,
  deleteSchedule,
  getCachedTimesheetSnapshot,
  getSchedules,
  isCacheStale,
  saveSchedule,
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

describe('schedule storage helpers', () => {
  const scheduleA: WeeklySchedule = {
    id: 'schedule-a',
    label: 'Project A - 32h',
    projectCode: 'C0007012.1.1',
    hoursPerWeekday: {
      monday: 8,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 0,
      saturday: 0,
      sunday: 0,
    },
  };

  const scheduleB: WeeklySchedule = {
    id: 'schedule-b',
    label: 'Project B - 40h',
    projectCode: 'ZTEST_42',
    hoursPerWeekday: {
      monday: 8,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 8,
      saturday: 0,
      sunday: 0,
    },
  };

  beforeEach(() => {
    Object.keys(localState).forEach((key) => delete localState[key]);
    mockGet.mockClear();
    mockSet.mockClear();
    mockRemove.mockClear();
  });

  it('returns an empty array when no schedules are stored', async () => {
    const schedules = await getSchedules();

    expect(schedules).toEqual([]);
    expect(mockGet).toHaveBeenCalledWith([STORAGE_KEYS.projectSchedules], expect.any(Function));
  });

  it('stores a new schedule', async () => {
    await saveSchedule(scheduleA);
    const schedules = await getSchedules();

    expect(schedules).toEqual([scheduleA]);
    expect(mockSet).toHaveBeenCalledWith({ [STORAGE_KEYS.projectSchedules]: [scheduleA] }, expect.any(Function));
  });

  it('updates an existing schedule with the same id', async () => {
    const updatedScheduleA: WeeklySchedule = {
      ...scheduleA,
      label: 'Project A - updated',
      hoursPerWeekday: {
        ...scheduleA.hoursPerWeekday,
        friday: 4,
      },
    };

    await saveSchedule(scheduleA);
    await saveSchedule(updatedScheduleA);
    const schedules = await getSchedules();

    expect(schedules).toEqual([updatedScheduleA]);
  });

  it('deletes a schedule by id and keeps the others', async () => {
    await saveSchedule(scheduleA);
    await saveSchedule(scheduleB);

    await deleteSchedule(scheduleA.id);
    const schedules = await getSchedules();

    expect(schedules).toEqual([scheduleB]);
  });
});

describe('isCacheStale', () => {
  function makeCache(month: number | null, year: number | null, cachedAt: string = '2026-05-12T10:00:00.000Z'): CachedTimesheetSnapshot {
    return {
      snapshot: { month, year, projectCodes: [], totals: { worked: null, absent: null, toBePerformed: null } },
      cachedAt,
    };
  }

  it('returns false when cache month/year matches the current month/year', () => {
    expect(isCacheStale(makeCache(5, 2026), { month: 5, year: 2026 })).toBe(false);
  });

  it('returns true when cache month differs from current month', () => {
    expect(isCacheStale(makeCache(4, 2026), { month: 5, year: 2026 })).toBe(true);
  });

  it('returns true when cache year differs from current year', () => {
    expect(isCacheStale(makeCache(5, 2025), { month: 5, year: 2026 })).toBe(true);
  });

  it('returns false when cache has no month or year (undated snapshot is not stale)', () => {
    expect(isCacheStale(makeCache(null, null), { month: 5, year: 2026 })).toBe(false);
  });

  it('returns true when cachedAt is older than 3 months', () => {
    const now = new Date('2026-05-19T08:00:00.000Z');
    expect(isCacheStale(makeCache(5, 2026, '2026-02-18T07:59:59.000Z'), { month: 5, year: 2026 }, now)).toBe(true);
  });

  it('returns false when cachedAt is within 3 months', () => {
    const now = new Date('2026-05-19T08:00:00.000Z');
    expect(isCacheStale(makeCache(5, 2026, '2026-02-20T08:00:00.000Z'), { month: 5, year: 2026 }, now)).toBe(false);
  });

  it('returns true when cachedAt is invalid', () => {
    const now = new Date('2026-05-19T08:00:00.000Z');
    expect(isCacheStale(makeCache(5, 2026, 'invalid-date'), { month: 5, year: 2026 }, now)).toBe(true);
  });
});

