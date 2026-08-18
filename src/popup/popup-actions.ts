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

function getProjectNameByCode(snapshot: TimesheetSnapshot | null): Map<string, string> {
  if (!snapshot) {
    return new Map();
  }

  return new Map(snapshot.projects.map((project) => [project.code, project.name.trim() || 'Onbekend project']));
}

function resolveProjectName(snapshot: TimesheetSnapshot, projectCode: string): string {
  return snapshot.projects.find((project) => project.code === projectCode)?.name.trim() || 'Onbekend project';
}

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

function renderSchedulesFromState(ctx: PopupActionsContext): void {
  renderSchedules(
    ctx.dom,
    ctx.state.renderedSchedules,
    ctx.state.selectedScheduleIds,
    getProjectNameByCode(ctx.state.currentSnapshot),
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

  renderSchedulesFromState(ctx);

  syncApplySchedulesButtonState(ctx);
}

export function renderCurrentSchedulesDisplay(ctx: PopupActionsContext): void {
  renderSchedulesFromState(ctx);
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
  if (!ctx.state.isTimesheetApplyAllowed) {
    ctx.setStatus(`Fout: ${LOCKED_TIMESHEET_MESSAGE}`, true);
    return;
  }

  if (!ctx.state.currentSnapshot || ctx.state.currentSnapshot.month === null || ctx.state.currentSnapshot.year === null) {
    ctx.setStatus('Fout: Kan niet toepassen zonder geldige periode. Analyseer eerst de timesheet.', true);
    return;
  }

  const month = ctx.state.currentSnapshot.month;
  const year = ctx.state.currentSnapshot.year;

  const schedulesToApply = getSchedulesToApply(ctx.state.renderedSchedules, ctx.state.selectedScheduleIds);
  if (schedulesToApply.length === 0) {
    ctx.setStatus('Fout: Geen schema\'s beschikbaar om toe te passen.', true);
    return;
  }

  for (const schedule of schedulesToApply) {
    const project = ctx.state.currentSnapshot.projects.find((item) => item.code === schedule.projectCode);
    if (!project) {
      const projectName = resolveProjectName(ctx.state.currentSnapshot, schedule.projectCode);
      ctx.setStatus(`Fout: Project "${projectName}" is niet beschikbaar in het SAP navigatiemenu.`, true);
      return;
    }
  }

  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      ctx.setStatus('Fout: Geen actief tabblad gevonden.', true);
      return;
    }

    if (!isTimesheetTab(activeTab)) {
      ctx.setStatus('Fout: Het actieve tabblad is geen SAP My Timesheet pagina.', true);
      return;
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
        const projectName = resolveProjectName(ctx.state.currentSnapshot, schedule.projectCode);

        totalDaysCount += summary.totalDaysCount;
        appliedDaysCount += summary.appliedDaysCount;
        addFailedDatesForProject(failedDatesByProject, projectName, summary.failedDates);
        if (summary.submissionAttempted) {
          submissionAttemptedCount += 1;
        }
        if (summary.submissionConfirmed) {
          submissionConfirmedCount += 1;
        }
        if (summary.error) {
          scheduleErrors.push(`${projectName}: ${summary.error}`);
        }
      } catch (error) {
        const projectName = resolveProjectName(ctx.state.currentSnapshot, schedule.projectCode);
        const scheduleEntries = expandWeeklyScheduleToMonthEntries(schedule, month, year);
        totalDaysCount += scheduleEntries.length;
        addFailedDatesForProject(failedDatesByProject, projectName, scheduleEntries.map((entry) => entry.date));
        scheduleErrors.push(`${projectName}: ${(error as Error).message}`);
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

async function runAnalyseActiveTab(ctx: PopupActionsContext): Promise<void> {
  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    ctx.setStatus('Fout: Geen actief tabblad gevonden.');
    return;
  }

  if (!isTimesheetTab(activeTab)) {
    ctx.setStatus('Fout: Het actieve tabblad is geen SAP My Timesheet pagina.');
    return;
  }

  const cachedSnapshot = await getValidCachedSnapshot(activeTab);
  const hasCachedData = cachedSnapshot !== undefined;
  if (!hasCachedData) {
    ctx.setStatus('Pagina analyseren...');
  }

  const isPageLoading = activeTab.status === 'loading' || await getSAPBusyStateForTab(activeTab.id);
  if (isPageLoading) {
    if (!hasCachedData) {
      ctx.setStatus('Fout: De pagina laadt nog. Probeer het over een moment opnieuw.');
      return;
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
    await runAnalyseActiveTab(ctx);
  } catch (err) {
    ctx.setStatus(`Fout: ${(err as Error).message}`);
  } finally {
    setScrapeButtonState(ctx.dom, false);
  }
}

function isTimesheetTab(tab: chrome.tabs.Tab | undefined): boolean {
  return (tab?.url ?? '').includes(SAP_TIMESHEET_URL_PATTERN);
}
