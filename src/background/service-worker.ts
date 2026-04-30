/**
 * Background service worker — MV3 lifecycle, messaging hub, and icon state management.
 *
 * Icon states:
 * - periscope       (red, default) — active tab URL does not match SAP My Timesheet
 * - submarine-red   (red)          — URL matches, SAP busy indicator is visible (data loading)
 * - submarine-green (green)        — URL matches, SAP busy indicator is gone (data ready)
 */

const SAP_TIMESHEET_URL_PATTERN = 'p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site';

const ICON_SETS = {
  noMatch: {
    '16': 'src/assets/icons/periscope-16.png',
    '48': 'src/assets/icons/periscope-48.png',
    '128': 'src/assets/icons/periscope-128.png',
  },
  loading: {
    '16': 'src/assets/icons/submarine-red-16.png',
    '48': 'src/assets/icons/submarine-red-48.png',
    '128': 'src/assets/icons/submarine-red-128.png',
  },
  loaded: {
    '16': 'src/assets/icons/submarine-green-16.png',
    '48': 'src/assets/icons/submarine-green-48.png',
    '128': 'src/assets/icons/submarine-green-128.png',
  },
} as const;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[service-worker] sub installed.');
});

// Reset icon when switching tabs or navigating away from SAP
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === undefined && changeInfo.url === undefined) {
    return;
  }
  const url = tab.url ?? '';
  if (!url.includes(SAP_TIMESHEET_URL_PATTERN)) {
    applyIconForTab(tabId, ICON_SETS.noMatch);
  } else {
    // Show loading (red submarine) until SAP_BUSY_STATE_CHANGED says otherwise
    applyIconForTab(tabId, ICON_SETS.loading);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) {
      return;
    }
    const url = tab.url ?? '';
    if (!url.includes(SAP_TIMESHEET_URL_PATTERN)) {
      applyIconForTab(tabId, ICON_SETS.noMatch);
    }
    // If it is the SAP URL, keep whatever icon the content script last set
  });
});

// Content script reports SAP busy-indicator changes
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== 'SAP_BUSY_STATE_CHANGED') {
    return;
  }
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    return;
  }
  const busy = (message.payload as { busy: boolean }).busy;
  applyIconForTab(tabId, busy ? ICON_SETS.loading : ICON_SETS.loaded);
});

function applyIconForTab(tabId: number, iconSet: typeof ICON_SETS[keyof typeof ICON_SETS]): void {
  chrome.action.setIcon({ tabId, path: iconSet });
}
