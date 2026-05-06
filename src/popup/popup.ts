/**
 * Popup script — handles UI interactions for scraping hours from SAP My Timesheet.
 */

import type { MessageRequest, MessageResponse, TimesheetSnapshot } from '../shared/types';
import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';

const btnScrape = document.getElementById('btn-scrape') as HTMLButtonElement;
const statusMessage = document.getElementById('status-message') as HTMLParagraphElement;
const summarySection = document.getElementById('summary-section') as HTMLElement;
const periodValue = document.getElementById('period-value') as HTMLSpanElement;
const projectCodesValue = document.getElementById('project-codes-value') as HTMLSpanElement;
const workedHoursValue = document.getElementById('worked-hours-value') as HTMLSpanElement;
const absentHoursValue = document.getElementById('absent-hours-value') as HTMLSpanElement;
const toBePerformedHoursValue = document.getElementById('to-be-performed-hours-value') as HTMLSpanElement;

btnScrape.addEventListener('click', () => {
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
  btnScrape.disabled = true;

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
    btnScrape.disabled = false;
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isTimesheetTab(tab: chrome.tabs.Tab | undefined): boolean {
  return (tab?.url ?? '').includes(SAP_TIMESHEET_URL_PATTERN);
}

function renderSnapshot(snapshot: TimesheetSnapshot): void {
  periodValue.textContent = snapshot.month && snapshot.year ? `${snapshot.month}/${snapshot.year}` : '-';
  projectCodesValue.textContent = snapshot.projectCodes.length > 0 ? snapshot.projectCodes.join(', ') : '-';
  workedHoursValue.textContent = formatHours(snapshot.totals.worked);
  absentHoursValue.textContent = formatHours(snapshot.totals.absent);
  toBePerformedHoursValue.textContent = formatHours(snapshot.totals.toBePerformed);
  summarySection.hidden = false;
}

function formatHours(value: number | null): string {
  if (value === null) {
    return '-';
  }

  return `${value.toString().replace('.', ',')} u`;
}

function setStatus(message: string): void {
  statusMessage.textContent = message;
}
