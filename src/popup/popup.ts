/**
 * Popup script — UI interactions for SAP My Timesheet hour booking.
 */

import type { CachedTimesheetSnapshot, TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import { SAP_TIMESHEET_URL_PATTERN } from '../shared/types';
import { getSAPBusyStateForTab, initBusyStateListener } from '../shared/busy-state';
import { getCachedTimesheetSnapshot, setCachedTimesheetSnapshot, clearCachedTimesheetSnapshot, getSchedules, isCacheStale } from '../shared/storage';
import { expandWeeklyScheduleToMonthEntries } from '../shared/schedule-expansion';
import { readTimesheetSnapshotViaUi5 } from './ui5-scripting';
import {
  navigateToProject,
  autofillScheduleEntries,
  addFailedDatesForProject,
  buildApplyStatusMessage,
} from './schedule-apply';

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

function getApplySchedulesButton(): HTMLButtonElement {
  return document.getElementById('btn-apply-schedules') as HTMLButtonElement;
}

let isCachedData = false;
let snapshotTimestampIso: string | null = null;
let currentSnapshot: TimesheetSnapshot | null = null;
let renderedSchedules: WeeklySchedule[] = [];
const selectedScheduleIds = new Set<string>();

getBtnScrape().addEventListener('click', () => {
  void analyseActiveTab();
});

getAddScheduleButton().addEventListener('click', () => {
  openScheduleFormFromLatestSnapshot();
});

getApplySchedulesButton().addEventListener('click', () => {
  void applySchedulesFromSelection();
});

// Initialize busy-state listener and auto-analyze on ready
initBusyStateListener((busy) => {
  if (!busy) {
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
  renderedSchedules = schedules;
  const availableIds = new Set(schedules.map((schedule) => schedule.id));
  Array.from(selectedScheduleIds).forEach((id) => {
    if (!availableIds.has(id)) {
      selectedScheduleIds.delete(id);
    }
  });

  const list = getSchedulesList();
  const empty = getSchedulesEmpty();

  list.innerHTML = '';
  if (schedules.length === 0) {
    empty.hidden = false;
    list.hidden = true;
    updateApplySchedulesButtonState();
    return;
  }

  const fragment = document.createDocumentFragment();
  schedules.forEach((schedule) => {
    fragment.appendChild(renderScheduleListItem(schedule));
  });

  list.appendChild(fragment);
  empty.hidden = true;
  list.hidden = false;
  updateApplySchedulesButtonState();
}

function renderScheduleListItem(schedule: WeeklySchedule): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'schedule-item';
  if (selectedScheduleIds.has(schedule.id)) {
    item.classList.add('schedule-item--selected');
  }

  const toggleSelection = (): void => {
    if (selectedScheduleIds.has(schedule.id)) {
      selectedScheduleIds.delete(schedule.id);
      item.classList.remove('schedule-item--selected');
      content.setAttribute('aria-checked', 'false');
    } else {
      selectedScheduleIds.add(schedule.id);
      item.classList.add('schedule-item--selected');
      content.setAttribute('aria-checked', 'true');
    }
    updateApplySchedulesButtonState();
  };

  item.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    toggleSelection();
  });

  const content = document.createElement('div');
  content.className = 'schedule-content';
  content.setAttribute('role', 'checkbox');
  content.setAttribute('aria-checked', selectedScheduleIds.has(schedule.id) ? 'true' : 'false');
  content.setAttribute('aria-label', `Selecteren: ${schedule.label} — ${schedule.projectCode}`);
  content.tabIndex = 0;
  content.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      toggleSelection();
    }
  });

  const title = document.createElement('div');
  title.className = 'schedule-title';
  title.textContent = schedule.label;

  const meta = document.createElement('div');
  meta.className = 'schedule-meta';
  meta.textContent = `Project: ${schedule.projectCode}`;

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

function getSchedulesToApply(): WeeklySchedule[] {
  if (selectedScheduleIds.size === 0) {
    return renderedSchedules;
  }

  return renderedSchedules.filter((schedule) => selectedScheduleIds.has(schedule.id));
}

function updateApplySchedulesButtonState(): void {
  const button = getApplySchedulesButton();
  const hasSelection = selectedScheduleIds.size > 0;
  button.textContent = hasSelection ? 'Toepassen' : 'Alles toepassen';

  const hasPeriod = currentSnapshot?.month !== null && currentSnapshot?.year !== null;
  button.disabled = renderedSchedules.length === 0 || !hasPeriod;
}

