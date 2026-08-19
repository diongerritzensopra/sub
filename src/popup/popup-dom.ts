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

/**
 * Retrieve all required DOM elements for the popup UI.
 * Throws if any required element is missing.
 */
export function getPopupDomRefs(document: Document): PopupDomRefs {
  return {
    btnScrape: document.getElementById('btn-scrape') as HTMLButtonElement,
    statusMessage: document.getElementById('status-message') as HTMLParagraphElement,
    statusDismissButton: document.getElementById('btn-status-dismiss') as HTMLButtonElement,
    summarySection: document.getElementById('summary-section') as HTMLElement,
    periodValue: document.getElementById('period-value') as HTMLSpanElement,
    projectsValue: document.getElementById('projects-value') as HTMLUListElement,
    workedHoursValue: document.getElementById('worked-hours-value') as HTMLSpanElement,
    toBePerformedHoursValue: document.getElementById('to-be-performed-hours-value') as HTMLSpanElement,
    scrapeStatus: document.getElementById('scrape-status') as HTMLSpanElement,
    dataOriginIndicator: document.getElementById('data-origin-indicator') as HTMLParagraphElement,
    schedulesList: document.getElementById('schedules-list') as HTMLUListElement,
    schedulesEmpty: document.getElementById('schedules-empty') as HTMLParagraphElement,
    addScheduleButton: document.getElementById('btn-add-schedule') as HTMLButtonElement,
    applySchedulesButton: document.getElementById('btn-apply-schedules') as HTMLButtonElement,
    scheduleFormSection: document.getElementById('schedule-form-section') as HTMLElement,
    scheduleForm: document.getElementById('schedule-form') as HTMLFormElement,
    scheduleFormTitle: document.getElementById('schedule-form-title') as HTMLElement,
    scheduleLabelInput: document.getElementById('schedule-label') as HTMLInputElement,
    scheduleProjectSelect: document.getElementById('schedule-project') as HTMLSelectElement,
    scheduleFormCancel: document.getElementById('schedule-form-cancel') as HTMLButtonElement,
    hoursInputs: {
      monday: document.getElementById('hours-monday') as HTMLInputElement,
      tuesday: document.getElementById('hours-tuesday') as HTMLInputElement,
      wednesday: document.getElementById('hours-wednesday') as HTMLInputElement,
      thursday: document.getElementById('hours-thursday') as HTMLInputElement,
      friday: document.getElementById('hours-friday') as HTMLInputElement,
      saturday: document.getElementById('hours-saturday') as HTMLInputElement,
      sunday: document.getElementById('hours-sunday') as HTMLInputElement,
    },
  };
}

/**
 * Minimal DOM utility: set visibility.
 */
export function setVisible(element: HTMLElement, visible: boolean): void {
  element.hidden = !visible;
}

