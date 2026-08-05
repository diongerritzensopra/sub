/**
 * Popup script — UI interactions for SAP My Timesheet hour booking.
 */

import type { CachedTimesheetSnapshot, TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';
import { getSAPBusyStateForTab, initBusyStateListener } from '../shared/busy-state';
import {
  getCachedTimesheetSnapshot,
  setCachedTimesheetSnapshot,
  clearCachedTimesheetSnapshot,
  getSchedules,
  saveSchedule,
  deleteSchedule,
  isCacheStale,
  getCachedStatusMessage,
  setCachedStatusMessage,
  clearCachedStatusMessage,
} from '../shared/storage';
import { expandWeeklyScheduleToMonthEntries } from '../shared/schedule-expansion';
import { readTimesheetSnapshotViaUi5 } from './ui5-scripting';
import {
  navigateToProject,
  autofillScheduleEntries,
  addFailedDatesForProject,
  buildApplyStatusMessage,
} from './schedule-apply';
import { getPopupDomRefs } from './popup-dom';
import {
  STATUS_MESSAGE_MAX_AGE_MS,
  getSchedulesToApply,
  isSapTimesheetEditable,
  isSnapshotComplete,
  resolveValidationPeriod,
} from './popup-model';
import {
  renderSnapshot as renderSnapshotCore,
  renderSchedules as renderSchedulesCore,
  showScheduleForm as showScheduleFormCore,
  hideScheduleForm as hideScheduleFormCore,
  updateAddScheduleButtonState,
  updateApplySchedulesButtonState,
  setScrapeButtonState,
  renderStatusMessage,
} from './popup-render';

const LOCKED_TIMESHEET_MESSAGE = 'De timesheet is vergrendeld. Uren boeken en indienen is uitgeschakeld.';

// Popup state
const dom = getPopupDomRefs(document);
let isCachedData = false;
let snapshotTimestampIso: string | null = null;
let currentSnapshot: TimesheetSnapshot | null = null;
let renderedSchedules: WeeklySchedule[] = [];
let isTimesheetApplyAllowed = false;
const selectedScheduleIds = new Set<string>();

// Event listeners
dom.btnScrape.addEventListener('click', () => {
  void analyseActiveTab();
});

dom.statusDismissButton.addEventListener('click', () => {
  dismissStatus();
});

dom.addScheduleButton.addEventListener('click', () => {
  openScheduleFormFromLatestSnapshot();
});

dom.applySchedulesButton.addEventListener('click', () => {
  void applySchedulesFromSelection();
});

// Form submission
dom.scheduleForm.addEventListener('submit', (e) => {
  e.preventDefault();
  void handleScheduleFormSubmit();
});

dom.scheduleFormCancel.addEventListener('click', () => {
  hideScheduleFormCore(dom);
});

// Initialize busy-state listener and auto-analyze on ready
initBusyStateListener((busy) => {
  if (!busy) {
    void analyseActiveTab();
  }
});

updateAddScheduleButtonState(dom, false);
setTimesheetApplyAllowedState(false);

void bootstrapPopup();

async function bootstrapPopup(): Promise<void> {
  await reloadSchedulesDisplay();
  await renderCachedSnapshotIfAvailable();
  await analyseActiveTab();
}

async function reloadSchedulesDisplay(): Promise<void> {
  const schedules = await getSchedules();
  renderedSchedules = schedules;
  const availableIds = new Set(schedules.map((schedule) => schedule.id));
  Array.from(selectedScheduleIds).forEach((id) => {
    if (!availableIds.has(id)) {
      selectedScheduleIds.delete(id);
    }
  });

  renderSchedulesCore(
    dom,
    schedules,
    selectedScheduleIds,
    (scheduleId) => {
      if (selectedScheduleIds.has(scheduleId)) {
        selectedScheduleIds.delete(scheduleId);
      } else {
        selectedScheduleIds.add(scheduleId);
      }
      updateApplySchedulesButtonState(
        dom,
        !isTimesheetApplyAllowed,
        selectedScheduleIds.size > 0,
        renderedSchedules.length,
        currentSnapshot?.month !== null && currentSnapshot?.year !== null,
      );
    },
    openScheduleFormForEdit,
    handleDeleteSchedule,
  );

  updateApplySchedulesButtonState(
    dom,
    !isTimesheetApplyAllowed,
    selectedScheduleIds.size > 0,
    renderedSchedules.length,
    currentSnapshot?.month !== null && currentSnapshot?.year !== null,
  );
}

// Form state
let scheduleBeingEdited: WeeklySchedule | null = null;

async function handleScheduleFormSubmit(): Promise<void> {
  if (!currentSnapshot) {
    setStatus('Geen project beschikbaar. Ververs alstublieft de pagina.');
    return;
  }

  const label = dom.scheduleLabelInput.value.trim();
  const projectCode = dom.scheduleProjectSelect.value;

  if (!label || !projectCode) {
    setStatus('Vul alstublieft alle vereiste velden in.');
    return;
  }

  const hoursInputs = dom.hoursInputs;
  const hoursPerWeekday = {
    monday: Number(hoursInputs.monday.value) || 0,
    tuesday: Number(hoursInputs.tuesday.value) || 0,
    wednesday: Number(hoursInputs.wednesday.value) || 0,
    thursday: Number(hoursInputs.thursday.value) || 0,
    friday: Number(hoursInputs.friday.value) || 0,
    saturday: Number(hoursInputs.saturday.value) || 0,
    sunday: Number(hoursInputs.sunday.value) || 0,
  };

  try {
    const scheduleId = scheduleBeingEdited?.id || crypto.randomUUID?.() || Date.now().toString();
    const isEditing = Boolean(scheduleBeingEdited);

    const schedule: WeeklySchedule = {
      id: scheduleId,
      label,
      projectCode,
      hoursPerWeekday,
    };

    await saveSchedule(schedule);
    await reloadSchedulesDisplay();
    hideScheduleFormCore(dom);
    const action = isEditing ? 'bijgewerkt' : 'opgeslagen';
    setStatus(`Schema ${action}`);
    setTimeout(() => setStatus(''), 2000);
  } catch (err) {
    setStatus(`Fout bij opslaan: ${(err as Error).message}`);
  }
}

function openScheduleFormForEdit(schedule: WeeklySchedule): void {
  if (!currentSnapshot) {
    setStatus('Analyseer eerst de huidige timesheet voordat je een schema bewerkt.');
    return;
  }

  scheduleBeingEdited = schedule;
  showScheduleFormCore(dom, currentSnapshot, schedule);
}

function setTimesheetApplyAllowedState(editable: boolean): void {
  isTimesheetApplyAllowed = editable;
  updateApplySchedulesButtonState(
    dom,
    !editable,
    selectedScheduleIds.size > 0,
    renderedSchedules.length,
    currentSnapshot?.month !== null && currentSnapshot?.year !== null,
  );
}

async function applySchedulesFromSelection(): Promise<void> {
  try {
    if (!isTimesheetApplyAllowed) {
      throw new Error(LOCKED_TIMESHEET_MESSAGE);
    }

    if (!currentSnapshot || currentSnapshot.month === null || currentSnapshot.year === null) {
      throw new Error('Kan niet toepassen zonder geldige periode. Analyseer eerst de timesheet.');
    }

    const month = currentSnapshot.month;
    const year = currentSnapshot.year;

    const schedulesToApply = getSchedulesToApply(renderedSchedules, selectedScheduleIds);
    if (schedulesToApply.length === 0) {
      throw new Error('Geen schema\'s beschikbaar om toe te passen.');
    }

    // Validate selected projects against the currently available SAP navigation projects
    // before requiring an active tab or starting any navigation/autofill operations.
    for (const schedule of schedulesToApply) {
      if (!currentSnapshot.projectCodes.includes(schedule.projectCode)) {
        throw new Error(`Project ${schedule.projectCode} is niet beschikbaar in het SAP navigatiemenu.`);
      }
    }

    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      throw new Error('Geen actief tabblad gevonden.');
    }

    if (!isTimesheetTab(activeTab)) {
      throw new Error('Het actieve tabblad is geen SAP My Timesheet pagina.');
    }

    updateApplySchedulesButtonState(
      dom,
      !isTimesheetApplyAllowed,
      selectedScheduleIds.size > 0,
      renderedSchedules.length,
      currentSnapshot?.month !== null && currentSnapshot?.year !== null,
      true, // isApplying
    );

    let totalDaysCount = 0;
    let appliedDaysCount = 0;
    const failedDatesByProject = new Map<string, string[]>();
    let submissionAttemptedCount = 0;
    let submissionConfirmedCount = 0;
    const scheduleErrors: string[] = [];

    for (const schedule of schedulesToApply) {
      try {
        await navigateToProject(activeTab.id, month, year, schedule.projectCode);
        const summary = await autofillScheduleEntries(activeTab.id, schedule, month, year);

        totalDaysCount += summary.totalDaysCount;
        appliedDaysCount += summary.appliedDaysCount;
        addFailedDatesForProject(failedDatesByProject, schedule.projectCode, summary.failedDates);
        if (summary.submissionAttempted) {
          submissionAttemptedCount += 1;
        }
        if (summary.submissionConfirmed) {
          submissionConfirmedCount += 1;
        }
        if (summary.error) {
          scheduleErrors.push(`${schedule.projectCode}: ${summary.error}`);
        }
      } catch (error) {
        const scheduleEntries = expandWeeklyScheduleToMonthEntries(schedule, month, year);
        totalDaysCount += scheduleEntries.length;
        addFailedDatesForProject(failedDatesByProject, schedule.projectCode, scheduleEntries.map((entry) => entry.date));
        scheduleErrors.push(`${schedule.projectCode}: ${(error as Error).message}`);
      }
    }

    let statusMessage = buildApplyStatusMessage(
      schedulesToApply,
      appliedDaysCount,
      totalDaysCount,
      failedDatesByProject,
      submissionAttemptedCount,
      submissionConfirmedCount,
    );

    if (scheduleErrors.length > 0) {
      statusMessage += `\nFouten:\n- ${scheduleErrors.join('\n- ')}`;
    }

    setStatus(statusMessage, true);
  } catch (error) {
    setStatus(`Fout: ${(error as Error).message}`, true);
  } finally {
    updateApplySchedulesButtonState(
      dom,
      !isTimesheetApplyAllowed,
      selectedScheduleIds.size > 0,
      renderedSchedules.length,
      currentSnapshot?.month !== null && currentSnapshot?.year !== null,
    );
  }
}

