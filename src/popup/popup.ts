/**
 * Popup script — handles UI interactions for scraping hours from SAP My Timesheet.
 */

import type { HoursEntry, MessageRequest, MessageResponse } from '../shared/types';

const btnScrape = document.getElementById('btn-scrape') as HTMLButtonElement;
const statusMessage = document.getElementById('status-message') as HTMLParagraphElement;
const entriesSection = document.getElementById('entries-section') as HTMLElement;
const entriesList = document.getElementById('entries-list') as HTMLUListElement;

btnScrape.addEventListener('click', async () => {
  setStatus('Pagina analyseren...');
  btnScrape.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('Geen actief tabblad gevonden.');

    const response = await chrome.tabs.sendMessage<MessageRequest, MessageResponse>(tab.id, {
      type: 'SCRAPE_ENTRIES',
    });

    if (!response.success) throw new Error(response.error ?? 'Onbekende fout.');

    const scrapedEntries = response.data as HoursEntry[];
    renderEntries(scrapedEntries);
    setStatus(scrapedEntries.length === 0 ? 'Geen uren gevonden op deze pagina.' : `${scrapedEntries.length} uur-regel(s) gevonden.`);
  } catch (err) {
    setStatus(`Fout: ${(err as Error).message}`);
  } finally {
    btnScrape.disabled = false;
  }
});

function renderEntries(entries: HoursEntry[]): void {
  entriesList.innerHTML = '';
  entries.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `${entry.date} - ${entry.project} / ${entry.activity}: ${entry.hours}u`;
    entriesList.appendChild(li);
  });
  entriesSection.hidden = entries.length === 0;
}

function setStatus(message: string): void {
  statusMessage.textContent = message;
}
