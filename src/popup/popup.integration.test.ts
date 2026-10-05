import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import { STORAGE_KEYS } from '../shared/storage';
import { formatStatusDate } from './schedule-apply';
import {
  flushAsyncWork,
  mockChromeRuntimeSendMessage,
  mockChromeScriptingExecuteScript,
  mockChromeStorageLocalGet,
  mockChromeStorageLocalRemove,
  mockChromeStorageLocalSet,
  mockChromeTabsGet,
  mockChromeTabsQuery,
  mockChromeTabsUpdate,
  resetPopupTestEnvironment,
} from './popup.test-helpers';

beforeEach(() => {
  resetPopupTestEnvironment();
});

describe('popup integration tests', () => {
  describe('status restore lifecycle', () => {
    it('keeps the persisted status visible after refresh lifecycle transitions', async () => {
      const sapTab = {
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/8/2026/project/ZSST',
        status: 'complete',
      } as chrome.tabs.Tab;
      const storedValues: Record<string, unknown> = {};

      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({
        success: true,
        data: { busy: false },
      });
      mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
        if (injection.func?.name === 'ui5MainWorldReadSnapshot') {
          return [
            {
              documentId: 'mock-id',
              frameId: 0,
              result: {
                success: true,
                snapshot: {
                  month: 8,
                  year: 2026,
                  targets: [
                    {
                      targetType: 'general-hours',
                      targetCode: 'MISC',
                      targetLabel: 'Commercial hours',
                    },
                  ],
                  currentProjectCode: null,
                  totals: { worked: null, toBePerformed: null },
                  sapStatus: 'editable',
                },
              },
            },
          ];
        }

        return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
      });
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: storedValues[keys[0]] });
      });
      mockChromeStorageLocalSet.mockImplementation((values, callback) => {
        Object.assign(storedValues, values);
        callback();
      });

      const { setStatus } = await import('./popup');
      await flushAsyncWork();

      setStatus('Eerder resultaat: 5 dagen bijgewerkt.', true);
      expect(document.getElementById('status-message')?.textContent).toBe(
        'Eerder resultaat: 5 dagen bijgewerkt.',
      );

      (document.getElementById('btn-scrape') as HTMLButtonElement).click();
      await flushAsyncWork();

      expect(document.getElementById('status-message')?.textContent).toBe(
        'Eerder resultaat: 5 dagen bijgewerkt.',
      );
      expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(false);
    });
  });

  describe('apply flow resilience', () => {
    const makeProjectSchedule = (
      id: string,
      label: string,
      projectCode: string,
      targetName: string,
    ): WeeklySchedule => ({
      id,
      label,
      target: {
        targetType: 'project',
        targetCode: projectCode,
        targetLabel: targetName,
      },
      hoursPerWeekday: {
        monday: 8,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
      },
    });

    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      targets: [
        {
          targetType: 'project',
          targetCode: 'ZMOCK_001.1.1',
          targetLabel: 'Mockproject',
        },
        {
          targetType: 'project',
          targetCode: 'ZTEST_42',
          targetLabel: 'Testproject 42',
        },
        {
          targetType: 'general-hours',
          targetCode: 'MISC',
          targetLabel: 'Commercial hours',
        },
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

    it('continues with remaining schedules and reports accumulated errors when one navigation fails', async () => {
      const storedValues: Record<string, unknown> = {
        [STORAGE_KEYS.projectSchedules]: [
          makeProjectSchedule(
            's1',
            'Kantooruren',
            'ZMOCK_001.1.1',
            'Mockproject',
          ),
          makeProjectSchedule('s2', 'Deeltijd', 'ZTEST_42', 'Testproject 42'),
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
      mockChromeTabsGet.mockResolvedValue({
        ...sapTab,
        status: 'complete',
      } as chrome.tabs.Tab);
      mockChromeTabsUpdate.mockImplementation(
        async (tabId, updateProperties) => {
          if ((updateProperties.url ?? '').includes('project/ZMOCK_001.1.1')) {
            throw new Error('Navigatie mislukt voor project');
          }
          return {
            id: tabId,
            status: 'complete',
            url: updateProperties.url,
          } as chrome.tabs.Tab;
        },
      );

      let autofillCalls = 0;
      mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
        const funcName = injection.func?.name;
        if (funcName === 'ui5MainWorldAutofill') {
          autofillCalls += 1;
          return [
            {
              documentId: 'mock-id',
              frameId: 0,
              result: {
                appliedDates: ['2026-08-01'],
                failedDates: [],
                submissionAttempted: true,
                submissionConfirmed: true,
              },
            },
          ];
        }

        return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
      });

      const applyButton = document.getElementById(
        'btn-apply-schedules',
      ) as HTMLButtonElement;
      document
        .querySelectorAll<HTMLLIElement>('#schedules-list .schedule-item')
        .forEach((item) => item.click());
      applyButton.click();
      await flushAsyncWork();

      const statusMessage =
        document.getElementById('status-message')?.textContent ?? '';
      expect(autofillCalls).toBe(1);
      const sections = document.querySelectorAll(
        '#status-message .status-message-section',
      );
      expect(sections[0].querySelector('strong')?.textContent).toBe(
        "Toegepaste schema's:",
      );
      expect(
        Array.from(
          sections[0].querySelectorAll('li'),
          (item) => item.textContent,
        ),
      ).toEqual(['Kantooruren', 'Deeltijd']);
      expect(statusMessage).toContain('Mockproject: alle dagen mislukt');
      expect(sections).toHaveLength(5);
      expect(
        Array.from(
          sections[1].querySelectorAll('ul ul li'),
          (item) => item.textContent,
        ),
      ).toContain(formatStatusDate('2026-08-01'));
      expect(statusMessage).toContain('Fouten:');
      expect(statusMessage).toContain(
        'Mockproject: Navigatie mislukt voor project',
      );
      expect(
        document
          .getElementById('status-box')
          ?.classList.contains('status-box--error'),
      ).toBe(true);
    });

    it('applies without navigation when already on the same project page', async () => {
      const storedValues: Record<string, unknown> = {
        [STORAGE_KEYS.projectSchedules]: [
          makeProjectSchedule(
            's1',
            'Kantooruren',
            'ZMOCK_001.1.1',
            'Mockproject',
          ),
        ],
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

      const applyButton = document.getElementById(
        'btn-apply-schedules',
      ) as HTMLButtonElement;
      document
        .querySelectorAll<HTMLLIElement>('#schedules-list .schedule-item')
        .forEach((item) => item.click());
      applyButton.click();
      await flushAsyncWork();

      expect(mockChromeTabsUpdate).not.toHaveBeenCalled();
      expect(mockChromeTabsGet).toHaveBeenCalledTimes(1);
      expect(mockChromeScriptingExecuteScript).toHaveBeenCalledTimes(1);
      const sections = document.querySelectorAll(
        '#status-message .status-message-section',
      );
      expect(sections[0].querySelector('strong')?.textContent).toBe(
        "Toegepaste schema's:",
      );
      expect(sections[0].querySelector('li')?.textContent).toBe('Kantooruren');
      expect(document.getElementById('status-message')?.textContent).toContain(
        'Bijgewerkte dagen: 1/',
      );
      expect(sections[2].textContent).toBe(
        'Verwerkt door SAP: 1/1 (alles ingediend)',
      );
    });
  });

  describe('popup wiring coverage', () => {
    const editableSnapshot: TimesheetSnapshot = {
      month: 8,
      year: 2026,
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
      currentProjectCode: 'C001',
      totals: { worked: 10, toBePerformed: 20 },
      sapStatus: 'editable',
    };

    it('shows cached data and a loading status while SAP is loading', async () => {
      const now = new Date();
      const cachedSnapshot: TimesheetSnapshot = {
        ...editableSnapshot,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      };
      const sapTab = {
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
        status: 'loading',
      } as chrome.tabs.Tab;
      const cachedData = {
        snapshot: cachedSnapshot,
        cachedAt: now.toISOString(),
      };
      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({
          [keys[0]]:
            keys[0] === STORAGE_KEYS.timesheetSnapshotCache
              ? cachedData
              : undefined,
        });
      });

      await import('./popup');
      await flushAsyncWork();

      expect(
        Array.from(
          document.querySelectorAll('main > section'),
          (section) => section.id,
        ),
      ).toEqual(['summary-section', 'status-section', 'schedules-section']);
      expect(document.getElementById('summary-section')?.hidden).toBe(false);
      expect(
        document.getElementById('data-origin-indicator')?.textContent,
      ).toContain('Cache gebruikt');
      expect(document.getElementById('status-message')?.textContent).toContain(
        'Pagina laadt nog, gegevens kunnen verouderd zijn...',
      );
      expect(
        document
          .getElementById('status-box')
          ?.classList.contains('status-box--warning'),
      ).toBe(true);
      expect(document.getElementById('schedules-empty')?.hidden).toBe(false);
      expect(document.getElementById('schedules-list')?.hidden).toBe(true);
      expect(
        (document.getElementById('btn-scrape') as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    it('shows a locked status and disables applying for a locked timesheet', async () => {
      const sapTab = {
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
        status: 'complete',
      } as chrome.tabs.Tab;
      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({
        success: true,
        data: { busy: false },
      });
      mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
        if (injection.func?.name === 'ui5MainWorldReadSnapshot') {
          return [
            {
              documentId: 'mock-id',
              frameId: 0,
              result: {
                success: true,
                snapshot: {
                  ...editableSnapshot,
                  sapStatus: 'locked',
                },
              },
            },
          ];
        }

        return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
      });

      await import('./popup');
      await flushAsyncWork();

      expect(document.getElementById('summary-section')?.hidden).toBe(false);
      expect(document.getElementById('status-message')?.textContent).toContain(
        'De timesheet is vergrendeld.',
      );
      expect(
        document
          .getElementById('status-box')
          ?.classList.contains('status-box--warning'),
      ).toBe(true);
      expect(
        (document.getElementById('btn-apply-schedules') as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(
        document
          .getElementById('btn-apply-schedules')
          ?.classList.contains('is-locked'),
      ).toBe(true);
    });

    it('clears a persisted status when dismiss is clicked', async () => {
      const storedValues: Record<string, unknown> = {};
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: storedValues[keys[0]] });
      });
      mockChromeStorageLocalSet.mockImplementation((values, callback) => {
        Object.assign(storedValues, values);
        callback();
      });

      const { setStatus } = await import('./popup');
      await flushAsyncWork();

      setStatus('Tijdelijk bericht', true);
      expect(document.getElementById('status-message')?.textContent).toBe(
        'Tijdelijk bericht',
      );

      (
        document.getElementById('btn-status-dismiss') as HTMLButtonElement
      ).click();
      await flushAsyncWork();

      expect(document.getElementById('status-message')?.textContent).toBe('');
    });

    it('opens the schedule form from add button when a snapshot is available', async () => {
      const { renderSnapshot } = await import('./popup');
      await flushAsyncWork();

      renderSnapshot(editableSnapshot);
      (
        document.getElementById('btn-add-schedule') as HTMLButtonElement
      ).click();
      await flushAsyncWork();

      expect(document.getElementById('schedule-form-section')?.hidden).toBe(
        false,
      );
      expect(
        document.getElementById('btn-add-schedule')?.nextElementSibling?.id,
      ).toBe('schedule-form-section');
      expect(
        (document.getElementById('btn-add-schedule') as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    it('deselects a schedule and blocks selection while it is being edited', async () => {
      const schedule = {
        id: 'edit-selected',
        label: 'Geselecteerd schema',
        target: {
          targetType: 'project' as const,
          targetCode: 'C001',
          targetLabel: 'Project Alpha',
        },
        hoursPerWeekday: {
          monday: 8,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 0,
          sunday: 0,
        },
      };
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({
          [keys[0]]:
            keys[0] === STORAGE_KEYS.projectSchedules ? [schedule] : undefined,
        });
      });

      const { renderSchedules, renderSnapshot } = await import('./popup');
      await flushAsyncWork();
      renderSnapshot(editableSnapshot);
      await renderSchedules();

      let scheduleItem = document.querySelector(
        '[data-schedule-id="edit-selected"]',
      ) as HTMLLIElement;
      scheduleItem.click();
      expect(scheduleItem.classList.contains('schedule-item--selected')).toBe(
        true,
      );

      (
        scheduleItem.querySelector('.schedule-edit-button') as HTMLButtonElement
      ).click();

      scheduleItem = document.querySelector(
        '[data-schedule-id="edit-selected"]',
      ) as HTMLLIElement;
      expect(scheduleItem.classList.contains('schedule-item--selected')).toBe(
        false,
      );
      expect(
        (document.getElementById('btn-apply-schedules') as HTMLButtonElement)
          .disabled,
      ).toBe(true);

      (scheduleItem.querySelector('.schedule-content') as HTMLElement).click();
      expect(scheduleItem.classList.contains('schedule-item--selected')).toBe(
        false,
      );
    });

    it('matches SAP timesheet tabs through isTimesheetTab', async () => {
      const { isTimesheetTab } = await import('./popup');

      expect(
        isTimesheetTab({
          url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
        } as chrome.tabs.Tab),
      ).toBe(true);
      expect(
        isTimesheetTab({ url: 'https://example.com' } as chrome.tabs.Tab),
      ).toBe(false);
      expect(isTimesheetTab(undefined)).toBe(false);
    });

    it('auto-triggers analyze flow when busy-state reports ready', async () => {
      const sapTab = {
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
        status: 'complete',
      } as chrome.tabs.Tab;
      const storedValues: Record<string, unknown> = {};

      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({
        success: true,
        data: { busy: false },
      });

      let snapshotReadCalls = 0;
      mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
        if (injection.func?.name === 'ui5MainWorldReadSnapshot') {
          snapshotReadCalls += 1;
          return [
            {
              documentId: 'mock-id',
              frameId: 0,
              result: {
                success: true,
                snapshot: editableSnapshot,
              },
            },
          ];
        }

        return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
      });
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: storedValues[keys[0]] });
      });
      mockChromeStorageLocalSet.mockImplementation((values, callback) => {
        Object.assign(storedValues, values);
        callback();
      });

      await import('./popup');
      await flushAsyncWork();

      expect(mockChromeRuntimeSendMessage).toHaveBeenCalled();
      expect(snapshotReadCalls).toBeGreaterThan(0);
    });

    it('hides the schedule form when cancel button is clicked', async () => {
      const { renderSnapshot } = await import('./popup');
      await flushAsyncWork();

      renderSnapshot(editableSnapshot);
      (
        document.getElementById('btn-add-schedule') as HTMLButtonElement
      ).click();
      await flushAsyncWork();
      expect(document.getElementById('schedule-form-section')?.hidden).toBe(
        false,
      );

      (
        document.getElementById('schedule-form-cancel') as HTMLButtonElement
      ).click();
      await flushAsyncWork();

      expect(document.getElementById('schedule-form-section')?.hidden).toBe(
        true,
      );
      expect(
        (document.getElementById('btn-add-schedule') as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });

    it('shows an error when add-schedule is clicked but no snapshot is loaded', async () => {
      await import('./popup');
      await flushAsyncWork();

      const btn = document.getElementById(
        'btn-add-schedule',
      ) as HTMLButtonElement;
      btn.disabled = false;
      btn.click();
      await flushAsyncWork();

      expect(document.getElementById('status-message')?.textContent).toContain(
        'Analyseer eerst de huidige timesheet voordat je een schema toevoegt',
      );
    });

    it('shows an error when edit-schedule is triggered but no snapshot is loaded', async () => {
      const storedValues: Record<string, unknown> = {
        [STORAGE_KEYS.projectSchedules]: [
          {
            id: 'e1',
            label: 'Test',
            target: {
              targetType: 'project',
              targetCode: 'C001',
              targetLabel: 'Project Alpha',
            },
            hoursPerWeekday: {
              monday: 8,
              tuesday: 0,
              wednesday: 0,
              thursday: 0,
              friday: 0,
              saturday: 0,
              sunday: 0,
            },
          },
        ],
      };
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: storedValues[keys[0]] });
      });

      const { renderSchedules } = await import('./popup');
      await renderSchedules();
      await flushAsyncWork();

      const editBtn = document.querySelector(
        '.schedule-edit-button',
      ) as HTMLButtonElement;
      editBtn.click();
      await flushAsyncWork();

      expect(document.getElementById('status-message')?.textContent).toContain(
        'Analyseer eerst de huidige timesheet voordat je een schema bewerkt',
      );
    });
  });

  describe('popup utility function coverage', () => {
    it('restoreCachedStatusMessage returns false and clears cache for an invalid timestamp', async () => {
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        const value =
          keys[0] === STORAGE_KEYS.statusMessageCache
            ? { message: 'Old', cachedAt: 'not-a-date' }
            : undefined;
        callback({ [keys[0]]: value });
      });

      const { restoreCachedStatusMessage } = await import('./popup');
      await flushAsyncWork();

      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        const value =
          keys[0] === STORAGE_KEYS.statusMessageCache
            ? { message: 'Old', cachedAt: 'not-a-date' }
            : undefined;
        callback({ [keys[0]]: value });
      });
      mockChromeStorageLocalRemove.mockClear();

      const result = await restoreCachedStatusMessage();

      expect(result).toBe(false);
      expect(mockChromeStorageLocalRemove).toHaveBeenCalled();
    });

    it('restoreCachedStatusMessage returns false and clears cache when entry is older than 30 minutes', async () => {
      const expiredIso = new Date(Date.now() - 31 * 60 * 1000).toISOString();
      const setupMock = () =>
        mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
          const value =
            keys[0] === STORAGE_KEYS.statusMessageCache
              ? { message: 'Expired', cachedAt: expiredIso }
              : undefined;
          callback({ [keys[0]]: value });
        });

      setupMock();
      const { restoreCachedStatusMessage } = await import('./popup');
      await flushAsyncWork();
      setupMock();
      mockChromeStorageLocalRemove.mockClear();

      const result = await restoreCachedStatusMessage();

      expect(result).toBe(false);
      expect(mockChromeStorageLocalRemove).toHaveBeenCalled();
    });

    it('restoreCachedStatusMessage returns true and displays a fresh cached message', async () => {
      const freshIso = new Date().toISOString();
      const setupMock = () =>
        mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
          const value =
            keys[0] === STORAGE_KEYS.statusMessageCache
              ? { message: 'Vers bericht', cachedAt: freshIso }
              : undefined;
          callback({ [keys[0]]: value });
        });

      setupMock();
      const { restoreCachedStatusMessage } = await import('./popup');
      await flushAsyncWork();
      setupMock();

      const result = await restoreCachedStatusMessage();

      expect(result).toBe(true);
      expect(document.getElementById('status-message')?.textContent).toBe(
        'Vers bericht',
      );
    });

    it('showScheduleForm wrapper sets state and opens the form', async () => {
      const { showScheduleForm } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 8,
        year: 2026,
        targets: [
          {
            targetType: 'project',
            targetCode: 'C001',
            targetLabel: 'Alpha',
          },
          {
            targetType: 'general-hours',
            targetCode: 'MISC',
            targetLabel: 'Commercial hours',
          },
        ],
        currentProjectCode: 'C001',
        totals: { worked: 0, toBePerformed: 0 },
        sapStatus: 'editable' as const,
      };

      showScheduleForm(snapshot);

      expect(document.getElementById('schedule-form-section')?.hidden).toBe(
        false,
      );
    });
  });
});
