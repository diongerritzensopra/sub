import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {CachedTimesheetSnapshot, TimesheetSnapshot, WeeklySchedule} from '../shared/types';
import { STORAGE_KEYS } from '../shared/storage';

// Mock chrome API before any imports
const mockChromeTabsQuery = vi.fn<
  (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>
>();
const mockChromeRuntimeSendMessage = vi.fn<
  (message: any, options?: chrome.runtime.MessageOptions) => Promise<any>
>();
const mockChromeTabsSendMessage = vi.fn<
  (tabId: number, message: any) => Promise<any>
>();
const mockChromeTabsGet = vi.fn<
  (tabId: number) => Promise<chrome.tabs.Tab>
>();
const mockChromeTabsUpdate = vi.fn<
  (tabId: number, updateProperties: chrome.tabs.UpdateProperties) => Promise<chrome.tabs.Tab>
>();
const mockChromeScriptingExecuteScript = vi.fn<
  (injection: chrome.scripting.ScriptInjection<any[], any>) => Promise<chrome.scripting.InjectionResult[]>
>();
const mockChromeStorageLocalGet = vi.fn<
  (keys: string[], callback: (result: Record<string, unknown>) => void) => void
>();
const mockChromeStorageLocalSet = vi.fn<
  (values: Record<string, unknown>, callback: () => void) => void
>();
const mockChromeStorageLocalRemove = vi.fn<
  (key: string, callback: () => void) => void
>();
globalThis.chrome = {
  tabs: {
    query: mockChromeTabsQuery,
    get: mockChromeTabsGet,
    update: mockChromeTabsUpdate,
    sendMessage: mockChromeTabsSendMessage,
    onUpdated: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
  },
  scripting: {
    executeScript: mockChromeScriptingExecuteScript,
  },
  runtime: {
    sendMessage: mockChromeRuntimeSendMessage,
    onMessage: { addListener: vi.fn() },
    lastError: null,
  },
  storage: {
    local: {
      get: mockChromeStorageLocalGet,
      set: mockChromeStorageLocalSet,
      remove: mockChromeStorageLocalRemove,
    },
  },
  action: {
    setIcon: vi.fn(),
  },
} as unknown as typeof chrome;

// Setup jsdom environment with required elements before importing popup.ts
beforeEach(() => {
  document.body.innerHTML = `
    <div id="app">
      <header>
        <div class="header-content">
          <h1>sub</h1>
          <button id="btn-scrape" type="button">🔄</button>
        </div>
      </header>
      <main>
        <section id="status-section">
          <p id="status-message">Klik op het vernieuwingspictogram om te beginnen.</p>
          <button id="btn-status-dismiss" type="button" title="Sluiten" hidden>×</button>
        </section>
        <section id="schedules-section">
          <h2>Projectschema's</h2>
          <button id="btn-add-schedule" type="button" disabled>Nieuw schema</button>
          <button id="btn-apply-schedules" type="button" disabled>Alles toepassen</button>
          <p id="schedules-empty">Nog geen schema's opgeslagen.</p>
          <ul id="schedules-list" hidden aria-label="Selecteerbare projectschema's"></ul>
        </section>
        <section id="schedule-form-section" hidden>
          <h2 id="schedule-form-title">Nieuw schema</h2>
          <form id="schedule-form">
            <div class="form-group">
              <label for="schedule-label">Naam</label>
              <input type="text" id="schedule-label" required>
            </div>
            <div class="form-group">
              <label for="schedule-project">Projectcode</label>
              <select id="schedule-project" required>
                <option value="">-- Selecteer project --</option>
              </select>
            </div>
            <fieldset class="weekday-hours">
              <legend>Uren per dag</legend>
              <div class="weekday-inputs">
                <div class="weekday-input">
                  <label for="hours-monday">Maandag</label>
                  <input type="number" id="hours-monday" min="0" step="0.5" value="0">
                </div>
                <div class="weekday-input">
                  <label for="hours-tuesday">Dinsdag</label>
                  <input type="number" id="hours-tuesday" min="0" step="0.5" value="0">
                </div>
                <div class="weekday-input">
                  <label for="hours-wednesday">Woensdag</label>
                  <input type="number" id="hours-wednesday" min="0" step="0.5" value="0">
                </div>
                <div class="weekday-input">
                  <label for="hours-thursday">Donderdag</label>
                  <input type="number" id="hours-thursday" min="0" step="0.5" value="0">
                </div>
                <div class="weekday-input">
                  <label for="hours-friday">Vrijdag</label>
                  <input type="number" id="hours-friday" min="0" step="0.5" value="0">
                </div>
                <div class="weekday-input">
                  <label for="hours-saturday">Zaterdag</label>
                  <input type="number" id="hours-saturday" min="0" step="0.5" value="0">
                </div>
                <div class="weekday-input">
                  <label for="hours-sunday">Zondag</label>
                  <input type="number" id="hours-sunday" min="0" step="0.5" value="0">
                </div>
              </div>
            </fieldset>
            <div class="form-actions">
              <button type="submit">Opslaan</button>
              <button type="button" id="schedule-form-cancel">Annuleren</button>
            </div>
          </form>
        </section>
        <section id="summary-section" hidden>
          <h2>Timesheet overzicht</h2>
          <ul id="summary-list">
            <li><strong>Periode:</strong> <span id="period-value">-</span></li>
            <li><strong>Projectcodes:</strong> <span id="project-codes-value">-</span></li>
            <li><strong>Uren gewerkt:</strong> <span id="worked-hours-value">-</span></li>
            <li><strong>Uren uit te voeren:</strong> <span id="to-be-performed-hours-value">-</span></li>
          </ul>
          <p id="scrape-status" class="subtle-indicator" hidden></p>
          <p id="data-origin-indicator" class="subtle-indicator" hidden></p>
        </section>
      </main>
    </div>
  `;

  // Reset mock
  vi.resetModules();
  vi.clearAllMocks();
  mockChromeTabsQuery.mockResolvedValue([]);
  mockChromeTabsGet.mockResolvedValue({ id: 99, status: 'complete' } as chrome.tabs.Tab);
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
          appliedDaysCount: 1,
          failedDates: [],
          submissionAttempted: true,
          submissionConfirmed: true,
        },
      }];
    }
    if (funcName === 'ui5MainWorldReadSnapshot') {
      return [{
        documentId: 'mock-id',
        frameId: 0,
        result: {
          success: false,
          error: 'not mocked',
        },
      }];
    }

    return [{
      documentId: 'mock-id',
      frameId: 0,
      result: undefined,
    }];
  });
  mockChromeTabsSendMessage.mockResolvedValue({ success: false, error: 'not mocked' });
  mockChromeRuntimeSendMessage.mockResolvedValue({
    success: true,
    data: { busy: false },
  });
  mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
    callback({ [keys[0]]: undefined });
  });
  mockChromeStorageLocalSet.mockImplementation((_values, callback) => {
    callback();
  });
  mockChromeStorageLocalRemove.mockImplementation((_key, callback) => {
    callback();
  });
});

