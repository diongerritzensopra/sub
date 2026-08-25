import { vi } from 'vitest';

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';

export const mockChromeTabsQuery =
  vi.fn<(queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>>();
export const mockChromeRuntimeSendMessage =
  vi.fn<
    (message: any, options?: chrome.runtime.MessageOptions) => Promise<any>
  >();
export const mockChromeTabsGet =
  vi.fn<(tabId: number) => Promise<chrome.tabs.Tab>>();
export const mockChromeTabsUpdate =
  vi.fn<
    (
      tabId: number,
      updateProperties: chrome.tabs.UpdateProperties,
    ) => Promise<chrome.tabs.Tab>
  >();
export const mockChromeScriptingExecuteScript =
  vi.fn<
    (
      injection: chrome.scripting.ScriptInjection<any[], any>,
    ) => Promise<chrome.scripting.InjectionResult[]>
  >();
export const mockChromeStorageLocalGet =
  vi.fn<
    (
      keys: string[],
      callback: (result: Record<string, unknown>) => void,
    ) => void
  >();
export const mockChromeStorageLocalSet =
  vi.fn<(values: Record<string, unknown>, callback: () => void) => void>();
export const mockChromeStorageLocalRemove =
  vi.fn<(key: string, callback: () => void) => void>();

function installChromeMockGlobal(): void {
  globalThis.chrome = {
    tabs: {
      query: mockChromeTabsQuery,
      get: mockChromeTabsGet,
      update: mockChromeTabsUpdate,
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
}

export async function flushAsyncWork(rounds: number = 20): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

export function setupPopupDom(): void {
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
              <label for="schedule-project">Project</label>
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
            <li><strong>Projecten:</strong> <ul id="projects-value" class="project-list"><li>-</li></ul></li>
            <li><strong>Uren gewerkt:</strong> <span id="worked-hours-value">-</span></li>
            <li><strong>Uren uit te voeren:</strong> <span id="to-be-performed-hours-value">-</span></li>
          </ul>
          <p id="scrape-status" class="subtle-indicator" hidden></p>
          <p id="data-origin-indicator" class="subtle-indicator" hidden></p>
        </section>
      </main>
    </div>
  `;
}

export function resetPopupTestEnvironment(): void {
  setupPopupDom();

  vi.resetModules();
  vi.clearAllMocks();

  mockChromeTabsQuery.mockResolvedValue([]);
  mockChromeTabsGet.mockResolvedValue({
    id: 99,
    status: 'complete',
  } as chrome.tabs.Tab);
  mockChromeTabsUpdate.mockImplementation(
    async (tabId, updateProperties) =>
      ({
        id: tabId,
        status: 'complete',
        url: updateProperties.url,
      }) as chrome.tabs.Tab,
  );

  mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
    const funcName = injection.func?.name;
    if (funcName === 'ui5MainWorldAutofill') {
      return [
        {
          documentId: 'mock-id',
          frameId: 0,
          result: {
            appliedDaysCount: 1,
            failedDates: [],
            submissionAttempted: true,
            submissionConfirmed: true,
          },
        },
      ];
    }

    if (funcName === 'ui5MainWorldReadSnapshot') {
      return [
        {
          documentId: 'mock-id',
          frameId: 0,
          result: {
            success: false,
            error: 'not mocked',
          },
        },
      ];
    }

    return [
      {
        documentId: 'mock-id',
        frameId: 0,
        result: undefined,
      },
    ];
  });

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
}

// Test data factory helpers
export function createSnapshot(
  overrides: Partial<TimesheetSnapshot> = {},
): TimesheetSnapshot {
  return {
    month: 8,
    year: 2026,
    projects: [
      { code: 'C001', name: 'Project Alpha' },
      { code: 'C002', name: '  ' },
    ],
    totals: {
      worked: 12.5,
      toBePerformed: 30,
    },
    currentProjectCode: 'C001',
    sapStatus: 'editable',
    ...overrides,
  };
}

export function createSchedule(
  id: string,
  projectCode: string = 'C001',
): WeeklySchedule {
  return {
    id,
    label: `Schema ${id}`,
    projectCode,
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
}

installChromeMockGlobal();
