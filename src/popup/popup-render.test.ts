import { beforeEach, describe, expect, it, vi } from 'vitest';

import popupCss from './popup.css?raw';
import { getPopupDomRefs } from './popup-dom';
import {
  clearScheduleApplyStates,
  formatHours,
  formatPeriod,
  formatTimestampSuffix,
  hideScheduleForm,
  renderSchedules,
  renderSnapshot,
  renderStatusMessage,
  setScheduleApplyState,
  setScrapeButtonState,
  showScheduleForm,
  updateAddScheduleButtonState,
  updateApplySchedulesButtonState,
} from './popup-render';
import {
  createGeneralHoursSchedule,
  createSchedule,
  createSnapshot,
  setupPopupDom,
} from './popup.test-helpers';

beforeEach(() => {
  setupPopupDom();
});

describe('formatPeriod', () => {
  it('formats the full month name in the given locale', () => {
    expect(formatPeriod(8, 2026, 'nl-NL')).toBe('augustus 2026');
    expect(formatPeriod(8, 2026, 'en-US')).toBe('August 2026');
  });

  it('returns dash when month or year is missing', () => {
    expect(formatPeriod(null, 2026)).toBe('-');
    expect(formatPeriod(8, null)).toBe('-');
  });
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
    const dateTimeFormatSpy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation(function (locales, options) {
        return new originalDateTimeFormat(locales, {
          ...options,
          timeZone: 'UTC',
        });
      });

    try {
      expect(formatTimestampSuffix(timestampIso)).toBe(' (05-08-2026, 14:30)');
    } finally {
      dateTimeFormatSpy.mockRestore();
    }
  });
});

describe('renderSnapshot', () => {
  it('renders period and totals and shows summary section', () => {
    const dom = getPopupDomRefs(document);
    const snapshot = createSnapshot();

    renderSnapshot(dom, snapshot, true, false, '2026-08-05T14:30:00.000Z');

    expect(dom.periodValue.textContent).toBe(formatPeriod(8, 2026));
    expect(dom.workedHoursValue.textContent).toBe('12,5 u');
    expect(dom.toBePerformedHoursValue.textContent).toBe('30 u');
    expect(dom.summarySection.hidden).toBe(false);
  });

  it('renders missing period/totals and incomplete indicator', () => {
    const dom = getPopupDomRefs(document);
    const snapshot = createSnapshot({
      month: null,
      year: null,
      totals: { worked: null, toBePerformed: null },
      targets: [],
    });

    renderSnapshot(dom, snapshot, false, false, null);

    expect(dom.periodValue.textContent).toBe('-');
    expect(dom.workedHoursValue.textContent).toBe('-');
    expect(dom.toBePerformedHoursValue.textContent).toBe('-');
    expect(dom.scrapeStatus.hidden).toBe(false);
    expect(dom.scrapeStatus.textContent).toBe('Onvolledig');
    expect(dom.scrapeStatus.classList.contains('warning')).toBe(true);
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

    renderSnapshot(dom, createSnapshot(), false, true, null);
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
    expect(dom.scrapeStatus.hidden).toBe(true);
    expect(dom.scrapeStatus.classList.contains('warning')).toBe(false);
  });
});