async function handleDeleteSchedule(scheduleId: string): Promise<void> {
  try {
    await deleteSchedule(scheduleId);
    await reloadSchedulesDisplay();
  } catch (err) {
    setStatus(`Fout bij verwijderen: ${(err as Error).message}`);
  }
}

function openScheduleFormFromLatestSnapshot(): void {
  if (!currentSnapshot) {
    setStatus('Analyseer eerst de huidige timesheet voordat je een schema toevoegt.');
    return;
  }

  showScheduleFormCore(dom, currentSnapshot);
}

async function renderCachedSnapshotIfAvailable(): Promise<void> {
  const activeTab = await getActiveTab();
  const cached = await getValidCachedSnapshot(activeTab);
  if (!cached) {
    return;
  }

  isCachedData = true;
  snapshotTimestampIso = cached.cachedAt;
  renderSnapshot(cached.snapshot, isSnapshotComplete(cached.snapshot), false);
}

/**
 * Test-compatible wrapper for renderSnapshot.
 * Takes just a snapshot and optional flags (old API), internally uses dom refs.
 */
export function renderSnapshot(
  snapshot: TimesheetSnapshot,
  hasAllData: boolean = false,
  syncEditability: boolean = true,
): void {
  currentSnapshot = snapshot;
  if (syncEditability) {
    setTimesheetApplyAllowedState(isSapTimesheetEditable(snapshot.sapStatus));
  }
  updateAddScheduleButtonState(dom, currentSnapshot !== null);
  updateApplySchedulesButtonState(
    dom,
    !isTimesheetApplyAllowed,
    selectedScheduleIds.size > 0,
    renderedSchedules.length,
    currentSnapshot?.month !== null && currentSnapshot?.year !== null,
  );

  renderSnapshotCore(
    dom,
    snapshot,
    hasAllData,
    isCachedData,
    snapshotTimestampIso,
  );
}

