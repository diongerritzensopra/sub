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
  it('extracts month/year from iframe route with no project segment', () => {
    document.body.innerHTML = `
      <iframe
        data-sap-ushell-active="true"
        src="https://example.test/cp.portal/ui5appruntime.html#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/4/2026"
      ></iframe>
    `;

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.month).toBe(4);
    expect(snapshot.year).toBe(2026);
    expect(snapshot.projectCodes).toEqual([]);
  });

  it('extracts month/year from iframe route with project segment', () => {
    document.body.innerHTML = `
      <iframe
        data-sap-ushell-active="true"
        src="https://example.test/cp.portal/ui5appruntime.html#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/4/2026/project/ZSST"
      ></iframe>
    `;

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.month).toBe(4);
    expect(snapshot.year).toBe(2026);
    // Route is no longer a source of project codes; navigation tree is authoritative
    expect(snapshot.projectCodes).toEqual([]);
  });

  it('extracts month/year from route when timesheet iframe id changes', () => {
    document.body.innerHTML = `
      <iframe
        id="sap-shell-frame"
        data-sap-ushell-active="true"
        src="https://example.test/cp.portal/ui5appruntime.html#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/9/2026"
      ></iframe>
    `;

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.month).toBe(9);
    expect(snapshot.year).toBe(2026);
  });

  it('extracts hours totals from visible page labels', () => {
    document.body.innerHTML = `
      <div>Hours worked</div><div>134:30</div>
      <div>Hours absent</div><div>8:00</div>
      <div>Hours to be performed</div><div>160:00</div>
    `;

    const snapshot = scrapeTimesheetSnapshot(document);

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




