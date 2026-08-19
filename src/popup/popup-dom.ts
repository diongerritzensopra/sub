/**
 * Popup DOM reference getters — single source of truth for element access.
 */

export type PopupDomRefs = {
  btnScrape: HTMLButtonElement;
  statusMessage: HTMLParagraphElement;
  statusDismissButton: HTMLButtonElement;
  summarySection: HTMLElement;
  periodValue: HTMLSpanElement;
  projectsValue: HTMLUListElement;
  workedHoursValue: HTMLSpanElement;
  toBePerformedHoursValue: HTMLSpanElement;
  scrapeStatus: HTMLSpanElement;
  dataOriginIndicator: HTMLParagraphElement;
  schedulesList: HTMLUListElement;
  schedulesEmpty: HTMLParagraphElement;
  addScheduleButton: HTMLButtonElement;
  applySchedulesButton: HTMLButtonElement;
  scheduleFormSection: HTMLElement;
  scheduleForm: HTMLFormElement;
  scheduleFormTitle: HTMLElement;
  scheduleLabelInput: HTMLInputElement;
  scheduleProjectSelect: HTMLSelectElement;
  scheduleFormCancel: HTMLButtonElement;
  hoursInputs: Record<string, HTMLInputElement>;
};

function getRequiredElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`[popup-dom] Missing required element: #${id}`);
  }

  return element as T;
}

/**
 * Retrieve all required DOM elements for the popup UI.
 * Throws if any required element is missing.
 */
export function getPopupDomRefs(document: Document): PopupDomRefs {
  return {
    btnScrape: getRequiredElement<HTMLButtonElement>(document, 'btn-scrape'),
    statusMessage: getRequiredElement<HTMLParagraphElement>(document, 'status-message'),
    statusDismissButton: getRequiredElement<HTMLButtonElement>(document, 'btn-status-dismiss'),
    summarySection: getRequiredElement<HTMLElement>(document, 'summary-section'),
    periodValue: getRequiredElement<HTMLSpanElement>(document, 'period-value'),
    projectsValue: getRequiredElement<HTMLUListElement>(document, 'projects-value'),
    workedHoursValue: getRequiredElement<HTMLSpanElement>(document, 'worked-hours-value'),
    toBePerformedHoursValue: getRequiredElement<HTMLSpanElement>(document, 'to-be-performed-hours-value'),
    scrapeStatus: getRequiredElement<HTMLSpanElement>(document, 'scrape-status'),
    dataOriginIndicator: getRequiredElement<HTMLParagraphElement>(document, 'data-origin-indicator'),
    schedulesList: getRequiredElement<HTMLUListElement>(document, 'schedules-list'),
    schedulesEmpty: getRequiredElement<HTMLParagraphElement>(document, 'schedules-empty'),
    addScheduleButton: getRequiredElement<HTMLButtonElement>(document, 'btn-add-schedule'),
    applySchedulesButton: getRequiredElement<HTMLButtonElement>(document, 'btn-apply-schedules'),
    scheduleFormSection: getRequiredElement<HTMLElement>(document, 'schedule-form-section'),
    scheduleForm: getRequiredElement<HTMLFormElement>(document, 'schedule-form'),
    scheduleFormTitle: getRequiredElement<HTMLElement>(document, 'schedule-form-title'),
    scheduleLabelInput: getRequiredElement<HTMLInputElement>(document, 'schedule-label'),
    scheduleProjectSelect: getRequiredElement<HTMLSelectElement>(document, 'schedule-project'),
    scheduleFormCancel: getRequiredElement<HTMLButtonElement>(document, 'schedule-form-cancel'),
    hoursInputs: {
      monday: getRequiredElement<HTMLInputElement>(document, 'hours-monday'),
      tuesday: getRequiredElement<HTMLInputElement>(document, 'hours-tuesday'),
      wednesday: getRequiredElement<HTMLInputElement>(document, 'hours-wednesday'),
      thursday: getRequiredElement<HTMLInputElement>(document, 'hours-thursday'),
      friday: getRequiredElement<HTMLInputElement>(document, 'hours-friday'),
      saturday: getRequiredElement<HTMLInputElement>(document, 'hours-saturday'),
      sunday: getRequiredElement<HTMLInputElement>(document, 'hours-sunday'),
    },
  };
}
