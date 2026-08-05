import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
const { isTimesheetReady, startBusyStateMonitor } = await import('./content-script');

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
  beforeEach(() => {
    vi.useFakeTimers();
    mockSendMessage.mockClear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('immediately sends SAP_BUSY_STATE_CHANGED with the current busy state on start', () => {
    startBusyStateMonitor();

    // No iframe in DOM → not ready → busy: true
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'SAP_BUSY_STATE_CHANGED',
      payload: { busy: true },
    });
  });

  it('does not re-send when the busy state is unchanged on subsequent polls', () => {
    startBusyStateMonitor();
    mockSendMessage.mockClear();

    vi.advanceTimersByTime(250 * 3);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('sends again when the state transitions from busy to ready on a poll', () => {
    startBusyStateMonitor(); // initial → busy: true
    mockSendMessage.mockClear();

    // Simulate SAP becoming ready: add iframe with hidden busy indicator
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(iframe);
    const indicator = iframe.contentDocument!.createElement('div');
    indicator.id = 'sapUiBusyIndicator';
    indicator.style.display = 'none';
    iframe.contentDocument!.body.appendChild(indicator);

    vi.advanceTimersByTime(250);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'SAP_BUSY_STATE_CHANGED',
      payload: { busy: false },
    });
  });

  it('sends again when the state transitions from ready to busy on a poll', () => {
    // Start with SAP already ready
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-sap-ushell-active', 'true');
    document.body.appendChild(iframe);
    const indicator = iframe.contentDocument!.createElement('div');
    indicator.id = 'sapUiBusyIndicator';
    indicator.style.display = 'none';
    iframe.contentDocument!.body.appendChild(indicator);

    startBusyStateMonitor(); // initial → busy: false
    mockSendMessage.mockClear();

    // Simulate SAP going busy again: remove the hidden indicator
    indicator.style.display = '';

    vi.advanceTimersByTime(250);

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
