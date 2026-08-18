import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import { STORAGE_KEYS } from '../shared/storage';
import {
  flushAsyncWork,
  mockChromeRuntimeSendMessage,
  mockChromeScriptingExecuteScript,
  mockChromeStorageLocalGet,
  mockChromeTabsGet,
  mockChromeTabsQuery,
  mockChromeTabsUpdate,
  resetPopupTestEnvironment,
} from './popup.test-helpers';

beforeEach(() => {
  resetPopupTestEnvironment();
});

describe('popup schedule apply', () => {
  const makeSchedule = (id: string, label: string, projectCode: string): WeeklySchedule => ({
    id,
    label,
    projectCode,
    hoursPerWeekday: { monday: 8, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
  });

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

  const sapTab = {
    id: 99,
    url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
    status: 'complete',
  } as chrome.tabs.Tab;

  it('shows "Alles toepassen" by default and switches to "Toepassen" when a schedule is selected', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    expect(applyButton.textContent).toBe('Alles toepassen');

    const scheduleItem = document.querySelector('#schedules-list .schedule-item') as HTMLElement;
    scheduleItem.click();
    expect(applyButton.textContent).toBe('Toepassen');
  });

  it('enables the apply button after the UI5 snapshot is loaded and schedules are available', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });
    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: false } });
    mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
      const funcName = injection.func?.name;
      if (funcName === 'ui5MainWorldReadSnapshot') {
        return [{
          documentId: 'mock-id',
          frameId: 0,
          result: {
            success: true,
            snapshot,
          },
        }];
      }
      if (funcName === 'ui5MainWorldAutofill') {
        return [{
          documentId: 'mock-id',
          frameId: 0,
          result: {
            appliedDaysCount: 1,
            failedDates: [],
            submissionAttempted: true,
            submissionConfirmed: true,
          },
        }];
      }

      return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
    });

    await import('./popup');
    await flushAsyncWork();

    expect((document.getElementById('btn-apply-schedules') as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not start apply flow when snapshot period is invalid', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot({
      ...snapshot,
      month: null,
    });

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    expect(applyButton.disabled).toBe(true);

    await flushAsyncWork();
    vi.clearAllMocks();
    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    document.getElementById('status-message')!.textContent = '';
    applyButton.disabled = false;
    applyButton.click();
    await flushAsyncWork();

    expect(document.getElementById('status-message')?.textContent).toBe(
      'Fout: Kan niet toepassen zonder geldige periode. Analyseer eerst de timesheet.',
    );
    expect(mockChromeTabsQuery).not.toHaveBeenCalled();
  });

  it('appends autofill summary errors to the final status message', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    vi.clearAllMocks();
    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeTabsGet.mockResolvedValue({ ...sapTab, status: 'complete' } as chrome.tabs.Tab);
    mockChromeTabsUpdate.mockImplementation(async (tabId, updateProperties) => ({
      id: tabId,
      status: 'complete',
      url: updateProperties.url,
    } as chrome.tabs.Tab));
    mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
      const funcName = injection.func?.name;
      if (funcName === 'ui5MainWorldAutofill') {
        return [{
          documentId: 'mock-id',
          frameId: 0,
          result: {
            appliedDaysCount: 0,
            failedDates: ['2026-05-05'],
            submissionAttempted: true,
            submissionConfirmed: false,
            error: 'postTimeSheet gaf een fout terug',
          },
        }];
      }

      return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
    });

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    applyButton.click();
    await flushAsyncWork();

    const statusMessage = document.getElementById('status-message')?.textContent ?? '';
    expect(statusMessage).toContain('Fouten:');
    expect(statusMessage).toContain('ZMOCK_001.1.1: postTimeSheet gaf een fout terug');
  });

  it('continues with remaining schedules when navigation fails for one schedule', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [
        makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1'),
        makeSchedule('s2', 'Deeltijd', 'ZTEST_42'),
      ],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    vi.clearAllMocks();
    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeTabsGet.mockResolvedValue({ ...sapTab, status: 'complete' } as chrome.tabs.Tab);
    mockChromeTabsUpdate.mockImplementation(async (tabId, updateProperties) => {
      if ((updateProperties.url ?? '').includes('project/ZMOCK_001.1.1')) {
        throw new Error('Navigatie mislukt voor project');
      }
      return {
        id: tabId,
        status: 'complete',
        url: updateProperties.url,
      } as chrome.tabs.Tab;
    });

    let autofillCalls = 0;
    mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
      const funcName = injection.func?.name;
      if (funcName === 'ui5MainWorldAutofill') {
        autofillCalls += 1;
        return [{
          documentId: 'mock-id',
          frameId: 0,
          result: {
            appliedDaysCount: 1,
            failedDates: [],
            submissionAttempted: true,
            submissionConfirmed: true,
          },
        }];
      }

      return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
    });

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    applyButton.click();
    await flushAsyncWork();

    const statusMessage = document.getElementById('status-message')?.textContent ?? '';
    expect(autofillCalls).toBe(1);
    expect(statusMessage).toContain('Schema\'s toegepast: Kantooruren, Deeltijd.');
    expect(statusMessage).toContain('Fouten:');
    expect(statusMessage).toContain('ZMOCK_001.1.1: Navigatie mislukt voor project');
  });

  it('applies only selected schedules when one or more schedules are selected', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [
        makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1'),
        makeSchedule('s2', 'Deeltijd', 'ZTEST_42'),
      ],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    vi.clearAllMocks();
    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeTabsGet.mockResolvedValue({ ...sapTab, status: 'complete' } as chrome.tabs.Tab);
    mockChromeTabsUpdate.mockImplementation(async (tabId, updateProperties) => ({
      id: tabId,
      status: 'complete',
      url: updateProperties.url,
    } as chrome.tabs.Tab));
    const schedules = document.querySelectorAll('#schedules-list .schedule-item');
    (schedules[0] as HTMLElement).click();

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    applyButton.click();
    await flushAsyncWork();

    expect(mockChromeScriptingExecuteScript).toHaveBeenCalledTimes(1);
    expect(mockChromeTabsUpdate).toHaveBeenCalledTimes(1);
    expect(document.getElementById('status-message')?.textContent).toContain('Schema toegepast: Kantooruren.');
    expect(document.getElementById('status-message')?.textContent).toContain('1/');
    expect(document.getElementById('status-message')?.textContent).toContain('dagen bijgewerkt');
    expect(document.getElementById('status-message')?.textContent).toContain('SAP bevestiging: ontvangen (1/1)');
  });

  it('applies all schedules when none are selected', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [
        makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1'),
        makeSchedule('s2', 'Deeltijd', 'ZTEST_42'),
      ],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    vi.clearAllMocks();
    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeTabsGet.mockResolvedValue({ ...sapTab, status: 'complete' } as chrome.tabs.Tab);
    mockChromeTabsUpdate.mockImplementation(async (tabId, updateProperties) => ({
      id: tabId,
      status: 'complete',
      url: updateProperties.url,
    } as chrome.tabs.Tab));
    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    applyButton.click();
    await flushAsyncWork();

    expect(mockChromeScriptingExecuteScript).toHaveBeenCalledTimes(2);
    expect(mockChromeTabsUpdate).toHaveBeenCalledTimes(2);
    expect(document.getElementById('status-message')?.textContent).toContain('Schema\'s toegepast: Kantooruren, Deeltijd.');
    expect(document.getElementById('status-message')?.textContent).toContain('2/');
    expect(document.getElementById('status-message')?.textContent).toContain('dagen bijgewerkt');
    expect(document.getElementById('status-message')?.textContent).toContain('SAP bevestiging: ontvangen (2/2)');
  });

  it('applies without navigation when already on the same project page', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    vi.clearAllMocks();
    const sameProjectTab = {
      ...sapTab,
      url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/5/2026/project/ZMOCK_001.1.1',
    } as chrome.tabs.Tab;
    mockChromeTabsQuery.mockResolvedValue([sameProjectTab]);
    mockChromeTabsGet.mockResolvedValue(sameProjectTab);

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    applyButton.click();
    await flushAsyncWork();

    expect(mockChromeTabsUpdate).not.toHaveBeenCalled();
    expect(mockChromeTabsGet).toHaveBeenCalledTimes(1);
    expect(mockChromeScriptingExecuteScript).toHaveBeenCalledTimes(1);
    expect(document.getElementById('status-message')?.textContent).toContain('Schema toegepast: Kantooruren.');
    expect(document.getElementById('status-message')?.textContent).toContain('1/');
    expect(document.getElementById('status-message')?.textContent).toContain('dagen bijgewerkt');
    expect(document.getElementById('status-message')?.textContent).toContain('SAP bevestiging: ontvangen (1/1)');
  });

  it('shows "Bezig..." label and is-applying class while apply is in progress', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    vi.clearAllMocks();
    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeTabsGet.mockResolvedValue({ ...sapTab, status: 'complete' } as chrome.tabs.Tab);
    mockChromeTabsUpdate.mockImplementation(async (tabId, updateProperties) => ({
      id: tabId,
      status: 'complete',
      url: updateProperties.url,
    } as chrome.tabs.Tab));

    let resolveAutofill!: () => void;
    mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
      if (injection.func?.name === 'ui5MainWorldAutofill') {
        return new Promise<chrome.scripting.InjectionResult[]>((resolve) => {
          resolveAutofill = () => resolve([{
            documentId: 'mock-id',
            frameId: 0,
            result: { appliedDaysCount: 1, failedDates: [], submissionAttempted: true, submissionConfirmed: true },
          }]);
        });
      }
      return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
    });

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    applyButton.click();

    await flushAsyncWork();

    expect(applyButton.textContent).toBe('Bezig...');
    expect(applyButton.disabled).toBe(true);
    expect(applyButton.classList.contains('is-applying')).toBe(true);
    expect(applyButton.classList.contains('is-locked')).toBe(false);

    resolveAutofill();
    await flushAsyncWork();

    expect(applyButton.classList.contains('is-applying')).toBe(false);
    expect(applyButton.textContent).not.toBe('Bezig...');
  });

  it('reports failed days and SAP confirmation status when autofill is only partially successful', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1')],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    vi.clearAllMocks();
    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeTabsGet.mockResolvedValue({ ...sapTab, status: 'complete' } as chrome.tabs.Tab);
    mockChromeTabsUpdate.mockImplementation(async (tabId, updateProperties) => ({
      id: tabId,
      status: 'complete',
      url: updateProperties.url,
    } as chrome.tabs.Tab));
    mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
      const funcName = injection.func?.name;
      if (funcName === 'ui5MainWorldAutofill') {
        return [{
          documentId: 'mock-id',
          frameId: 0,
          result: {
            appliedDaysCount: 0,
            failedDates: ['2026-05-05'],
            submissionAttempted: true,
            submissionConfirmed: false,
          },
        }];
      }

      return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
    });

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    applyButton.click();
    await flushAsyncWork();

    const statusMessage = document.getElementById('status-message')?.textContent ?? '';
    expect(statusMessage).toContain('Schema toegepast: Kantooruren.');
    expect(statusMessage).toContain('0/');
    expect(statusMessage).toContain('dagen bijgewerkt');
    expect(statusMessage).toContain('Mislukt per project:');
    expect(statusMessage).toContain('- ZMOCK_001.1.1: 2026-05-05.');
    expect(statusMessage).toContain('SAP bevestiging: gedeeltelijk (0/1)');
  });

  it('groups failed dates by project when applying multiple schedules', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [
        makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1'),
        makeSchedule('s2', 'Deeltijd', 'ZTEST_42'),
      ],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    vi.clearAllMocks();
    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeTabsGet.mockResolvedValue({ ...sapTab, status: 'complete' } as chrome.tabs.Tab);
    mockChromeTabsUpdate.mockImplementation(async (tabId, updateProperties) => ({
      id: tabId,
      status: 'complete',
      url: updateProperties.url,
    } as chrome.tabs.Tab));

    let autofillCallCount = 0;
    mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
      const funcName = injection.func?.name;
      if (funcName === 'ui5MainWorldAutofill') {
        autofillCallCount += 1;
        return [{
          documentId: 'mock-id',
          frameId: 0,
          result: autofillCallCount === 1
            ? {
              appliedDaysCount: 0,
              failedDates: ['2026-05-05'],
              submissionAttempted: true,
              submissionConfirmed: false,
            }
            : {
              appliedDaysCount: 0,
              failedDates: ['2026-05-12', '2026-05-19'],
              submissionAttempted: true,
              submissionConfirmed: false,
            },
        }];
      }

      return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
    });

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    applyButton.click();
    await flushAsyncWork();

    const statusMessage = document.getElementById('status-message')?.textContent ?? '';
    expect(statusMessage).toContain('Schema\'s toegepast: Kantooruren, Deeltijd.');
    expect(statusMessage).toContain('Mislukt per project:');
    expect(statusMessage).toContain('- ZMOCK_001.1.1: 2026-05-05.');
    expect(statusMessage).toContain('- ZTEST_42: 2026-05-12, 2026-05-19.');
  });

  it('prevents navigation when a selected schedule project is not available', async () => {
    const storedValues: Record<string, unknown> = {
      [STORAGE_KEYS.projectSchedules]: [
        makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1'),
        makeSchedule('s2', 'Deeltijd', 'UNAVAILABLE_PROJECT'),
      ],
    };
    mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
      callback({ [keys[0]]: storedValues[keys[0]] });
    });

    mockChromeTabsQuery.mockResolvedValue([sapTab]);
    mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: false } });

    const { renderSchedules, renderSnapshot } = await import('./popup');
    await renderSchedules();
    renderSnapshot(snapshot);

    await flushAsyncWork();
    vi.clearAllMocks();

    const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
    applyButton.click();
    await flushAsyncWork();

    expect(mockChromeTabsQuery).not.toHaveBeenCalled();
    expect(mockChromeTabsUpdate).not.toHaveBeenCalled();
    expect(document.getElementById('status-message')?.textContent).toContain('UNAVAILABLE_PROJECT');
    expect(document.getElementById('status-message')?.textContent).toContain('niet beschikbaar');
  });
});
