import { beforeEach, describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '../shared/storage';
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

describe('popup status message caching', () => {
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
    setStatus('Bericht', true);
    setStatus('');

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
      cachedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
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
              month: 8,
              year: 2026,
              projects: [],
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
    await flushAsyncWork();

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
              projects: [],
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
    await flushAsyncWork();

    setStatus('Eerder resultaat: 5 dagen bijgewerkt.', true);
    expect(document.getElementById('status-message')?.textContent).toBe('Eerder resultaat: 5 dagen bijgewerkt.');

    (document.getElementById('btn-scrape') as HTMLButtonElement).click();
    await flushAsyncWork();

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
    await flushAsyncWork();

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
      cachedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
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
              month: 8,
              year: 2026,
              projects: [],
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
    await flushAsyncWork();

    expect(document.getElementById('status-message')?.textContent).toBe('');
    expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(true);
    expect(mockChromeStorageLocalRemove).toHaveBeenCalledWith(
      STORAGE_KEYS.statusMessageCache,
      expect.any(Function),
    );
  });
});
