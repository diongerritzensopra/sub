import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import type { PopupDomRefs } from './popup-dom';
import type { PopupActionsContext } from './popup-actions';
import { getPopupDomRefs } from './popup-dom';
import {
  analyseActiveTab,
  applySchedulesFromSelection,
  handleDeleteSchedule,
  handleScheduleFormSubmit,
  reloadSchedulesDisplay,
  renderCachedSnapshotIfAvailable,
  renderCurrentSchedulesDisplay,
} from './popup-actions';
import { setupPopupDom } from './popup.test-helpers';
import {
  deleteSchedule,
  getSchedules,
  saveSchedule,
  getCachedStatusMessage,
  setCachedStatusMessage,
  getCachedTimesheetSnapshot,
  isCacheStale,
  clearCachedTimesheetSnapshot,
} from '../shared/storage';
import { getSAPBusyStateForTab } from '../shared/busy-state';
import {
  getActiveTab,
  getValidCachedSnapshot,
  readTimesheetSnapshotViaUi5,
  setCachedTimesheetSnapshot,
} from './popup-gateway';
import { addFailedDatesForProject, autofillScheduleEntries, buildApplyStatusMessage, navigateToProject } from './schedule-apply';
import { getSchedulesToApply, isSapTimesheetEditable, isSnapshotComplete } from './popup-model';
import { hideScheduleForm, renderSchedules, setScrapeButtonState, updateApplySchedulesButtonState } from './popup-render';

vi.mock('../shared/storage', () => ({
  deleteSchedule: vi.fn(),
  getSchedules: vi.fn(),
  saveSchedule: vi.fn(),
  getCachedStatusMessage: vi.fn(),
  setCachedStatusMessage: vi.fn(),
  getCachedTimesheetSnapshot: vi.fn(),
  setCachedTimesheetSnapshot: vi.fn(),
  isCacheStale: vi.fn(),
  clearCachedTimesheetSnapshot: vi.fn(),
}));

vi.mock('../shared/busy-state', () => ({
  getSAPBusyStateForTab: vi.fn(),
}));

vi.mock('./popup-gateway', () => ({
  getActiveTab: vi.fn(),
  getValidCachedSnapshot: vi.fn(),
  readTimesheetSnapshotViaUi5: vi.fn(),
  setCachedTimesheetSnapshot: vi.fn(),
}));

vi.mock('./schedule-apply', () => ({
  addFailedDatesForProject: vi.fn(),
  autofillScheduleEntries: vi.fn(),
  buildApplyStatusMessage: vi.fn(),
  navigateToProject: vi.fn(),
}));

vi.mock('./popup-model', () => ({
  getSchedulesToApply: vi.fn(),
  isSapTimesheetEditable: vi.fn(),
  isSnapshotComplete: vi.fn(),
}));

vi.mock('./popup-render', () => ({
  hideScheduleForm: vi.fn(),
  renderSchedules: vi.fn(),
  setScrapeButtonState: vi.fn(),
  updateApplySchedulesButtonState: vi.fn(),
}));

function createSchedule(id: string, projectCode: string = 'C001'): WeeklySchedule {
  return {
    id,
    label: `Schema ${id}`,
    projectCode,
    hoursPerWeekday: {
      monday: 8,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 8,
      saturday: 0,
      sunday: 0,
    },
  };
}

function createSnapshot(overrides: Partial<TimesheetSnapshot> = {}): TimesheetSnapshot {
  return {
    month: 8,
    year: 2026,
    projects: [{ code: 'C001', name: 'Project Alpha' }],
    totals: {
      worked: 10,
      toBePerformed: 20,
    },
    currentProjectCode: 'C001',
    sapStatus: 'editable',
    ...overrides,
  };
}

