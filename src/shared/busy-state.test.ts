import { beforeEach, describe, expect, it, vi } from 'vitest';

const addMessageListener = vi.fn();
const mockSendMessage = vi.fn();

globalThis.chrome = {
  runtime: {
    onMessage: { addListener: addMessageListener },
    sendMessage: mockSendMessage,
  },
} as unknown as typeof chrome;

describe('busy-state helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    addMessageListener.mockClear();
    mockSendMessage.mockReset();
  });

  it('tracks busy-state messages and calls the optional callback with tab id', async () => {
    const { initBusyStateListener, getSAPBusyStateForTab } =
      await import('./busy-state');
    const onChange = vi.fn();

    initBusyStateListener(onChange);
    const listener = addMessageListener.mock.calls[0]?.[0] as (
      message: { type: string; payload: { busy: boolean } },
      sender: { tab?: { id?: number } },
    ) => void;

    listener({ type: 'OTHER_MESSAGE', payload: { busy: true } }, {});
    expect(onChange).not.toHaveBeenCalled();

    listener(
      { type: 'SAP_BUSY_STATE_CHANGED', payload: { busy: true } },
      { tab: { id: 17 } },
    );
    expect(onChange).toHaveBeenCalledWith(true, 17);

    mockSendMessage.mockResolvedValue({ success: false });
    await expect(getSAPBusyStateForTab(17)).resolves.toBe(true);
  });

  it('updates state without a callback or sender tab', async () => {
    const { initBusyStateListener, getSAPBusyStateForTab } =
      await import('./busy-state');

    initBusyStateListener();
    const listener = addMessageListener.mock.calls[0]?.[0] as (
      message: { type: string; payload: { busy: boolean } },
      sender: { tab?: { id?: number } },
    ) => void;

    listener({ type: 'SAP_BUSY_STATE_CHANGED', payload: { busy: false } }, {});
    mockSendMessage.mockRejectedValue(new Error('No receiving end'));

    await expect(getSAPBusyStateForTab(18)).resolves.toBe(false);
  });

  it('returns the tab response, defaulting missing busy data to false', async () => {
    const { getSAPBusyStateForTab } = await import('./busy-state');
    mockSendMessage.mockResolvedValueOnce({
      success: true,
      data: { busy: true },
    });
    mockSendMessage.mockResolvedValueOnce({ success: true, data: {} });
    mockSendMessage.mockResolvedValueOnce({ success: true });

    await expect(getSAPBusyStateForTab(21)).resolves.toBe(true);
    await expect(getSAPBusyStateForTab(22)).resolves.toBe(false);
    await expect(getSAPBusyStateForTab(23)).resolves.toBe(false);
    expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
      type: 'GET_SAP_BUSY_STATE',
      payload: { tabId: 21 },
    });
  });
});
