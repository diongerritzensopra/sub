import { describe, expect, it } from 'vitest';

import type { WeeklySchedule } from './types';
import { expandWeeklyScheduleToMonthEntries } from './schedule-expansion';

function makeSchedule(overrides: Partial<WeeklySchedule> = {}): WeeklySchedule {
  return {
    id: 'schedule-1',
    label: 'Kantooruren',
    projectCode: 'ZMOCK_001.1.1',
    hoursPerWeekday: {
      monday: 8,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 8,
      saturday: 0,
      sunday: 0,
    },
    ...overrides,
  };
}

describe('expandWeeklyScheduleToMonthEntries', () => {
  it('expands a month and includes weekend days with explicit zero hours', () => {
    const schedule = makeSchedule();

    const entries = expandWeeklyScheduleToMonthEntries(schedule, 5, 2026);

    expect(entries.length).toBe(31);
    expect(entries[0]).toEqual({
      date: '2026-05-01',
      project: 'ZMOCK_001.1.1',
      hours: 8,
    });
    expect(entries[entries.length - 1]?.date).toBe('2026-05-31');
    expect(entries.find((entry) => entry.date === '2026-05-02')?.hours).toBe(0);
    expect(entries.find((entry) => entry.date === '2026-05-03')?.hours).toBe(0);
  });

  it('covers every day in month and applies zeros when only monday has hours', () => {
    const schedule = makeSchedule({
      hoursPerWeekday: {
        monday: 4,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
      },
    });

    const entries = expandWeeklyScheduleToMonthEntries(schedule, 3, 2026);

    expect(entries.length).toBe(31);
    expect(entries.filter((entry) => entry.hours === 4).map((entry) => entry.date)).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
      '2026-03-30',
    ]);
    expect(entries.filter((entry) => entry.hours === 0)).toHaveLength(26);
  });

  it('handles leap-year february correctly', () => {
    const schedule = makeSchedule({
      hoursPerWeekday: {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 2,
      },
    });

    const entries = expandWeeklyScheduleToMonthEntries(schedule, 2, 2024);

    expect(entries.filter((entry) => entry.hours === 2).map((entry) => entry.date)).toEqual([
      '2024-02-04',
      '2024-02-11',
      '2024-02-18',
      '2024-02-25',
    ]);
    expect(entries.filter((entry) => entry.hours === 0)).toHaveLength(25);
    expect(entries.every((entry) => entry.project === 'ZMOCK_001.1.1')).toBe(true);
  });

  it('skips days with negative hours and keeps zero-hour days', () => {
    const schedule = makeSchedule({
      hoursPerWeekday: {
        monday: -1,
        tuesday: 0,
        wednesday: 3.5,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
      },
    });

    const entries = expandWeeklyScheduleToMonthEntries(schedule, 4, 2026);

    expect(entries.length).toBe(26);
    expect(entries.filter((entry) => entry.hours === 3.5)).toHaveLength(5);
    expect(entries.filter((entry) => entry.hours === 0)).toHaveLength(21);
  });

  it('throws for invalid month/year arguments', () => {
    const schedule = makeSchedule();

    expect(() => expandWeeklyScheduleToMonthEntries(schedule, 0, 2026)).toThrow('Month must be an integer between 1 and 12.');
    expect(() => expandWeeklyScheduleToMonthEntries(schedule, 13, 2026)).toThrow('Month must be an integer between 1 and 12.');
    expect(() => expandWeeklyScheduleToMonthEntries(schedule, 5, 100)).toThrow('Year must be an integer between 1970 and 9999.');
  });
});


