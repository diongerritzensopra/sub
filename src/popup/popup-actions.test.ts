import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import type { PopupDomRefs } from './popup-dom';
import { getPopupDomRefs } from './popup-dom';
import type { PopupActionsContext } from './popup-actions';
import {
  analyseActiveTab,
  applySchedulesFromSelection,
  getApplyStatusLevel,
  handleDeleteSchedule,
  handleScheduleFormSubmit,
  reloadSchedulesDisplay,
  renderCachedSnapshotIfAvailable,
  renderCurrentSchedulesDisplay,
} from './popup-actions';
import { setupPopupDom } from './popup.test-helpers';
import {
  clearCachedTimesheetSnapshot,
  deleteSchedule,
  getCachedStatusMessage,
  getCachedTimesheetSnapshot,
  getSchedules,
  isCacheStale,
  saveSchedule,
  setCachedStatusMessage,
} from '../shared/storage';
import { getSAPBusyStateForTab } from '../shared/busy-state';
import {
  getActiveTab,
  getValidCachedSnapshot,
  readTimesheetSnapshotViaUi5,
  setCachedTimesheetSnapshot,
} from './popup-gateway';
import {
  addFailedDatesForProject,
  addTargetDatesForProject,
  autofillScheduleEntries,
  buildApplyStatusMessage,
  navigateToProject,
} from './schedule-apply';
import {
  getSchedulesToApply,
  isSapTimesheetEditable,
  isSnapshotComplete,
} from './popup-model';
import {
  clearScheduleApplyStates,
  hideScheduleForm,
  renderSchedules,
  setScheduleApplyState,
  setScrapeButtonState,
  updateApplySchedulesButtonState,
} from './popup-render';

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
  addTargetDatesForProject: vi.fn(),
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
  clearScheduleApplyStates: vi.fn(),
  hideScheduleForm: vi.fn(),
  renderSchedules: vi.fn(),
  setScheduleApplyState: vi.fn(),
  setScrapeButtonState: vi.fn(),
  updateApplySchedulesButtonState: vi.fn(),
}));

