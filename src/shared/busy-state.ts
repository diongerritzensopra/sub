/**
 * Shared busy-state detection logic.
 * The SAP page reports its loading state via SAP_BUSY_STATE_CHANGED messages.
 */

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

export function isSAPPageBusy(): boolean {
  return isSAPBusy;
}


