import type { HoursEntry, Weekday, WeeklySchedule } from './types';

const WEEKDAY_BY_UTC_DAY_INDEX: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function formatIsoDateUTC(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10);
}

function getWeekdayUTC(year: number, month: number, day: number): Weekday {
  const date = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAY_BY_UTC_DAY_INDEX[date.getUTCDay()];
}

function validateMonthYear(month: number, year: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Month must be an integer between 1 and 12.');
  }

  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new Error('Year must be an integer between 1970 and 9999.');
  }
}

/**
 * Expand a weekly schedule into concrete day-by-day entries for one month.
 * Zero-hour days are included so the target form can be reset explicitly.
 * Invalid or negative planned hours are skipped.
 */
export function expandWeeklyScheduleToMonthEntries(
  schedule: WeeklySchedule,
  month: number,
  year: number,
): HoursEntry[] {
  validateMonthYear(month, year);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const entries: HoursEntry[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekday = getWeekdayUTC(year, month, day);
    const plannedHours = schedule.hoursPerWeekday[weekday];

    if (!Number.isFinite(plannedHours) || plannedHours < 0) {
      continue;
    }

    entries.push({
      date: formatIsoDateUTC(year, month, day),
      project: schedule.projectCode,
      hours: plannedHours,
    });
  }

  return entries;
}
