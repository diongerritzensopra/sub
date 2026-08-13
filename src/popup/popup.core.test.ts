import { describe, it, expect, beforeEach } from 'vitest';
import type { CachedTimesheetSnapshot, TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import {
  flushAsyncWork,
  mockChromeRuntimeSendMessage,
  mockChromeScriptingExecuteScript,
  mockChromeStorageLocalGet,
  mockChromeStorageLocalRemove,
  mockChromeStorageLocalSet,
  mockChromeTabsQuery,
  resetPopupTestEnvironment,
} from './popup.test-helpers';

beforeEach(() => {
  resetPopupTestEnvironment();
});

function recentCacheTimestamp(daysAgo: number = 1): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

describe('popup core', () => {
  describe('schedule list', () => {
    it('shows empty state when no schedules are stored', async () => {
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: undefined });
      });

      await import('./popup');
      await flushAsyncWork();

      expect(document.getElementById('schedules-empty')?.hidden).toBe(false);
      expect(document.getElementById('schedules-list')?.hidden).toBe(true);
    });

    it('renders saved schedules in read-only list', async () => {
      const schedules: WeeklySchedule[] = [
        {
          id: 'schedule-1',
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
        },
        {
          id: 'schedule-2',
          label: 'Deeltijd',
          projectCode: 'ZTEST_42',
          hoursPerWeekday: {
            monday: 4,
            tuesday: 4,
            wednesday: 4,
            thursday: 4,
            friday: 4,
            saturday: 0,
            sunday: 0,
          },
        },
      ];

      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        const key = keys[0];
        if (key === 'projectSchedules') {
          callback({ [key]: schedules });
          return;
        }
        callback({ [key]: undefined });
      });

      await import('./popup');
      await flushAsyncWork();

      const list = document.getElementById('schedules-list') as HTMLUListElement;
      expect(document.getElementById('schedules-empty')?.hidden).toBe(true);
      expect(list.hidden).toBe(false);
      expect(list.querySelectorAll('li')).toHaveLength(2);
      expect(list.textContent).toContain('Kantooruren');
      expect(list.textContent).toContain('Project: ZMOCK_001.1.1');
      expect(list.textContent).toContain('Deeltijd');
      expect(list.textContent).toContain('Project: ZTEST_42');
    });
  });

  describe('cache bootstrap', () => {
    it('renders cached snapshot when it matches period from route query parameter', async () => {
      const cached: CachedTimesheetSnapshot = {
        snapshot: {
          month: 5,
          year: 2026,
          projectCodes: ['ZMOCK_001.1.1'],
          currentProjectCode: 'ZMOCK_001.1.1',
          totals: {
            worked: 120,

            toBePerformed: 160,
          },
          sapStatus: 'editable',
        },
        cachedAt: recentCacheTimestamp(),
      };
      mockChromeTabsQuery.mockResolvedValue([{
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/5/2026/project/ZSST',
        status: 'complete',
      } as chrome.tabs.Tab]);
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: cached });
      });

      await import('./popup');
      await flushAsyncWork();

      expect(document.getElementById('period-value')?.textContent).toBe('5/2026');
      expect(document.getElementById('project-codes-value')?.textContent).toBe('ZMOCK_001.1.1');
      expect(document.getElementById('worked-hours-value')?.textContent).toBe('120 u');
      expect(document.getElementById('summary-section')?.hasAttribute('hidden')).toBe(false);
      expect(document.getElementById('data-origin-indicator')?.textContent).toContain('Cache gebruikt');
      expect(document.getElementById('data-origin-indicator')?.classList.contains('cached')).toBe(true);
    });

    it('clears and does not render a stale cached snapshot when route period differs', async () => {
      const staleCache: CachedTimesheetSnapshot = {
        snapshot: {
          month: 4,
          year: 2026,
          projectCodes: ['ZMOCK_001.1.1'],
          currentProjectCode: 'ZMOCK_001.1.1',
          totals: { worked: 120, toBePerformed: 160 },
          sapStatus: 'editable',
        },
        cachedAt: '2026-04-30T10:00:00.000Z',
      };
      mockChromeTabsQuery.mockResolvedValue([{
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/5/2026/project/ZSST',
        status: 'complete',
      } as chrome.tabs.Tab]);
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: staleCache });
      });

      await import('./popup');
      await flushAsyncWork();

      // Summary section should remain hidden — stale data should not be displayed
      expect(document.getElementById('summary-section')?.hidden).toBe(true);
      // Cache should have been cleared
      expect(mockChromeStorageLocalRemove).toHaveBeenCalled();
    });

    it('validates cache against current date when route has no month/year parameter', async () => {
      const now = new Date();
      const currentCache: CachedTimesheetSnapshot = {
        snapshot: {
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          projectCodes: ['ZMOCK_001.1.1'],
          currentProjectCode: 'ZMOCK_001.1.1',
          totals: { worked: 120, toBePerformed: 160 },
          sapStatus: 'editable',
        },
        cachedAt: recentCacheTimestamp(),
      };
      mockChromeTabsQuery.mockResolvedValue([{
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
        status: 'complete',
      } as chrome.tabs.Tab]);
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: currentCache });
      });

      await import('./popup');
      await flushAsyncWork();

      expect(document.getElementById('period-value')?.textContent).toBe(`${currentCache.snapshot.month}/${currentCache.snapshot.year}`);
      expect(mockChromeStorageLocalRemove).not.toHaveBeenCalled();
    });
  });

  describe('cache write-through', () => {
    const sapTab = {
      id: 99,
      url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/5/2026/project/ZSST',
      status: 'complete',
    } as chrome.tabs.Tab;

    function setupScrapeReturning(snapshot: TimesheetSnapshot, storedValues: Record<string, unknown> = {}) {
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
            },
          }];
        }

        return [{
          documentId: 'mock-id',
          frameId: 0,
          result: undefined,
        }];
      });
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: storedValues[keys[0]] });
      });
      mockChromeStorageLocalSet.mockImplementation((values, callback) => {
        Object.assign(storedValues, values);
        callback();
      });
    }

    it('saves snapshot to cache after successful scrape', async () => {
      const snapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['ZMOCK_001.1.1'],
        currentProjectCode: 'ZMOCK_001.1.1',
        totals: { worked: 120, toBePerformed: 160 },
        sapStatus: 'editable',
      };
      const storedValues: Record<string, unknown> = {};
      setupScrapeReturning(snapshot, storedValues);

      await import('./popup');
      await flushAsyncWork();

       expect(mockChromeStorageLocalSet).toHaveBeenCalledWith(
         expect.objectContaining({
           timesheetSnapshotCache: expect.objectContaining({ snapshot }),
         }),
         expect.any(Function),
       );
       expect(document.getElementById('data-origin-indicator')?.textContent).toContain('Vers bijgewerkt');
       expect(document.getElementById('data-origin-indicator')?.classList.contains('fresh')).toBe(true);
    });

    it('renders summary values from the UI5 main-world snapshot reader', async () => {
      const snapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['ZMOCK_001.1.1', 'ZTEST_42'],
        currentProjectCode: 'ZMOCK_001.1.1',
        totals: { worked: 120, toBePerformed: 160 },
        sapStatus: 'editable',
      };
      setupScrapeReturning(snapshot);

      await import('./popup');
      await flushAsyncWork();

      expect(document.getElementById('period-value')?.textContent).toBe('5/2026');
      expect(document.getElementById('project-codes-value')?.textContent).toBe('ZMOCK_001.1.1, ZTEST_42');
      expect(document.getElementById('worked-hours-value')?.textContent).toBe('120 u');
      expect(document.getElementById('to-be-performed-hours-value')?.textContent).toBe('160 u');
    });

    it('does not overwrite a complete cache with a partial fresh snapshot', async () => {
      const completeSnapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['ZMOCK_001.1.1'],
        currentProjectCode: 'ZMOCK_001.1.1',
        totals: { worked: 120, toBePerformed: 160 },
        sapStatus: 'editable',
      };
      const partialSnapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['ZMOCK_001.1.1'],
        currentProjectCode: 'ZMOCK_001.1.1',
        totals: { worked: null, toBePerformed: null },
        sapStatus: 'editable',
      };
       const existingCache: CachedTimesheetSnapshot = {
         snapshot: completeSnapshot,
         cachedAt: recentCacheTimestamp(),
       };
      // Cache already has complete data; fresh scrape returns partial
      const storedValues: Record<string, unknown> = { timesheetSnapshotCache: existingCache };
      setupScrapeReturning(partialSnapshot, storedValues);

      await import('./popup');
      await flushAsyncWork();

      // set should not have been called with partial data
      expect(mockChromeStorageLocalSet).not.toHaveBeenCalledWith(
        expect.objectContaining({
          timesheetSnapshotCache: expect.objectContaining({ snapshot: partialSnapshot }),
        }),
        expect.any(Function),
      );
    });

    it('caches snapshot even when it has no month or year', async () => {
       const snapshotNoDate: TimesheetSnapshot = {
         month: null, year: null,
         projectCodes: [],
         currentProjectCode: null,
         totals: { worked: null, toBePerformed: null },
         sapStatus: 'editable',
       };
       setupScrapeReturning(snapshotNoDate);

       await import('./popup');
       await flushAsyncWork();

       expect(mockChromeStorageLocalSet).toHaveBeenCalledWith(
         expect.objectContaining({
           timesheetSnapshotCache: expect.objectContaining({ snapshot: snapshotNoDate }),
         }),
         expect.any(Function),
       );
      });
   });

  describe('busy/loading UX behavior', () => {
    const sapTab = {
      id: 99,
      url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/5/2026/project/ZSST',
      status: 'complete',
    } as chrome.tabs.Tab;

    it('shows cached data and gentle loading message when SAP page is loading', async () => {
      const cachedSnapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['ZMOCK_001.1.1'],
        currentProjectCode: 'ZMOCK_001.1.1',
        totals: { worked: 120, toBePerformed: 160 },
        sapStatus: 'editable',
      };
      const cachedData: CachedTimesheetSnapshot = {
        snapshot: cachedSnapshot,
        cachedAt: recentCacheTimestamp(),
      };

      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: true } });
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: cachedData });
      });

      await import('./popup');
      await flushAsyncWork();

      // Cached data should still be visible
      expect(document.getElementById('period-value')?.textContent).toBe('5/2026');
      expect(document.getElementById('project-codes-value')?.textContent).toBe('ZMOCK_001.1.1');
      expect(document.getElementById('worked-hours-value')?.textContent).toBe('120 u');
      // Status message should be gentle, not an error
      expect(document.getElementById('status-message')?.textContent).toContain('Pagina laadt nog');
    });

    it('returns early with cached data visible when tab status is loading', async () => {
      const cachedSnapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['ZMOCK_001.1.1'],
        currentProjectCode: 'ZMOCK_001.1.1',
        totals: { worked: 120, toBePerformed: 160 },
        sapStatus: 'editable',
      };
      const cachedData: CachedTimesheetSnapshot = {
        snapshot: cachedSnapshot,
        cachedAt: recentCacheTimestamp(),
      };
      const loadingTab = { ...sapTab, status: 'loading' } as chrome.tabs.Tab;

      mockChromeTabsQuery.mockResolvedValue([loadingTab]);
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: cachedData });
      });

      await import('./popup');
      await flushAsyncWork();

      // Cached data should still be visible
      expect(document.getElementById('period-value')?.textContent).toBe('5/2026');
      expect(document.getElementById('summary-section')?.hidden).toBe(false);
      // Should not throw error when cached data is available
      expect(document.getElementById('status-message')?.textContent).toContain('Pagina laadt nog');
    });

    it('throws error when tab is loading and no cached data available', async () => {
      const loadingTab = { ...sapTab, status: 'loading' } as chrome.tabs.Tab;

      mockChromeTabsQuery.mockResolvedValue([loadingTab]);
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: undefined });
      });

      await import('./popup');
      await flushAsyncWork();

      // Should show error
      expect(document.getElementById('status-message')?.textContent).toContain('Fout:');
      expect(document.getElementById('status-message')?.textContent).toContain('De pagina laadt nog');
    });
   });

  describe('isTimesheetTab', () => {
    it('returns true when tab URL includes SAP timesheet pattern', async () => {
      const { isTimesheetTab } = await import('./popup');
      const tab = {
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
        id: 1,
      } as chrome.tabs.Tab;

      expect(isTimesheetTab(tab)).toBe(true);
    });

    it('returns false when tab URL does not include pattern', async () => {
      const { isTimesheetTab } = await import('./popup');
      const tab = {
        url: 'https://www.google.com',
        id: 1,
      } as chrome.tabs.Tab;

      expect(isTimesheetTab(tab)).toBe(false);
    });

    it('returns false when tab is undefined', async () => {
      const { isTimesheetTab } = await import('./popup');

      expect(isTimesheetTab(undefined)).toBe(false);
    });
  });

  describe('extractPeriodFromTimesheetUrl', () => {
    it('extracts period when route contains month/year query segment', async () => {
      const { extractPeriodFromTimesheetUrl } = await import('./popup');
      const period = extractPeriodFromTimesheetUrl(
        'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/4/2026/project/ZSST',
      );

      expect(period).toEqual({ month: 4, year: 2026 });
    });

    it('returns null when route has no month/year query segment', async () => {
      const { extractPeriodFromTimesheetUrl } = await import('./popup');
      const period = extractPeriodFromTimesheetUrl(
        'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
      );

      expect(period).toBeNull();
    });
  });


  describe('setStatus', () => {
    it('updates status message text', async () => {
      const { setStatus } = await import('./popup');
      const message = 'Test status message';

      setStatus(message);

      expect(document.getElementById('status-message')?.textContent).toBe(message);
    });

    it('clears previous message', async () => {
      const { setStatus } = await import('./popup');

      setStatus('First message');
      expect(document.getElementById('status-message')?.textContent).toBe('First message');

      setStatus('Second message');
      expect(document.getElementById('status-message')?.textContent).toBe('Second message');
    });
  });

  describe('getActiveTab', () => {
    it('returns the active tab in current window', async () => {
      const mockTab = { id: 42, url: 'https://example.com' } as chrome.tabs.Tab;
      mockChromeTabsQuery.mockResolvedValue([mockTab]);

      const { getActiveTab } = await import('./popup');
      const tab = await getActiveTab();

      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(tab).toEqual(mockTab);
    });

    it('returns undefined when no active tab found', async () => {
      mockChromeTabsQuery.mockResolvedValue([]);

      const { getActiveTab } = await import('./popup');
      const tab = await getActiveTab();

      expect(tab).toBeUndefined();
    });
  });
 });
