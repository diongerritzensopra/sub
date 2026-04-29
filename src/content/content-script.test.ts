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
  it('extracts month/year and selected project code from SAP iframe route', () => {
    document.body.innerHTML = `
      <iframe
        id="__container1"
        src="/cp.portal/ui5appruntime.html#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/4/2026/project/ZSST"
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

  it('returns null totals when labels are missing', () => {
    document.body.innerHTML = '<div>No totals available</div>';

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.totals.worked).toBeNull();
    expect(snapshot.totals.absent).toBeNull();
    expect(snapshot.totals.toBePerformed).toBeNull();
  });
});

