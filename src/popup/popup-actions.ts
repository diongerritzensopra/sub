/**
 * Popup action orchestration.
 *
 * Coordinates popup state, gateway calls, and rendering side effects.
 */

import type {
  StatusContent,
  StatusLevel,
  TimesheetSnapshot,
  WeeklySchedule,
} from '../shared/types';
import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';
import { expandWeeklyScheduleToMonthEntries } from '../shared/schedule-expansion';
import { deleteSchedule, getSchedules, saveSchedule } from '../shared/storage';
import { getSAPBusyStateForTab } from '../shared/busy-state';
import {
  autofillScheduleEntries,
  buildApplyStatusMessage,
  navigateToProject,
} from './schedule-apply';
import type { PopupDomRefs } from './popup-dom';
import type { PopupState } from './popup-model';
import {
  findScheduleById,
  isSapTimesheetEditable,
  isSnapshotComplete,
} from './popup-model';
import {
  getActiveTab,
  getValidCachedSnapshot,
  readTimesheetSnapshotViaUi5,
  setCachedTimesheetSnapshot,
} from './popup-gateway';
import {
  clearScheduleApplyStates,
  hideScheduleForm,
  renderSchedules,
  setScheduleApplyState,
  setScrapeButtonState,
  updateApplyButtonState,
} from './popup-render';
import {
  decodeScheduleTargetSelectValue,
  getScheduleTargetDisplayName,
} from './schedule-target';

const LOCKED_TIMESHEET_MESSAGE =
  'De timesheet is vergrendeld. Uren boeken en indienen is uitgeschakeld.';

export type PopupActionsContext = {
  dom: PopupDomRefs;
  state: PopupState;
  setStatus: (
    message: StatusContent,
    persist?: boolean,
    level?: StatusLevel,
  ) => void;
  renderSnapshot: (
    snapshot: TimesheetSnapshot,
    hasAllData?: boolean,
    syncEditability?: boolean,
  ) => void;
  openScheduleFormForEdit: (schedule: WeeklySchedule) => void;
  setTimesheetApplyAllowedState: (editable: boolean) => void;
  restoreCachedStatusMessage: () => Promise<boolean>;
};

/**
 * Determine the urgency of the apply-result summary: errors win over partial
 * results (failed days or missing/partial SAP confirmation).
 */
export function getApplyStatusLevel(
  scheduleErrorCount: number,
  failedTargetCount: number,
  submissionAttemptedCount: number,
  submissionConfirmedCount: number,
): StatusLevel {
  if (scheduleErrorCount > 0) {
    return 'error';
  }

  if (
    failedTargetCount > 0 ||
    submissionAttemptedCount === 0 ||
    submissionConfirmedCount < submissionAttemptedCount
  ) {
    return 'warning';
  }

  return 'success';
}

function hasCurrentPeriod(state: PopupState): boolean {
  return (
    state.currentSnapshot?.month !== null &&
    state.currentSnapshot?.year !== null
  );
}

function syncApplyButtonState(
  ctx: PopupActionsContext,
  isApplying: boolean = false,
): void {
  updateApplyButtonState(
    ctx.dom,
    !ctx.state.isTimesheetApplyAllowed,
    ctx.state.selectedScheduleId !== null,
    ctx.state.renderedSchedules.length,
    hasCurrentPeriod(ctx.state),
    isApplying,
  );
}

function renderSchedulesFromState(ctx: PopupActionsContext): void {
  renderSchedules(
    ctx.dom,
    ctx.state.renderedSchedules,
    ctx.state.selectedScheduleId,
    (scheduleId) => {
      ctx.state.selectedScheduleId =
        ctx.state.selectedScheduleId === scheduleId ? null : scheduleId;
      syncApplyButtonState(ctx);
    },
    ctx.openScheduleFormForEdit,
    (scheduleId) => {
      void handleDeleteSchedule(ctx, scheduleId);
    },
  );
}

export async function reloadSchedulesDisplay(
  ctx: PopupActionsContext,
): Promise<void> {
  const schedules = await getSchedules();
  ctx.state.renderedSchedules = schedules;

  if (
    ctx.state.selectedScheduleId !== null &&
    !schedules.some((schedule) => schedule.id === ctx.state.selectedScheduleId)
  ) {
    ctx.state.selectedScheduleId = null;
  }

  renderSchedulesFromState(ctx);

  syncApplyButtonState(ctx);
}

export function renderCurrentSchedulesDisplay(ctx: PopupActionsContext): void {
  renderSchedulesFromState(ctx);
}

