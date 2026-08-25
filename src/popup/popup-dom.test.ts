import { beforeEach, describe, expect, it } from 'vitest';

import { setupPopupDom } from './popup.test-helpers';
import { getPopupDomRefs } from './popup-dom';

beforeEach(() => {
  setupPopupDom();
});

describe('getPopupDomRefs', () => {
  it('returns references for all required popup elements', () => {
    const dom = getPopupDomRefs(document);

    expect(dom.btnScrape).toBe(document.getElementById('btn-scrape'));
    expect(dom.statusMessage).toBe(document.getElementById('status-message'));
    expect(dom.statusDismissButton).toBe(
      document.getElementById('btn-status-dismiss'),
    );
    expect(dom.summarySection).toBe(document.getElementById('summary-section'));
    expect(dom.periodValue).toBe(document.getElementById('period-value'));
    expect(dom.projectsValue).toBe(document.getElementById('projects-value'));
    expect(dom.workedHoursValue).toBe(
      document.getElementById('worked-hours-value'),
    );
    expect(dom.toBePerformedHoursValue).toBe(
      document.getElementById('to-be-performed-hours-value'),
    );
    expect(dom.scrapeStatus).toBe(document.getElementById('scrape-status'));
    expect(dom.dataOriginIndicator).toBe(
      document.getElementById('data-origin-indicator'),
    );
    expect(dom.schedulesList).toBe(document.getElementById('schedules-list'));
    expect(dom.schedulesEmpty).toBe(document.getElementById('schedules-empty'));
    expect(dom.addScheduleButton).toBe(
      document.getElementById('btn-add-schedule'),
    );
    expect(dom.applySchedulesButton).toBe(
      document.getElementById('btn-apply-schedules'),
    );
    expect(dom.scheduleFormSection).toBe(
      document.getElementById('schedule-form-section'),
    );
    expect(dom.scheduleForm).toBe(document.getElementById('schedule-form'));
    expect(dom.scheduleFormTitle).toBe(
      document.getElementById('schedule-form-title'),
    );
    expect(dom.scheduleLabelInput).toBe(
      document.getElementById('schedule-label'),
    );
    expect(dom.scheduleProjectSelect).toBe(
      document.getElementById('schedule-project'),
    );
    expect(dom.scheduleFormCancel).toBe(
      document.getElementById('schedule-form-cancel'),
    );
  });

  it('returns monday-sunday hour input references by weekday key', () => {
    const dom = getPopupDomRefs(document);

    expect(dom.hoursInputs.monday).toBe(
      document.getElementById('hours-monday'),
    );
    expect(dom.hoursInputs.tuesday).toBe(
      document.getElementById('hours-tuesday'),
    );
    expect(dom.hoursInputs.wednesday).toBe(
      document.getElementById('hours-wednesday'),
    );
    expect(dom.hoursInputs.thursday).toBe(
      document.getElementById('hours-thursday'),
    );
    expect(dom.hoursInputs.friday).toBe(
      document.getElementById('hours-friday'),
    );
    expect(dom.hoursInputs.saturday).toBe(
      document.getElementById('hours-saturday'),
    );
    expect(dom.hoursInputs.sunday).toBe(
      document.getElementById('hours-sunday'),
    );
  });

  it('throws when a required top-level element is missing', () => {
    document.getElementById('btn-scrape')?.remove();

    expect(() => getPopupDomRefs(document)).toThrow(
      '[popup-dom] Missing required element: #btn-scrape',
    );
  });

  it('throws when a required weekday input element is missing', () => {
    document.getElementById('hours-friday')?.remove();

    expect(() => getPopupDomRefs(document)).toThrow(
      '[popup-dom] Missing required element: #hours-friday',
    );
  });
});
