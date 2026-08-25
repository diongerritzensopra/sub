/**
 * Popup rendering logic — pure functions that update DOM from model/snapshot state.
 */

import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import type { PopupDomRefs } from './popup-dom';

function formatScheduleProjectOptionLabel(name: string, code: string): string {
  const trimmedName = name.trim();
  return trimmedName ? `${trimmedName} [${code}]` : code;
}

function formatProjectWithCode(name: string, code: string): string {
  const trimmedName = name.trim() || 'Onbekend project';
  return `${trimmedName} [${code}]`;
}

function renderProjectsList(
  projectList: HTMLUListElement,
  projects: TimesheetSnapshot['projects'],
): void {
  projectList.innerHTML = '';
  if (projects.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = '-';
    projectList.appendChild(emptyItem);
    return;
  }

  projects.forEach((project) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = project.name.trim() || 'Onbekend project';
    const code = document.createElement('span');
    code.textContent = project.code;
    item.appendChild(name);
    item.appendChild(document.createElement('br'));
    item.appendChild(code);
    projectList.appendChild(item);
  });
}

/**
 * Render the snapshot summary (period, projects, hours totals, data origin).
 * @param dom DOM references
 * @param snapshot Current snapshot to display
 * @param hasAllData Whether snapshot is complete (affects "incomplete" warning)
 * @param isCachedData Whether data is from cache or fresh
 * @param snapshotTimestampIso Timestamp of snapshot for display
 */