async function analyseActiveTab(): Promise<void> {
  setScrapeButtonState(dom, true);

  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      throw new Error('Geen actief tabblad gevonden.');
    }

    if (!isTimesheetTab(activeTab)) {
      throw new Error('Het actieve tabblad is geen SAP My Timesheet pagina.');
    }

    const cachedSnapshot = await getValidCachedSnapshot(activeTab);
    const hasCachedData = cachedSnapshot !== undefined;
    if (!hasCachedData) {
      setStatus('Pagina analyseren...');
    }

    const isPageLoading = activeTab.status === 'loading' || await getSAPBusyStateForTab(activeTab.id);
    if (isPageLoading) {
      if (!hasCachedData) {
        throw new Error('De pagina laadt nog. Probeer het over een moment opnieuw.');
      }
      setStatus('Pagina laadt nog, gegevens kunnen verouderd zijn...');
      return;
    }

    const scrapedSnapshot = await readTimesheetSnapshotViaUi5(activeTab.id);
    const scrapedIsComplete = isSnapshotComplete(scrapedSnapshot);
    const timesheetIsEditable = isSapTimesheetEditable(scrapedSnapshot.sapStatus);
    snapshotTimestampIso = new Date().toISOString();
    isCachedData = false;
    renderSnapshot(scrapedSnapshot, scrapedIsComplete);

    // Write-through: persist fresh snapshot to cache only when it improves on
    // what is already cached (don't downgrade complete → partial)
    const cachedIsComplete = cachedSnapshot ? isSnapshotComplete(cachedSnapshot.snapshot) : false;
    if (!cachedIsComplete || scrapedIsComplete) {
      await setCachedTimesheetSnapshot({
        snapshot: scrapedSnapshot,
        cachedAt: snapshotTimestampIso,
      });
    }

    if (!timesheetIsEditable) {
      setStatus(LOCKED_TIMESHEET_MESSAGE);
      return;
    }

    const restoredCachedStatus = await restoreCachedStatusMessage();
    if (!restoredCachedStatus) {
      setStatus('');
    }
  } catch (err) {
    setStatus(`Fout: ${(err as Error).message}`);
  } finally {
    setScrapeButtonState(dom, false);
  }
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function isTimesheetTab(tab: chrome.tabs.Tab | undefined): boolean {
  return (tab?.url ?? '').includes(SAP_TIMESHEET_URL_PATTERN);
}

