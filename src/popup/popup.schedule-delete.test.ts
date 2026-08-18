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

describe('popup schedule delete', () => {
  const makeSchedule = (id: string, label: string): WeeklySchedule => ({
    id,
    label,
    projectCode: 'ZMOCK_001.1.1',
    hoursPerWeekday: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
  });

  const editableSnapshot: TimesheetSnapshot = {
    month: 5,
    year: 2026,
    projects: [{ code: 'ZMOCK_001.1.1', name: 'Mockproject' }],
    currentProjectCode: 'ZMOCK_001.1.1',
    totals: { worked: 120, toBePerformed: 160 },
    sapStatus: 'editable',
  };

  it('renders a delete button per schedule row', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    renderSnapshot(editableSnapshot);
    await renderSchedules();

    const deleteBtn = document.querySelector('#schedules-list li button.schedule-delete-button') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();
    expect(deleteBtn.textContent).toBe('🗑️');
  });

  it('shows inline confirmation row when delete button is clicked', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    renderSnapshot(editableSnapshot);
    await renderSchedules();

    const li = document.querySelector('#schedules-list li') as HTMLElement;
    const deleteBtn = li.querySelector('button.schedule-delete-button') as HTMLButtonElement;
    const confirmRow = li.querySelector('.schedule-confirm-delete') as HTMLElement;
    const actions = li.querySelector('.schedule-actions') as HTMLElement;

    expect(confirmRow.hidden).toBe(true);
    deleteBtn.click();
    expect(confirmRow.hidden).toBe(false);
    expect(actions.hidden).toBe(true);
  });

  it('restores action buttons when inline cancel is clicked', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    renderSnapshot(editableSnapshot);
    await renderSchedules();

    const li = document.querySelector('#schedules-list li') as HTMLElement;
    const deleteBtn = li.querySelector('button.schedule-delete-button') as HTMLButtonElement;
    const confirmRow = li.querySelector('.schedule-confirm-delete') as HTMLElement;
    const actions = li.querySelector('.schedule-actions') as HTMLElement;

    deleteBtn.click();
    expect(confirmRow.hidden).toBe(false);

    const cancelBtn = li.querySelector('button.schedule-confirm-no') as HTMLButtonElement;
    cancelBtn.click();

    expect(confirmRow.hidden).toBe(true);
    expect(actions.hidden).toBe(false);
    expect(mockChromeStorageLocalSet).not.toHaveBeenCalled();
  });

  it('removes schedule from list when inline confirm yes is clicked', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren'), makeSchedule('s2', 'Deeltijd')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });
    mockChromeStorageLocalSet.mockImplementation((values, callback) => {
      Object.assign(storedValues, values);
      callback();
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    renderSnapshot(editableSnapshot);
    await renderSchedules();

    const listItems = document.querySelectorAll('#schedules-list li');
    expect(listItems).toHaveLength(2);

    listItems[0].querySelector('button.schedule-delete-button')!.dispatchEvent(new MouseEvent('click'));
    const confirmYes = listItems[0].querySelector('button.schedule-confirm-yes') as HTMLButtonElement;
    confirmYes.click();
    await flushAsyncWork();

    expect(document.querySelectorAll('#schedules-list li')).toHaveLength(1);
    expect(document.getElementById('schedules-list')?.textContent).toContain('Deeltijd');
    expect(document.getElementById('schedules-list')?.textContent).not.toContain('Kantooruren');
  });

  it('shows empty state after the last schedule is deleted', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });
    mockChromeStorageLocalSet.mockImplementation((values, callback) => {
      Object.assign(storedValues, values);
      callback();
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    renderSnapshot(editableSnapshot);
    await renderSchedules();

    document.querySelector('#schedules-list li button.schedule-delete-button')!.dispatchEvent(new MouseEvent('click'));
    const confirmYes = document.querySelector('.schedule-confirm-yes') as HTMLButtonElement;
    confirmYes.click();
    await flushAsyncWork();

    expect(document.getElementById('schedules-empty')?.hidden).toBe(false);
    expect(document.getElementById('schedules-list')?.hidden).toBe(true);
  });
});
