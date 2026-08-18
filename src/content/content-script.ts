/**
 * Content script — runs in the context of SAP My Timesheet.
 *
 * Responsibility:
 * - Detect SAP busy state and notify the service worker
 */

function resolveTimesheetFrame(rootDocument: Document): HTMLIFrameElement | null {
  const preferredSelectors = [
    'iframe[data-sap-ushell-active="true"]',
    'iframe[src*="ui5appruntime.html"]',
    'iframe[src*="#timesheet-my"]',
  ];

  for (const selector of preferredSelectors) {
    const frame = rootDocument.querySelector<HTMLIFrameElement>(selector);
    if (frame) {
      return frame;
    }
  }

  return rootDocument.querySelector<HTMLIFrameElement>('iframe');
}

// Observe SAP's busy indicator to track whether the app is still loading data.
// The indicator uses id="sapUiBusyIndicator" and is shown/hidden via inline style.
// We notify the service worker on every visibility change so it can update the icon.
const SAP_BUSY_INDICATOR_SELECTOR = '#sapUiBusyIndicator';
const BUSY_STATE_POLL_INTERVAL_MS = 250;

function notifyBusyState(busy: boolean): void {
  chrome.runtime.sendMessage({ type: 'SAP_BUSY_STATE_CHANGED', payload: { busy } });
}

export function isTimesheetReady(): boolean {
  const frame = resolveTimesheetFrame(document);
  if (!frame?.contentDocument) {
    return false;
  }

  let iframeDocument: Document;
  try {
    iframeDocument = frame.contentDocument;
    void iframeDocument.body;
  } catch {
    return false;
  }

  if (iframeDocument.readyState !== 'complete') {
    return false;
  }

  const busyIndicator = iframeDocument.querySelector<HTMLElement>(SAP_BUSY_INDICATOR_SELECTOR);
  if (!busyIndicator) {
    return false;
  }

  const computedStyle = iframeDocument.defaultView?.getComputedStyle(busyIndicator);
  const isHiddenByStyle =
    computedStyle?.display === 'none'
    || computedStyle?.visibility === 'hidden'
    || computedStyle?.opacity === '0';
  const isHiddenInline = busyIndicator.style.display === 'none' || busyIndicator.style.visibility === 'hidden';

  return isHiddenByStyle || isHiddenInline;
}

export function startBusyStateMonitor(): void {
  let lastBusyState: boolean | null = null;

  const emitBusyStateIfChanged = (): void => {
    const busy = !isTimesheetReady();
    if (lastBusyState === busy) {
      return;
    }
    lastBusyState = busy;
    notifyBusyState(busy);
  };

  emitBusyStateIfChanged();

  const intervalId = window.setInterval(emitBusyStateIfChanged, BUSY_STATE_POLL_INTERVAL_MS);
  window.addEventListener('beforeunload', () => {
    window.clearInterval(intervalId);
  });

  // When SAP performs a soft navigation the service worker eagerly sets busy=true,
  // but the busy indicator may never appear (fast/cached transition), so the content
  // script's change-detection never fires a correcting SAP_BUSY_STATE_CHANGED message.
  // SAP updates the top-level URL hash during navigation, so hashchange fires on the
  // root window. Resetting lastBusyState here forces an unconditional emit on the next
  // poll tick, which corrects the service worker's stale busy=true state.
  window.addEventListener('hashchange', () => {
    lastBusyState = null;
  });
}

// Skip monitor in jsdom tests to avoid unnecessary timers in test runtime.
if (!(typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom'))) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBusyStateMonitor);
  } else {
    startBusyStateMonitor();
  }
}
