/**
 * Popup rendering logic — pure functions that update DOM from model/snapshot state.
 */

import type {
  StatusContent,
  StatusLevel,
  StatusListItem,
  TimesheetSnapshot,
  WeeklySchedule,
} from '../shared/types';
import type { PopupDomRefs } from './popup-dom';
import {
  encodeScheduleTargetSelectValue,
  getScheduleTargetDisplayName,
} from './schedule-target';

function formatScheduleTargetWithCode(name: string, code: string): string {
  return `${name.trim()} [${code}]`;
}

/**
 * Render the snapshot summary (period, hours totals, data origin).
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
  dom.periodValue.textContent = formatPeriod(snapshot.month, snapshot.year);
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
 * @param onToggleSelection Callback when user toggles schedule selection
 * @param onEditClick Callback when user clicks edit button
 * @param onDeleteConfirm Callback when user confirms delete
 */
export function renderSchedules(
  dom: PopupDomRefs,
  schedules: WeeklySchedule[],
  selectedIds: Set<string>,
  onToggleSelection: (scheduleId: string) => void,
  onEditClick: (schedule: WeeklySchedule) => void,
  onDeleteConfirm: (scheduleId: string) => void,
): void {
  const list = dom.schedulesList;
  const empty = dom.schedulesEmpty;

  if (dom.scheduleFormSection.closest('#schedules-list')) {
    hideScheduleForm(dom);
  }

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
  onToggleSelection: (scheduleId: string) => void,
  onEditClick: (schedule: WeeklySchedule) => void,
  onDeleteConfirm: (scheduleId: string) => void,
): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'schedule-item';
  item.dataset.scheduleId = schedule.id;
  if (selectedIds.has(schedule.id)) {
    item.classList.add('schedule-item--selected');
  }

  const toggleSelection = (): void => {
    if (item.classList.contains('schedule-item--editing')) {
      return;
    }

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
    if (
      (event.target as HTMLElement).closest('button, #schedule-form-section')
    ) {
      return;
    }
    toggleSelection();
  });

  const content = document.createElement('div');
  const targetCode = schedule.target.targetCode;
  const targetDisplayName = getScheduleTargetDisplayName(schedule.target);
  const targetKindLabel =
    schedule.target.targetType === 'project' ? 'Project' : 'Algemene uren';
  const targetDisplayLabel = formatScheduleTargetWithCode(
    targetDisplayName,
    targetCode,
  );
  content.className = 'schedule-content';
  content.setAttribute('role', 'checkbox');
  content.setAttribute(
    'aria-checked',
    selectedIds.has(schedule.id) ? 'true' : 'false',
  );
  content.setAttribute(
    'aria-label',
    `Selecteren: ${schedule.label} — ${targetKindLabel} ${targetDisplayLabel}`,
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
  metaName.textContent = targetDisplayName;
  const metaCode = document.createElement('span');
  metaCode.textContent = targetCode;
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

  const applyStatus = document.createElement('span');
  applyStatus.className = 'schedule-apply-status';
  applyStatus.hidden = true;

  content.appendChild(title);
  content.appendChild(meta);
  content.appendChild(applyStatus);
  item.appendChild(content);
  item.appendChild(actions);
  item.appendChild(confirmRow);

  return item;
}

export type ScheduleApplyState = 'applying' | 'success' | 'warning' | 'error';

const SCHEDULE_APPLY_STATE_CLASSES: Record<ScheduleApplyState, string> = {
  applying: 'schedule-apply-status--applying',
  success: 'schedule-apply-status--success',
  warning: 'schedule-apply-status--warning',
  error: 'schedule-apply-status--error',
};

