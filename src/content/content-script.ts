/**
 * Content script — runs in the context of SAP My Timesheet.
 *
 * Responsibilities:
 * - Scrape existing hour entries from the page DOM
 * - Inject UI hints or autofill fields when requested
 */

import type { HoursEntry } from '../shared/types';

/**
 * Scrapes hour entries from the current page.
 * Replace the selectors below to match SAP My Timesheet's DOM.
 */
function scrapeHoursEntries(): HoursEntry[] {
  // TODO: Replace with selectors matching SAP My Timesheet
  const rows = document.querySelectorAll<HTMLElement>('[data-hours-row]');
  return Array.from(rows).map((row) => ({
    project: row.dataset['project'] ?? '',
    activity: row.dataset['activity'] ?? '',
    hours: parseFloat(row.dataset['hours'] ?? '0'),
    date: row.dataset['date'] ?? new Date().toISOString().split('T')[0],
  }));
}

/**
 * Autofill a single entry back into the page.
 * Replace selectors and interactions once SAP My Timesheet fields are mapped.
 */
function autofillEntry(entry: HoursEntry): void {
  // TODO: Implement once SAP My Timesheet form fields are mapped
  console.log('[content-script] autofill (not yet implemented):', entry);
}

// Listen for messages from the popup or service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_ENTRIES') {
    sendResponse({ success: true, data: scrapeHoursEntries() });
  }

  if (message.type === 'AUTOFILL_ENTRY') {
    autofillEntry(message.payload as HoursEntry);
    sendResponse({ success: true });
  }
});
