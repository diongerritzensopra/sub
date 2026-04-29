import { describe, expect, it, vi } from 'vitest';

globalThis.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
  },
} as unknown as typeof chrome;

const { scrapeTimesheetSnapshot } = await import('./content-script');

describe('scrapeTimesheetSnapshot', () => {
  it('extracts month/year when SAP iframe route has no project segment', () => {
    document.body.innerHTML = `
      <iframe
        id="__container1"
        src="https://example.test/cp.portal/ui5appruntime.html#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/4/2026"
      ></iframe>
    `;

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.month).toBe(4);
    expect(snapshot.year).toBe(2026);
    expect(snapshot.projectCodes).toEqual([]);
  });

  it('extracts month/year and selected project code from SAP iframe route', () => {
    document.body.innerHTML = `
      <iframe
        id="__container1"
        src="https://example.test/cp.portal/ui5appruntime.html#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/4/2026/project/ZSST"
      ></iframe>
    `;

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.month).toBe(4);
    expect(snapshot.year).toBe(2026);
    expect(snapshot.projectCodes).toContain('ZSST');
  });

  it('extracts project codes and hours totals from visible page labels', () => {
    document.body.innerHTML = `
      <div>Hours worked</div><div>134.5</div>
      <div>Hours absent</div><div>8</div>
      <div>Hours to be performed</div><div>160</div>
      <select>
        <option value="PRJ001">PRJ001</option>
        <option value="ABC42">ABC42</option>
      </select>
    `;

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.projectCodes).toEqual(['ABC42', 'PRJ001']);
    expect(snapshot.totals.worked).toBe(134.5);
    expect(snapshot.totals.absent).toBe(8);
    expect(snapshot.totals.toBePerformed).toBe(160);
  });

  it('extracts calendar period, project codes, and HH:MM totals from SAP selectors', () => {
    document.body.innerHTML = `
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B1">April</button>
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B2">2026</button>

      <ul id="application-timesheet-my-component---idMaster--idNavigationProjectCodes-subtree">
        <li><a title="C0007012.1.1 - Politie DPC - Signalen">Project A</a></li>
        <li><a title="ZTEST_42 - Internal">Project B</a></li>
      </ul>

      <div class="sapUiRGLContainer">
        <h5 class="sapUiFormTitle">Total of the month</h5>
        <div class="sapUiFormElementLbl">Hours to be performed</div>
        <div>160:00</div>
        <div class="sapUiFormElementLbl">Number of hours worked</div>
        <div>18:00</div>
        <div class="sapUiFormElementLbl">Number of hours absent</div>
        <div>151:12</div>
      </div>
    `;

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.month).toBe(4);
    expect(snapshot.year).toBe(2026);
    expect(snapshot.projectCodes).toEqual(['C0007012.1.1', 'ZTEST_42']);
    expect(snapshot.totals.toBePerformed).toBe(160);
    expect(snapshot.totals.worked).toBe(18);
    expect(snapshot.totals.absent).toBeCloseTo(151.2, 5);
  });

  it('returns null totals when labels are missing', () => {
    document.body.innerHTML = '<div>No totals available</div>';

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.totals.worked).toBeNull();
    expect(snapshot.totals.absent).toBeNull();
    expect(snapshot.totals.toBePerformed).toBeNull();
  });
});



