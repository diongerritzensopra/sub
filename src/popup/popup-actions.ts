/**
 * Popup action orchestration.
 *
 * Coordinates popup state, gateway calls, and rendering side effects.
 */

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';
import { expandWeeklyScheduleToMonthEntries } from '../shared/schedule-expansion';
import {
  addFailedDatesForProject,
  autofillScheduleEntries,
  buildApplyStatusMessage,
  navigateToProject,
} from './schedule-apply';
import type { PopupDomRefs } from './popup-dom';
import type { PopupState } from './popup-model';
import { getSchedulesToApply, isSapTimesheetEditable, isSnapshotComplete } from './popup-model';
import {
  deleteSchedule,
  getActiveTab,
  getSAPBusyStateForTab,
  getSchedules,
  getValidCachedSnapshot,
  readTimesheetSnapshotViaUi5,
  saveSchedule,
  setCachedTimesheetSnapshot,
} from './popup-gateway';
import {
  hideScheduleForm,
  renderSchedules,
  setScrapeButtonState,
  updateApplySchedulesButtonState,
} from './popup-render';

const LOCKED_TIMESHEET_MESSAGE = 'De timesheet is vergrendeld. Uren boeken en indienen is uitgeschakeld.';

export type PopupActionsContext = {
  dom: PopupDomRefs;
  state: PopupState;
  setStatus: (message: string, persist?: boolean) => void;
  renderSnapshot: (snapshot: TimesheetSnapshot, hasAllData?: boolean, syncEditability?: boolean) => void;
  openScheduleFormForEdit: (schedule: WeeklySchedule) => void;
  setTimesheetApplyAllowedState: (editable: boolean) => void;
  restoreCachedStatusMessage: () => Promise<boolean>;
};

function hasCurrentPeriod(state: PopupState): boolean {
  return state.currentSnapshot?.month !== null && state.currentSnapshot?.year !== null;
}

function syncApplySchedulesButtonState(ctx: PopupActionsContext, isApplying: boolean = false): void {
  updateApplySchedulesButtonState(
    ctx.dom,
    !ctx.state.isTimesheetApplyAllowed,
    ctx.state.selectedScheduleIds.size > 0,
    ctx.state.renderedSchedules.length,
    hasCurrentPeriod(ctx.state),
    isApplying,
  );
}

export async function reloadSchedulesDisplay(ctx: PopupActionsContext): Promise<void> {
  const schedules = await getSchedules();
  ctx.state.renderedSchedules = schedules;

  const availableIds = new Set(schedules.map((schedule) => schedule.id));
  Array.from<string>(ctx.state.selectedScheduleIds).forEach((id) => {
    if (!availableIds.has(id)) {
      ctx.state.selectedScheduleIds.delete(id);
    }
  });

  renderSchedules(
    ctx.dom,
    schedules,
    ctx.state.selectedScheduleIds,
    (scheduleId) => {
      if (ctx.state.selectedScheduleIds.has(scheduleId)) {
        ctx.state.selectedScheduleIds.delete(scheduleId);
      } else {
        ctx.state.selectedScheduleIds.add(scheduleId);
      }
      syncApplySchedulesButtonState(ctx);
    },
    ctx.openScheduleFormForEdit,
    (scheduleId) => {
      void handleDeleteSchedule(ctx, scheduleId);
    },
  );

  syncApplySchedulesButtonState(ctx);
}

export async function handleScheduleFormSubmit(ctx: PopupActionsContext): Promise<void> {
  if (!ctx.state.currentSnapshot) {
    ctx.setStatus('Geen project beschikbaar. Ververs alstublieft de pagina.');
    return;
  }

  const label = ctx.dom.scheduleLabelInput.value.trim();
  const projectCode = ctx.dom.scheduleProjectSelect.value;

  if (!label || !projectCode) {
    ctx.setStatus('Vul alstublieft alle vereiste velden in.');
    return;
  }

  const hoursInputs = ctx.dom.hoursInputs;
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
    const scheduleId = ctx.state.scheduleBeingEdited?.id || crypto.randomUUID?.() || Date.now().toString();
    const isEditing = Boolean(ctx.state.scheduleBeingEdited);

    const schedule: WeeklySchedule = {
      id: scheduleId,
      label,
      projectCode,
      hoursPerWeekday,
    };

    await saveSchedule(schedule);
    await reloadSchedulesDisplay(ctx);
    hideScheduleForm(ctx.dom);
    const action = isEditing ? 'bijgewerkt' : 'opgeslagen';
    ctx.setStatus(`Schema ${action}`);
    setTimeout(() => ctx.setStatus(''), 2000);
  } catch (err) {
    ctx.setStatus(`Fout bij opslaan: ${(err as Error).message}`);
  }
}