function createContext(overrides: Partial<PopupActionsContext> = {}): PopupActionsContext {
  setupPopupDom();
  const dom = getPopupDomRefs(document);

  const ctx: PopupActionsContext = {
    dom,
    state: {
      isCachedData: false,
      snapshotTimestampIso: null,
      currentSnapshot: createSnapshot(),
      renderedSchedules: [],
      isTimesheetApplyAllowed: true,
      selectedScheduleIds: new Set<string>(),
      scheduleBeingEdited: null,
    },
    setStatus: vi.fn(),
    renderSnapshot: vi.fn(),
    openScheduleFormForEdit: vi.fn(),
    setTimesheetApplyAllowedState: vi.fn(),
    restoreCachedStatusMessage: vi.fn().mockResolvedValue(false),
  };

  return {
    ...ctx,
    ...overrides,
    state: {
      ...ctx.state,
      ...(overrides.state ?? {}),
    },
    dom: (overrides.dom as PopupDomRefs | undefined) ?? dom,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();

  vi.mocked(getSchedules).mockResolvedValue([]);
  vi.mocked(deleteSchedule).mockResolvedValue();
  vi.mocked(saveSchedule).mockResolvedValue();
  vi.mocked(getCachedStatusMessage).mockResolvedValue(undefined);
  vi.mocked(setCachedStatusMessage).mockResolvedValue();
  vi.mocked(clearCachedTimesheetSnapshot).mockResolvedValue();
  vi.mocked(getCachedTimesheetSnapshot).mockResolvedValue(undefined);
  vi.mocked(isCacheStale).mockReturnValue(false);

  vi.mocked(getActiveTab).mockResolvedValue({
    id: 1,
    url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
    status: 'complete',
  } as chrome.tabs.Tab);
  vi.mocked(getSAPBusyStateForTab).mockResolvedValue(false);
  vi.mocked(getValidCachedSnapshot).mockResolvedValue(undefined);
  vi.mocked(readTimesheetSnapshotViaUi5).mockResolvedValue(createSnapshot());
  vi.mocked(setCachedTimesheetSnapshot).mockResolvedValue();

  vi.mocked(getSchedulesToApply).mockImplementation((rendered) => rendered);
  vi.mocked(isSnapshotComplete).mockReturnValue(true);
  vi.mocked(isSapTimesheetEditable).mockReturnValue(true);

  vi.mocked(buildApplyStatusMessage).mockReturnValue('Toegepast');
  vi.mocked(autofillScheduleEntries).mockResolvedValue({
    totalDaysCount: 3,
    appliedDaysCount: 3,
    failedDates: [],
    submissionAttempted: true,
    submissionConfirmed: true,
    error: undefined,
  });
  vi.mocked(navigateToProject).mockResolvedValue();
});

describe('reloadSchedulesDisplay', () => {
  it('loads schedules, removes stale selections and syncs rendering/button state', async () => {
    const ctx = createContext();
    ctx.state.selectedScheduleIds = new Set(['keep', 'drop']);
    vi.mocked(getSchedules).mockResolvedValue([createSchedule('keep')]);

    await reloadSchedulesDisplay(ctx);

    expect(ctx.state.renderedSchedules).toHaveLength(1);
    expect(ctx.state.selectedScheduleIds.has('keep')).toBe(true);
    expect(ctx.state.selectedScheduleIds.has('drop')).toBe(false);
    expect(renderSchedules).toHaveBeenCalledTimes(1);
    expect(updateApplySchedulesButtonState).toHaveBeenCalledTimes(1);
  });
});

describe('renderCurrentSchedulesDisplay', () => {
  it('toggles selected ids through render callback and resyncs apply button', () => {
    const ctx = createContext();
    ctx.state.renderedSchedules = [createSchedule('a')];

    renderCurrentSchedulesDisplay(ctx);

    const onToggleSelection = vi.mocked(renderSchedules).mock.calls[0][4];
    onToggleSelection('a');
    expect(ctx.state.selectedScheduleIds.has('a')).toBe(true);

    onToggleSelection('a');
    expect(ctx.state.selectedScheduleIds.has('a')).toBe(false);
    expect(updateApplySchedulesButtonState).toHaveBeenCalledTimes(2);
  });
});

describe('handleScheduleFormSubmit', () => {
  it('validates required fields before saving', async () => {
    const ctx = createContext();
    ctx.dom.scheduleLabelInput.value = '';
    ctx.dom.scheduleProjectSelect.value = '';

    await handleScheduleFormSubmit(ctx);

    expect(ctx.setStatus).toHaveBeenCalledWith('Vul alstublieft alle vereiste velden in.');
    expect(saveSchedule).not.toHaveBeenCalled();
  });

  it('saves a new schedule, reloads, hides form and clears status after delay', async () => {
    vi.useFakeTimers();
    const ctx = createContext();
    ctx.dom.scheduleLabelInput.value = 'Nieuw schema';
    const projectOption = document.createElement('option');
    projectOption.value = 'C001';
    projectOption.textContent = 'Project Alpha [C001]';
    ctx.dom.scheduleProjectSelect.appendChild(projectOption);
    ctx.dom.scheduleProjectSelect.value = 'C001';
    ctx.dom.hoursInputs.monday.value = '6.5';

    await handleScheduleFormSubmit(ctx);

    expect(saveSchedule).toHaveBeenCalledTimes(1);
    const savedSchedule = vi.mocked(saveSchedule).mock.calls[0][0];
    expect(savedSchedule.label).toBe('Nieuw schema');
    expect(savedSchedule.projectCode).toBe('C001');
    expect(savedSchedule.hoursPerWeekday.monday).toBe(6.5);

    expect(hideScheduleForm).toHaveBeenCalledWith(ctx.dom);
    expect(ctx.setStatus).toHaveBeenCalledWith('Schema opgeslagen');

    vi.advanceTimersByTime(2000);
    expect(ctx.setStatus).toHaveBeenCalledWith('');
  });
});

describe('handleDeleteSchedule', () => {
  it('deletes schedule and reloads list', async () => {
    const ctx = createContext();

    await handleDeleteSchedule(ctx, 'to-delete');

    expect(deleteSchedule).toHaveBeenCalledWith('to-delete');
    expect(getSchedules).toHaveBeenCalledTimes(1);
  });
});

