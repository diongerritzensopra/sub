/**
 * Popup side-effect gateway.
 *
 * Centralizes Chrome/storage/UI5 calls so popup.ts can focus on orchestration.
 */

import type { CachedStatusMessage, CachedTimesheetSnapshot, TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import {
  clearCachedStatusMessage as clearCachedStatusMessageFromStorage,
  clearCachedTimesheetSnapshot as clearCachedTimesheetSnapshotFromStorage,
  deleteSchedule as deleteScheduleFromStorage,
  getCachedStatusMessage as getCachedStatusMessageFromStorage,
  getCachedTimesheetSnapshot as getCachedTimesheetSnapshotFromStorage,
  getSchedules as getSchedulesFromStorage,
  isCacheStale,
  saveSchedule as saveScheduleToStorage,
  setCachedStatusMessage as setCachedStatusMessageToStorage,
  setCachedTimesheetSnapshot as setCachedTimesheetSnapshotToStorage,
} from '../shared/storage';
import { getSAPBusyStateForTab as getSAPBusyStateForTabFromShared } from '../shared/busy-state';
import { resolveValidationPeriod } from './popup-model';
import { readTimesheetSnapshotViaUi5 as readTimesheetSnapshotViaUi5FromScripting } from './ui5-scripting';

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function getValidCachedSnapshot(tab: chrome.tabs.Tab | undefined): Promise<CachedTimesheetSnapshot | undefined> {
  const cached = await getCachedTimesheetSnapshotFromStorage();
  if (!cached) {
    return undefined;
  }

  if (isCacheStale(cached, resolveValidationPeriod(tab))) {
    await clearCachedTimesheetSnapshotFromStorage();
    return undefined;
  }

  return cached;
}

export async function getSchedules(): Promise<WeeklySchedule[]> {
  return getSchedulesFromStorage();
}

export async function saveSchedule(schedule: WeeklySchedule): Promise<void> {
  await saveScheduleToStorage(schedule);
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  await deleteScheduleFromStorage(scheduleId);
}

export async function getSAPBusyStateForTab(tabId: number): Promise<boolean> {
  return getSAPBusyStateForTabFromShared(tabId);
}

export async function readTimesheetSnapshotViaUi5(tabId: number): Promise<TimesheetSnapshot> {
  return readTimesheetSnapshotViaUi5FromScripting(tabId);
}

export async function setCachedTimesheetSnapshot(cache: CachedTimesheetSnapshot): Promise<void> {
  await setCachedTimesheetSnapshotToStorage(cache);
}

export async function getCachedStatusMessage(): Promise<CachedStatusMessage | undefined> {
  return getCachedStatusMessageFromStorage();
}

export async function setCachedStatusMessage(cache: CachedStatusMessage): Promise<void> {
  await setCachedStatusMessageToStorage(cache);
}

export async function clearCachedStatusMessage(): Promise<void> {
  await clearCachedStatusMessageFromStorage();
}