const SCHEDULE_APPLY_STATE_ICONS: Record<ScheduleApplyState, string> = {
  applying: '⏳',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

/**
 * Update a single schedule row's apply result state (applying/success/warning/error).
 * @param dom DOM references
 * @param scheduleId Schedule whose row should be updated
 * @param applyState State to show, or null to clear/hide the indicator
 * @param message Optional detail text shown next to the state icon
 */
export function setScheduleApplyState(
  dom: PopupDomRefs,
  scheduleId: string,
  applyState: ScheduleApplyState | null,
  message?: string,
): void {
  const row = Array.from(
    dom.schedulesList.querySelectorAll<HTMLLIElement>('[data-schedule-id]'),
  ).find((candidate) => candidate.dataset.scheduleId === scheduleId);
  const applyStatus = row?.querySelector<HTMLSpanElement>(
    '.schedule-apply-status',
  );
  if (!applyStatus) {
    return;
  }

  Object.values(SCHEDULE_APPLY_STATE_CLASSES).forEach((className) => {
    applyStatus.classList.remove(className);
  });

  if (!applyState) {
    applyStatus.hidden = true;
    applyStatus.textContent = '';
    return;
  }

  applyStatus.classList.add(SCHEDULE_APPLY_STATE_CLASSES[applyState]);
  applyStatus.textContent = message
    ? `${SCHEDULE_APPLY_STATE_ICONS[applyState]} ${message}`
    : SCHEDULE_APPLY_STATE_ICONS[applyState];
  applyStatus.hidden = false;
}

/**
 * Hide and clear the apply-state indicator for every rendered schedule row.
 */
export function clearScheduleApplyStates(dom: PopupDomRefs): void {
  dom.schedulesList
    .querySelectorAll<HTMLSpanElement>('.schedule-apply-status')
    .forEach((applyStatus) => {
      Object.values(SCHEDULE_APPLY_STATE_CLASSES).forEach((className) => {
        applyStatus.classList.remove(className);
      });
      applyStatus.hidden = true;
      applyStatus.textContent = '';
    });
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

  projectSelect.innerHTML =
    '<option value="">-- Selecteer project of algemene uren --</option>';

  const projectOptionsGroup = document.createElement('optgroup');
  projectOptionsGroup.label = 'Projecten';
  snapshot.targets
    .filter((target) => target.targetType === 'project')
    .forEach((target) => {
      if (!target.targetCode) {
        return;
      }

      const option = document.createElement('option');
      option.value = encodeScheduleTargetSelectValue({
        targetType: 'project',
        targetCode: target.targetCode,
      });
      option.textContent = formatScheduleTargetWithCode(
        target.targetLabel,
        target.targetCode,
      );
      projectOptionsGroup.appendChild(option);
    });

  if (projectOptionsGroup.children.length > 0) {
    projectSelect.appendChild(projectOptionsGroup);
  }

  const generalHoursOptionsGroup = document.createElement('optgroup');
  generalHoursOptionsGroup.label = 'Algemene uren';
  snapshot.targets
    .filter((target) => target.targetType === 'general-hours')
    .forEach((target) => {
      if (!target.targetCode) {
        return;
      }

      const option = document.createElement('option');
      option.value = encodeScheduleTargetSelectValue({
        targetType: 'general-hours',
        targetCode: target.targetCode,
      });
      option.textContent = formatScheduleTargetWithCode(
        target.targetLabel,
        target.targetCode,
      );
      generalHoursOptionsGroup.appendChild(option);
    });

  if (generalHoursOptionsGroup.children.length > 0) {
    projectSelect.appendChild(generalHoursOptionsGroup);
  }

  dom.scheduleLabelInput.value = '';
  Object.values(dom.hoursInputs).forEach((input) => {
    input.value = '0';
  });

  const isEditMode = Boolean(scheduleToEdit);
  if (isEditMode && scheduleToEdit) {
    formTitle.textContent = 'Schema bewerken';
    submitBtn.textContent = 'Bijwerken';
    dom.scheduleLabelInput.value = scheduleToEdit.label;
    projectSelect.value = encodeScheduleTargetSelectValue(
      scheduleToEdit.target,
    );
    Object.entries(scheduleToEdit.hoursPerWeekday).forEach(([day, hours]) => {
      if (day in dom.hoursInputs) {
        dom.hoursInputs[day].value = String(hours);
      }
    });
  } else {
    formTitle.textContent = 'Nieuw schema';
    submitBtn.textContent = 'Opslaan';
  }

  restoreScheduleFormAnchor(dom);
  if (scheduleToEdit) {
    const scheduleItem = Array.from(
      dom.schedulesList.querySelectorAll<HTMLLIElement>('[data-schedule-id]'),
    ).find((item) => item.dataset.scheduleId === scheduleToEdit.id);
    if (scheduleItem) {
      scheduleItem.classList.add('schedule-item--editing');
      const scheduleContent =
        scheduleItem.querySelector<HTMLElement>('.schedule-content');
      if (scheduleContent) {
        scheduleContent.setAttribute('aria-disabled', 'true');
        scheduleContent.tabIndex = -1;
      }
      scheduleItem
        .querySelectorAll<HTMLButtonElement>(
          '.schedule-edit-button, .schedule-delete-button',
        )
        .forEach((button) => {
          button.disabled = true;
        });
      scheduleItem.appendChild(dom.scheduleFormSection);
    }
    dom.scheduleFormSection.dataset.formMode = 'edit';
  } else {
    dom.scheduleFormSection.dataset.formMode = 'add';
    dom.addScheduleButton.disabled = true;
  }

  dom.scheduleFormSection.hidden = false;
  dom.scheduleLabelInput.focus();
}

function restoreScheduleFormAnchor(dom: PopupDomRefs): void {
  const editedItem =
    dom.scheduleFormSection.closest<HTMLLIElement>('.schedule-item');
  if (editedItem) {
    editedItem.classList.remove('schedule-item--editing');
    const scheduleContent =
      editedItem.querySelector<HTMLElement>('.schedule-content');
    if (scheduleContent) {
      scheduleContent.removeAttribute('aria-disabled');
      scheduleContent.tabIndex = 0;
    }
    editedItem
      .querySelectorAll<HTMLButtonElement>(
        '.schedule-edit-button, .schedule-delete-button',
      )
      .forEach((button) => {
        button.disabled = false;
      });
  }

  dom.addScheduleButton.insertAdjacentElement(
    'afterend',
    dom.scheduleFormSection,
  );
  dom.addScheduleButton.disabled =
    dom.addScheduleButton.dataset.hasSnapshot !== 'true';
  delete dom.scheduleFormSection.dataset.formMode;
}

/**
 * Hide and reset the schedule form.
 */
export function hideScheduleForm(dom: PopupDomRefs): void {
  dom.scheduleForm.reset();
  dom.scheduleFormSection.hidden = true;
  restoreScheduleFormAnchor(dom);
}

/**
 * Update the "Add Schedule" button disabled state.
 */
export function updateAddScheduleButtonState(
  dom: PopupDomRefs,
  hasSnapshot: boolean,
): void {
  dom.addScheduleButton.dataset.hasSnapshot = String(hasSnapshot);
  dom.addScheduleButton.disabled =
    !hasSnapshot || dom.scheduleFormSection.dataset.formMode === 'add';
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
  button.textContent = isApplying ? 'Bezig...' : 'Toepassen';
  button.classList.remove('is-applying');

  button.disabled =
    isLocked ||
    scheduleCount === 0 ||
    !hasPeriod ||
    !hasSelection ||
    isApplying;
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

const STATUS_LEVEL_ICONS: Record<StatusLevel, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

/**
 * Update status message display (with urgency level and optional dismiss button).
 */
function buildStatusList(items: StatusListItem[]): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'status-message-list';
  items.forEach((item) => {
    const listItem = document.createElement('li');
    if (typeof item === 'string') {
      listItem.textContent = item;
    } else {
      listItem.textContent = item.text;
      if (item.items.length > 0) {
        listItem.append(buildStatusList(item.items));
      }
    }
    list.append(listItem);
  });
  return list;
}

function renderStatusContent(
  container: HTMLElement,
  content: StatusContent,
): void {
  if (typeof content === 'string') {
    container.textContent = content;
    return;
  }

  container.replaceChildren(
    ...content.map((section) => {
      const block = document.createElement('div');
      block.className = 'status-message-section';
      if (section.label) {
        const label = document.createElement('strong');
        label.textContent = section.label;
        block.append(label);
      }
      if (section.text) {
        block.append(section.label ? ` ${section.text}` : section.text);
      }
      if (section.items && section.items.length > 0) {
        block.append(buildStatusList(section.items));
      }
      return block;
    }),
  );
}

export function renderStatusMessage(
  dom: PopupDomRefs,
  message: StatusContent,
  showDismiss: boolean = false,
  level: StatusLevel = 'info',
): void {
  renderStatusContent(dom.statusMessage, message);
  dom.statusIcon.textContent = STATUS_LEVEL_ICONS[level];
  (Object.keys(STATUS_LEVEL_ICONS) as StatusLevel[]).forEach((candidate) => {
    dom.statusBox.classList.toggle(
      `status-box--${candidate}`,
      candidate === level,
    );
  });
  dom.statusDismissButton.hidden = !showDismiss;
  dom.statusSection.hidden = message.length === 0;
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
 * Format a month/year period with the full month name in the user's language
 * (e.g., "augustus 2026" or "August 2026").
 */
export function formatPeriod(
  month: number | null,
  year: number | null,
  locale: string | undefined = navigator.language,
): string {
  if (!month || !year) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
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