export async function handleScheduleFormSubmit(
  ctx: PopupActionsContext,
): Promise<void> {
  if (!ctx.state.currentSnapshot) {
    ctx.setStatus(
      'Geen project beschikbaar. Ververs alstublieft de pagina.',
      false,
      'error',
    );
    return;
  }

  const label = ctx.dom.scheduleLabelInput.value.trim();
  const encodedTargetValue = ctx.dom.scheduleProjectSelect.value;

  if (!label || !encodedTargetValue) {
    ctx.setStatus('Vul alstublieft alle vereiste velden in.', false, 'warning');
    return;
  }

  const selectedTarget = decodeScheduleTargetSelectValue(encodedTargetValue);
  if (!selectedTarget) {
    ctx.setStatus('Geselecteerd schema-doel is ongeldig.', false, 'error');
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
    const scheduleId =
      ctx.state.scheduleBeingEdited?.id ||
      crypto.randomUUID?.() ||
      Date.now().toString();
    const isEditing = Boolean(ctx.state.scheduleBeingEdited);

    const target = ctx.state.currentSnapshot.targets.find(
      (item) =>
        item.targetType === selectedTarget.targetType &&
        item.targetCode === selectedTarget.targetCode,
    );
    if (!target) {
      ctx.setStatus(
        'Geselecteerd schema-doel is niet meer beschikbaar.',
        false,
        'error',
      );
      return;
    }

    const schedule: WeeklySchedule = {
      id: scheduleId,
      label,
      target,
      hoursPerWeekday,
    };

    await saveSchedule(schedule);
    hideScheduleForm(ctx.dom);
    await reloadSchedulesDisplay(ctx);
    const action = isEditing ? 'bijgewerkt' : 'opgeslagen';
    ctx.setStatus(`Schema ${action}`, false, 'success');
    setTimeout(() => ctx.setStatus(''), 2000);
  } catch (err) {
    ctx.setStatus(
      `Fout bij opslaan: ${(err as Error).message}`,
      false,
      'error',
    );
  }
}

export async function applySelectedSchedule(
  ctx: PopupActionsContext,
): Promise<void> {
  if (!ctx.state.isTimesheetApplyAllowed) {
    ctx.setStatus(LOCKED_TIMESHEET_MESSAGE, true, 'error');
    return;
  }

  if (
    !ctx.state.currentSnapshot ||
    ctx.state.currentSnapshot.month === null ||
    ctx.state.currentSnapshot.year === null
  ) {
    ctx.setStatus(
      'Kan niet toepassen zonder geldige periode. Analyseer eerst de timesheet.',
      true,
      'error',
    );
    return;
  }

  const month = ctx.state.currentSnapshot.month;
  const year = ctx.state.currentSnapshot.year;

  if (ctx.state.selectedScheduleId === null) {
    ctx.setStatus('Selecteer een schema om toe te passen.', true, 'warning');
    return;
  }

  const schedule = findScheduleById(
    ctx.state.renderedSchedules,
    ctx.state.selectedScheduleId,
  );
  if (!schedule) {
    ctx.setStatus(
      'Het geselecteerde schema is niet beschikbaar om toe te passen.',
      true,
      'error',
    );
    return;
  }

  const targetLabel = getScheduleTargetDisplayName(schedule.target);
  const scheduleTarget = schedule.target;
  const isAvailable = ctx.state.currentSnapshot.targets.some(
    (item) =>
      item.targetType === scheduleTarget.targetType &&
      item.targetCode === scheduleTarget.targetCode,
  );
  if (!isAvailable) {
    const unavailableKindMessage =
      scheduleTarget.targetType === 'project'
        ? 'Project'
        : 'Algemene uren type';
    ctx.setStatus(
      `${unavailableKindMessage} "${targetLabel}" is niet beschikbaar in het SAP navigatiemenu.`,
      true,
      'error',
    );
    return;
  }

  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      ctx.setStatus('Geen actief tabblad gevonden.', true, 'error');
      return;
    }

    if (!isTimesheetTab(activeTab)) {
      ctx.setStatus(
        'Het actieve tabblad is geen SAP My Timesheet pagina.',
        true,
        'error',
      );
      return;
    }

    syncApplyButtonState(ctx, true);
    clearScheduleApplyStates(ctx.dom);
    setScheduleApplyState(ctx.dom, schedule.id, 'applying');

    const targetDates = expandWeeklyScheduleToMonthEntries(
      schedule,
      month,
      year,
    ).map((entry) => entry.date);
    let appliedDates: string[] = [];
    let failedDates: string[] = [];
    let submissionAttempted = false;
    let submissionConfirmed = false;
    let scheduleError: string | undefined;

    try {
      await navigateToProject(
        activeTab.id,
        month,
        year,
        schedule.target.targetCode,
      );
      const summary = await autofillScheduleEntries(
        activeTab.id,
        schedule,
        month,
        year,
      );

      appliedDates = summary.appliedDates;
      failedDates = summary.failedDates;
      submissionAttempted = summary.submissionAttempted;
      submissionConfirmed = summary.submissionConfirmed;
      if (summary.error) {
        scheduleError = summary.error;
        setScheduleApplyState(ctx.dom, schedule.id, 'error', summary.error);
      } else if (summary.failedDates.length > 0) {
        setScheduleApplyState(
          ctx.dom,
          schedule.id,
          'warning',
          `${summary.failedDates.length}/${summary.totalDaysCount} dagen mislukt`,
        );
      } else if (!summary.submissionAttempted) {
        setScheduleApplyState(
          ctx.dom,
          schedule.id,
          'warning',
          'Niet ingediend bij SAP',
        );
      } else if (!summary.submissionConfirmed) {
        setScheduleApplyState(
          ctx.dom,
          schedule.id,
          'warning',
          'Geen SAP bevestiging',
        );
      } else {
        setScheduleApplyState(ctx.dom, schedule.id, 'success');
      }
    } catch (error) {
      failedDates = targetDates;
      scheduleError = (error as Error).message;
      setScheduleApplyState(ctx.dom, schedule.id, 'error', scheduleError);
    }

    const statusMessage = buildApplyStatusMessage(
      schedule,
      appliedDates,
      failedDates,
      targetDates,
      submissionAttempted,
      submissionConfirmed,
    );

    if (scheduleError) {
      statusMessage.push({
        label: 'Fouten:',
        items: [`${targetLabel}: ${scheduleError}`],
      });
    }

    ctx.setStatus(
      statusMessage,
      true,
      getApplyStatusLevel(
        scheduleError ? 1 : 0,
        failedDates.length > 0 ? 1 : 0,
        Number(submissionAttempted),
        Number(submissionConfirmed),
      ),
    );
  } catch (error) {
    ctx.setStatus((error as Error).message, true, 'error');
  } finally {
    syncApplyButtonState(ctx);
  }
}

