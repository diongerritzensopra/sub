/**
 * Popup script — handles UI interactions for scraping hours from SAP My Timesheet.
 */

import type { MessageRequest, MessageResponse, TimesheetSnapshot } from '../shared/types';
import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';
import { getSAPBusyStateForTab, initBusyStateListener } from '../shared/busy-state';
import { getCachedTimesheetSnapshot, setCachedTimesheetSnapshot } from '../shared/storage';

// Getters for DOM elements (allows for flexible testing)
function getBtnScrape(): HTMLButtonElement {
  return document.getElementById('btn-scrape') as HTMLButtonElement;
}

function getStatusMessage(): HTMLParagraphElement {
  return document.getElementById('status-message') as HTMLParagraphElement;
}

function getSummarySection(): HTMLElement {
  return document.getElementById('summary-section') as HTMLElement;
}

function getPeriodValue(): HTMLSpanElement {
  return document.getElementById('period-value') as HTMLSpanElement;
}

function getProjectCodesValue(): HTMLSpanElement {
  return document.getElementById('project-codes-value') as HTMLSpanElement;
}

function getWorkedHoursValue(): HTMLSpanElement {
  return document.getElementById('worked-hours-value') as HTMLSpanElement;
}

function getAbsentHoursValue(): HTMLSpanElement {
  return document.getElementById('absent-hours-value') as HTMLSpanElement;
}

function getToBePerformedHoursValue(): HTMLSpanElement {
  return document.getElementById('to-be-performed-hours-value') as HTMLSpanElement;
}

function getScrapeStatus(): HTMLSpanElement {
  return document.getElementById('scrape-status') as HTMLSpanElement;
}

getBtnScrape().addEventListener('click', () => {
  void analyseActiveTab();
});

// Initialize busy-state listener and auto-analyze on ready
initBusyStateListener((busy) => {
  if (!busy) {
    // SAP page is ready, automatically scrape
    void analyseActiveTab();
  }
});

void bootstrapPopup();

async function bootstrapPopup(): Promise<void> {
  await renderCachedSnapshotIfAvailable();
  await analyseActiveTab();
}

async function renderCachedSnapshotIfAvailable(): Promise<void> {
  const cached = await getCachedTimesheetSnapshot();
  if (!cached) {
    return;
  }

  renderSnapshot(cached.snapshot, isSnapshotComplete(cached.snapshot));
}

async function analyseActiveTab(): Promise<void> {
  setStatus('Pagina analyseren...');
  getBtnScrape().disabled = true;

  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      throw new Error('Geen actief tabblad gevonden.');
    }

    if (!isTimesheetTab(activeTab)) {
      throw new Error('Het actieve tabblad is geen SAP My Timesheet pagina.');
    }

    if (activeTab.status === 'loading') {
      throw new Error('De pagina laadt nog. Probeer het over een moment opnieuw.');
    }

    const busy = await getSAPBusyStateForTab(activeTab.id);
    if (busy) {
      throw new Error('De pagina laadt nog. Probeer het over een moment opnieuw.');
    }

    const response = await chrome.tabs.sendMessage<MessageRequest, MessageResponse>(activeTab.id, {
      type: 'SCRAPE_TIMESHEET_SUMMARY',
    });

    if (!response.success) {
      throw new Error(response.error ?? 'Onbekende fout.');
    }

    const scrapedSnapshot = response.data as TimesheetSnapshot;
    const scrapedIsComplete = isSnapshotComplete(scrapedSnapshot);
    renderSnapshot(scrapedSnapshot, scrapedIsComplete);

    // Write-through: persist fresh snapshot to cache only when it improves on
    // what is already cached (don't downgrade complete → partial)
    const cachedSnapshot = await getCachedTimesheetSnapshot();
    const cachedIsComplete = cachedSnapshot ? isSnapshotComplete(cachedSnapshot.snapshot) : false;
    if (!cachedIsComplete || scrapedIsComplete) {
      await setCachedTimesheetSnapshot({
        snapshot: scrapedSnapshot,
        cachedAt: new Date().toISOString(),
      });
    }

    setStatus('');
  } catch (err) {
    setStatus(`Fout: ${(err as Error).message}`);
  } finally {
    getBtnScrape().disabled = false;
  }
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function isTimesheetTab(tab: chrome.tabs.Tab | undefined): boolean {
  return (tab?.url ?? '').includes(SAP_TIMESHEET_URL_PATTERN);
}

export function renderSnapshot(snapshot: TimesheetSnapshot, hasAllData: boolean = false): void {
  getPeriodValue().textContent = snapshot.month && snapshot.year ? `${snapshot.month}/${snapshot.year}` : '-';
  getProjectCodesValue().textContent = snapshot.projectCodes.length > 0 ? snapshot.projectCodes.join(', ') : '-';
  getWorkedHoursValue().textContent = formatHours(snapshot.totals.worked);
  getAbsentHoursValue().textContent = formatHours(snapshot.totals.absent);
  getToBePerformedHoursValue().textContent = formatHours(snapshot.totals.toBePerformed);

  // Show status emoji: green checkmark if all data present, yellow warning if partial
  const statusEmoji = hasAllData ? '✅' : '⚠️';
  getScrapeStatus().textContent = ` ${statusEmoji}`;

  getSummarySection().hidden = false;
}

export function formatHours(value: number | null): string {
  if (value === null) {
    return '-';
  }

  return `${value.toString().replace('.', ',')} u`;
}

export function setStatus(message: string): void {
  getStatusMessage().textContent = message;
}

function isSnapshotComplete(snapshot: TimesheetSnapshot): boolean {
  return snapshot.totals.worked !== null
    && snapshot.totals.absent !== null
    && snapshot.totals.toBePerformed !== null;
}

