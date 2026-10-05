/**
 * Schedule apply — navigation, autofill orchestration, and status message building.
 *
 * Contains all infrastructure for the apply flow:
 * - Tab URL-based project navigation
 * - Per-schedule autofill execution via ui5-scripting
 * - Status message composition for the popup UI
 */

import type {
  StatusListItem,
  StatusSection,
  WeeklySchedule,
} from '../shared/types';
import { getSAPBusyStateForTab } from '../shared/busy-state';
import { expandWeeklyScheduleToMonthEntries } from '../shared/schedule-expansion';
import { autofillEntriesViaUi5 } from './ui5-scripting';

const ROUTE_PROJECT_SEGMENT_PATTERN =
  /([?&])\/(1[0-2]|0?[1-9])\/(20\d{2})(?:\/project\/[^&#?]*)?/i;
const PROJECT_NAVIGATION_TIMEOUT_MS = 10_000;
const PROJECT_NAVIGATION_POLL_INTERVAL_MS = 200;

export type ScheduleAutofillSummary = {
  totalDaysCount: number;
  appliedDates: string[];
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

function sortedDates(dates: Set<string>): string[] {
  return Array.from(dates).sort((a, b) => a.localeCompare(b));
}

export function addFailedDatesForProject(
  failedDatesByProject: Map<string, Set<string>>,
  projectCode: string,
  dates: string[],
): void {
  if (dates.length === 0) {
    return;
  }

  const failedDates =
    failedDatesByProject.get(projectCode) ?? new Set<string>();
  dates.forEach((date) => failedDates.add(date));
  failedDatesByProject.set(projectCode, failedDates);
}

export function addTargetDatesForProject(
  datesByProject: Map<string, Set<string>>,
  projectCode: string,
  dates: string[],
): void {
  if (dates.length === 0) {
    return;
  }

  const targetDates = datesByProject.get(projectCode) ?? new Set<string>();
  dates.forEach((date) => targetDates.add(date));
  datesByProject.set(projectCode, targetDates);
}

function countDatesByProject(datesByProject: Map<string, Set<string>>): number {
  return Array.from(datesByProject.values()).reduce(
    (total, dates) => total + dates.size,
    0,
  );
}

function buildAppliedSchedulesSection(
  schedules: WeeklySchedule[],
): StatusSection {
  return {
    label: "Toegepaste schema's:",
    items: schedules.map((schedule) => schedule.label),
  };
}

function buildFailedDatesSection(
  failedDatesByProject: Map<string, Set<string>>,
  targetDatesByProject: Map<string, Set<string>>,
): StatusSection | undefined {
  if (failedDatesByProject.size === 0) {
    return undefined;
  }

  const items: StatusListItem[] = [];
  failedDatesByProject.forEach((failedDates, targetName) => {
    const targetDates = targetDatesByProject.get(targetName);
    if (
      targetDates &&
      targetDates.size > 0 &&
      [...targetDates].every((date) => failedDates.has(date))
    ) {
      items.push(`${targetName}: alle dagen mislukt`);
    } else {
      items.push({ text: `${targetName}:`, items: sortedDates(failedDates) });
    }
  });

  return {
    label: 'Mislukte dagen:',
    text: `${countDatesByProject(failedDatesByProject)}/${countDatesByProject(targetDatesByProject)}`,
    items,
  };
}

function buildSubmissionSection(
  submissionAttemptedCount: number,
  submissionConfirmedCount: number,
): StatusSection {
  const counts = `${submissionConfirmedCount}/${submissionAttemptedCount}`;
  let text: string;
  if (submissionAttemptedCount === 0) {
    text = `${counts} (niets ingediend)`;
  } else if (submissionConfirmedCount === submissionAttemptedCount) {
    text = `${counts} (alles ingediend)`;
  } else {
    text = `${counts} (gedeeltelijk ingediend)`;
  }

  return {
    label: 'Verwerkt door SAP:',
    text,
  };
}

export function buildApplyStatusMessage(
  schedules: WeeklySchedule[],
  appliedDatesByProject: Map<string, Set<string>>,
  failedDatesByProject: Map<string, Set<string>>,
  targetDatesByProject: Map<string, Set<string>>,
  submissionAttemptedCount: number,
  submissionConfirmedCount: number,
): StatusSection[] {
  const sections: StatusSection[] = [
    buildAppliedSchedulesSection(schedules),
    {
      label: 'Bijgewerkte dagen:',
      text: `${countDatesByProject(appliedDatesByProject)}/${countDatesByProject(targetDatesByProject)}`,
      items: Array.from(appliedDatesByProject).some(
        ([, dates]) => dates.size > 0,
      )
        ? Array.from(appliedDatesByProject, ([targetName, dates]) => ({
            text: `${targetName}:`,
            items: sortedDates(dates),
          })).filter((target) => target.items.length > 0)
        : ['Geen dagen bijgewerkt.'],
    },
  ];

  const failedDatesSection = buildFailedDatesSection(
    failedDatesByProject,
    targetDatesByProject,
  );
  if (failedDatesSection) {
    sections.push(failedDatesSection);
  }

  sections.push(
    buildSubmissionSection(submissionAttemptedCount, submissionConfirmedCount),
  );
  return sections;
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
      appliedDates: [],
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
    appliedDates: result.error ? [] : result.appliedDates,
    failedDates: result.error
      ? entries.map((entry) => entry.date)
      : result.failedDates,
    submissionAttempted: result.submissionAttempted,
    submissionConfirmed: result.submissionConfirmed,
    error: result.error,
  };
}
