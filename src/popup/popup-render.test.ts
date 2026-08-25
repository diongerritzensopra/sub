import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPopupDomRefs } from './popup-dom';
import {
  formatHours,
  formatTimestampSuffix,
  hideScheduleForm,
  renderSchedules,
  renderSnapshot,
  renderStatusMessage,
  setScrapeButtonState,
  showScheduleForm,
  updateAddScheduleButtonState,
  updateApplySchedulesButtonState,
} from './popup-render';
import {
  createSchedule,
  createSnapshot,
  setupPopupDom,
} from './popup.test-helpers';

beforeEach(() => {
  setupPopupDom();
});

describe('formatHours', () => {
  it('returns dash for null values', () => {
    expect(formatHours(null)).toBe('-');
  });

  it('formats decimal values with comma and unit suffix', () => {
    expect(formatHours(7.5)).toBe('7,5 u');
    expect(formatHours(8)).toBe('8 u');
  });
});

describe('formatTimestampSuffix', () => {
  it('returns empty string for null or invalid timestamps', () => {
    expect(formatTimestampSuffix(null)).toBe('');
    expect(formatTimestampSuffix('not-a-date')).toBe('');
  });

  it('returns a formatted suffix for valid timestamps', () => {
    const timestampIso = '2026-08-05T14:30:00.000Z';
    const originalDateTimeFormat = Intl.DateTimeFormat;
    // We only force UTC in this test so the hardcoded expectation is deterministic across environments.
    const dateTimeFormatSpy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation(function (locales, options) {
        return new originalDateTimeFormat(locales, {
          ...options,
          timeZone: 'UTC',
        });
      });

    try {
      const result = formatTimestampSuffix(timestampIso);

      expect(result).toBe(' (05-08-2026, 14:30)');
    } finally {
      dateTimeFormatSpy.mockRestore();
    }
  });
});

describe('renderSnapshot', () => {
  it('renders period, project list, totals and shows summary section', () => {
    const dom = getPopupDomRefs(document);
    const snapshot = createSnapshot();

    renderSnapshot(dom, snapshot, true, false, '2026-08-05T14:30:00.000Z');

    expect(dom.periodValue.textContent).toBe('8/2026');
    expect(dom.workedHoursValue.textContent).toBe('12,5 u');
    expect(dom.toBePerformedHoursValue.textContent).toBe('30 u');
    expect(dom.summarySection.hidden).toBe(false);
    expect(dom.projectsValue.querySelectorAll('li')).toHaveLength(2);
    expect(dom.projectsValue.textContent).toContain('Project Alpha');
    expect(dom.projectsValue.textContent).toContain('Onbekend project');
  });

  it('renders missing period/totals and incomplete indicator', () => {
    const dom = getPopupDomRefs(document);
    const snapshot = createSnapshot({
      month: null,
      year: null,
      totals: { worked: null, toBePerformed: null },
      projects: [],
    });

    renderSnapshot(dom, snapshot, false, false, null);

    expect(dom.periodValue.textContent).toBe('-');
    expect(dom.workedHoursValue.textContent).toBe('-');
    expect(dom.toBePerformedHoursValue.textContent).toBe('-');
    expect(dom.scrapeStatus.hidden).toBe(false);
    expect(dom.scrapeStatus.textContent).toBe('Onvolledig');
    expect(dom.scrapeStatus.classList.contains('warning')).toBe(true);
    expect(dom.projectsValue.textContent).toBe('-');
  });

  it('renders cached origin styling and message when cached data is shown', () => {
    const dom = getPopupDomRefs(document);

    renderSnapshot(
      dom,
      createSnapshot(),
      true,
      true,
      '2026-08-05T14:30:00.000Z',
    );

    expect(dom.summarySection.classList.contains('cached-data')).toBe(true);
    expect(dom.dataOriginIndicator.classList.contains('cached')).toBe(true);
    expect(dom.dataOriginIndicator.classList.contains('fresh')).toBe(false);
    expect(dom.dataOriginIndicator.textContent).toContain('Cache gebruikt');
    expect(dom.dataOriginIndicator.hidden).toBe(false);
  });

  it('renders fresh origin styling and message when live data is shown', () => {
    const dom = getPopupDomRefs(document);

    renderSnapshot(
      dom,
      createSnapshot(),
      true,
      false,
      '2026-08-05T14:30:00.000Z',
    );

    expect(dom.summarySection.classList.contains('cached-data')).toBe(false);
    expect(dom.dataOriginIndicator.classList.contains('fresh')).toBe(true);
    expect(dom.dataOriginIndicator.classList.contains('cached')).toBe(false);
    expect(dom.dataOriginIndicator.textContent).toContain('Vers bijgewerkt');
  });
});