describe('renderCachedSnapshotIfAvailable', () => {
  it('returns early when there is no valid cache', async () => {
    const ctx = createContext();
    vi.mocked(getValidCachedSnapshot).mockResolvedValue(undefined);

    await renderCachedSnapshotIfAvailable(ctx);

    expect(ctx.renderSnapshot).not.toHaveBeenCalled();
  });

  it('renders cached snapshot and marks state as cached', async () => {
    const ctx = createContext();
    const cachedSnapshot = createSnapshot();
    vi.mocked(getValidCachedSnapshot).mockResolvedValue({
      snapshot: cachedSnapshot,
      cachedAt: '2026-08-20T09:00:00.000Z',
    });
    vi.mocked(isSnapshotComplete).mockReturnValue(true);

    await renderCachedSnapshotIfAvailable(ctx);

    expect(ctx.state.isCachedData).toBe(true);
    expect(ctx.state.snapshotTimestampIso).toBe('2026-08-20T09:00:00.000Z');
    expect(ctx.renderSnapshot).toHaveBeenCalledWith(cachedSnapshot, true, false);
  });
});

describe('analyseActiveTab', () => {
  it('always restores scrape button state even when analysis fails early', async () => {
    const ctx = createContext();
    vi.mocked(getActiveTab).mockResolvedValue(undefined);

    await analyseActiveTab(ctx);

    expect(setScrapeButtonState).toHaveBeenNthCalledWith(1, ctx.dom, true);
    expect(setScrapeButtonState).toHaveBeenNthCalledWith(2, ctx.dom, false);
    expect(ctx.setStatus).toHaveBeenCalledWith('Fout: Geen actief tabblad gevonden.');
  });

  it('renders fresh snapshot and updates cache when page is ready', async () => {
    const ctx = createContext();
    const snapshot = createSnapshot();
    vi.mocked(getValidCachedSnapshot).mockResolvedValue(undefined);
    vi.mocked(readTimesheetSnapshotViaUi5).mockResolvedValue(snapshot);
    vi.mocked(isSnapshotComplete).mockReturnValue(true);
    vi.mocked(isSapTimesheetEditable).mockReturnValue(true);

    await analyseActiveTab(ctx);

    expect(ctx.renderSnapshot).toHaveBeenCalledWith(snapshot, true);
    expect(setCachedTimesheetSnapshot).toHaveBeenCalledTimes(1);
    expect(ctx.state.isCachedData).toBe(false);
    expect(ctx.state.snapshotTimestampIso).not.toBeNull();
  });
});

describe('applySchedulesFromSelection', () => {
  it('blocks apply when timesheet is locked', async () => {
    const ctx = createContext();
    ctx.state.isTimesheetApplyAllowed = false;

    await applySchedulesFromSelection(ctx);

    expect(ctx.setStatus).toHaveBeenCalledWith(
      'Fout: De timesheet is vergrendeld. Uren boeken en indienen is uitgeschakeld.',
      true,
    );
    expect(getActiveTab).not.toHaveBeenCalled();
  });

  it('applies schedules and persists status message on success', async () => {
    const ctx = createContext();
    const schedule = createSchedule('a', 'C001');
    ctx.state.renderedSchedules = [schedule];

    vi.mocked(getSchedulesToApply).mockReturnValue([schedule]);
    vi.mocked(buildApplyStatusMessage).mockReturnValue('Alles gelukt');

    await applySchedulesFromSelection(ctx);

    expect(navigateToProject).toHaveBeenCalledWith(1, 8, 2026, 'C001');
    expect(autofillScheduleEntries).toHaveBeenCalledWith(1, schedule, 8, 2026);
    expect(addFailedDatesForProject).toHaveBeenCalled();
    expect(ctx.setStatus).toHaveBeenCalledWith('Alles gelukt', true);
    expect(updateApplySchedulesButtonState).toHaveBeenCalledTimes(2);
  });

  it('adds schedule-level errors to the final status message', async () => {
    const ctx = createContext();
    const schedule = createSchedule('a', 'C001');
    ctx.state.renderedSchedules = [schedule];

    vi.mocked(getSchedulesToApply).mockReturnValue([schedule]);
    vi.mocked(buildApplyStatusMessage).mockReturnValue('Basisstatus');
    vi.mocked(autofillScheduleEntries).mockResolvedValue({
      totalDaysCount: 2,
      appliedDaysCount: 1,
      failedDates: ['2026-08-03'],
      submissionAttempted: true,
      submissionConfirmed: false,
      error: 'SAP fout',
    });

    await applySchedulesFromSelection(ctx);

    const finalCall = vi.mocked(ctx.setStatus).mock.calls.at(-1);
    expect(finalCall?.[0]).toContain('Basisstatus');
    expect(finalCall?.[0]).toContain('Fouten:');
    expect(finalCall?.[0]).toContain('Project Alpha: SAP fout');
    expect(finalCall?.[1]).toBe(true);
  });
});
