import { beforeEach, describe, expect, it, vi } from 'vitest';

const onInstalled = { addListener: vi.fn() };
const runtimeOnMessage = { addListener: vi.fn() };
const onUpdated = { addListener: vi.fn() };
const onActivated = { addListener: vi.fn() };
const onRemoved = { addListener: vi.fn() };
const setIcon = vi.fn();
const getTab = vi.fn();

globalThis.chrome = {
  runtime: {
    onInstalled,
    onMessage: runtimeOnMessage,
    lastError: undefined,
  },
  tabs: {
    onUpdated,
    onActivated,
    onRemoved,
    get: getTab,
  },
  action: { setIcon },
} as unknown as typeof chrome;

const SAP_URL =
  'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet';
const NO_MATCH_ICON = {
  '16': 'src/assets/icons/status-no-match-16.png',
  '48': 'src/assets/icons/status-no-match-48.png',
  '128': 'src/assets/icons/status-no-match-128.png',
};
const LOADING_ICON = {
  '16': 'src/assets/icons/status-loading-16.png',
  '48': 'src/assets/icons/status-loading-48.png',
  '128': 'src/assets/icons/status-loading-128.png',
};
const LOADED_ICON = {
  '16': 'src/assets/icons/status-ready-16.png',
  '48': 'src/assets/icons/status-ready-48.png',
  '128': 'src/assets/icons/status-ready-128.png',
};

type MessageListener = (
  message: { type: string; payload?: { tabId?: number; busy?: boolean } },
  sender: { tab?: { id?: number } },
  sendResponse: (response: unknown) => void,
) => void;

function sendMessage(
  listener: MessageListener,
  message: { type: string; payload?: { tabId?: number; busy?: boolean } },
): unknown {
  let response: unknown;
  listener(message, {}, (value) => {
    response = value;
  });
  return response;
}

describe('service worker', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    (
      chrome.runtime as typeof chrome.runtime & { lastError?: unknown }
    ).lastError = undefined;
    getTab.mockImplementation(
      (_tabId: number, callback: (tab?: chrome.tabs.Tab) => void) =>
        callback({ url: SAP_URL } as chrome.tabs.Tab),
    );
    await import('./service-worker');
  });

  it('registers installation and tab lifecycle listeners', () => {
    expect(onInstalled.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(onUpdated.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(onActivated.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(onRemoved.addListener).toHaveBeenCalledWith(expect.any(Function));

    const installListener = onInstalled.addListener.mock
      .calls[0]?.[0] as () => void;
    installListener();
  });

  it('updates the icon for busy-state messages with a tab id', () => {
    const busyListener = runtimeOnMessage.addListener.mock.calls[0]?.[0] as (
      message: { type: string; payload: { busy: boolean } },
      sender: { tab?: { id?: number } },
    ) => void;

    busyListener(
      { type: 'SAP_BUSY_STATE_CHANGED', payload: { busy: true } },
      { tab: { id: 5 } },
    );
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 5, path: LOADING_ICON });

    busyListener(
      { type: 'SAP_BUSY_STATE_CHANGED', payload: { busy: false } },
      { tab: { id: 5 } },
    );
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 5, path: LOADED_ICON });

    const callCount = setIcon.mock.calls.length;
    busyListener(
      { type: 'SAP_BUSY_STATE_CHANGED', payload: { busy: true } },
      {},
    );
    expect(setIcon).toHaveBeenCalledTimes(callCount);
  });

  it('sets a no-match icon on non-SAP updates and loading on SAP updates', () => {
    const listener = onUpdated.addListener.mock.calls[0]?.[0] as (
      tabId: number,
      changeInfo: { status?: string; url?: string },
      tab: { url?: string },
    ) => void;

    listener(3, {}, { url: SAP_URL });
    expect(setIcon).not.toHaveBeenCalled();

    listener(
      3,
      { url: 'https://example.test' },
      { url: 'https://example.test' },
    );
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 3, path: NO_MATCH_ICON });

    listener(4, { status: 'loading' }, { url: SAP_URL });
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 4, path: LOADING_ICON });

    listener(5, { status: 'complete' }, {});
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 5, path: NO_MATCH_ICON });
  });

  it('checks the activated tab and leaves SAP tab icon unchanged', () => {
    const listener = onActivated.addListener.mock
      .calls[0]?.[0] as (activeInfo: { tabId: number }) => void;

    listener({ tabId: 8 });
    expect(setIcon).not.toHaveBeenCalled();

    getTab.mockImplementationOnce(
      (_tabId: number, callback: (tab?: chrome.tabs.Tab) => void) =>
        callback({ url: 'https://example.test' } as chrome.tabs.Tab),
    );
    listener({ tabId: 9 });
    expect(setIcon).toHaveBeenLastCalledWith({ tabId: 9, path: NO_MATCH_ICON });

    getTab.mockImplementationOnce(
      (_tabId: number, callback: (tab?: chrome.tabs.Tab) => void) =>
        callback(undefined),
    );
    listener({ tabId: 10 });
    expect(setIcon).toHaveBeenCalledTimes(1);

    (
      chrome.runtime as typeof chrome.runtime & { lastError?: unknown }
    ).lastError = { message: 'Tab not found' };
    listener({ tabId: 11 });
    expect(setIcon).toHaveBeenCalledTimes(1);
  });

  it('serves busy-state requests and clears state after navigation or removal', () => {
    const updatedListener = onUpdated.addListener.mock.calls[0]?.[0] as (
      tabId: number,
      changeInfo: { status?: string; url?: string },
      tab: { url?: string },
    ) => void;
    const removedListener = onRemoved.addListener.mock.calls[0]?.[0] as (
      tabId: number,
    ) => void;
    const requestListener = runtimeOnMessage.addListener.mock
      .calls[1]?.[0] as MessageListener;

    expect(
      sendMessage(requestListener, {
        type: 'GET_SAP_BUSY_STATE',
        payload: {},
      }),
    ).toEqual({ success: false, error: 'tabId ontbreekt.' });
    expect(
      sendMessage(requestListener, {
        type: 'GET_SAP_BUSY_STATE',
        payload: { tabId: 12 },
      }),
    ).toEqual({ success: true, data: { busy: false } });

    updatedListener(12, { status: 'loading' }, { url: SAP_URL });
    expect(
      sendMessage(requestListener, {
        type: 'GET_SAP_BUSY_STATE',
        payload: { tabId: 12 },
      }),
    ).toEqual({ success: true, data: { busy: true } });

    updatedListener(
      12,
      { url: 'https://example.test' },
      { url: 'https://example.test' },
    );
    expect(
      sendMessage(requestListener, {
        type: 'GET_SAP_BUSY_STATE',
        payload: { tabId: 12 },
      }),
    ).toEqual({ success: true, data: { busy: false } });

    updatedListener(12, { status: 'loading' }, { url: SAP_URL });
    removedListener(12);
    expect(
      sendMessage(requestListener, {
        type: 'GET_SAP_BUSY_STATE',
        payload: { tabId: 12 },
      }),
    ).toEqual({ success: true, data: { busy: false } });
  });

  it('ignores unrelated runtime messages', () => {
    const requestListener = runtimeOnMessage.addListener.mock
      .calls[1]?.[0] as MessageListener;
    const sendResponse = vi.fn();

    requestListener({ type: 'OTHER_MESSAGE' }, {}, sendResponse);

    expect(sendResponse).not.toHaveBeenCalled();
  });
});
