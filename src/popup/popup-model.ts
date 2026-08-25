/**
 * Popup-local model helpers and state shape.
 */

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';

export const ROUTE_PERIOD_PATTERN =
  /[?&]\/(1[0-2]|0?[1-9])\/(20\d{2})(?:[/?&#]|$)/i;
export const STATUS_MESSAGE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export type PopupState = {
  isCachedData: boolean;
  snapshotTimestampIso: string | null;
  currentSnapshot: TimesheetSnapshot | null;
  renderedSchedules: WeeklySchedule[];
  isTimesheetApplyAllowed: boolean;
  selectedScheduleIds: Set<string>;
  scheduleBeingEdited: WeeklySchedule | null;
};

export function createInitialPopupState(): PopupState {
  return {
    isCachedData: false,
    snapshotTimestampIso: null,
    currentSnapshot: null,
    renderedSchedules: [],
    isTimesheetApplyAllowed: false,
    selectedScheduleIds: new Set<string>(),
    scheduleBeingEdited: null,
  };
}

export function isSapTimesheetEditable(
  status: TimesheetSnapshot['sapStatus'] | null | undefined,
): boolean {
  return status !== 'locked';
}

export function isSnapshotComplete(snapshot: TimesheetSnapshot): boolean {
  return (
    snapshot.totals.worked !== null && snapshot.totals.toBePerformed !== null
  );
}

export function extractPeriodFromTimesheetUrl(
  url: string | undefined,
): { month: number; year: number } | null {
  if (!url) {
    return null;
  }

  const match = url.match(ROUTE_PERIOD_PATTERN);
  if (!match) {
    return null;
  }

  return {
    month: Number.parseInt(match[1], 10),
    year: Number.parseInt(match[2], 10),
  };
}

export function resolveValidationPeriod(tab: chrome.tabs.Tab | undefined): {
  month: number;
  year: number;
} {
  const routePeriod = extractPeriodFromTimesheetUrl(tab?.url);
  if (routePeriod) {
    return routePeriod;
  }

  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function getSchedulesToApply(
  renderedSchedules: WeeklySchedule[],
  selectedScheduleIds: Set<string>,
): WeeklySchedule[] {
  if (selectedScheduleIds.size === 0) {
    return renderedSchedules;
  }

  return renderedSchedules.filter((schedule) =>
    selectedScheduleIds.has(schedule.id),
  );
}