function createSchedule(
  id: string,
  targetCode: string = 'C001',
  targetName: string = 'Project Alpha',
): WeeklySchedule {
  return {
    id,
    label: `Schema ${id}`,
    target: { targetType: 'project', targetCode, targetLabel: targetName },
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

function createSnapshot(
  overrides: Partial<TimesheetSnapshot> = {},
): TimesheetSnapshot {
  return {
    month: 8,
    year: 2026,
    targets: [
      {
        targetType: 'project',
        targetCode: 'C001',
        targetLabel: 'Project Alpha',
      },
    ],
    totals: {
      worked: 10,
      toBePerformed: 20,
    },
    currentProjectCode: 'C001',
    sapStatus: 'editable',
    ...overrides,
  };
}

function createContext(
  overrides: Omit<Partial<PopupActionsContext>, 'state'> & {
    state?: Partial<PopupActionsContext['state']>;
  } = {},
): PopupActionsContext {
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

  vi.mocked(addTargetDatesForProject).mockImplementation(
    (datesByProject, projectCode, dates) => {
      if (dates.length === 0) {
        return;
      }
      const targetDates = datesByProject.get(projectCode) ?? new Set<string>();
      dates.forEach((date) => targetDates.add(date));
      datesByProject.set(projectCode, targetDates);
    },
  );

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

  vi.mocked(buildApplyStatusMessage).mockImplementation(() => [
    { text: 'Toegepast' },
  ]);
  vi.mocked(autofillScheduleEntries).mockResolvedValue({
    totalDaysCount: 3,
    appliedDates: ['2026-08-03', '2026-08-04', '2026-08-05'],
    failedDates: [],
    submissionAttempted: true,
    submissionConfirmed: true,
    error: undefined,
  });
  vi.mocked(navigateToProject).mockResolvedValue();
});

describe('getApplyStatusLevel', () => {
  it('returns success when everything was applied and confirmed', () => {
    expect(getApplyStatusLevel(0, 0, 2, 2)).toBe('success');
  });

  it('returns warning for failed days or missing/partial SAP confirmation', () => {
    expect(getApplyStatusLevel(0, 1, 2, 2)).toBe('warning');
    expect(getApplyStatusLevel(0, 0, 0, 0)).toBe('warning');
    expect(getApplyStatusLevel(0, 0, 2, 1)).toBe('warning');
  });

  it('returns error when any schedule reported an error', () => {
    expect(getApplyStatusLevel(1, 1, 2, 1)).toBe('error');
  });
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

    const onToggleSelection = vi.mocked(renderSchedules).mock.calls[0][3];
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

    expect(ctx.setStatus).toHaveBeenCalledWith(
      'Vul alstublieft alle vereiste velden in.',
      false,
      'warning',
    );
    expect(saveSchedule).not.toHaveBeenCalled();
  });

  it('saves a new schedule, reloads, hides form and clears status after delay', async () => {
    vi.useFakeTimers();
    const ctx = createContext();
    ctx.dom.scheduleLabelInput.value = 'Nieuw schema';
    const projectOption = document.createElement('option');
    projectOption.value = '{"targetType":"project","targetCode":"C001"}';
    projectOption.textContent = 'Project Alpha [C001]';
    ctx.dom.scheduleProjectSelect.appendChild(projectOption);
    ctx.dom.scheduleProjectSelect.value = projectOption.value;
    ctx.dom.hoursInputs.monday.value = '6.5';

    await handleScheduleFormSubmit(ctx);

    expect(saveSchedule).toHaveBeenCalledTimes(1);
    const savedSchedule = vi.mocked(saveSchedule).mock.calls[0][0];
    expect(savedSchedule.label).toBe('Nieuw schema');
    expect(savedSchedule.target).toEqual({
      targetType: 'project',
      targetCode: 'C001',
      targetLabel: 'Project Alpha',
    });
    expect(savedSchedule.hoursPerWeekday.monday).toBe(6.5);

    expect(hideScheduleForm).toHaveBeenCalledWith(ctx.dom);
    expect(ctx.setStatus).toHaveBeenCalledWith(
      'Schema opgeslagen',
      false,
      'success',
    );

    vi.advanceTimersByTime(2000);
    expect(ctx.setStatus).toHaveBeenCalledWith('');
  });

  it('saves a general-hours schedule with the correct target metadata', async () => {
    const ctx = createContext({
      state: {
        currentSnapshot: createSnapshot({
          targets: [
            {
              targetType: 'project',
              targetCode: 'C001',
              targetLabel: 'Project Alpha',
            },
            {
              targetType: 'general-hours',
              targetCode: 'MISC',
              targetLabel: 'Commercial hours',
            },
          ],
        }),
      },
    });
    ctx.dom.scheduleLabelInput.value = 'Commerciële uren';
    const generalHoursOption = document.createElement('option');
    generalHoursOption.value =
      '{"targetType":"general-hours","targetCode":"MISC"}';
    generalHoursOption.textContent = 'Commercial hours [MISC]';
    ctx.dom.scheduleProjectSelect.appendChild(generalHoursOption);
    ctx.dom.scheduleProjectSelect.value = generalHoursOption.value;
    ctx.dom.hoursInputs.tuesday.value = '2';

    await handleScheduleFormSubmit(ctx);

    expect(saveSchedule).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveSchedule).mock.calls[0][0].target).toEqual({
      targetType: 'general-hours',
      targetCode: 'MISC',
      targetLabel: 'Commercial hours',
    });
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
    expect(ctx.renderSnapshot).toHaveBeenCalledWith(
      cachedSnapshot,
      true,
      false,
    );
  });
});

