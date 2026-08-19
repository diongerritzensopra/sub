import { describe, expect, it, vi, afterEach } from 'vitest';

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import {
  createInitialPopupState,
  getSchedulesToApply,
  isSapTimesheetEditable,
  isSnapshotComplete,
  resolveValidationPeriod,
} from './popup-model';

function createSnapshot(overrides: Partial<TimesheetSnapshot> = {}): TimesheetSnapshot {
  return {
    month: 8,
    year: 2026,
    projects: [],
    totals: {
      worked: 10,
      toBePerformed: 20,
    },
    currentProjectCode: null,
    sapStatus: 'editable',
    ...overrides,
  };
}

function createSchedule(id: string): WeeklySchedule {
  return {
    id,
    label: `Schema ${id}`,
    projectCode: `P-${id}`,
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
}

function createTab(url: string, id: number = 1): chrome.tabs.Tab {
  return {
    id,
    url,
  } as chrome.tabs.Tab;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createInitialPopupState', () => {
  it('creates a state object with expected defaults', () => {
    const state = createInitialPopupState();

    expect(state.isCachedData).toBe(false);
    expect(state.snapshotTimestampIso).toBeNull();
    expect(state.currentSnapshot).toBeNull();
    expect(state.renderedSchedules).toEqual([]);
    expect(state.isTimesheetApplyAllowed).toBe(false);
    expect(state.selectedScheduleIds).toEqual(new Set<string>());
    expect(state.scheduleBeingEdited).toBeNull();
  });

  it('creates a fresh selected ids set for each call', () => {
    const a = createInitialPopupState();
    const b = createInitialPopupState();

    a.selectedScheduleIds.add('schedule-1');

    expect(a.selectedScheduleIds.has('schedule-1')).toBe(true);
    expect(b.selectedScheduleIds.has('schedule-1')).toBe(false);
  });
});

describe('isSapTimesheetEditable', () => {
  it('returns false only when status is locked', () => {
    expect(isSapTimesheetEditable('locked')).toBe(false);
    expect(isSapTimesheetEditable('editable')).toBe(true);
  });

  it('treats missing status as editable', () => {
    expect(isSapTimesheetEditable(null)).toBe(true);
    expect(isSapTimesheetEditable(undefined)).toBe(true);
  });
});

describe('isSnapshotComplete', () => {
  it('returns true when worked and toBePerformed are both present', () => {
    const snapshot = createSnapshot({
      totals: {
        worked: 7.5,
        toBePerformed: 12,
      },
    });

    expect(isSnapshotComplete(snapshot)).toBe(true);
  });

  it('returns false when worked is missing', () => {
    const snapshot = createSnapshot({
      totals: {
        worked: null,
        toBePerformed: 12,
      },
    });

    expect(isSnapshotComplete(snapshot)).toBe(false);
  });

  it('returns false when toBePerformed is missing', () => {
    const snapshot = createSnapshot({
      totals: {
        worked: 12,
        toBePerformed: null,
      },
    });

    expect(isSnapshotComplete(snapshot)).toBe(false);
  });
});

describe('resolveValidationPeriod', () => {
  it('uses route period when available', () => {
    const period = resolveValidationPeriod(
      createTab('https://host/site#timesheet-my?sap-ui-app-id-hint=app&/11/2026/project/XYZ', 1),
    );

    expect(period).toEqual({ month: 11, year: 2026 });
  });

  it('supports leading-zero month values in route period', () => {
    const period = resolveValidationPeriod(
      createTab('https://host/site#timesheet-my?sap-ui-app-id-hint=app&/09/2026/project/XYZ', 3),
    );

    expect(period).toEqual({ month: 9, year: 2026 });
  });

  it('falls back to current date when route period is not present', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00.000Z'));

    const period = resolveValidationPeriod(createTab('https://host/site', 2));

    expect(period).toEqual({ month: 2, year: 2026 });
  });

  it('falls back to current date when URL has an invalid route period', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T09:00:00.000Z'));

    const period = resolveValidationPeriod(createTab('https://host/site?state=/13/2026', 4));

    expect(period).toEqual({ month: 3, year: 2026 });
  });

  it('falls back to current date when tab is missing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-03T08:30:00.000Z'));

    const period = resolveValidationPeriod(undefined);

    expect(period).toEqual({ month: 12, year: 2025 });
  });
});

describe('getSchedulesToApply', () => {
  it('returns all schedules when nothing is selected', () => {
    const schedules = [createSchedule('a'), createSchedule('b')];

    expect(getSchedulesToApply(schedules, new Set<string>())).toEqual(schedules);
  });

  it('returns only selected schedules when ids are provided', () => {
    const schedules = [createSchedule('a'), createSchedule('b'), createSchedule('c')];

    const selected = getSchedulesToApply(schedules, new Set<string>(['c', 'a']));

    expect(selected).toEqual([schedules[0], schedules[2]]);
  });

  it('ignores selected ids that are not in rendered schedules', () => {
    const schedules = [createSchedule('a')];

    const selected = getSchedulesToApply(schedules, new Set<string>(['missing']));

    expect(selected).toEqual([]);
  });
});
