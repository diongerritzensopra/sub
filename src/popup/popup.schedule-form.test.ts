import { beforeEach, describe, expect, it } from 'vitest';

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import { STORAGE_KEYS } from '../shared/storage';
import {
  flushAsyncWork,
  mockChromeStorageLocalGet,
  mockChromeStorageLocalSet,
  resetPopupTestEnvironment,
} from './popup.test-helpers';

beforeEach(() => {
  resetPopupTestEnvironment();
});

describe('popup schedule form', () => {
  it('keeps the add button disabled until a snapshot is rendered', async () => {
    await import('./popup');

    expect(document.getElementById('btn-add-schedule')?.hasAttribute('disabled')).toBe(true);
  });

  it('opens the form from the add button after a snapshot is rendered', async () => {
    const { renderSnapshot } = await import('./popup');
    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projects: [
        { code: 'ZMOCK_001.1.1', name: 'Mockproject' },
        { code: 'ZTEST_42', name: 'Testproject 42' },
      ],
      currentProjectCode: 'ZMOCK_001.1.1',
      totals: { worked: 120, toBePerformed: 160 },
      sapStatus: 'editable',
    };

    renderSnapshot(snapshot);

    const button = document.getElementById('btn-add-schedule') as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    button.click();

    const formSection = document.getElementById('schedule-form-section') as HTMLElement;
    const projectSelect = document.getElementById('schedule-project') as HTMLSelectElement;

    expect(formSection.hidden).toBe(false);
    expect(projectSelect.querySelectorAll('option')).toHaveLength(3);
    expect(projectSelect.options[1].textContent).toBe('Mockproject [ZMOCK_001.1.1]');
    expect(projectSelect.options[2].textContent).toBe('Testproject 42 [ZTEST_42]');
  });

  it('displays form with project names from snapshot', async () => {
    const { showScheduleForm } = await import('./popup');
    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projects: [
        { code: 'ZMOCK_001.1.1', name: 'Mockproject' },
        { code: 'ZTEST_42', name: 'Testproject 42' },
      ],
      currentProjectCode: 'ZMOCK_001.1.1',
      totals: { worked: 120, toBePerformed: 160 },
      sapStatus: 'editable',
    };

    showScheduleForm(snapshot);

    const formSection = document.getElementById('schedule-form-section') as HTMLElement;
    const projectSelect = document.getElementById('schedule-project') as HTMLSelectElement;

    expect(formSection.hidden).toBe(false);
    expect(projectSelect.querySelectorAll('option')).toHaveLength(3);
    expect(projectSelect.options[1].textContent).toBe('Mockproject [ZMOCK_001.1.1]');
    expect(projectSelect.options[2].textContent).toBe('Testproject 42 [ZTEST_42]');
  });

  it('hides form when showScheduleForm called with null', async () => {
    const { showScheduleForm } = await import('./popup');

    showScheduleForm(null);

    const formSection = document.getElementById('schedule-form-section') as HTMLElement;
    expect(formSection.hidden).toBe(true);
  });

  it('saves new schedule on form submit', async () => {
    const storedValues: Record<string, unknown> = {};
    mockChromeStorageLocalSet.mockImplementation((values, callback) => {
      Object.assign(storedValues, values);
      callback();
    });
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { showScheduleForm } = await import('./popup');
    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projects: [{ code: 'ZMOCK_001.1.1', name: 'Mockproject' }],
      currentProjectCode: 'ZMOCK_001.1.1',
      totals: { worked: 120, toBePerformed: 160 },
      sapStatus: 'editable',
    };

    showScheduleForm(snapshot);

    const form = document.getElementById('schedule-form') as HTMLFormElement;
    const labelInput = document.getElementById('schedule-label') as HTMLInputElement;
    const projectSelect = document.getElementById('schedule-project') as HTMLSelectElement;
    const mondayInput = document.getElementById('hours-monday') as HTMLInputElement;

    labelInput.value = 'Test Schedule';
    projectSelect.value = 'ZMOCK_001.1.1';
    mondayInput.value = '8';

    form.dispatchEvent(new Event('submit'));
    await flushAsyncWork();

    const formSection = document.getElementById('schedule-form-section') as HTMLElement;
    expect(formSection.hidden).toBe(true);
    expect(storedValues[STORAGE_KEYS.projectSchedules]).toBeDefined();
  });

  it('opens edit form when edit button is clicked', async () => {
    const storedValues: Record<string, unknown> = {};
    mockChromeStorageLocalSet.mockImplementation((values, callback) => {
      Object.assign(storedValues, values);
      callback();
    });
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSnapshot, renderSchedules } = await import('./popup');

    const schedule: WeeklySchedule = {
      id: 'sched-1',
      label: 'Kantooruren',
      projectCode: 'ZMOCK_001.1.1',
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

    storedValues[STORAGE_KEYS.projectSchedules] = [schedule];

    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projects: [{ code: 'ZMOCK_001.1.1', name: 'Mockproject' }],
      currentProjectCode: 'ZMOCK_001.1.1',
      totals: { worked: 120, toBePerformed: 160 },
      sapStatus: 'editable',
    };

    await renderSchedules();
    renderSnapshot(snapshot);
    await flushAsyncWork();

    const listItems = document.querySelectorAll('#schedules-list li');
    expect(listItems).toHaveLength(1);

    const editButton = listItems[0].querySelector('button.schedule-edit-button') as HTMLButtonElement;
    expect(editButton).toBeTruthy();
    expect(editButton.textContent).toBe('✏️');
    editButton.click();

    const formSection = document.getElementById('schedule-form-section') as HTMLElement;
    const formTitle = document.getElementById('schedule-form-title') as HTMLElement;
    const submitBtn = document.getElementById('schedule-form')?.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(formSection.hidden).toBe(false);
    expect(formTitle.textContent).toBe('Schema bewerken');
    expect(submitBtn.textContent).toBe('Bijwerken');
  });

  it('populates form fields with existing schedule data in edit mode', async () => {
    const { showScheduleForm } = await import('./popup');
    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projects: [
        { code: 'ZMOCK_001.1.1', name: 'Mockproject' },
        { code: 'ZTEST_42', name: 'Testproject 42' },
      ],
      currentProjectCode: 'ZMOCK_001.1.1',
      totals: { worked: 120, toBePerformed: 160 },
      sapStatus: 'editable',
    };

    const scheduleToEdit: WeeklySchedule = {
      id: 'sched-1',
      label: 'Kantooruren',
      projectCode: 'ZMOCK_001.1.1',
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

    showScheduleForm(snapshot, scheduleToEdit);

    const labelInput = document.getElementById('schedule-label') as HTMLInputElement;
    const projectSelect = document.getElementById('schedule-project') as HTMLSelectElement;
    const mondayInput = document.getElementById('hours-monday') as HTMLInputElement;
    const fridayInput = document.getElementById('hours-friday') as HTMLInputElement;
    const saturdayInput = document.getElementById('hours-saturday') as HTMLInputElement;

    expect(labelInput.value).toBe('Kantooruren');
    expect(projectSelect.value).toBe('ZMOCK_001.1.1');
    expect(mondayInput.value).toBe('8');
    expect(fridayInput.value).toBe('8');
    expect(saturdayInput.value).toBe('0');
  });

  it('updates an existing schedule on form submit', async () => {
    const storedValues: Record<string, unknown> = {};
    mockChromeStorageLocalSet.mockImplementation((values, callback) => {
      Object.assign(storedValues, values);
      callback();
    });
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { showScheduleForm } = await import('./popup');
    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projects: [{ code: 'ZMOCK_001.1.1', name: 'Mockproject' }],
      currentProjectCode: 'ZMOCK_001.1.1',
      totals: { worked: 120, toBePerformed: 160 },
      sapStatus: 'editable',
    };

    const scheduleToEdit: WeeklySchedule = {
      id: 'sched-1',
      label: 'Kantooruren',
      projectCode: 'ZMOCK_001.1.1',
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

    showScheduleForm(snapshot, scheduleToEdit);

    const form = document.getElementById('schedule-form') as HTMLFormElement;
    const labelInput = document.getElementById('schedule-label') as HTMLInputElement;
    const projectSelect = document.getElementById('schedule-project') as HTMLSelectElement;
    const tuesdayInput = document.getElementById('hours-tuesday') as HTMLInputElement;

    labelInput.value = 'Kantooruren (updated)';
    projectSelect.value = 'ZMOCK_001.1.1';
    tuesdayInput.value = '7.5';

    form.dispatchEvent(new Event('submit'));
    await flushAsyncWork();

    const saved = (storedValues[STORAGE_KEYS.projectSchedules] as WeeklySchedule[]) || [];
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('sched-1');
    expect(saved[0].label).toBe('Kantooruren (updated)');
    expect(saved[0].hoursPerWeekday.tuesday).toBe(7.5);
  });

  it('shows "bijgewerkt" status when updating existing schedule', async () => {
    const storedValues: Record<string, unknown> = {};
    mockChromeStorageLocalSet.mockImplementation((values, callback) => {
      Object.assign(storedValues, values);
      callback();
    });
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { showScheduleForm } = await import('./popup');
    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projects: [{ code: 'ZMOCK_001.1.1', name: 'Mockproject' }],
      currentProjectCode: 'ZMOCK_001.1.1',
      totals: { worked: 120, toBePerformed: 160 },
      sapStatus: 'editable',
    };

    const scheduleToEdit: WeeklySchedule = {
      id: 'sched-1',
      label: 'Test',
      projectCode: 'ZMOCK_001.1.1',
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

    showScheduleForm(snapshot, scheduleToEdit);

    const form = document.getElementById('schedule-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await flushAsyncWork();

    expect(document.getElementById('status-message')?.textContent).toContain('bijgewerkt');
  });
});