describe('analyseActiveTab', () => {
  it('always restores scrape button state even when analysis fails early', async () => {
    const ctx = createContext();
    vi.mocked(getActiveTab).mockResolvedValue(undefined);

    await analyseActiveTab(ctx);

    expect(setScrapeButtonState).toHaveBeenNthCalledWith(1, ctx.dom, true);
    expect(setScrapeButtonState).toHaveBeenNthCalledWith(2, ctx.dom, false);
    expect(ctx.setStatus).toHaveBeenCalledWith(
      'Geen actief tabblad gevonden.',
      false,
      'error',
    );
  });

  it('warns while the page is loading without cached data', async () => {
    const ctx = createContext();
    vi.mocked(getSAPBusyStateForTab).mockResolvedValue(true);

    await analyseActiveTab(ctx);

    expect(ctx.setStatus).toHaveBeenCalledWith(
      'De pagina laadt nog. Probeer het over een moment opnieuw.',
      false,
      'warning',
    );
    expect(readTimesheetSnapshotViaUi5).not.toHaveBeenCalled();
    expect(setScrapeButtonState).toHaveBeenNthCalledWith(2, ctx.dom, false);
  });

  it('warns that cached data may be stale while the page is loading', async () => {
    const ctx = createContext();
    vi.mocked(getValidCachedSnapshot).mockResolvedValue({
      snapshot: createSnapshot(),
      cachedAt: '2026-08-20T09:00:00.000Z',
    });
    vi.mocked(getSAPBusyStateForTab).mockResolvedValue(true);

    await analyseActiveTab(ctx);

    expect(ctx.setStatus).toHaveBeenCalledWith(
      'Pagina laadt nog, gegevens kunnen verouderd zijn...',
      false,
      'warning',
    );
    expect(readTimesheetSnapshotViaUi5).not.toHaveBeenCalled();
  });

  it('shows a warning for a locked timesheet after rendering the snapshot', async () => {
    const ctx = createContext();
    const snapshot = createSnapshot({ sapStatus: 'locked' });
    vi.mocked(readTimesheetSnapshotViaUi5).mockResolvedValue(snapshot);
    vi.mocked(isSapTimesheetEditable).mockReturnValue(false);

    await analyseActiveTab(ctx);

    expect(ctx.renderSnapshot).toHaveBeenCalledWith(snapshot, true);
    expect(ctx.setStatus).toHaveBeenCalledWith(
      'De timesheet is vergrendeld. Uren boeken en indienen is uitgeschakeld.',
      false,
      'warning',
    );
    expect(ctx.restoreCachedStatusMessage).not.toHaveBeenCalled();
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
  it('does not report updated dates for failed or unchanged schedules', async () => {
    const ctx = createContext();
    const scheduleA = createSchedule('a', 'C001');
    const scheduleB = createSchedule('b', 'C001');
    ctx.state.renderedSchedules = [scheduleA, scheduleB];
    ctx.state.selectedScheduleIds = new Set(['a', 'b']);
    vi.mocked(getSchedulesToApply).mockReturnValue([scheduleA, scheduleB]);
    vi.mocked(autofillScheduleEntries)
      .mockResolvedValueOnce({
        totalDaysCount: 31,
        appliedDates: [],
        failedDates: ['2026-08-01'],
        submissionAttempted: false,
        submissionConfirmed: false,
        error: 'SAP fout',
      })
      .mockResolvedValueOnce({
        totalDaysCount: 31,
        appliedDates: [],
        failedDates: [],
        submissionAttempted: false,
        submissionConfirmed: false,
      });

    await applySchedulesFromSelection(ctx);

    const calls = vi.mocked(addTargetDatesForProject).mock.calls;
    const appliedDateCalls = [calls[0], calls[2]];
    expect(calls).toHaveLength(4);
    expect(appliedDateCalls[0][0]).toBe(appliedDateCalls[1][0]);
    expect(appliedDateCalls[0][1]).toBe('Project Alpha');
    expect(appliedDateCalls[1][1]).toBe('Project Alpha');
    expect(appliedDateCalls[0][2]).toEqual(appliedDateCalls[1][2]);
    expect(appliedDateCalls[0][2]).toEqual([]);
    expect(appliedDateCalls[1][2]).toEqual([]);
    expect(vi.mocked(buildApplyStatusMessage).mock.calls[0][1]).toBe(
      appliedDateCalls[0][0],
    );
    expect(vi.mocked(buildApplyStatusMessage).mock.calls[0][1]).toEqual(
      new Map(),
    );
    expect(vi.mocked(buildApplyStatusMessage).mock.calls[0][3]).toBe(
      calls[1][0],
    );
  });

  it('blocks apply when timesheet is locked', async () => {
    const ctx = createContext();
    ctx.state.isTimesheetApplyAllowed = false;

    await applySchedulesFromSelection(ctx);

    expect(ctx.setStatus).toHaveBeenCalledWith(
      'De timesheet is vergrendeld. Uren boeken en indienen is uitgeschakeld.',
      true,
      'error',
    );
    expect(getActiveTab).not.toHaveBeenCalled();
  });

  it('blocks apply when no schedule is selected', async () => {
    const ctx = createContext();
    const schedule = createSchedule('a', 'C001');
    ctx.state.renderedSchedules = [schedule];
    ctx.state.selectedScheduleIds = new Set<string>();

    await applySchedulesFromSelection(ctx);

    expect(ctx.setStatus).toHaveBeenCalledWith(
      'Selecteer minstens één schema om toe te passen.',
      true,
      'warning',
    );
    expect(getActiveTab).not.toHaveBeenCalled();
  });

  it('applies schedules and persists status message on success', async () => {
    const ctx = createContext();
    const schedule = createSchedule('a', 'C001');
    ctx.state.renderedSchedules = [schedule];
    ctx.state.selectedScheduleIds = new Set<string>(['a']);

    vi.mocked(getSchedulesToApply).mockReturnValue([schedule]);
    vi.mocked(buildApplyStatusMessage).mockImplementation(() => [
      { text: 'Alles gelukt' },
    ]);

    await applySchedulesFromSelection(ctx);

    expect(navigateToProject).toHaveBeenCalledWith(1, 8, 2026, 'C001');
    expect(autofillScheduleEntries).toHaveBeenCalledWith(1, schedule, 8, 2026);
    expect(addFailedDatesForProject).toHaveBeenCalled();
    expect(ctx.setStatus).toHaveBeenCalledWith(
      [{ text: 'Alles gelukt' }],
      true,
      'success',
    );
    expect(vi.mocked(buildApplyStatusMessage).mock.calls[0][1]).toEqual(
      new Map([
        ['Project Alpha', new Set(['2026-08-03', '2026-08-04', '2026-08-05'])],
      ]),
    );
    expect(
      Array.from(
        vi.mocked(buildApplyStatusMessage).mock.calls[0][3].values(),
      ).reduce((total, dates) => total + dates.size, 0),
    ).toBe(31);
    expect(updateApplySchedulesButtonState).toHaveBeenCalledTimes(2);
    expect(clearScheduleApplyStates).toHaveBeenCalledWith(ctx.dom);
    expect(setScheduleApplyState).toHaveBeenCalledWith(ctx.dom, 'a', 'success');
  });

  it('marks a row as warning when all days applied but SAP did not confirm', async () => {
    const ctx = createContext();
    const scheduleA = createSchedule('a', 'C001');
    const scheduleB = createSchedule('b', 'C001');
    ctx.state.renderedSchedules = [scheduleA, scheduleB];
    ctx.state.selectedScheduleIds = new Set<string>(['a', 'b']);

    vi.mocked(getSchedulesToApply).mockReturnValue([scheduleA, scheduleB]);
    vi.mocked(autofillScheduleEntries)
      .mockResolvedValueOnce({
        totalDaysCount: 3,
        appliedDates: ['2026-08-03', '2026-08-04', '2026-08-05'],
        failedDates: [],
        submissionAttempted: true,
        submissionConfirmed: false,
        error: undefined,
      })
      .mockResolvedValueOnce({
        totalDaysCount: 3,
        appliedDates: ['2026-08-03', '2026-08-04', '2026-08-05'],
        failedDates: [],
        submissionAttempted: false,
        submissionConfirmed: false,
        error: undefined,
      });

    await applySchedulesFromSelection(ctx);

    expect(setScheduleApplyState).toHaveBeenCalledWith(
      ctx.dom,
      'a',
      'warning',
      'Geen SAP bevestiging',
    );
    expect(setScheduleApplyState).toHaveBeenCalledWith(
      ctx.dom,
      'b',
      'warning',
      'Niet ingediend bij SAP',
    );
    expect(setScheduleApplyState).not.toHaveBeenCalledWith(
      ctx.dom,
      expect.any(String),
      'success',
    );
  });

  it('navigates and applies a general-hours schedule using its target code', async () => {
    const ctx = createContext({
      state: {
        currentSnapshot: createSnapshot({
          targets: [
            {
              targetType: 'project',
              targetCode: 'C001',
              targetLabel: 'Project Alpha',
            },
            {
              targetType: 'general-hours',
              targetCode: 'MISC',
              targetLabel: 'Commercial hours',
            },
          ],
        }),
      },
    });
    const schedule: WeeklySchedule = {
      id: 'gh-1',
      label: 'Algemene uren',
      target: {
        targetType: 'general-hours',
        targetCode: 'MISC',
        targetLabel: 'Commercial hours',
      },
      hoursPerWeekday: {
        monday: 2,
        tuesday: 2,
        wednesday: 2,
        thursday: 2,
        friday: 2,
        saturday: 0,
        sunday: 0,
      },
    };
    ctx.state.renderedSchedules = [schedule];
    ctx.state.selectedScheduleIds = new Set<string>(['gh-1']);

    vi.mocked(getSchedulesToApply).mockReturnValue([schedule]);
    vi.mocked(buildApplyStatusMessage).mockImplementation(() => [
      { text: 'Algemene uren toegepast' },
    ]);

    await applySchedulesFromSelection(ctx);

    expect(navigateToProject).toHaveBeenCalledWith(1, 8, 2026, 'MISC');
    expect(autofillScheduleEntries).toHaveBeenCalledWith(1, schedule, 8, 2026);
    expect(ctx.setStatus).toHaveBeenCalledWith(
      [{ text: 'Algemene uren toegepast' }],
      true,
      'success',
    );
  });

  it('adds schedule-level errors to the final status message', async () => {
    const ctx = createContext();
    const schedule = createSchedule('a', 'C001');
    ctx.state.renderedSchedules = [schedule];
    ctx.state.selectedScheduleIds = new Set<string>(['a']);

    vi.mocked(getSchedulesToApply).mockReturnValue([schedule]);
    vi.mocked(buildApplyStatusMessage).mockImplementation(() => [
      { text: 'Basisstatus' },
    ]);
    vi.mocked(autofillScheduleEntries).mockResolvedValue({
      totalDaysCount: 2,
      appliedDates: ['2026-08-02'],
      failedDates: ['2026-08-03'],
      submissionAttempted: true,
      submissionConfirmed: false,
      error: 'SAP fout',
    });

    await applySchedulesFromSelection(ctx);

    const finalCall = vi.mocked(ctx.setStatus).mock.calls.at(-1);
    expect(finalCall?.[0]).toEqual([
      { text: 'Basisstatus' },
      { label: 'Fouten:', items: ['Project Alpha: SAP fout'] },
    ]);
    expect(finalCall?.[1]).toBe(true);
    expect(finalCall?.[2]).toBe('error');
    expect(setScheduleApplyState).toHaveBeenCalledWith(
      ctx.dom,
      'a',
      'error',
      'SAP fout',
    );
  });
});
