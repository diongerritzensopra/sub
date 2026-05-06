/**
 * Popup script — handles UI interactions for scraping hours from SAP My Timesheet.
 */

import type { MessageRequest, MessageResponse, TimesheetSnapshot } from '../shared/types';
import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';

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

getBtnScrape().addEventListener('click', () => {
  void analyseActiveTab();
});

void autoAnalyseIfTimesheetTab();

async function autoAnalyseIfTimesheetTab(): Promise<void> {
  const activeTab = await getActiveTab();
  if (!isTimesheetTab(activeTab)) {
    setStatus('Open SAP My Timesheet to analyse the current page automatically.');
    return;
  }

  await analyseActiveTab(activeTab);
}

async function analyseActiveTab(existingTab?: chrome.tabs.Tab): Promise<void> {
  setStatus('Pagina analyseren...');
  getBtnScrape().disabled = true;

  try {
    const activeTab = existingTab ?? await getActiveTab();
    if (!activeTab?.id) {
      throw new Error('Geen actief tabblad gevonden.');
    }

    if (!isTimesheetTab(activeTab)) {
      throw new Error('Het actieve tabblad is geen SAP My Timesheet pagina.');
    }

    const response = await chrome.tabs.sendMessage<MessageRequest, MessageResponse>(activeTab.id, {
      type: 'SCRAPE_TIMESHEET_SUMMARY',
    });

    if (!response.success) {
      throw new Error(response.error ?? 'Onbekende fout.');
    }

    const snapshot = response.data as TimesheetSnapshot;
    renderSnapshot(snapshot);
    setStatus('Timesheet gegevens opgehaald.');
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

export function renderSnapshot(snapshot: TimesheetSnapshot): void {
  getPeriodValue().textContent = snapshot.month && snapshot.year ? `${snapshot.month}/${snapshot.year}` : '-';
  getProjectCodesValue().textContent = snapshot.projectCodes.length > 0 ? snapshot.projectCodes.join(', ') : '-';
  getWorkedHoursValue().textContent = formatHours(snapshot.totals.worked);
  getAbsentHoursValue().textContent = formatHours(snapshot.totals.absent);
  getToBePerformedHoursValue().textContent = formatHours(snapshot.totals.toBePerformed);
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
