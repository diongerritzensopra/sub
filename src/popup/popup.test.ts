import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TimesheetSnapshot } from '../shared/types';

// Mock chrome API before any imports
const mockChromeQuery = vi.fn();
globalThis.chrome = {
  tabs: {
    query: mockChromeQuery,
    get: vi.fn(),
    sendMessage: vi.fn(),
    onUpdated: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
  },
  runtime: {
    onMessage: { addListener: vi.fn() },
    lastError: null,
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
        <h1>sub</h1>
      </header>
      <main>
        <section id="status-section">
          <p id="status-message">Klik op "Analyseer pagina" om te beginnen.</p>
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
        </section>
      </main>
      <footer>
        <button id="btn-scrape" type="button">Analyseer pagina</button>
      </footer>
    </div>
  `;

  // Reset mock
  vi.clearAllMocks();
  mockChromeQuery.mockResolvedValue([]);
});

describe('popup', () => {
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
      const mockTab: chrome.tabs.Tab = { id: 42, url: 'https://example.com' };
      vi.mocked(chrome.tabs.query).mockResolvedValue([mockTab]);

      const { getActiveTab } = await import('./popup');
      const tab = await getActiveTab();

      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(tab).toEqual(mockTab);
    });

    it('returns undefined when no active tab found', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([]);

      const { getActiveTab } = await import('./popup');
      const tab = await getActiveTab();

      expect(tab).toBeUndefined();
    });
  });
});




