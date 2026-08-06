/**
 * Shared busy-state detection logic.
 * The SAP page reports its loading state via SAP_BUSY_STATE_CHANGED messages.
 */

import type { MessageRequest, MessageResponse } from './types';

let isSAPBusy = false;

export function initBusyStateListener(onBusyStateChange?: (busy: boolean, tabId?: number) => void): void {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type !== 'SAP_BUSY_STATE_CHANGED') {
      return;
    }
    const busy = (message.payload as { busy: boolean }).busy;
    isSAPBusy = busy;
    onBusyStateChange?.(busy, sender.tab?.id);
  });
}

export async function getSAPBusyStateForTab(tabId: number): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage<MessageRequest, MessageResponse>({
      type: 'GET_SAP_BUSY_STATE',
      payload: { tabId },
    });
    if (!response.success) {
      return isSAPBusy;
    }
    const data = response.data as { busy?: boolean } | undefined;
    return data?.busy ?? false;
  } catch {
    return isSAPBusy;
  }
}