describe('popup', () => {
  describe('schedule list', () => {
    it('shows empty state when no schedules are stored', async () => {
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: undefined });
      });

      await import('./popup');
      await new Promise((r) => setTimeout(r, 0));

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
      await new Promise((r) => setTimeout(r, 0));

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
        cachedAt: '2026-05-12T10:00:00.000Z',
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
      await new Promise((r) => setTimeout(r, 0));

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
      await new Promise((r) => setTimeout(r, 0));

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
        cachedAt: '2026-05-12T10:00:00.000Z',
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
      await new Promise((r) => setTimeout(r, 0));

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
      await new Promise((r) => setTimeout(r, 0));

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
      await new Promise((r) => setTimeout(r, 0));

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
         cachedAt: '2026-05-12T10:00:00.000Z',
       };
      // Cache already has complete data; fresh scrape returns partial
      const storedValues: Record<string, unknown> = { timesheetSnapshotCache: existingCache };
      setupScrapeReturning(partialSnapshot, storedValues);

      await import('./popup');
      await new Promise((r) => setTimeout(r, 0));

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
       await new Promise((r) => setTimeout(r, 0));

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
        cachedAt: '2026-05-12T10:00:00.000Z',
      };

      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: true } });
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: cachedData });
      });

      await import('./popup');
      await new Promise((r) => setTimeout(r, 0));

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
        cachedAt: '2026-05-12T10:00:00.000Z',
      };
      const loadingTab = { ...sapTab, status: 'loading' } as chrome.tabs.Tab;

      mockChromeTabsQuery.mockResolvedValue([loadingTab]);
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: cachedData });
      });

      await import('./popup');
      await new Promise((r) => setTimeout(r, 0));

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
      await new Promise((r) => setTimeout(r, 0));

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

  describe('formatHours', () => {
    it('formats number with decimal separator as comma', async () => {
      const { formatHours } = await import('./popup');

      expect(formatHours(7.5)).toBe('7,5 u');
    });

    it('formats whole numbers without decimal', async () => {
      const { formatHours } = await import('./popup');

      expect(formatHours(8)).toBe('8 u');
    });

    it('returns "-" when value is null', async () => {
      const { formatHours } = await import('./popup');

      expect(formatHours(null)).toBe('-');
    });

    it('handles large numbers', async () => {
      const { formatHours } = await import('./popup');
      expect(formatHours(160.5)).toBe('160,5 u');
    });
  });
  describe('renderSnapshot', () => {
    it('displays month and year when both are provided', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        currentProjectCode: null,
        totals: {
          worked: 0,
          
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('period-value')?.textContent).toBe('4/2026');
    });

    it('displays "-" when month or year is null', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: null,
        year: null,
        projectCodes: [],
        currentProjectCode: null,
        totals: {
          worked: 0,
          
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('period-value')?.textContent).toBe('-');
    });

    it('displays project codes joined by comma', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: ['ZMOCK_001.1.1', 'ZTEST_42'],
        currentProjectCode: 'ZMOCK_001.1.1',
        totals: {
          worked: null,
          
          toBePerformed: null,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('project-codes-value')?.textContent).toBe(
        'ZMOCK_001.1.1, ZTEST_42'
      );
    });

    it('displays "-" when project codes array is empty', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        currentProjectCode: null,
        totals: {
          worked: null,
          
          toBePerformed: null,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('project-codes-value')?.textContent).toBe('-');
    });

    it('displays formatted hours for all totals', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        currentProjectCode: null,
        totals: {
          worked: 134.5,
          
          toBePerformed: 160,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('worked-hours-value')?.textContent).toBe('134,5 u');
      expect(document.getElementById('to-be-performed-hours-value')?.textContent).toBe('160 u');
    });

    it('unhides summary section after rendering', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        currentProjectCode: null,
        totals: {
          worked: 0,
          
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      const summarySection = document.getElementById('summary-section') as HTMLElement;
      expect(summarySection.hidden).toBe(true);

      renderSnapshot(snapshot);

      expect(summarySection.hidden).toBe(false);
    });

    it('displays null totals as "-"', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        currentProjectCode: null,
        totals: {
          worked: null,
          
          toBePerformed: null,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('worked-hours-value')?.textContent).toBe('-');
      expect(document.getElementById('to-be-performed-hours-value')?.textContent).toBe('-');
    });

    it('hides scrape status indicator when all data is present', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        currentProjectCode: null,
        totals: {
          worked: 160,
          
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot, true);

      expect(document.getElementById('scrape-status')?.hidden).toBe(true);
    });

    it('shows subtle warning status indicator when data is incomplete', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        currentProjectCode: null,
        totals: {
          worked: 160,
          
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot, false);

      expect(document.getElementById('scrape-status')?.hidden).toBe(false);
      expect(document.getElementById('scrape-status')?.textContent).toBe('Onvolledig');
      expect(document.getElementById('scrape-status')?.classList.contains('warning')).toBe(true);
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

  describe('schedule form', () => {
    it('keeps the add button disabled until a snapshot is rendered', async () => {
      await import('./popup');

      expect(document.getElementById('btn-add-schedule')?.hasAttribute('disabled')).toBe(true);
    });

    it('opens the form from the add button after a snapshot is rendered', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 5,
        year: 2026,
        projectCodes: ['ZMOCK_001.1.1', 'ZTEST_42'],
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
      expect(projectSelect.innerHTML).toContain('ZMOCK_001.1.1');
      expect(projectSelect.innerHTML).toContain('ZTEST_42');
    });

    it('displays form with project options from snapshot', async () => {
      const { showScheduleForm } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 5,
        year: 2026,
        projectCodes: ['ZMOCK_001.1.1', 'ZTEST_42'],
        currentProjectCode: 'ZMOCK_001.1.1',
        totals: { worked: 120, toBePerformed: 160 },
        sapStatus: 'editable',
      };

      showScheduleForm(snapshot);

      const formSection = document.getElementById('schedule-form-section') as HTMLElement;
      const projectSelect = document.getElementById('schedule-project') as HTMLSelectElement;

      expect(formSection.hidden).toBe(false);
      expect(projectSelect.querySelectorAll('option')).toHaveLength(3); // blank + 2 projects
      expect(projectSelect.innerHTML).toContain('ZMOCK_001.1.1');
      expect(projectSelect.innerHTML).toContain('ZTEST_42');
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
        projectCodes: ['ZMOCK_001.1.1'],
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

      // Wait for async save
      await new Promise((r) => setTimeout(r, 10));

       const formSection = document.getElementById('schedule-form-section') as HTMLElement;
       expect(formSection.hidden).toBe(true); // Form should be hidden after save
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
         projectCodes: ['ZMOCK_001.1.1'],
         currentProjectCode: 'ZMOCK_001.1.1',
         totals: { worked: 120, toBePerformed: 160 },
         sapStatus: 'editable',
       };

       // Render the schedule list and snapshot
       await renderSchedules();
       renderSnapshot(snapshot);

       await new Promise((r) => setTimeout(r, 10));

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
         projectCodes: ['ZMOCK_001.1.1', 'ZTEST_42'],
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
         projectCodes: ['ZMOCK_001.1.1'],
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

       // Wait for async save
       await new Promise((r) => setTimeout(r, 10));

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
         projectCodes: ['ZMOCK_001.1.1'],
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

       // Wait for async save and status message
       await new Promise((r) => setTimeout(r, 20));

       expect(document.getElementById('status-message')?.textContent).toContain('bijgewerkt');
     });
   });

  describe('schedule delete', () => {
    const makeSchedule = (id: string, label: string): WeeklySchedule => ({
      id,
      label,
      projectCode: 'ZMOCK_001.1.1',
      hoursPerWeekday: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
    });

    const editableSnapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projectCodes: ['ZMOCK_001.1.1'],
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
      await new Promise((r) => setTimeout(r, 10));

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
      await new Promise((r) => setTimeout(r, 10));

      expect(document.getElementById('schedules-empty')?.hidden).toBe(false);
      expect(document.getElementById('schedules-list')?.hidden).toBe(true);
    });
  });

  describe('schedule apply', () => {
    const makeSchedule = (id: string, label: string, projectCode: string): WeeklySchedule => ({
      id,
      label,
      projectCode,
      hoursPerWeekday: { monday: 8, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
    });

    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projectCodes: ['ZMOCK_001.1.1', 'ZTEST_42'],
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
      await new Promise((r) => setTimeout(r, 0));

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

      await new Promise((r) => setTimeout(r, 25));
      vi.clearAllMocks();
      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      document.getElementById('status-message')!.textContent = '';
      applyButton.disabled = false;
      applyButton.click();
      await new Promise((r) => setTimeout(r, 10));

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
      await new Promise((r) => setTimeout(r, 25));

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
      await new Promise((r) => setTimeout(r, 40));

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
      await new Promise((r) => setTimeout(r, 25));

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
      await new Promise((r) => setTimeout(r, 25));

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
      await new Promise((r) => setTimeout(r, 25));

      expect(mockChromeTabsUpdate).not.toHaveBeenCalled();
      expect(mockChromeTabsGet).toHaveBeenCalledTimes(1);
      expect(mockChromeScriptingExecuteScript).toHaveBeenCalledTimes(1);
      expect(document.getElementById('status-message')?.textContent).toContain('Schema toegepast: Kantooruren.');
      expect(document.getElementById('status-message')?.textContent).toContain('1/');
      expect(document.getElementById('status-message')?.textContent).toContain('dagen bijgewerkt');
      expect(document.getElementById('status-message')?.textContent).toContain('SAP bevestiging: ontvangen (1/1)');
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
      await new Promise((r) => setTimeout(r, 25));

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
      await new Promise((r) => setTimeout(r, 25));

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

      await new Promise((r) => setTimeout(r, 25));
      vi.clearAllMocks();

      const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
      applyButton.click();
      await new Promise((r) => setTimeout(r, 25));

      expect(mockChromeTabsQuery).not.toHaveBeenCalled();
      expect(mockChromeTabsUpdate).not.toHaveBeenCalled();
      expect(document.getElementById('status-message')?.textContent).toContain('UNAVAILABLE_PROJECT');
      expect(document.getElementById('status-message')?.textContent).toContain('niet beschikbaar');
    });
  });

  describe('timesheet lock state', () => {
    const sapTab = {
      id: 99,
      url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/8/2026/project/ZSST',
      status: 'complete',
    } as chrome.tabs.Tab;

    const lockedSnapshot: TimesheetSnapshot = {
      month: 8,
      year: 2026,
      projectCodes: ['ZMOCK_001.1.1'],
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
      await new Promise((r) => setTimeout(r, 40));

      expect(document.getElementById('status-message')?.textContent).toContain('vergrendeld');
      expect((document.getElementById('btn-scrape') as HTMLButtonElement).disabled).toBe(false);
      expect((document.getElementById('btn-add-schedule') as HTMLButtonElement).disabled).toBe(false);
      expect((document.getElementById('btn-apply-schedules') as HTMLButtonElement).disabled).toBe(true);

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
      await new Promise((r) => setTimeout(r, 40));

      expect((document.getElementById('btn-scrape') as HTMLButtonElement).disabled).toBe(false);
      expect((document.getElementById('btn-add-schedule') as HTMLButtonElement).disabled).toBe(false);
      expect((document.getElementById('btn-apply-schedules') as HTMLButtonElement).disabled).toBe(false);

      const editButton = document.querySelector('#schedules-list .schedule-edit-button') as HTMLButtonElement;
      const deleteButton = document.querySelector('#schedules-list .schedule-delete-button') as HTMLButtonElement;
      expect(editButton?.disabled).toBe(false);
      expect(deleteButton?.disabled).toBe(false);
    });
  });

  describe('status message caching', () => {
    it('setStatus with persist=true saves message to storage', async () => {
      const { setStatus } = await import('./popup');

      setStatus('5/21 dagen bijgewerkt.', true);

      expect(mockChromeStorageLocalSet).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.statusMessageCache]: expect.objectContaining({ message: '5/21 dagen bijgewerkt.' }),
        }),
        expect.any(Function),
      );
    });

    it('setStatus with persist=false does not save message to storage', async () => {
      const { setStatus } = await import('./popup');

      setStatus('Pagina analyseren...', false);

      expect(mockChromeStorageLocalSet).not.toHaveBeenCalledWith(
        expect.objectContaining({ [STORAGE_KEYS.statusMessageCache]: expect.anything() }),
        expect.any(Function),
      );
    });

    it('setStatus with persist=true shows the dismiss button', async () => {
      const { setStatus } = await import('./popup');

      setStatus('Boekingen gelukt.', true);

      expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(false);
    });

    it('setStatus with persist=false hides the dismiss button', async () => {
      const { setStatus } = await import('./popup');

      setStatus('Pagina analyseren...', false);

      expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(true);
    });

    it('setStatus with empty string hides the dismiss button', async () => {
      const { setStatus } = await import('./popup');
      setStatus('Bericht', true); // first set a visible message
      setStatus(''); // then clear

      expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(true);
    });

    it('clicking dismiss button clears message and removes it from storage', async () => {
      const { setStatus } = await import('./popup');
      setStatus('Te verwijderen bericht.', true);

      const dismissButton = document.getElementById('btn-status-dismiss') as HTMLButtonElement;
      dismissButton.click();

      expect(document.getElementById('status-message')?.textContent).toBe('');
      expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(true);
      expect(mockChromeStorageLocalRemove).toHaveBeenCalledWith(
        STORAGE_KEYS.statusMessageCache,
        expect.any(Function),
      );
    });

    it('restores cached status message when analyseActiveTab succeeds', async () => {
      const sapTab = {
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/8/2026/project/ZSST',
        status: 'complete',
      } as chrome.tabs.Tab;
      const freshCachedMessage = {
        message: 'Eerder resultaat: 5 dagen bijgewerkt.',
        cachedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
      };

      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: false } });
      mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
        if (injection.func?.name === 'ui5MainWorldReadSnapshot') {
          return [{
            documentId: 'mock-id',
            frameId: 0,
            result: {
              success: true,
              snapshot: {
                month: 8, year: 2026,
                projectCodes: [],
                currentProjectCode: null,
                totals: { worked: null, toBePerformed: null },
                sapStatus: 'editable',
              },
            },
          }];
        }
        return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
      });
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        if (keys[0] === STORAGE_KEYS.statusMessageCache) {
          callback({ [keys[0]]: freshCachedMessage });
        } else {
          callback({ [keys[0]]: undefined });
        }
      });

      await import('./popup');
      await new Promise((r) => setTimeout(r, 50));

      expect(document.getElementById('status-message')?.textContent).toBe(freshCachedMessage.message);
      expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(false);
    });

    it('restores persisted status after pressing refresh and temporary loading messages', async () => {
      const sapTab = {
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/8/2026/project/ZSST',
        status: 'complete',
      } as chrome.tabs.Tab;
      const storedValues: Record<string, unknown> = {};

      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: false } });
      mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
        if (injection.func?.name === 'ui5MainWorldReadSnapshot') {
          return [{
            documentId: 'mock-id',
            frameId: 0,
            result: {
              success: true,
              snapshot: {
                month: 8,
                year: 2026,
                projectCodes: [],
                currentProjectCode: null,
                totals: { worked: null, toBePerformed: null },
                sapStatus: 'editable',
              },
            },
          }];
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
      await new Promise((r) => setTimeout(r, 30));

      setStatus('Eerder resultaat: 5 dagen bijgewerkt.', true);
      expect(document.getElementById('status-message')?.textContent).toBe('Eerder resultaat: 5 dagen bijgewerkt.');

      (document.getElementById('btn-scrape') as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 40));

      expect(document.getElementById('status-message')?.textContent).toBe('Eerder resultaat: 5 dagen bijgewerkt.');
      expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(false);
    });

    it('does not restore cached status message when analyseActiveTab sets an error', async () => {
      const nonSapTab = {
        id: 99,
        url: 'https://www.google.com',
        status: 'complete',
      } as chrome.tabs.Tab;
      const freshCachedMessage = {
        message: 'Eerder resultaat: 5 dagen bijgewerkt.',
        cachedAt: new Date().toISOString(),
      };

      mockChromeTabsQuery.mockResolvedValue([nonSapTab]);
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        if (keys[0] === STORAGE_KEYS.statusMessageCache) {
          callback({ [keys[0]]: freshCachedMessage });
        } else {
          callback({ [keys[0]]: undefined });
        }
      });

      await import('./popup');
      await new Promise((r) => setTimeout(r, 50));

      expect(document.getElementById('status-message')?.textContent).toContain('Fout:');
      expect(document.getElementById('status-message')?.textContent).not.toContain('Eerder resultaat');
    });

    it('does not restore a cached status message older than 30 minutes', async () => {
      const sapTab = {
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/8/2026/project/ZSST',
        status: 'complete',
      } as chrome.tabs.Tab;
      const expiredCachedMessage = {
        message: 'Oud bericht.',
        cachedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(), // 31 min ago
      };

      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: false } });
      mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
        if (injection.func?.name === 'ui5MainWorldReadSnapshot') {
          return [{
            documentId: 'mock-id',
            frameId: 0,
            result: {
              success: true,
              snapshot: {
                month: 8, year: 2026,
                projectCodes: [],
                currentProjectCode: null,
                totals: { worked: null, toBePerformed: null },
                sapStatus: 'editable',
              },
            },
          }];
        }
        return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
      });
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        if (keys[0] === STORAGE_KEYS.statusMessageCache) {
          callback({ [keys[0]]: expiredCachedMessage });
        } else {
          callback({ [keys[0]]: undefined });
        }
      });

      await import('./popup');
      await new Promise((r) => setTimeout(r, 50));

      expect(document.getElementById('status-message')?.textContent).toBe('');
      expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(true);
      expect(mockChromeStorageLocalRemove).toHaveBeenCalledWith(
        STORAGE_KEYS.statusMessageCache,
        expect.any(Function),
      );
    });
  });
 });
