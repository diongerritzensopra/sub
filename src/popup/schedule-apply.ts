/**
 * Schedule apply — navigation, autofill orchestration, and status message building.
 *
 * Contains all infrastructure for the apply flow:
 * - Tab URL-based project navigation
 * - Per-schedule autofill execution via ui5-scripting
 * - Status message composition for the popup UI
 */

import type { WeeklySchedule } from '../shared/types';
import { getSAPBusyStateForTab } from '../shared/busy-state';
import { expandWeeklyScheduleToMonthEntries } from '../shared/schedule-expansion';
import { autofillEntriesViaUi5 } from './ui5-scripting';

const ROUTE_PROJECT_SEGMENT_PATTERN =
  /([?&])\/(1[0-2]|0?[1-9])\/(20\d{2})(?:\/project\/[^&#?]*)?/i;
const PROJECT_NAVIGATION_TIMEOUT_MS = 10_000;
const PROJECT_NAVIGATION_POLL_INTERVAL_MS = 200;

export type ScheduleAutofillSummary = {
  totalDaysCount: number;
  appliedDaysCount: number;
  failedDates: string[];
  submissionAttempted: boolean;
  submissionConfirmed: boolean;
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function buildTimesheetUrlForProject(
  url: string,
  month: number,
  year: number,
  projectCode: string,
): string {
  const routeValue = `/${month}/${year}/project/${encodeURIComponent(projectCode)}`;
  if (ROUTE_PROJECT_SEGMENT_PATTERN.test(url)) {
    return url.replace(ROUTE_PROJECT_SEGMENT_PATTERN, `$1${routeValue}`);
  }

  if (url.includes('#timesheet-my?')) {
    return `${url}&${routeValue}`;
  }

  if (url.includes('#timesheet-my')) {
    return `${url}?${routeValue}`;
  }

  return `${url}${url.includes('?') ? '&' : '?'}${routeValue}`;
}

async function waitForTabReady(tabId: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < PROJECT_NAVIGATION_TIMEOUT_MS) {
    const tab = await chrome.tabs.get(tabId);
    const busy = await getSAPBusyStateForTab(tabId);
    if (tab.status === 'complete' && !busy) {
      return;
    }

    await sleep(PROJECT_NAVIGATION_POLL_INTERVAL_MS);
  }

  throw new Error('Navigatie naar projectpagina duurde te lang.');
}

export async function navigateToProject(
  tabId: number,
  month: number,
  year: number,
  projectCode: string,
): Promise<void> {
  const currentTab = await chrome.tabs.get(tabId);
  const tabUrl = currentTab.url;
  if (!tabUrl) {
    throw new Error('Kan niet navigeren zonder huidige tab-URL.');
  }

  const targetUrl = buildTimesheetUrlForProject(
    tabUrl,
    month,
    year,
    projectCode,
  );
  if (targetUrl === tabUrl) {
    return;
  }

  await chrome.tabs.update(tabId, { url: targetUrl });
  await waitForTabReady(tabId);
}

function uniqueSortedDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
}

export function addFailedDatesForProject(
  failedDatesByProject: Map<string, string[]>,
  projectCode: string,
  dates: string[],
): void {
  if (dates.length === 0) {
    return;
  }

  const existingDates = failedDatesByProject.get(projectCode) ?? [];
  existingDates.push(...dates);
  failedDatesByProject.set(projectCode, existingDates);
}

function buildAppliedSchedulesLine(schedules: WeeklySchedule[]): string {
  const scheduleLabels = schedules.map((schedule) => schedule.label);
  return scheduleLabels.length === 1
    ? `Schema toegepast: ${scheduleLabels[0]}.`
    : `Schema's toegepast: ${scheduleLabels.join(', ')}.`;
}

function buildFailedDatesLines(
  failedDatesByProject: Map<string, string[]>,
): string[] {
  if (failedDatesByProject.size === 0) {
    return [];
  }

  const lines = ['Mislukt per project:'];
  failedDatesByProject.forEach((dates, projectName) => {
    lines.push(`- ${projectName}: ${uniqueSortedDates(dates).join(', ')}.`);
  });

  return lines;
}

export function buildApplyStatusMessage(
  schedules: WeeklySchedule[],
  appliedDaysCount: number,
  totalDaysCount: number,
  failedDatesByProject: Map<string, string[]>,
  submissionAttemptedCount: number,
  submissionConfirmedCount: number,
): string {
  const parts = [
    buildAppliedSchedulesLine(schedules),
    `${appliedDaysCount}/${totalDaysCount} dagen bijgewerkt.`,
    ...buildFailedDatesLines(failedDatesByProject),
  ];

  if (submissionAttemptedCount === 0) {
    parts.push('SAP bevestiging: geen submit uitgevoerd.');
  } else if (submissionConfirmedCount === submissionAttemptedCount) {
    parts.push(
      `SAP bevestiging: ontvangen (${submissionConfirmedCount}/${submissionAttemptedCount}).`,
    );
  } else {
    parts.push(
      `SAP bevestiging: gedeeltelijk (${submissionConfirmedCount}/${submissionAttemptedCount}).`,
    );
  }

  return parts.join('\n');
}

export async function autofillScheduleEntries(
  tabId: number,
  schedule: WeeklySchedule,
  month: number,
  year: number,
): Promise<ScheduleAutofillSummary> {
  const entries = expandWeeklyScheduleToMonthEntries(schedule, month, year);
  const totalDaysCount = entries.length;
  if (totalDaysCount === 0) {
    return {
      totalDaysCount,
      appliedDaysCount: 0,
      failedDates: [],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: `Geen toepasbare dagen gevonden voor schema ${schedule.label} in periode ${month}/${year}.`,
    };
  }

  const result = await autofillEntriesViaUi5(
    tabId,
    entries.map((entry) => ({ date: entry.date, hours: entry.hours })),
  );

  return {
    totalDaysCount,
    appliedDaysCount: result.error ? 0 : result.appliedDaysCount,
    failedDates: result.error
      ? entries.map((entry) => entry.date)
      : result.failedDates,
    submissionAttempted: result.submissionAttempted,
    submissionConfirmed: result.submissionConfirmed,
    error: result.error,
  };
}
