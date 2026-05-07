/**
 * Background service worker — MV3 lifecycle, messaging hub, and icon state management.
 *
 * Icon states:
 * - status-no-match (periscope)    — active tab URL does not match SAP My Timesheet
 * - status-loading  (red submarine) — URL matches, SAP busy indicator is visible (data loading)
 * - status-ready    (blue submarine) — URL matches, SAP busy indicator is gone (data ready)
 */

import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';
import { initBusyStateListener } from '../shared/busy-state';

const ICON_SETS = {
  noMatch: {
    '16': 'src/assets/icons/status-no-match-16.png',
    '48': 'src/assets/icons/status-no-match-48.png',
    '128': 'src/assets/icons/status-no-match-128.png',
  },
  loading: {
    '16': 'src/assets/icons/status-loading-16.png',
    '48': 'src/assets/icons/status-loading-48.png',
    '128': 'src/assets/icons/status-loading-128.png',
  },
  loaded: {
    '16': 'src/assets/icons/status-ready-16.png',
    '48': 'src/assets/icons/status-ready-48.png',
    '128': 'src/assets/icons/status-ready-128.png',
  },
} as const;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[service-worker] sub installed.');
});

// Initialize busy-state listener for icon management
initBusyStateListener((busy, tabId) => {
  if (tabId === undefined) {
    return;
  }
  applyIconForTab(tabId, busy ? ICON_SETS.loading : ICON_SETS.loaded);
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


function applyIconForTab(tabId: number, iconSet: typeof ICON_SETS[keyof typeof ICON_SETS]): void {
  chrome.action.setIcon({ tabId, path: iconSet });
}