describe('renderSchedules', () => {
  it('shows empty state when no schedules exist', () => {
    const dom = getPopupDomRefs(document);

    renderSchedules(
      dom,
      [],
      new Set<string>(),
      new Map(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    expect(dom.schedulesEmpty.hidden).toBe(false);
    expect(dom.schedulesList.hidden).toBe(true);
    expect(dom.schedulesList.children).toHaveLength(0);
  });

  it('renders schedule rows and fallback project labels', () => {
    const dom = getPopupDomRefs(document);
    const schedules = [
      createSchedule('a', 'C001'),
      createSchedule('b', 'UNKNOWN'),
    ];

    renderSchedules(
      dom,
      schedules,
      new Set<string>(['a']),
      new Map<string, string>([['C001', 'Project Alpha']]),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    const items = dom.schedulesList.querySelectorAll('.schedule-item');
    expect(items).toHaveLength(2);
    expect(items[0].classList.contains('schedule-item--selected')).toBe(true);
    expect(items[1].textContent).toContain('Onbekend project');
    expect(dom.schedulesEmpty.hidden).toBe(true);
    expect(dom.schedulesList.hidden).toBe(false);
  });

  it('toggles selection via row click and keyboard interactions', () => {
    const dom = getPopupDomRefs(document);
    const schedules = [createSchedule('a')];
    const selected = new Set<string>();
    const onToggleSelection = vi.fn((scheduleId: string) => {
      if (selected.has(scheduleId)) {
        selected.delete(scheduleId);
      } else {
        selected.add(scheduleId);
      }
    });

    renderSchedules(
      dom,
      schedules,
      selected,
      new Map(),
      onToggleSelection,
      vi.fn(),
      vi.fn(),
    );

    const item = dom.schedulesList.querySelector(
      '.schedule-item',
    ) as HTMLLIElement;
    const content = item.querySelector('.schedule-content') as HTMLDivElement;

    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onToggleSelection).toHaveBeenCalledWith('a');
    expect(item.classList.contains('schedule-item--selected')).toBe(true);
    expect(content.getAttribute('aria-checked')).toBe('true');

    content.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(onToggleSelection).toHaveBeenCalledTimes(2);
    expect(item.classList.contains('schedule-item--selected')).toBe(false);
    expect(content.getAttribute('aria-checked')).toBe('false');
  });

  it('handles edit and delete confirmation actions', () => {
    const dom = getPopupDomRefs(document);
    const schedule = createSchedule('a');
    const onEditClick = vi.fn();
    const onDeleteConfirm = vi.fn();

    renderSchedules(
      dom,
      [schedule],
      new Set<string>(),
      new Map<string, string>([['C001', 'Project Alpha']]),
      vi.fn(),
      onEditClick,
      onDeleteConfirm,
    );

    const item = dom.schedulesList.querySelector(
      '.schedule-item',
    ) as HTMLLIElement;
    const editButton = item.querySelector(
      '.schedule-edit-button',
    ) as HTMLButtonElement;
    const deleteButton = item.querySelector(
      '.schedule-delete-button',
    ) as HTMLButtonElement;
    const actions = item.querySelector('.schedule-actions') as HTMLDivElement;
    const confirmRow = item.querySelector(
      '.schedule-confirm-delete',
    ) as HTMLDivElement;
    const confirmNo = item.querySelector(
      '.schedule-confirm-no',
    ) as HTMLButtonElement;
    const confirmYes = item.querySelector(
      '.schedule-confirm-yes',
    ) as HTMLButtonElement;

    editButton.click();
    expect(onEditClick).toHaveBeenCalledWith(schedule);

    deleteButton.click();
    expect(actions.hidden).toBe(true);
    expect(confirmRow.hidden).toBe(false);

    confirmNo.click();
    expect(actions.hidden).toBe(false);
    expect(confirmRow.hidden).toBe(true);

    deleteButton.click();
    confirmYes.click();
    expect(onDeleteConfirm).toHaveBeenCalledWith('a');
  });
});

describe('schedule form rendering', () => {
  it('hides the form when snapshot is null', () => {
    const dom = getPopupDomRefs(document);
    dom.scheduleFormSection.hidden = false;

    showScheduleForm(dom, null);

    expect(dom.scheduleFormSection.hidden).toBe(true);
  });

  it('shows form in new mode with project options and defaults', () => {
    const dom = getPopupDomRefs(document);
    const snapshot = createSnapshot();
    const submitBtn = dom.scheduleForm.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    dom.scheduleLabelInput.value = 'Old value';
    dom.hoursInputs.monday.value = '7';

    showScheduleForm(dom, snapshot);

    expect(dom.scheduleFormSection.hidden).toBe(false);
    expect(dom.scheduleFormTitle.textContent).toBe('Nieuw schema');
    expect(submitBtn.textContent).toBe('Opslaan');
    expect(dom.scheduleLabelInput.value).toBe('');
    expect(dom.hoursInputs.monday.value).toBe('0');
    expect(dom.scheduleProjectSelect.options).toHaveLength(3);
    expect(dom.scheduleProjectSelect.options[1].textContent).toBe(
      'Project Alpha [C001]',
    );
    expect(dom.scheduleProjectSelect.options[2].textContent).toBe('C002');
  });

  it('shows form in edit mode and pre-fills schedule values', () => {
    const dom = getPopupDomRefs(document);
    const submitBtn = dom.scheduleForm.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    const scheduleToEdit = createSchedule('a', 'C001');
    scheduleToEdit.label = 'Bestaand schema';
    scheduleToEdit.hoursPerWeekday.monday = 6.5;

    showScheduleForm(dom, createSnapshot(), scheduleToEdit);

    expect(dom.scheduleFormTitle.textContent).toBe('Schema bewerken');
    expect(submitBtn.textContent).toBe('Bijwerken');
    expect(dom.scheduleLabelInput.value).toBe('Bestaand schema');
    expect(dom.scheduleProjectSelect.value).toBe('C001');
    expect(dom.hoursInputs.monday.value).toBe('6.5');
  });

  it('hideScheduleForm resets and hides form', () => {
    const dom = getPopupDomRefs(document);
    dom.scheduleLabelInput.value = 'Will reset';
    dom.scheduleFormSection.hidden = false;

    hideScheduleForm(dom);

    expect(dom.scheduleLabelInput.value).toBe('');
    expect(dom.scheduleFormSection.hidden).toBe(true);
  });
});

describe('button and status rendering helpers', () => {
  it('updates add schedule button state from snapshot availability', () => {
    const dom = getPopupDomRefs(document);

    updateAddScheduleButtonState(dom, false);
    expect(dom.addScheduleButton.disabled).toBe(true);

    updateAddScheduleButtonState(dom, true);
    expect(dom.addScheduleButton.disabled).toBe(false);
  });

  it('updates apply button text, lock state and applying state', () => {
    const dom = getPopupDomRefs(document);

    updateApplySchedulesButtonState(dom, false, false, 2, true, false);
    expect(dom.applySchedulesButton.textContent).toBe('Alles toepassen');
    expect(dom.applySchedulesButton.disabled).toBe(false);
    expect(dom.applySchedulesButton.classList.contains('is-locked')).toBe(
      false,
    );
    expect(dom.applySchedulesButton.classList.contains('is-applying')).toBe(
      false,
    );

    updateApplySchedulesButtonState(dom, false, true, 2, true, false);
    expect(dom.applySchedulesButton.textContent).toBe('Toepassen');

    updateApplySchedulesButtonState(dom, true, true, 2, true, false);
    expect(dom.applySchedulesButton.disabled).toBe(true);
    expect(dom.applySchedulesButton.classList.contains('is-locked')).toBe(true);

    updateApplySchedulesButtonState(dom, false, true, 2, true, true);
    expect(dom.applySchedulesButton.textContent).toBe('Bezig...');
    expect(dom.applySchedulesButton.disabled).toBe(true);
    expect(dom.applySchedulesButton.classList.contains('is-applying')).toBe(
      true,
    );
  });

  it('updates scrape button disabled state', () => {
    const dom = getPopupDomRefs(document);

    setScrapeButtonState(dom, true);
    expect(dom.btnScrape.disabled).toBe(true);

    setScrapeButtonState(dom, false);
    expect(dom.btnScrape.disabled).toBe(false);
  });

  it('renders status text and dismiss visibility', () => {
    const dom = getPopupDomRefs(document);

    renderStatusMessage(dom, 'Bericht', true);
    expect(dom.statusMessage.textContent).toBe('Bericht');
    expect(dom.statusDismissButton.hidden).toBe(false);

    renderStatusMessage(dom, 'Nieuw', false);
    expect(dom.statusMessage.textContent).toBe('Nieuw');
    expect(dom.statusDismissButton.hidden).toBe(true);
  });
});
