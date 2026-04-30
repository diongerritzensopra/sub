/**
 * Background service worker — MV3 lifecycle, messaging hub, and icon state management.
 *
 * Icon states:
 * - periscope      (red, default)  — active tab URL does not match SAP My Timesheet
 * - submarine-red  (red)           — active tab matches SAP My Timesheet, page still loading
 * - submarine-green (green)        — active tab matches SAP My Timesheet, page fully loaded
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === undefined && changeInfo.url === undefined) {
    return;
  }
  applyIconForTab(tabId, tab.url ?? '', tab.status ?? 'complete');
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) {
      return;
    }
    applyIconForTab(tabId, tab.url ?? '', tab.status ?? 'complete');
  });
});

function applyIconForTab(tabId: number, url: string, status: string): void {
  const iconSet = resolveIconSet(url, status);
  chrome.action.setIcon({ tabId, path: iconSet });
}

function resolveIconSet(url: string, status: string): typeof ICON_SETS[keyof typeof ICON_SETS] {
  if (!url.includes(SAP_TIMESHEET_URL_PATTERN)) {
    return ICON_SETS.noMatch;
  }
  if (status === 'loading') {
    return ICON_SETS.loading;
  }
  return ICON_SETS.loaded;
}
