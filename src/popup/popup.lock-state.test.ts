import { beforeEach, describe, expect, it } from 'vitest';

import type { TimesheetSnapshot } from '../shared/types';
import { STORAGE_KEYS } from '../shared/storage';
import {
  flushAsyncWork,
  mockChromeRuntimeSendMessage,
  mockChromeScriptingExecuteScript,
  mockChromeStorageLocalGet,
  mockChromeTabsQuery,
  resetPopupTestEnvironment,
} from './popup.test-helpers';

beforeEach(() => {
  resetPopupTestEnvironment();
});

describe('popup timesheet lock state', () => {
  const sapTab = {
    id: 99,
    url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/8/2026/project/ZSST',
    status: 'complete',
  } as chrome.tabs.Tab;

  const lockedSnapshot: TimesheetSnapshot = {
    month: 8,
    year: 2026,
    projects: [{ code: 'ZMOCK_001.1.1', name: 'Mockproject' }],
    currentProjectCode: 'ZMOCK_001.1.1',
    totals: { worked: 120, toBePerformed: 160 },
    sapStatus: 'locked',
  };

  const editableSnapshot: TimesheetSnapshot = {
    ...lockedSnapshot,
    sapStatus: 'editable',
  };

  it('keeps apply disabled and shows a lock message when sapStatus is locked', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [
        {
          id: 's1',
          label: 'Kantooruren',
          projectCode: 'ZMOCK_001.1.1',
          hoursPerWeekday: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
        },
      ],
    };

    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: false } });
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });
    mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
      if (injection.func?.name === 'ui5MainWorldReadSnapshot') {
        return [{
          documentId: 'mock-id',
          frameId: 0,
          result: { success: true, snapshot: lockedSnapshot },
        }];
      }
      return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
    });

    await import('./popup');
    await flushAsyncWork();

    expect(document.getElementById('status-message')?.textContent).toContain('vergrendeld');
    expect((document.getElementById('btn-scrape') as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById('btn-add-schedule') as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById('btn-apply-schedules') as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById('btn-apply-schedules') as HTMLButtonElement).classList.contains('is-locked')).toBe(true);

    const editButton = document.querySelector('#schedules-list .schedule-edit-button') as HTMLButtonElement;
    const deleteButton = document.querySelector('#schedules-list .schedule-delete-button') as HTMLButtonElement;
    expect(editButton?.disabled).toBe(false);
    expect(deleteButton?.disabled).toBe(false);
  });

  it('enables apply when sapStatus is editable', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [
        {
          id: 's1',
          label: 'Kantooruren',
          projectCode: 'ZMOCK_001.1.1',
          hoursPerWeekday: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
        },
      ],
    };

    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: false } });
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });
    mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
      if (injection.func?.name === 'ui5MainWorldReadSnapshot') {
        return [{
          documentId: 'mock-id',
          frameId: 0,
          result: { success: true, snapshot: editableSnapshot },
        }];
      }
      return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
    });

    await import('./popup');
    await flushAsyncWork();

    expect((document.getElementById('btn-scrape') as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById('btn-add-schedule') as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById('btn-apply-schedules') as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById('btn-apply-schedules') as HTMLButtonElement).classList.contains('is-locked')).toBe(false);

    const editButton = document.querySelector('#schedules-list .schedule-edit-button') as HTMLButtonElement;
    const deleteButton = document.querySelector('#schedules-list .schedule-delete-button') as HTMLButtonElement;
    expect(editButton?.disabled).toBe(false);
    expect(deleteButton?.disabled).toBe(false);
  });
});