export async function applySchedulesFromSelection(ctx: PopupActionsContext): Promise<void> {
  try {
    if (!ctx.state.isTimesheetApplyAllowed) {
      throw new Error(LOCKED_TIMESHEET_MESSAGE);
    }

    if (!ctx.state.currentSnapshot || ctx.state.currentSnapshot.month === null || ctx.state.currentSnapshot.year === null) {
      throw new Error('Kan niet toepassen zonder geldige periode. Analyseer eerst de timesheet.');
    }

    const month = ctx.state.currentSnapshot.month;
    const year = ctx.state.currentSnapshot.year;

    const schedulesToApply = getSchedulesToApply(ctx.state.renderedSchedules, ctx.state.selectedScheduleIds);
    if (schedulesToApply.length === 0) {
      throw new Error('Geen schema\'s beschikbaar om toe te passen.');
    }

    for (const schedule of schedulesToApply) {
      if (!ctx.state.currentSnapshot.projectCodes.includes(schedule.projectCode)) {
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

    syncApplySchedulesButtonState(ctx, true);

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

    ctx.setStatus(statusMessage, true);
  } catch (error) {
    ctx.setStatus(`Fout: ${(error as Error).message}`, true);
  } finally {
    syncApplySchedulesButtonState(ctx);
  }
}

export async function handleDeleteSchedule(ctx: PopupActionsContext, scheduleId: string): Promise<void> {
  try {
    await deleteSchedule(scheduleId);
    await reloadSchedulesDisplay(ctx);
  } catch (err) {
    ctx.setStatus(`Fout bij verwijderen: ${(err as Error).message}`);
  }
}

export async function renderCachedSnapshotIfAvailable(ctx: PopupActionsContext): Promise<void> {
  const activeTab = await getActiveTab();
  const cached = await getValidCachedSnapshot(activeTab);
  if (!cached) {
    return;
  }

  ctx.state.isCachedData = true;
  ctx.state.snapshotTimestampIso = cached.cachedAt;
  ctx.renderSnapshot(cached.snapshot, isSnapshotComplete(cached.snapshot), false);
}

export async function analyseActiveTab(ctx: PopupActionsContext): Promise<void> {
  setScrapeButtonState(ctx.dom, true);

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
      ctx.setStatus('Pagina analyseren...');
    }

    const isPageLoading = activeTab.status === 'loading' || await getSAPBusyStateForTab(activeTab.id);
    if (isPageLoading) {
      if (!hasCachedData) {
        throw new Error('De pagina laadt nog. Probeer het over een moment opnieuw.');
      }
      ctx.setStatus('Pagina laadt nog, gegevens kunnen verouderd zijn...');
      return;
    }

    const scrapedSnapshot = await readTimesheetSnapshotViaUi5(activeTab.id);
    const scrapedIsComplete = isSnapshotComplete(scrapedSnapshot);
    const timesheetIsEditable = isSapTimesheetEditable(scrapedSnapshot.sapStatus);
    ctx.state.snapshotTimestampIso = new Date().toISOString();
    ctx.state.isCachedData = false;
    ctx.renderSnapshot(scrapedSnapshot, scrapedIsComplete);

    const cachedIsComplete = cachedSnapshot ? isSnapshotComplete(cachedSnapshot.snapshot) : false;
    if (!cachedIsComplete || scrapedIsComplete) {
      await setCachedTimesheetSnapshot({
        snapshot: scrapedSnapshot,
        cachedAt: ctx.state.snapshotTimestampIso,
      });
    }

    if (!timesheetIsEditable) {
      ctx.setStatus(LOCKED_TIMESHEET_MESSAGE);
      return;
    }

    const restoredCachedStatus = await ctx.restoreCachedStatusMessage();
    if (!restoredCachedStatus) {
      ctx.setStatus('');
    }
  } catch (err) {
    ctx.setStatus(`Fout: ${(err as Error).message}`);
  } finally {
    setScrapeButtonState(ctx.dom, false);
  }
}

function isTimesheetTab(tab: chrome.tabs.Tab | undefined): boolean {
  return (tab?.url ?? '').includes(SAP_TIMESHEET_URL_PATTERN);
}
