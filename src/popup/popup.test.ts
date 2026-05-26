import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CachedTimesheetSnapshot, TimesheetSnapshot, WeeklySchedule } from '../shared/types';
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
    get: vi.fn(),
    sendMessage: mockChromeTabsSendMessage,
    onUpdated: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
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
        </section>
        <section id="schedules-section">
          <h2>Projectschema's</h2>
          <button id="btn-add-schedule" type="button" disabled>Nieuw schema</button>
          <p id="schedules-empty">Nog geen schema's opgeslagen.</p>
          <ul id="schedules-list" hidden></ul>
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
            <li><strong>Uren afwezig:</strong> <span id="absent-hours-value">-</span></li>
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
          projectCode: 'C0007012.1.1',
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
      expect(list.textContent).toContain('Project: C0007012.1.1');
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
          projectCodes: ['C0007012.1.1'],
          totals: {
            worked: 120,
            absent: 8,
            toBePerformed: 160,
          },
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
      expect(document.getElementById('project-codes-value')?.textContent).toBe('C0007012.1.1');
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
          projectCodes: ['C0007012.1.1'],
          totals: { worked: 120, absent: 8, toBePerformed: 160 },
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
          projectCodes: ['C0007012.1.1'],
          totals: { worked: 120, absent: 8, toBePerformed: 160 },
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
      url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
      status: 'complete',
    } as chrome.tabs.Tab;

    function setupScrapeReturning(snapshot: TimesheetSnapshot, storedValues: Record<string, unknown> = {}) {
      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: false } });
      mockChromeTabsSendMessage.mockResolvedValue({ success: true, data: snapshot });
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
        projectCodes: ['C0007012.1.1'],
        totals: { worked: 120, absent: 8, toBePerformed: 160 },
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

    it('does not overwrite a complete cache with a partial fresh snapshot', async () => {
      const completeSnapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['C0007012.1.1'],
        totals: { worked: 120, absent: 8, toBePerformed: 160 },
      };
      const partialSnapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['C0007012.1.1'],
        totals: { worked: null, absent: null, toBePerformed: null },
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
         totals: { worked: null, absent: null, toBePerformed: null },
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
      url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
      status: 'complete',
    } as chrome.tabs.Tab;

    it('shows cached data and gentle loading message when SAP page is loading', async () => {
      const cachedSnapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['C0007012.1.1'],
        totals: { worked: 120, absent: 8, toBePerformed: 160 },
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
      expect(document.getElementById('project-codes-value')?.textContent).toBe('C0007012.1.1');
      expect(document.getElementById('worked-hours-value')?.textContent).toBe('120 u');
      // Status message should be gentle, not an error
      expect(document.getElementById('status-message')?.textContent).toContain('Pagina laadt nog');
    });

    it('returns early with cached data visible when tab status is loading', async () => {
      const cachedSnapshot: TimesheetSnapshot = {
        month: 5, year: 2026,
        projectCodes: ['C0007012.1.1'],
        totals: { worked: 120, absent: 8, toBePerformed: 160 },
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
        totals: {
          worked: 0,
          absent: 0,
          toBePerformed: 0,
        },
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
        totals: {
          worked: 0,
          absent: 0,
          toBePerformed: 0,
        },
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('period-value')?.textContent).toBe('-');
    });

    it('displays project codes joined by comma', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: ['C0007012.1.1', 'ZTEST_42'],
        totals: {
          worked: null,
          absent: null,
          toBePerformed: null,
        },
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('project-codes-value')?.textContent).toBe(
        'C0007012.1.1, ZTEST_42'
      );
    });

    it('displays "-" when project codes array is empty', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        totals: {
          worked: null,
          absent: null,
          toBePerformed: null,
        },
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
        totals: {
          worked: 134.5,
          absent: 8,
          toBePerformed: 160,
        },
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('worked-hours-value')?.textContent).toBe('134,5 u');
      expect(document.getElementById('absent-hours-value')?.textContent).toBe('8 u');
      expect(document.getElementById('to-be-performed-hours-value')?.textContent).toBe('160 u');
    });

    it('unhides summary section after rendering', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        totals: {
          worked: 0,
          absent: 0,
          toBePerformed: 0,
        },
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
        totals: {
          worked: null,
          absent: null,
          toBePerformed: null,
        },
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('worked-hours-value')?.textContent).toBe('-');
      expect(document.getElementById('absent-hours-value')?.textContent).toBe('-');
      expect(document.getElementById('to-be-performed-hours-value')?.textContent).toBe('-');
    });

    it('hides scrape status indicator when all data is present', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projectCodes: [],
        totals: {
          worked: 160,
          absent: 0,
          toBePerformed: 0,
        },
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
        totals: {
          worked: 160,
          absent: null,
          toBePerformed: 0,
        },
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
        projectCodes: ['C0007012.1.1', 'ZTEST_42'],
        totals: { worked: 120, absent: 8, toBePerformed: 160 },
      };

      renderSnapshot(snapshot);

      const button = document.getElementById('btn-add-schedule') as HTMLButtonElement;
      expect(button.disabled).toBe(false);

      button.click();

      const formSection = document.getElementById('schedule-form-section') as HTMLElement;
      const projectSelect = document.getElementById('schedule-project') as HTMLSelectElement;

      expect(formSection.hidden).toBe(false);
      expect(projectSelect.querySelectorAll('option')).toHaveLength(3);
      expect(projectSelect.innerHTML).toContain('C0007012.1.1');
      expect(projectSelect.innerHTML).toContain('ZTEST_42');
    });

    it('displays form with project options from snapshot', async () => {
      const { showScheduleForm } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 5,
        year: 2026,
        projectCodes: ['C0007012.1.1', 'ZTEST_42'],
        totals: { worked: 120, absent: 8, toBePerformed: 160 },
      };

      showScheduleForm(snapshot);

      const formSection = document.getElementById('schedule-form-section') as HTMLElement;
      const projectSelect = document.getElementById('schedule-project') as HTMLSelectElement;

      expect(formSection.hidden).toBe(false);
      expect(projectSelect.querySelectorAll('option')).toHaveLength(3); // blank + 2 projects
      expect(projectSelect.innerHTML).toContain('C0007012.1.1');
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
        projectCodes: ['C0007012.1.1'],
        totals: { worked: 120, absent: 8, toBePerformed: 160 },
      };

      showScheduleForm(snapshot);

      const form = document.getElementById('schedule-form') as HTMLFormElement;
      const labelInput = document.getElementById('schedule-label') as HTMLInputElement;
      const projectSelect = document.getElementById('schedule-project') as HTMLSelectElement;
      const mondayInput = document.getElementById('hours-monday') as HTMLInputElement;

      labelInput.value = 'Test Schedule';
      projectSelect.value = 'C0007012.1.1';
      mondayInput.value = '8';

      form.dispatchEvent(new Event('submit'));

      // Wait for async save
      await new Promise((r) => setTimeout(r, 10));

      const formSection = document.getElementById('schedule-form-section') as HTMLElement;
      expect(formSection.hidden).toBe(true); // Form should be hidden after save
      expect(storedValues[STORAGE_KEYS.projectSchedules]).toBeDefined();
    });
  });
});