export function renderSnapshot(
  dom: PopupDomRefs,
  snapshot: TimesheetSnapshot,
  hasAllData: boolean = false,
  isCachedData: boolean = false,
  snapshotTimestampIso: string | null = null,
): void {
  dom.periodValue.textContent =
    snapshot.month && snapshot.year
      ? `${snapshot.month}/${snapshot.year}`
      : '-';
  renderProjectsList(dom.projectsValue, snapshot.projects);
  dom.workedHoursValue.textContent = formatHours(snapshot.totals.worked);
  dom.toBePerformedHoursValue.textContent = formatHours(
    snapshot.totals.toBePerformed,
  );

  const scrapeStatus = dom.scrapeStatus;
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

  const summarySection = dom.summarySection;
  const dataOriginIndicator = dom.dataOriginIndicator;
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

/**
 * Render the list of saved schedules.
 * @param dom DOM references
 * @param schedules Schedules to display
 * @param selectedIds Set of selected schedule IDs (for checkbox state)
 * @param projectNameByCode Map of project codes to names (for display)
 * @param onToggleSelection Callback when user toggles schedule selection
 * @param onEditClick Callback when user clicks edit button
 * @param onDeleteConfirm Callback when user confirms delete
 */
export function renderSchedules(
  dom: PopupDomRefs,
  schedules: WeeklySchedule[],
  selectedIds: Set<string>,
  projectNameByCode: Map<string, string>,
  onToggleSelection: (scheduleId: string) => void,
  onEditClick: (schedule: WeeklySchedule) => void,
  onDeleteConfirm: (scheduleId: string) => void,
): void {
  const list = dom.schedulesList;
  const empty = dom.schedulesEmpty;

  list.innerHTML = '';
  if (schedules.length === 0) {
    empty.hidden = false;
    list.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();
  schedules.forEach((schedule) => {
    fragment.appendChild(
      renderScheduleListItem(
        schedule,
        selectedIds,
        projectNameByCode,
        onToggleSelection,
        onEditClick,
        onDeleteConfirm,
      ),
    );
  });

  list.appendChild(fragment);
  empty.hidden = true;
  list.hidden = false;
}

/**
 * Create a single schedule list item with selection, edit, and delete UI.
 */
function renderScheduleListItem(
  schedule: WeeklySchedule,
  selectedIds: Set<string>,
  projectNameByCode: Map<string, string>,
  onToggleSelection: (scheduleId: string) => void,
  onEditClick: (schedule: WeeklySchedule) => void,
  onDeleteConfirm: (scheduleId: string) => void,
): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'schedule-item';
  if (selectedIds.has(schedule.id)) {
    item.classList.add('schedule-item--selected');
  }

  const toggleSelection = (): void => {
    onToggleSelection(schedule.id);
    if (selectedIds.has(schedule.id)) {
      item.classList.add('schedule-item--selected');
      content.setAttribute('aria-checked', 'true');
    } else {
      item.classList.remove('schedule-item--selected');
      content.setAttribute('aria-checked', 'false');
    }
  };

  item.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    toggleSelection();
  });

  const content = document.createElement('div');
  const projectDisplayLabel = formatProjectWithCode(
    projectNameByCode.get(schedule.projectCode) ?? '',
    schedule.projectCode,
  );
  content.className = 'schedule-content';
  content.setAttribute('role', 'checkbox');
  content.setAttribute(
    'aria-checked',
    selectedIds.has(schedule.id) ? 'true' : 'false',
  );
  content.setAttribute(
    'aria-label',
    `Selecteren: ${schedule.label} — Project ${projectDisplayLabel}`,
  );
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
  const metaName = document.createElement('span');
  metaName.textContent =
    projectNameByCode.get(schedule.projectCode)?.trim() || 'Onbekend project';
  const metaCode = document.createElement('span');
  metaCode.textContent = schedule.projectCode;
  meta.appendChild(metaName);
  meta.appendChild(document.createElement('br'));
  meta.appendChild(metaCode);

  const actions = document.createElement('div');
  actions.className = 'schedule-actions';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'schedule-edit-button';
  editButton.textContent = '✏️';
  editButton.title = 'Schema bewerken';
  editButton.setAttribute('aria-label', `Bewerk schema ${schedule.label}`);
  editButton.addEventListener('click', () => {
    onEditClick(schedule);
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
    onDeleteConfirm(schedule.id);
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

/**
 * Show the schedule form (new or edit mode).
 * @param dom DOM references
 * @param snapshot Current snapshot (provides project metadata to populate selector)
 * @param scheduleToEdit Optional schedule being edited (null = new)
 */
export function showScheduleForm(
  dom: PopupDomRefs,
  snapshot: TimesheetSnapshot | null,
  scheduleToEdit?: WeeklySchedule | null,
): void {
  if (snapshot === null) {
    hideScheduleForm(dom);
    return;
  }

  const projectSelect = dom.scheduleProjectSelect;
  const formTitle = dom.scheduleFormTitle;
  const submitBtn = dom.scheduleForm.querySelector(
    'button[type="submit"]',
  ) as HTMLButtonElement;

  projectSelect.innerHTML = '<option value="">-- Selecteer project --</option>';
  snapshot.projects.forEach(({ code, name }) => {
    if (!code) {
      return;
    }

    const option = document.createElement('option');
    option.value = code;
    option.textContent = formatScheduleProjectOptionLabel(name, code);
    projectSelect.appendChild(option);
  });

  dom.scheduleLabelInput.value = '';
  Object.values(dom.hoursInputs).forEach((input) => {
    input.value = '0';
  });

  const isEditMode = Boolean(scheduleToEdit);
  if (isEditMode && scheduleToEdit) {
    formTitle.textContent = 'Schema bewerken';
    submitBtn.textContent = 'Bijwerken';
    dom.scheduleLabelInput.value = scheduleToEdit.label;
    projectSelect.value = scheduleToEdit.projectCode;
    Object.entries(scheduleToEdit.hoursPerWeekday).forEach(([day, hours]) => {
      if (day in dom.hoursInputs) {
        dom.hoursInputs[day].value = String(hours);
      }
    });
  } else {
    formTitle.textContent = 'Nieuw schema';
    submitBtn.textContent = 'Opslaan';
  }

  dom.scheduleFormSection.hidden = false;
  dom.scheduleLabelInput.focus();
}

/**
 * Hide and reset the schedule form.
 */
export function hideScheduleForm(dom: PopupDomRefs): void {
  dom.scheduleForm.reset();
  dom.scheduleFormSection.hidden = true;
}

/**
 * Update the "Add Schedule" button disabled state.
 */
export function updateAddScheduleButtonState(
  dom: PopupDomRefs,
  hasSnapshot: boolean,
): void {
  dom.addScheduleButton.disabled = !hasSnapshot;
}

/**
 * Update the "Apply Schedules" button state (disabled, text, visual flags).
 */
export function updateApplySchedulesButtonState(
  dom: PopupDomRefs,
  isLocked: boolean,
  hasSelection: boolean,
  scheduleCount: number,
  hasPeriod: boolean,
  isApplying: boolean = false,
): void {
  const button = dom.applySchedulesButton;
  if (isApplying) {
    button.textContent = 'Bezig...';
  } else {
    button.textContent = hasSelection ? 'Toepassen' : 'Alles toepassen';
  }
  button.classList.remove('is-applying');

  button.disabled = isLocked || scheduleCount === 0 || !hasPeriod || isApplying;
  button.classList.toggle('is-locked', isLocked);

  if (isApplying) {
    button.classList.add('is-applying');
  }
}

/**
 * Set scrape button state (busy or ready).
 */
export function setScrapeButtonState(
  dom: PopupDomRefs,
  isLoading: boolean,
): void {
  dom.btnScrape.disabled = isLoading;
}

/**
 * Update status message display (with optional persistence flag).
 */
export function renderStatusMessage(
  dom: PopupDomRefs,
  message: string,
  showDismiss: boolean = false,
): void {
  dom.statusMessage.textContent = message;
  dom.statusDismissButton.hidden = !showDismiss;
}

/**
 * Format hours value as display text (e.g., "8,0 u").
 */
export function formatHours(value: number | null): string {
  if (value === null) {
    return '-';
  }

  return `${value.toString().replace('.', ',')} u`;
}

/**
 * Format ISO timestamp for display suffix (e.g., " (05-08-2026 14:30)").
 */
export function formatTimestampSuffix(timestampIso: string | null): string {
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
