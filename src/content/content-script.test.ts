import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendMessage = vi.fn();

async function flushAsyncWork(rounds: number = 2): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

globalThis.chrome = {
  runtime: {
    onMessage: { addListener: vi.fn() },
    sendMessage: mockSendMessage,
  },
} as unknown as typeof chrome;

// Top-level import gives us a stable module reference for the unit tests below.
// The bootstrap test re-imports via vi.resetModules() to test side-effect isolation.
const { isTimesheetReady, startBusyStateMonitor } =
  await import('./content-script');

describe('isTimesheetReady', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false when no timesheet iframe is present in the page', () => {
    expect(isTimesheetReady()).toBe(false);
  });

  it('returns false when a matching iframe is present but has no busy indicator', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(iframe);

    expect(isTimesheetReady()).toBe(false);
  });

  it('returns false when the busy indicator element is visible', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(iframe);

    const indicator = iframe.contentDocument!.createElement('div');
    indicator.id = 'sapUiBusyIndicator';
    iframe.contentDocument!.body.appendChild(indicator);

    expect(isTimesheetReady()).toBe(false);
  });

  it('returns true when the busy indicator is hidden via inline display:none', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(iframe);

    const indicator = iframe.contentDocument!.createElement('div');
    indicator.id = 'sapUiBusyIndicator';
    indicator.style.display = 'none';
    iframe.contentDocument!.body.appendChild(indicator);

    expect(isTimesheetReady()).toBe(true);
  });

  it('returns true when the busy indicator is hidden via inline visibility:hidden', () => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(iframe);

    const indicator = iframe.contentDocument!.createElement('div');
    indicator.id = 'sapUiBusyIndicator';
    indicator.style.visibility = 'hidden';
    iframe.contentDocument!.body.appendChild(indicator);

    expect(isTimesheetReady()).toBe(true);
  });

  it('prefers iframe[data-sap-ushell-active] over a generic iframe', () => {
    // Generic iframe first in DOM, preferred selector second
    const generic = document.createElement('iframe');
    document.body.appendChild(generic);

    const preferred = document.createElement('iframe');
    preferred.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(preferred);

    // Only the preferred iframe has the hidden indicator — proves it was selected
    const indicator = preferred.contentDocument!.createElement('div');
    indicator.id = 'sapUiBusyIndicator';
    indicator.style.display = 'none';
    preferred.contentDocument!.body.appendChild(indicator);

    expect(isTimesheetReady()).toBe(true);
  });
});

describe('startBusyStateMonitor', () => {
  let stopMonitor: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
    mockSendMessage.mockClear();
    document.body.innerHTML = '';
    stopMonitor = () => {};
  });

  afterEach(() => {
    stopMonitor();
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('immediately sends SAP_BUSY_STATE_CHANGED with the current busy state on start', () => {
    stopMonitor = startBusyStateMonitor();

    // No iframe in DOM → not ready → busy: true
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'SAP_BUSY_STATE_CHANGED',
      payload: { busy: true },
    });
  });

  it('does not re-send when the busy state is unchanged on subsequent polls', () => {
    stopMonitor = startBusyStateMonitor();
    mockSendMessage.mockClear();

    // The retry interval calls trySetupObserver (not emitBusyStateIfChanged directly),
    // so advancing time without changing the DOM should not produce any messages.
    vi.advanceTimersByTime(250 * 3);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('sends again when the state transitions from busy to ready on a poll', () => {
    stopMonitor = startBusyStateMonitor(); // initial → busy: true; retry interval started
    mockSendMessage.mockClear();

    // Simulate SAP becoming ready: add iframe with hidden busy indicator
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(iframe);
    const indicator = iframe.contentDocument!.createElement('div');
    indicator.id = 'sapUiBusyIndicator';
    indicator.style.display = 'none';
    iframe.contentDocument!.body.appendChild(indicator);

    // Retry interval fires → trySetupObserver succeeds → observer attached → emits busy: false
    vi.advanceTimersByTime(250);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'SAP_BUSY_STATE_CHANGED',
      payload: { busy: false },
    });
  });

  it('re-emits current state after hashchange event when state has not changed (soft-nav fix)', () => {
    // Start with SAP already ready so initial emit is busy: false
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(iframe);
    const indicator = iframe.contentDocument!.createElement('div');
    indicator.id = 'sapUiBusyIndicator';
    indicator.style.display = 'none';
    iframe.contentDocument!.body.appendChild(indicator);

    stopMonitor = startBusyStateMonitor(); // initial → busy: false; observer attached
    mockSendMessage.mockClear();

    // Simulate soft navigation: service worker sets busy=true (triggered by the same
    // hash change), but the busy indicator never appears (fast/cached navigation), so
    // the content-script state stays ready (false). ensureObserverSetup resets
    // lastBusyState and emits synchronously, correcting the service worker.
    window.dispatchEvent(new Event('hashchange'));

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'SAP_BUSY_STATE_CHANGED',
      payload: { busy: false },
    });
  });

  it('sends again when the state transitions from ready to busy via MutationObserver', async () => {
    // Start with SAP already ready
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(iframe);
    const indicator = iframe.contentDocument!.createElement('div');
    indicator.id = 'sapUiBusyIndicator';
    indicator.style.display = 'none';
    iframe.contentDocument!.body.appendChild(indicator);

    stopMonitor = startBusyStateMonitor(); // initial → busy: false; observer attached
    mockSendMessage.mockClear();

    // Simulate SAP going busy: make the indicator visible.
    // The MutationObserver fires as a microtask when the style attribute changes.
    indicator.style.display = '';
    // flushAsyncWork() cannot be used here: it calls setTimeout internally, which is
    // frozen by vi.useFakeTimers(). A single microtask flush is enough because
    // MutationObserver callbacks are queued as microtasks.
    await Promise.resolve();

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'SAP_BUSY_STATE_CHANGED',
      payload: { busy: true },
    });
  });
});

describe('content script bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not start busy-state polling in the jsdom test environment', async () => {
    await import('./content-script');
    await flushAsyncWork();

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