export async function handleDeleteSchedule(
  ctx: PopupActionsContext,
  scheduleId: string,
): Promise<void> {
  try {
    await deleteSchedule(scheduleId);
    await reloadSchedulesDisplay(ctx);
  } catch (err) {
    ctx.setStatus(
      `Fout bij verwijderen: ${(err as Error).message}`,
      false,
      'error',
    );
  }
}

async function runAnalyseActiveTab(ctx: PopupActionsContext): Promise<void> {
  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    ctx.setStatus('Geen actief tabblad gevonden.', false, 'error');
    return;
  }

  if (!isTimesheetTab(activeTab)) {
    ctx.setStatus(
      'Het actieve tabblad is geen SAP My Timesheet pagina.',
      false,
      'error',
    );
    return;
  }

  const cachedSnapshot = await getValidCachedSnapshot(activeTab);
  const hasCachedData = cachedSnapshot !== undefined;
  if (!hasCachedData) {
    ctx.setStatus('Pagina analyseren...');
  }

  const isPageLoading =
    activeTab.status === 'loading' ||
    (await getSAPBusyStateForTab(activeTab.id));
  if (isPageLoading) {
    if (!hasCachedData) {
      ctx.setStatus(
        'De pagina laadt nog. Probeer het over een moment opnieuw.',
        false,
        'warning',
      );
      return;
    }
    ctx.setStatus(
      'Pagina laadt nog, gegevens kunnen verouderd zijn...',
      false,
      'warning',
    );
    return;
  }

  const scrapedSnapshot = await readTimesheetSnapshotViaUi5(activeTab.id);
  const scrapedIsComplete = isSnapshotComplete(scrapedSnapshot);
  const timesheetIsEditable = isSapTimesheetEditable(scrapedSnapshot.sapStatus);
  ctx.state.snapshotTimestampIso = new Date().toISOString();
  ctx.state.isCachedData = false;
  ctx.renderSnapshot(scrapedSnapshot, scrapedIsComplete);

  const cachedIsComplete = cachedSnapshot
    ? isSnapshotComplete(cachedSnapshot.snapshot)
    : false;
  if (!cachedIsComplete || scrapedIsComplete) {
    await setCachedTimesheetSnapshot({
      snapshot: scrapedSnapshot,
      cachedAt: ctx.state.snapshotTimestampIso,
    });
  }

  if (!timesheetIsEditable) {
    ctx.setStatus(LOCKED_TIMESHEET_MESSAGE, false, 'warning');
    return;
  }

  const restoredCachedStatus = await ctx.restoreCachedStatusMessage();
  if (!restoredCachedStatus) {
    ctx.setStatus('');
  }
}

export async function renderCachedSnapshotIfAvailable(
  ctx: PopupActionsContext,
): Promise<void> {
  const activeTab = await getActiveTab();
  const cached = await getValidCachedSnapshot(activeTab);
  if (!cached) {
    return;
  }

  ctx.state.isCachedData = true;
  ctx.state.snapshotTimestampIso = cached.cachedAt;
  ctx.renderSnapshot(
    cached.snapshot,
    isSnapshotComplete(cached.snapshot),
    false,
  );
}

export async function analyseActiveTab(
  ctx: PopupActionsContext,
): Promise<void> {
  setScrapeButtonState(ctx.dom, true);

  try {
    await runAnalyseActiveTab(ctx);
  } catch (err) {
    ctx.setStatus((err as Error).message, false, 'error');
  } finally {
    setScrapeButtonState(ctx.dom, false);
  }
}

function isTimesheetTab(tab: chrome.tabs.Tab | undefined): boolean {
  return (tab?.url ?? '').includes(SAP_TIMESHEET_URL_PATTERN);
}
