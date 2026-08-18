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

export function startBusyStateMonitor(): () => void {
  let lastBusyState: boolean | null = null;
  let busyObserver: MutationObserver | null = null;
  let setupIntervalId: ReturnType<typeof window.setInterval> | null = null;

  const emitBusyStateIfChanged = (): void => {
    const busy = !isTimesheetReady();
    if (lastBusyState === busy) {
      return;
    }
    lastBusyState = busy;
    notifyBusyState(busy);
  };

  // Tries to attach a MutationObserver to the SAP busy indicator inside the iframe.
  // On success the observer will call emitBusyStateIfChanged whenever the indicator's
  // inline style changes, and the pending setup interval (if any) is cleared.
  // Returns true when the observer was successfully attached, false otherwise.
  const trySetupObserver = (): boolean => {
    const frame = resolveTimesheetFrame(document);
    let iframeDoc: Document;
    try {
      if (!frame?.contentDocument) return false;
      iframeDoc = frame.contentDocument;
      void iframeDoc.body;
    } catch {
      return false;
    }

    if (iframeDoc.readyState !== 'complete') return false;

    const indicator = iframeDoc.querySelector<HTMLElement>(SAP_BUSY_INDICATOR_SELECTOR);
    if (!indicator) return false;

    busyObserver?.disconnect();
    busyObserver = new MutationObserver(emitBusyStateIfChanged);
    busyObserver.observe(indicator, { attributes: true, attributeFilter: ['style'] });

    if (setupIntervalId !== null) {
      window.clearInterval(setupIntervalId);
      setupIntervalId = null;
    }

    emitBusyStateIfChanged();
    return true;
  };

  // Calls trySetupObserver; if the iframe is not yet ready, emits the current state
  // immediately and starts a retry interval that keeps trying until setup succeeds.
  const ensureObserverSetup = (): void => {
    if (trySetupObserver()) return;
    emitBusyStateIfChanged();
    if (setupIntervalId === null) {
      setupIntervalId = window.setInterval(trySetupObserver, BUSY_STATE_POLL_INTERVAL_MS);
    }
  };

  ensureObserverSetup();

  // After SAP hash navigation the service worker eagerly sets busy=true.
  // The hashchange handler resets lastBusyState and then calls ensureObserverSetup,
  // which immediately emits the real current state, correcting the service worker
  // even when the busy indicator never appears (fast/cached navigation where the
  // indicator is already hidden throughout).
  const onHashChange = (): void => {
    lastBusyState = null;
    ensureObserverSetup();
  };

  window.addEventListener('hashchange', onHashChange);

  const cleanup = (): void => {
    busyObserver?.disconnect();
    if (setupIntervalId !== null) window.clearInterval(setupIntervalId);
    window.removeEventListener('hashchange', onHashChange);
  };

  window.addEventListener('beforeunload', cleanup);
  // Returned for unit tests only — production callers use the beforeunload listener above.
  return cleanup;
}

// Skip monitor in jsdom tests to avoid unnecessary timers in test runtime.
if (!(typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom'))) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBusyStateMonitor);
  } else {
    startBusyStateMonitor();
  }
}