async function applySchedulesFromSelection(): Promise<void> {
  try {
    if (!currentSnapshot || currentSnapshot.month === null || currentSnapshot.year === null) {
      throw new Error('Kan niet toepassen zonder geldige periode. Analyseer eerst de timesheet.');
    }

    const month = currentSnapshot.month;
    const year = currentSnapshot.year;

    const schedulesToApply = getSchedulesToApply();
    if (schedulesToApply.length === 0) {
      throw new Error('Geen schema\'s beschikbaar om toe te passen.');
    }

    // Validate selected projects against the currently available SAP navigation projects
    // before requiring an active tab or starting any navigation/autofill operations.
    for (const schedule of schedulesToApply) {
      if (!currentSnapshot.projectCodes.includes(schedule.projectCode)) {
        throw new Error(`Project ${schedule.projectCode} is niet beschikbaar in het SAP navigatiemenu.`);
      }
    }

    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      throw new Error('Geen actief tabblad gevonden.');
    }

    if (!isTimesheetTab(activeTab)) {
      throw new Error('Het actieve tabblad is geen SAP My Timesheet pagina.');
    }

    const applyButton = getApplySchedulesButton();
    applyButton.disabled = true;

    let totalDaysCount = 0;
    let appliedDaysCount = 0;
    const failedDatesByProject = new Map<string, string[]>();
    let submissionAttemptedCount = 0;
    let submissionConfirmedCount = 0;
    const scheduleErrors: string[] = [];

    for (const schedule of schedulesToApply) {
      try {
        await navigateToProject(activeTab.id, month, year, schedule.projectCode);
        const summary = await autofillScheduleEntries(activeTab.id, schedule, month, year);

        totalDaysCount += summary.totalDaysCount;
        appliedDaysCount += summary.appliedDaysCount;
        addFailedDatesForProject(failedDatesByProject, schedule.projectCode, summary.failedDates);
        if (summary.submissionAttempted) {
          submissionAttemptedCount += 1;
        }
        if (summary.submissionConfirmed) {
          submissionConfirmedCount += 1;
        }
        if (summary.error) {
          scheduleErrors.push(`${schedule.projectCode}: ${summary.error}`);
        }
      } catch (error) {
        const scheduleEntries = expandWeeklyScheduleToMonthEntries(schedule, month, year);
        totalDaysCount += scheduleEntries.length;
        addFailedDatesForProject(failedDatesByProject, schedule.projectCode, scheduleEntries.map((entry) => entry.date));
        scheduleErrors.push(`${schedule.projectCode}: ${(error as Error).message}`);
      }
    }

    let statusMessage = buildApplyStatusMessage(
      schedulesToApply,
      appliedDaysCount,
      totalDaysCount,
      failedDatesByProject,
      submissionAttemptedCount,
      submissionConfirmedCount,
    );

    if (scheduleErrors.length > 0) {
      statusMessage += `\nFouten:\n- ${scheduleErrors.join('\n- ')}`;
    }

    setStatus(statusMessage);
  } catch (error) {
    setStatus(`Fout: ${(error as Error).message}`);
  } finally {
    updateApplySchedulesButtonState();
  }
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

  projectSelect.innerHTML = '<option value="">-- Selecteer project --</option>';
  if (snapshot?.projectCodes) {
    snapshot.projectCodes.forEach((code) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code;
      projectSelect.appendChild(option);
    });
  }

  getScheduleLabelInput().value = '';
  const hoursInputs = getHoursInputs();
  Object.values(hoursInputs).forEach((input) => {
    input.value = '0';
  });

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
  const scrapeButton = getBtnScrape() as HTMLButtonElement | null;
  if (!scrapeButton) {
    return;
  }

  scrapeButton.disabled = true;

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
      if (!hasCachedData) {
        throw new Error('De pagina laadt nog. Probeer het over een moment opnieuw.');
      }
      setStatus('Pagina laadt nog, gegevens kunnen verouderd zijn...');
      return;
    }

    const scrapedSnapshot = await readTimesheetSnapshotViaUi5(activeTab.id);
    const scrapedIsComplete = isSnapshotComplete(scrapedSnapshot);
    snapshotTimestampIso = new Date().toISOString();
    isCachedData = false;
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
    scrapeButton.disabled = false;
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
  updateApplySchedulesButtonState();

  getPeriodValue().textContent = snapshot.month && snapshot.year ? `${snapshot.month}/${snapshot.year}` : '-';
  getProjectCodesValue().textContent = snapshot.projectCodes.length > 0 ? snapshot.projectCodes.join(', ') : '-';
  getWorkedHoursValue().textContent = formatHours(snapshot.totals.worked);
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
    && snapshot.totals.toBePerformed !== null;
}

