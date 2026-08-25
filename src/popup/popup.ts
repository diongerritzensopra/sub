/**
 * Popup script — composition root for SAP My Timesheet hour booking.
 */

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';
import { initBusyStateListener } from '../shared/busy-state';
import {
  clearCachedStatusMessage,
  getCachedStatusMessage,
  setCachedStatusMessage,
} from '../shared/storage';
import { getPopupDomRefs } from './popup-dom';
import {
  STATUS_MESSAGE_MAX_AGE_MS,
  createInitialPopupState,
  isSapTimesheetEditable,
} from './popup-model';
import {
  analyseActiveTab,
  applySchedulesFromSelection,
  handleScheduleFormSubmit,
  reloadSchedulesDisplay,
  renderCurrentSchedulesDisplay,
  renderCachedSnapshotIfAvailable,
  type PopupActionsContext,
} from './popup-actions';
import {
  renderSnapshot as renderSnapshotCore,
  showScheduleForm as showScheduleFormCore,
  hideScheduleForm,
  updateAddScheduleButtonState,
  updateApplySchedulesButtonState,
  renderStatusMessage,
} from './popup-render';

// Popup state
const dom = getPopupDomRefs(document);
const state = createInitialPopupState();

function createActionsContext(): PopupActionsContext {
  return {
    dom,
    state,
    setStatus,
    renderSnapshot,
    openScheduleFormForEdit,
    setTimesheetApplyAllowedState,
    restoreCachedStatusMessage,
  };
}

// Event listeners
dom.btnScrape.addEventListener('click', () => {
  void analyseActiveTab(createActionsContext());
});

dom.statusDismissButton.addEventListener('click', () => {
  setStatus('', true);
});

dom.addScheduleButton.addEventListener('click', () => {
  openScheduleFormFromLatestSnapshot();
});

dom.applySchedulesButton.addEventListener('click', () => {
  void applySchedulesFromSelection(createActionsContext());
});

// Form submission
dom.scheduleForm.addEventListener('submit', (e) => {
  e.preventDefault();
  void handleScheduleFormSubmit(createActionsContext());
});

dom.scheduleFormCancel.addEventListener('click', () => {
  hideScheduleForm(dom);
});

// Initialize busy-state listener and auto-analyze on ready
initBusyStateListener((busy) => {
  if (!busy) {
    void analyseActiveTab(createActionsContext());
  }
});

updateAddScheduleButtonState(dom, false);
setTimesheetApplyAllowedState(false);

void (async () => {
  await reloadSchedulesDisplay(createActionsContext());
  await renderCachedSnapshotIfAvailable(createActionsContext());
  await analyseActiveTab(createActionsContext());
})();

function openScheduleFormForEdit(schedule: WeeklySchedule): void {
  if (!state.currentSnapshot) {
    setStatus('Analyseer eerst de huidige timesheet voordat je een schema bewerkt.');
    return;
  }

  state.scheduleBeingEdited = schedule;
  showScheduleFormCore(dom, state.currentSnapshot, schedule);
}

function setTimesheetApplyAllowedState(editable: boolean): void {
  state.isTimesheetApplyAllowed = editable;
  updateApplySchedulesButtonState(
    dom,
    !editable,
    state.selectedScheduleIds.size > 0,
    state.renderedSchedules.length,
    state.currentSnapshot?.month !== null && state.currentSnapshot?.year !== null,
  );
}

function openScheduleFormFromLatestSnapshot(): void {
  if (!state.currentSnapshot) {
    setStatus('Analyseer eerst de huidige timesheet voordat je een schema toevoegt.');
    return;
  }

  state.scheduleBeingEdited = null;
  showScheduleFormCore(dom, state.currentSnapshot);
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
  state.currentSnapshot = snapshot;
  if (syncEditability) {
    setTimesheetApplyAllowedState(isSapTimesheetEditable(snapshot.sapStatus));
  }
  updateAddScheduleButtonState(dom, state.currentSnapshot !== null);
  updateApplySchedulesButtonState(
    dom,
    !state.isTimesheetApplyAllowed,
    state.selectedScheduleIds.size > 0,
    state.renderedSchedules.length,
    state.currentSnapshot?.month !== null && state.currentSnapshot?.year !== null,
  );

  renderSnapshotCore(
    dom,
    snapshot,
    hasAllData,
    state.isCachedData,
    state.snapshotTimestampIso,
  );

  renderCurrentSchedulesDisplay(createActionsContext());
}

export function isTimesheetTab(tab: chrome.tabs.Tab | undefined): boolean {
  return (tab?.url ?? '').includes(SAP_TIMESHEET_URL_PATTERN);
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

// Re-export functions for backward-compatibility with tests
export { formatHours } from './popup-render';
export { getPopupDomRefs } from './popup-dom';
export type { PopupDomRefs } from './popup-dom';
export { extractPeriodFromTimesheetUrl, isSnapshotComplete, isSapTimesheetEditable } from './popup-model';
export { getActiveTab } from './popup-gateway';

/**
 * Test-compatible wrapper for showScheduleForm (old API).
 */
export function showScheduleForm(snapshot: TimesheetSnapshot | null, scheduleToEdit?: WeeklySchedule | null): void {
  state.currentSnapshot = snapshot;
  state.scheduleBeingEdited = scheduleToEdit ?? null;
  showScheduleFormCore(dom, snapshot, scheduleToEdit);
}

/**
 * Test-compatible wrapper for renderSchedules (old API).
 */
export async function renderSchedules(): Promise<void> {
  await reloadSchedulesDisplay(createActionsContext());
}
