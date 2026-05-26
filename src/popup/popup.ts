/**
 * Popup script — handles UI interactions for scraping hours from SAP My Timesheet.
 */

import type { CachedTimesheetSnapshot, MessageRequest, MessageResponse, TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';
import { getSAPBusyStateForTab, initBusyStateListener } from '../shared/busy-state';
import { getCachedTimesheetSnapshot, setCachedTimesheetSnapshot, clearCachedTimesheetSnapshot, getSchedules, isCacheStale } from '../shared/storage';

const ROUTE_PERIOD_PATTERN = /[?&]\/(1[0-2]|0?[1-9])\/(20\d{2})(?:[/?&#]|$)/i;

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

function getDataOriginIndicator(): HTMLParagraphElement {
  return document.getElementById('data-origin-indicator') as HTMLParagraphElement;
}

function getSchedulesList(): HTMLUListElement {
  return document.getElementById('schedules-list') as HTMLUListElement;
}

function getSchedulesEmpty(): HTMLParagraphElement {
  return document.getElementById('schedules-empty') as HTMLParagraphElement;
}

function getAddScheduleButton(): HTMLButtonElement {
  return document.getElementById('btn-add-schedule') as HTMLButtonElement;
}

let isCachedData = false;
let snapshotTimestampIso: string | null = null;
let currentSnapshot: TimesheetSnapshot | null = null;

getBtnScrape().addEventListener('click', () => {
  void analyseActiveTab();
});

getAddScheduleButton().addEventListener('click', () => {
  openScheduleFormFromLatestSnapshot();
});

// Initialize busy-state listener and auto-analyze on ready
initBusyStateListener((busy) => {
  if (!busy) {
    // SAP page is ready, automatically scrape
    void analyseActiveTab();
  }
});

updateAddScheduleButtonState();

void bootstrapPopup();

async function bootstrapPopup(): Promise<void> {
  await renderSchedules();
  await renderCachedSnapshotIfAvailable();
  await analyseActiveTab();
}


export async function renderSchedules(): Promise<void> {
  const schedules = await getSchedules();
  const list = getSchedulesList();
  const empty = getSchedulesEmpty();

  list.innerHTML = '';
  if (schedules.length === 0) {
    empty.hidden = false;
    list.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();
  schedules.forEach((schedule) => {
    fragment.appendChild(renderScheduleListItem(schedule));
  });

  list.appendChild(fragment);
  empty.hidden = true;
  list.hidden = false;
}

function renderScheduleListItem(schedule: WeeklySchedule): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'schedule-item';

  const content = document.createElement('div');
  content.className = 'schedule-content';

  const title = document.createElement('div');
  title.className = 'schedule-title';
  title.textContent = schedule.label;

  const meta = document.createElement('div');
  meta.className = 'schedule-meta';
  meta.textContent = `Project: ${schedule.projectCode}`;

  // Normal action buttons
  const actions = document.createElement('div');
  actions.className = 'schedule-actions';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'schedule-edit-button';
  editButton.textContent = '✏️';
  editButton.title = 'Schema bewerken';
  editButton.setAttribute('aria-label', `Bewerk schema ${schedule.label}`);
  editButton.addEventListener('click', () => {
    openScheduleFormForEdit(schedule);
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'schedule-delete-button';
  deleteButton.textContent = '🗑️';
  deleteButton.title = 'Schema verwijderen';
  deleteButton.setAttribute('aria-label', `Verwijder schema ${schedule.label}`);

  // Inline confirmation UI (hidden initially)
  const confirmRow = document.createElement('div');
  confirmRow.className = 'schedule-confirm-delete';
  confirmRow.hidden = true;

  const confirmLabel = document.createElement('span');
  confirmLabel.className = 'schedule-confirm-label';
  confirmLabel.textContent = 'Verwijderen?';

  const confirmYes = document.createElement('button');
  confirmYes.type = 'button';
  confirmYes.className = 'schedule-confirm-yes';
  confirmYes.textContent = '✔️';
  confirmYes.title = 'Ja, verwijderen';
  confirmYes.addEventListener('click', () => {
    void handleDeleteSchedule(schedule.id);
  });

  const confirmNo = document.createElement('button');
  confirmNo.type = 'button';
  confirmNo.className = 'schedule-confirm-no';
  confirmNo.textContent = '❌';
  confirmNo.title = 'Annuleren';
  confirmNo.addEventListener('click', () => {
    confirmRow.hidden = true;
    actions.hidden = false;
  });

  deleteButton.addEventListener('click', () => {
    actions.hidden = true;
    confirmRow.hidden = false;
  });

  confirmRow.appendChild(confirmLabel);
  confirmRow.appendChild(confirmYes);
  confirmRow.appendChild(confirmNo);

  actions.appendChild(editButton);
  actions.appendChild(deleteButton);

  content.appendChild(title);
  content.appendChild(meta);
  item.appendChild(content);
  item.appendChild(actions);
  item.appendChild(confirmRow);

  return item;
}

// Form state and DOM getters
let scheduleBeingEdited: WeeklySchedule | null = null;

function getScheduleFormSection(): HTMLElement {
  return document.getElementById('schedule-form-section') as HTMLElement;
}

function getScheduleForm(): HTMLFormElement {
  return document.getElementById('schedule-form') as HTMLFormElement;
}

function getScheduleFormTitle(): HTMLElement {
  return document.getElementById('schedule-form-title') as HTMLElement;
}

function getScheduleLabelInput(): HTMLInputElement {
  return document.getElementById('schedule-label') as HTMLInputElement;
}

function getScheduleProjectSelect(): HTMLSelectElement {
  return document.getElementById('schedule-project') as HTMLSelectElement;
}

function getScheduleFormCancel(): HTMLButtonElement {
  return document.getElementById('schedule-form-cancel') as HTMLButtonElement;
}

function getHoursInputs(): Record<string, HTMLInputElement> {
  return {
    monday: document.getElementById('hours-monday') as HTMLInputElement,
    tuesday: document.getElementById('hours-tuesday') as HTMLInputElement,
    wednesday: document.getElementById('hours-wednesday') as HTMLInputElement,
    thursday: document.getElementById('hours-thursday') as HTMLInputElement,
    friday: document.getElementById('hours-friday') as HTMLInputElement,
    saturday: document.getElementById('hours-saturday') as HTMLInputElement,
    sunday: document.getElementById('hours-sunday') as HTMLInputElement,
  };
}

// Form event setup
getScheduleForm().addEventListener('submit', (e) => {
  e.preventDefault();
  void handleScheduleFormSubmit();
});

getScheduleFormCancel().addEventListener('click', () => {
  hideScheduleForm();
});

async function handleScheduleFormSubmit(): Promise<void> {
  if (!currentSnapshot) {
    setStatus('Geen project beschikbaar. Ververs alstublieft de pagina.');
    return;
  }

  const label = getScheduleLabelInput().value.trim();
  const projectCode = getScheduleProjectSelect().value;

  if (!label || !projectCode) {
    setStatus('Vul alstublieft alle vereiste velden in.');
    return;
  }

  const hoursInputs = getHoursInputs();
  const hoursPerWeekday = {
    monday: Number(hoursInputs.monday.value) || 0,
    tuesday: Number(hoursInputs.tuesday.value) || 0,
    wednesday: Number(hoursInputs.wednesday.value) || 0,
    thursday: Number(hoursInputs.thursday.value) || 0,
    friday: Number(hoursInputs.friday.value) || 0,
    saturday: Number(hoursInputs.saturday.value) || 0,
    sunday: Number(hoursInputs.sunday.value) || 0,
  };

  try {
    const { saveSchedule } = await import('../shared/storage');

    // Use existing ID if editing, otherwise generate new one
    const scheduleId = scheduleBeingEdited?.id || crypto.randomUUID?.() || Date.now().toString();
    const isEditing = Boolean(scheduleBeingEdited);

    const schedule: WeeklySchedule = {
      id: scheduleId,
      label,
      projectCode,
      hoursPerWeekday,
    };

    await saveSchedule(schedule);
    await renderSchedules();
    hideScheduleForm();
    const action = isEditing ? 'bijgewerkt' : 'opgeslagen';
    setStatus(`Schema ${action}`);
    setTimeout(() => setStatus(''), 2000);
  } catch (err) {
    setStatus(`Fout bij opslaan: ${(err as Error).message}`);
  }
}

function hideScheduleForm(): void {
  const form = getScheduleForm();
  form.reset();
  getScheduleFormSection().hidden = true;
  scheduleBeingEdited = null;
}

function openScheduleFormForEdit(schedule: WeeklySchedule): void {
  if (!currentSnapshot) {
    setStatus('Analyseer eerst de huidige timesheet voordat je een schema bewerkt.');
    return;
  }

  showScheduleForm(currentSnapshot, schedule);
}

async function handleDeleteSchedule(scheduleId: string): Promise<void> {
  try {
    const { deleteSchedule } = await import('../shared/storage');
    await deleteSchedule(scheduleId);
    await renderSchedules();
  } catch (err) {
    setStatus(`Fout bij verwijderen: ${(err as Error).message}`);
  }
}

export function showScheduleForm(snapshot: TimesheetSnapshot | null, scheduleToEdit?: WeeklySchedule | null): void {
  if (snapshot === null) {
    hideScheduleForm();
    return;
  }

  currentSnapshot = snapshot;
  scheduleBeingEdited = scheduleToEdit || null;
  const section = getScheduleFormSection();
  const projectSelect = getScheduleProjectSelect();
  const formTitle = getScheduleFormTitle();
  const submitBtn = getScheduleForm().querySelector('button[type="submit"]') as HTMLButtonElement;

  // Populate project options
  projectSelect.innerHTML = '<option value="">-- Selecteer project --</option>';
  if (snapshot?.projectCodes) {
    snapshot.projectCodes.forEach((code) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code;
      projectSelect.appendChild(option);
    });
  }

  // Reset form fields
  getScheduleLabelInput().value = '';
  const hoursInputs = getHoursInputs();
  Object.values(hoursInputs).forEach((input) => {
    input.value = '0';
  });

  // Set edit mode if schedule provided
  const isEditMode = Boolean(scheduleToEdit);
  if (isEditMode && scheduleToEdit) {
    formTitle.textContent = 'Schema bewerken';
    submitBtn.textContent = 'Bijwerken';
    getScheduleLabelInput().value = scheduleToEdit.label;
    projectSelect.value = scheduleToEdit.projectCode;
    Object.entries(scheduleToEdit.hoursPerWeekday).forEach(([day, hours]) => {
      if (day in hoursInputs) {
        hoursInputs[day].value = String(hours);
      }
    });
  } else {
    formTitle.textContent = 'Nieuw schema';
    submitBtn.textContent = 'Opslaan';
  }

  section.hidden = false;
  getScheduleLabelInput().focus();
}

async function renderCachedSnapshotIfAvailable(): Promise<void> {
  const activeTab = await getActiveTab();
  const cached = await getValidCachedSnapshot(activeTab);
  if (!cached) {
    return;
  }

  isCachedData = true;
  snapshotTimestampIso = cached.cachedAt;
  renderSnapshot(cached.snapshot, isSnapshotComplete(cached.snapshot));
}

function openScheduleFormFromLatestSnapshot(): void {
  if (!currentSnapshot) {
    setStatus('Analyseer eerst de huidige timesheet voordat je een schema toevoegt.');
    return;
  }

  showScheduleForm(currentSnapshot);
}

async function analyseActiveTab(): Promise<void> {
  getBtnScrape().disabled = true;

  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      throw new Error('Geen actief tabblad gevonden.');
    }

    if (!isTimesheetTab(activeTab)) {
      throw new Error('Het actieve tabblad is geen SAP My Timesheet pagina.');
    }

    const cachedSnapshot = await getValidCachedSnapshot(activeTab);
    const hasCachedData = cachedSnapshot !== undefined;
    if (!hasCachedData) {
      setStatus('Pagina analyseren...');
    }

    const isPageLoading = activeTab.status === 'loading' || await getSAPBusyStateForTab(activeTab.id);
    if (isPageLoading) {
      // If we have cached data, keep showing it while page loads; otherwise show error
      if (!hasCachedData) {
        throw new Error('De pagina laadt nog. Probeer het over een moment opnieuw.');
      }
      setStatus('Pagina laadt nog, gegevens kunnen verouderd zijn...');
      return;
    }

    const response = await chrome.tabs.sendMessage<MessageRequest, MessageResponse>(activeTab.id, {
      type: 'SCRAPE_TIMESHEET_SUMMARY',
    });

    if (!response.success) {
      throw new Error(response.error ?? 'Onbekende fout.');
    }

    const scrapedSnapshot = response.data as TimesheetSnapshot;
    const scrapedIsComplete = isSnapshotComplete(scrapedSnapshot);
    snapshotTimestampIso = new Date().toISOString();
    isCachedData = false; // Mark as fresh data
    renderSnapshot(scrapedSnapshot, scrapedIsComplete);

    // Write-through: persist fresh snapshot to cache only when it improves on
    // what is already cached (don't downgrade complete → partial)
    const cachedIsComplete = cachedSnapshot ? isSnapshotComplete(cachedSnapshot.snapshot) : false;
    if (!cachedIsComplete || scrapedIsComplete) {
      await setCachedTimesheetSnapshot({
        snapshot: scrapedSnapshot,
        cachedAt: snapshotTimestampIso,
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

export function extractPeriodFromTimesheetUrl(url: string | undefined): { month: number; year: number } | null {
  if (!url) {
    return null;
  }

  const match = url.match(ROUTE_PERIOD_PATTERN);
  if (!match) {
    return null;
  }

  return {
    month: Number.parseInt(match[1], 10),
    year: Number.parseInt(match[2], 10),
  };
}

function resolveValidationPeriod(tab: chrome.tabs.Tab | undefined): { month: number; year: number } {
  const routePeriod = extractPeriodFromTimesheetUrl(tab?.url);
  if (routePeriod) {
    return routePeriod;
  }

  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

async function getValidCachedSnapshot(tab: chrome.tabs.Tab | undefined): Promise<CachedTimesheetSnapshot | undefined> {
  const cached = await getCachedTimesheetSnapshot();
  if (!cached) {
    return undefined;
  }

  if (isCacheStale(cached, resolveValidationPeriod(tab))) {
    await clearCachedTimesheetSnapshot();
    return undefined;
  }

  return cached;
}

export function renderSnapshot(snapshot: TimesheetSnapshot, hasAllData: boolean = false): void {
  currentSnapshot = snapshot;
  updateAddScheduleButtonState();

  getPeriodValue().textContent = snapshot.month && snapshot.year ? `${snapshot.month}/${snapshot.year}` : '-';
  getProjectCodesValue().textContent = snapshot.projectCodes.length > 0 ? snapshot.projectCodes.join(', ') : '-';
  getWorkedHoursValue().textContent = formatHours(snapshot.totals.worked);
  getAbsentHoursValue().textContent = formatHours(snapshot.totals.absent);
  getToBePerformedHoursValue().textContent = formatHours(snapshot.totals.toBePerformed);

  const scrapeStatus = getScrapeStatus();
  scrapeStatus.classList.add('subtle-indicator');
  if (hasAllData) {
    scrapeStatus.hidden = true;
    scrapeStatus.textContent = '';
    scrapeStatus.classList.remove('warning');
  } else {
    scrapeStatus.hidden = false;
    scrapeStatus.textContent = 'Onvolledig';
    scrapeStatus.classList.add('warning');
  }

  // Add visual indicator for cached data
  const summarySection = getSummarySection();
  const dataOriginIndicator = getDataOriginIndicator();
  if (isCachedData) {
    summarySection.classList.add('cached-data');
    dataOriginIndicator.classList.add('cached');
    dataOriginIndicator.classList.remove('fresh');
  } else {
    summarySection.classList.remove('cached-data');
    dataOriginIndicator.classList.add('fresh');
    dataOriginIndicator.classList.remove('cached');
  }

  dataOriginIndicator.textContent = isCachedData
    ? `Cache gebruikt${formatTimestampSuffix(snapshotTimestampIso)}`
    : `Vers bijgewerkt${formatTimestampSuffix(snapshotTimestampIso)}`;
  dataOriginIndicator.hidden = false;

  summarySection.hidden = false;
}

function updateAddScheduleButtonState(): void {
  const button = getAddScheduleButton();
  button.disabled = currentSnapshot === null;
}

function formatTimestampSuffix(timestampIso: string | null): string {
  if (!timestampIso) {
    return '';
  }

  const date = new Date(timestampIso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const formatted = new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return ` (${formatted})`;
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