async function getValidCachedSnapshot(tab: chrome.tabs.Tab | undefined): Promise<CachedTimesheetSnapshot | undefined> {
  const cached = await getCachedTimesheetSnapshot();
  if (!cached) {
    return undefined;
  }

  if (isCacheStale(cached, resolveValidationPeriod(tab))) {
    await clearCachedTimesheetSnapshot();
    return undefined;
  }

  return cached;
}

export function setStatus(message: string, persist: boolean = false): void {
  renderStatusMessage(dom, message, persist && message.length > 0);
  if (!message) {
    if (persist) {
      void clearCachedStatusMessage();
    }
  } else if (persist) {
    void setCachedStatusMessage({ message, cachedAt: new Date().toISOString() });
  }
}

function dismissStatus(): void {
  setStatus('', true);
}

async function restoreCachedStatusMessage(): Promise<boolean> {
  const cached = await getCachedStatusMessage();
  if (!cached) {
    return false;
  }

  const cachedAt = new Date(cached.cachedAt);
  if (Number.isNaN(cachedAt.getTime())) {
    await clearCachedStatusMessage();
    return false;
  }

  if (Date.now() - cachedAt.getTime() > STATUS_MESSAGE_MAX_AGE_MS) {
    await clearCachedStatusMessage();
    return false;
  }

  renderStatusMessage(dom, cached.message, true);
  return true;
}

// Re-export render functions for backward-compatibility with tests
export { formatHours } from './popup-render';
export { getPopupDomRefs } from './popup-dom';
export type { PopupDomRefs } from './popup-dom';
export { extractPeriodFromTimesheetUrl, isSnapshotComplete, isSapTimesheetEditable } from './popup-model';

/**
 * Test-compatible wrapper for showScheduleForm (old API).
 * Uses the internal dom refs and snapshot/schedule state.
 */
export function showScheduleForm(snapshot: TimesheetSnapshot | null, scheduleToEdit?: WeeklySchedule | null): void {
  currentSnapshot = snapshot;
  if (scheduleToEdit) {
    scheduleBeingEdited = scheduleToEdit;
  }
  showScheduleFormCore(dom, snapshot, scheduleToEdit);
}

/**
 * Test-compatible wrapper for renderSchedules (old API).
 * Uses internal dom refs and schedules from storage.
 */
export async function renderSchedules(): Promise<void> {
  await reloadSchedulesDisplay();
}