describe('renderSchedules', () => {
  it('shows empty state when no schedules exist', () => {
    const dom = getPopupDomRefs(document);
    const style = document.createElement('style');
    style.textContent = popupCss;
    document.head.append(style);

    renderSchedules(dom, [], new Set<string>(), vi.fn(), vi.fn(), vi.fn());

    expect(dom.schedulesEmpty.hidden).toBe(false);
    expect(dom.schedulesList.hidden).toBe(true);
    expect(getComputedStyle(dom.schedulesList).display).toBe('none');
    expect(dom.schedulesList.children).toHaveLength(0);
    expect(dom.schedulesEmpty.textContent).toContain(
      "Nog geen schema's opgeslagen.",
    );
    style.remove();
  });

  it('renders schedule rows with provided target labels', () => {
    const dom = getPopupDomRefs(document);
    const schedules = [
      createSchedule('a', 'C001', 'Project Alpha'),
      createSchedule('b', 'UNKNOWN', 'Onbekend project'),
    ];

    renderSchedules(
      dom,
      schedules,
      new Set<string>(['a']),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    const items = dom.schedulesList.querySelectorAll('.schedule-item');
    expect(items).toHaveLength(2);
    expect(items[0].classList.contains('schedule-item--selected')).toBe(true);
    expect(items[1].textContent).toContain('Onbekend project');
    expect(items[1].textContent).toContain('UNKNOWN');
    expect(dom.schedulesEmpty.hidden).toBe(true);
    expect(dom.schedulesList.hidden).toBe(false);
  });

  it('toggles selection via row click and keyboard interactions', () => {
    const dom = getPopupDomRefs(document);
    const selected = new Set<string>();
    const onToggleSelection = vi.fn((scheduleId: string) => {
      if (selected.has(scheduleId)) {
        selected.delete(scheduleId);
      } else {
        selected.add(scheduleId);
      }
    });
    const schedules = [createSchedule('a')];

    renderSchedules(
      dom,
      schedules,
      selected,
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

  it('renders general-hours schedules with target type in the accessible label', () => {
    const dom = getPopupDomRefs(document);
    const schedules = [
      createGeneralHoursSchedule('gh-1', 'MISC', 'Commercial hours'),
    ];

    renderSchedules(
      dom,
      schedules,
      new Set<string>(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    const item = dom.schedulesList.querySelector(
      '.schedule-item',
    ) as HTMLLIElement;
    const content = item.querySelector('.schedule-content') as HTMLDivElement;
    expect(item.textContent).toContain('Commercial hours');
    expect(item.textContent).toContain('MISC');
    expect(content.getAttribute('aria-label')).toContain(
      'Algemene uren Commercial hours [MISC]',
    );
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

describe('setScheduleApplyState / clearScheduleApplyStates', () => {
  it('shows and hides the applying/success/error indicator on the matching row', () => {
    const dom = getPopupDomRefs(document);
    const schedules = [createSchedule('a'), createSchedule('b')];
    renderSchedules(
      dom,
      schedules,
      new Set<string>(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    setScheduleApplyState(dom, 'a', 'applying');
    const rowA = dom.schedulesList.querySelector(
      '[data-schedule-id="a"] .schedule-apply-status',
    ) as HTMLSpanElement;
    const rowB = dom.schedulesList.querySelector(
      '[data-schedule-id="b"] .schedule-apply-status',
    ) as HTMLSpanElement;
    expect(rowA.hidden).toBe(false);
    expect(rowA.textContent).toContain('⏳');
    expect(rowB.hidden).toBe(true);

    setScheduleApplyState(dom, 'a', 'error', 'SAP fout');
    expect(rowA.classList.contains('schedule-apply-status--error')).toBe(true);
    expect(rowA.textContent).toBe('❌ SAP fout');

    setScheduleApplyState(dom, 'a', 'warning', '1/2 dagen mislukt');
    expect(rowA.classList.contains('schedule-apply-status--warning')).toBe(
      true,
    );
    expect(rowA.classList.contains('schedule-apply-status--error')).toBe(false);
    expect(rowA.textContent).toBe('⚠️ 1/2 dagen mislukt');

    setScheduleApplyState(dom, 'a', null);
    expect(rowA.hidden).toBe(true);
    expect(rowA.textContent).toBe('');
  });

  it('clears every rendered row apply-state indicator', () => {
    const dom = getPopupDomRefs(document);
    const schedules = [createSchedule('a'), createSchedule('b')];
    renderSchedules(
      dom,
      schedules,
      new Set<string>(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    setScheduleApplyState(dom, 'a', 'success');
    setScheduleApplyState(dom, 'b', 'error', 'Mislukt');

    clearScheduleApplyStates(dom);

    dom.schedulesList
      .querySelectorAll('.schedule-apply-status')
      .forEach((el) => {
        expect((el as HTMLSpanElement).hidden).toBe(true);
        expect(el.textContent).toBe('');
      });
  });
});

describe('schedule form rendering', () => {
  it('hides the form when snapshot is null', () => {
    const dom = getPopupDomRefs(document);
    dom.scheduleFormSection.hidden = false;

    showScheduleForm(dom, null);

    expect(dom.scheduleFormSection.hidden).toBe(true);
  });

  it('shows form in new mode with project and general-hours options', () => {
    const dom = getPopupDomRefs(document);
    const snapshot = createSnapshot();
    const submitBtn = dom.scheduleForm.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    dom.scheduleLabelInput.value = 'Old value';
    dom.hoursInputs.monday.value = '7';

    showScheduleForm(dom, snapshot);

    expect(dom.scheduleFormSection.hidden).toBe(false);
    expect(dom.addScheduleButton.nextElementSibling).toBe(
      dom.scheduleFormSection,
    );
    expect(dom.addScheduleButton.disabled).toBe(true);
    expect(dom.scheduleFormTitle.textContent).toBe('Nieuw schema');
    expect(submitBtn.textContent).toBe('Opslaan');
    expect(dom.scheduleLabelInput.value).toBe('');
    expect(dom.hoursInputs.monday.value).toBe('0');
    expect(dom.scheduleProjectSelect.querySelectorAll('option')).toHaveLength(
      4,
    );
    expect(dom.scheduleProjectSelect.querySelectorAll('optgroup')).toHaveLength(
      2,
    );
    expect(dom.scheduleProjectSelect.options[1].value).toBe(
      '{"targetType":"project","targetCode":"C001"}',
    );
    expect(dom.scheduleProjectSelect.options[1].textContent).toBe(
      'Project Alpha [C001]',
    );
    expect(dom.scheduleProjectSelect.options[2].textContent).toBe(
      'Onbekend project [C002]',
    );
    expect(dom.scheduleProjectSelect.options[3].value).toBe(
      '{"targetType":"general-hours","targetCode":"MISC"}',
    );
    expect(dom.scheduleProjectSelect.options[3].textContent).toBe(
      'Commercial hours [MISC]',
    );
  });

  it('shows form in edit mode and pre-fills a project schedule', () => {
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
    expect(dom.scheduleProjectSelect.value).toBe(
      '{"targetType":"project","targetCode":"C001"}',
    );
    expect(dom.hoursInputs.monday.value).toBe('6.5');
  });

  it('places the edit form in its schedule row and restores its actions on close', () => {
    const dom = getPopupDomRefs(document);
    const scheduleToEdit = createSchedule('a', 'C001');
    const onToggleSelection = vi.fn();
    renderSchedules(
      dom,
      [scheduleToEdit],
      new Set<string>(),
      onToggleSelection,
      vi.fn(),
      vi.fn(),
    );

    showScheduleForm(dom, createSnapshot(), scheduleToEdit);

    const scheduleItem = dom.schedulesList.querySelector(
      '[data-schedule-id="a"]',
    ) as HTMLLIElement;
    const editButton = scheduleItem.querySelector(
      '.schedule-edit-button',
    ) as HTMLButtonElement;
    const deleteButton = scheduleItem.querySelector(
      '.schedule-delete-button',
    ) as HTMLButtonElement;
    const scheduleContent = scheduleItem.querySelector(
      '.schedule-content',
    ) as HTMLDivElement;
    expect(dom.scheduleFormSection.parentElement).toBe(scheduleItem);
    expect(scheduleItem.classList.contains('schedule-item--editing')).toBe(
      true,
    );
    expect(editButton.disabled).toBe(true);
    expect(deleteButton.disabled).toBe(true);
    expect(scheduleContent.getAttribute('aria-disabled')).toBe('true');
    expect(scheduleContent.tabIndex).toBe(-1);

    scheduleContent.click();
    scheduleContent.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(onToggleSelection).not.toHaveBeenCalled();

    hideScheduleForm(dom);

    expect(dom.addScheduleButton.nextElementSibling).toBe(
      dom.scheduleFormSection,
    );
    expect(scheduleItem.classList.contains('schedule-item--editing')).toBe(
      false,
    );
    expect(editButton.disabled).toBe(false);
    expect(deleteButton.disabled).toBe(false);
    expect(scheduleContent.hasAttribute('aria-disabled')).toBe(false);
    expect(scheduleContent.tabIndex).toBe(0);
  });

  it('shows form in edit mode for a general-hours schedule', () => {
    const dom = getPopupDomRefs(document);
    const submitBtn = dom.scheduleForm.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    const scheduleToEdit = createGeneralHoursSchedule(
      'gh-1',
      'MISC',
      'Commercial hours',
    );

    showScheduleForm(dom, createSnapshot(), scheduleToEdit);

    expect(dom.scheduleFormTitle.textContent).toBe('Schema bewerken');
    expect(submitBtn.textContent).toBe('Bijwerken');
    expect(dom.scheduleProjectSelect.value).toBe(
      '{"targetType":"general-hours","targetCode":"MISC"}',
    );
  });
});

describe('simple DOM state helpers', () => {
  it('hides and resets the schedule form', () => {
    const dom = getPopupDomRefs(document);
    updateAddScheduleButtonState(dom, true);
    dom.scheduleFormSection.hidden = false;
    dom.scheduleFormSection.dataset.formMode = 'add';
    dom.addScheduleButton.disabled = true;
    dom.scheduleLabelInput.value = 'Test';

    hideScheduleForm(dom);

    expect(dom.scheduleFormSection.hidden).toBe(true);
    expect(dom.scheduleLabelInput.value).toBe('');
    expect(dom.addScheduleButton.disabled).toBe(false);
  });

  it('updates add-schedule button state', () => {
    const dom = getPopupDomRefs(document);

    updateAddScheduleButtonState(dom, false);
    expect(dom.addScheduleButton.disabled).toBe(true);

    updateAddScheduleButtonState(dom, true);
    expect(dom.addScheduleButton.disabled).toBe(false);
  });

  it('updates apply button state for selection, locking and apply progress', () => {
    const dom = getPopupDomRefs(document);

    updateApplySchedulesButtonState(dom, false, false, 2, true, false);
    expect(dom.applySchedulesButton.disabled).toBe(true);
    expect(dom.applySchedulesButton.textContent).toBe('Toepassen');

    updateApplySchedulesButtonState(dom, false, true, 2, true, false);
    expect(dom.applySchedulesButton.disabled).toBe(false);
    expect(dom.applySchedulesButton.textContent).toBe('Toepassen');

    updateApplySchedulesButtonState(dom, true, true, 2, true, false);
    expect(dom.applySchedulesButton.disabled).toBe(true);
    expect(dom.applySchedulesButton.classList.contains('is-locked')).toBe(true);

    updateApplySchedulesButtonState(dom, false, true, 2, true, true);
    expect(dom.applySchedulesButton.disabled).toBe(true);
    expect(dom.applySchedulesButton.textContent).toBe('Bezig...');
    expect(dom.applySchedulesButton.classList.contains('is-applying')).toBe(
      true,
    );
  });

  it('updates scrape button and status message', () => {
    const dom = getPopupDomRefs(document);

    setScrapeButtonState(dom, true);
    expect(dom.btnScrape.disabled).toBe(true);

    renderStatusMessage(dom, 'Status', true);
    expect(dom.statusMessage.textContent).toBe('Status');
    expect(dom.statusDismissButton.hidden).toBe(false);
    expect(dom.statusSection.hidden).toBe(false);

    renderStatusMessage(dom, '', false);
    expect(dom.statusSection.hidden).toBe(true);
  });

  it('renders structured status sections with bold labels and nested lists', () => {
    const dom = getPopupDomRefs(document);

    renderStatusMessage(
      dom,
      [
        { label: 'Dagen bijgewerkt:', text: '1/3' },
        {
          label: 'Mislukt per doel:',
          items: [
            'Project A: alle dagen mislukt',
            { text: 'Project B:', items: ['2026-05-01', '<b>x</b>'] },
          ],
        },
      ],
      true,
      'warning',
    );

    const sections = dom.statusMessage.querySelectorAll(
      '.status-message-section',
    );
    expect(sections).toHaveLength(2);
    expect(sections[0].querySelector('strong')?.textContent).toBe(
      'Dagen bijgewerkt:',
    );
    expect(sections[0].textContent).toBe('Dagen bijgewerkt: 1/3');
    const topItems = sections[1].querySelectorAll(':scope > ul > li');
    expect(topItems[0].textContent).toBe('Project A: alle dagen mislukt');
    const nestedItems = topItems[1].querySelectorAll('ul > li');
    expect(Array.from(nestedItems, (li) => li.textContent)).toEqual([
      '2026-05-01',
      '<b>x</b>',
    ]);
    expect(dom.statusMessage.querySelector('b')).toBeNull();
    expect(dom.statusSection.hidden).toBe(false);

    renderStatusMessage(dom, []);
    expect(dom.statusSection.hidden).toBe(true);
  });

  it('renders the icon and border class matching the status level', () => {
    const dom = getPopupDomRefs(document);

    renderStatusMessage(dom, 'Info');
    expect(dom.statusIcon.textContent).toBe('ℹ️');
    expect(dom.statusBox.classList.contains('status-box--info')).toBe(true);

    renderStatusMessage(dom, 'Let op', false, 'warning');
    expect(dom.statusIcon.textContent).toBe('⚠️');
    expect(dom.statusBox.classList.contains('status-box--warning')).toBe(true);
    expect(dom.statusBox.classList.contains('status-box--info')).toBe(false);

    renderStatusMessage(dom, 'Mislukt', false, 'error');
    expect(dom.statusIcon.textContent).toBe('❌');
    expect(dom.statusBox.classList.contains('status-box--error')).toBe(true);
    expect(dom.statusBox.classList.contains('status-box--warning')).toBe(false);

    renderStatusMessage(dom, 'Gelukt', false, 'success');
    expect(dom.statusIcon.textContent).toBe('✅');
    expect(dom.statusBox.classList.contains('status-box--success')).toBe(true);
    expect(dom.statusBox.classList.contains('status-box--error')).toBe(false);
  });
});
