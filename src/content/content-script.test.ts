import { describe, expect, it, vi } from 'vitest';

const addListener = vi.fn();

globalThis.chrome = {
  runtime: {
    onMessage: {
      addListener,
    },
    sendMessage: vi.fn(),
  },
} as unknown as typeof chrome;

const { scrapeTimesheetSnapshot } = await import('./content-script');

function getMessageListener(): (
  message: { type: string; payload?: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => void {
  return addListener.mock.calls[0][0] as (
    message: { type: string; payload?: unknown },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => void;
}

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

  it.each([
    {
      name: 'uses `iframe[src*="ui5appruntime.html"]` when active-shell marker is missing',
      html: `
        <iframe id="sap-shell-frame" src="https://example.test/legacy#/1/2020"></iframe>
        <iframe src="https://example.test/cp.portal/ui5appruntime.html#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/9/2026"></iframe>
      `,
      month: 9,
      year: 2026,
    },
    {
      name: 'uses `iframe[src*="#timesheet-my"]` when ui5 runtime selector is missing',
      html: `
        <iframe src="https://example.test/legacy#/2/2021"></iframe>
        <iframe src="https://example.test/app#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/10/2027"></iframe>
      `,
      month: 10,
      year: 2027,
    },
    {
      name: 'falls back to first iframe when no preferred selector matches',
      html: `
        <iframe src="https://example.test/fallback-first#/11/2028/project/ZSST"></iframe>
        <iframe src="https://example.test/fallback-second#/12/2030/project/OTHER"></iframe>
      `,
      month: 11,
      year: 2028,
    },
  ])('extracts month/year via iframe fallback selectors: $name', ({ html, month, year }) => {
    document.body.innerHTML = html;

    const snapshot = scrapeTimesheetSnapshot(document);

    expect(snapshot.month).toBe(month);
    expect(snapshot.year).toBe(year);
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

describe('AUTOFILL_ENTRIES', () => {
  it('fills the Hours column for a matching day on the selected project page', () => {
    document.body.innerHTML = `
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B1">May</button>
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B2">2026</button>
      <ul id="application-timesheet-my-component---idMaster--idNavigationProjectCodes-subtree">
        <li class="sapTntNLI sapTntNLISecondLevel sapTntNLISelected">
          <a title="C0007012.1.1 - Politie DPC - Signalen" aria-current="page">Selected project</a>
        </li>
      </ul>
      <table id="application-timesheet-my-component---idDetail--idMonthTable-listUl">
        <tbody id="application-timesheet-my-component---idDetail--idMonthTable-tblBody">
          <tr id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0">
            <td></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell0"><span><div><span><bdi>Fri 1</bdi></span></div></span></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell1"></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell2"></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell3"><input value="00:00"></td>
          </tr>
        </tbody>
      </table>
      <button id="application-timesheet-my-component---idDetail--idSubmitTimesheet">Submit</button>
    `;

    const submitButton = document.getElementById('application-timesheet-my-component---idDetail--idSubmitTimesheet') as HTMLButtonElement;
    const clickSpy = vi.spyOn(submitButton, 'click');

    const sendResponse = vi.fn();
    getMessageListener()(
      {
        type: 'AUTOFILL_ENTRIES',
        payload: [{ date: '2026-05-01', project: 'C0007012.1.1', hours: 7.5 }],
      },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    const hoursInput = document.querySelector('#__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell3 input') as HTMLInputElement;
    expect(hoursInput.value).toBe('07:30');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: { applied: 1, failedDates: [] } });
  });

  it('returns failed dates when the active project does not match the entry project', () => {
    document.body.innerHTML = `
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B1">May</button>
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B2">2026</button>
      <ul id="application-timesheet-my-component---idMaster--idNavigationProjectCodes-subtree">
        <li class="sapTntNLI sapTntNLISecondLevel sapTntNLISelected">
          <a title="ZTEST_42 - Internal" aria-current="page">Wrong project</a>
        </li>
      </ul>
      <table id="application-timesheet-my-component---idDetail--idMonthTable-listUl">
        <tbody id="application-timesheet-my-component---idDetail--idMonthTable-tblBody">
          <tr><td></td><td id="row-cell0"><bdi>Fri 1</bdi></td><td></td><td></td><td id="row-cell3"><input value="00:00"></td></tr>
        </tbody>
      </table>
    `;

    const sendResponse = vi.fn();
    getMessageListener()(
      {
        type: 'AUTOFILL_ENTRIES',
        payload: [{ date: '2026-05-01', project: 'C0007012.1.1', hours: 8 }],
      },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: { applied: 0, failedDates: ['2026-05-01'] } });
  });

  it('returns an error for invalid AUTOFILL_ENTRIES payload', () => {
    const sendResponse = vi.fn();

    getMessageListener()(
      { type: 'AUTOFILL_ENTRIES', payload: { invalid: true } },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'Ongeldige payload voor AUTOFILL_ENTRIES.' });
  });

  it('returns an error when submit button is missing after filling entries', () => {
    document.body.innerHTML = `
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B1">May</button>
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B2">2026</button>
      <ul id="application-timesheet-my-component---idMaster--idNavigationProjectCodes-subtree">
        <li class="sapTntNLI sapTntNLISecondLevel sapTntNLISelected">
          <a title="C0007012.1.1 - Politie DPC - Signalen" aria-current="page">Selected project</a>
        </li>
      </ul>
      <table id="application-timesheet-my-component---idDetail--idMonthTable-listUl">
        <tbody id="application-timesheet-my-component---idDetail--idMonthTable-tblBody">
          <tr id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0">
            <td></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell0"><bdi>Fri 1</bdi></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell1"></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell2"></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell3"><input value="00:00"></td>
          </tr>
        </tbody>
      </table>
    `;

    const sendResponse = vi.fn();
    expect(() => getMessageListener()(
      {
        type: 'AUTOFILL_ENTRIES',
        payload: [{ date: '2026-05-01', project: 'C0007012.1.1', hours: 8 }],
      },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    )).toThrow('Submitknop niet gevonden na invullen van uren.');
  });

  it('does not click submit when all entries failed', () => {
    document.body.innerHTML = `
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B1">May</button>
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B2">2026</button>
      <ul id="application-timesheet-my-component---idMaster--idNavigationProjectCodes-subtree">
        <li class="sapTntNLI sapTntNLISecondLevel sapTntNLISelected">
          <a title="ZTEST_42 - Internal" aria-current="page">Wrong project</a>
        </li>
      </ul>
      <table id="application-timesheet-my-component---idDetail--idMonthTable-listUl">
        <tbody id="application-timesheet-my-component---idDetail--idMonthTable-tblBody"></tbody>
      </table>
      <button id="application-timesheet-my-component---idDetail--idSubmitTimesheet">Submit</button>
    `;

    const submitButton = document.getElementById('application-timesheet-my-component---idDetail--idSubmitTimesheet') as HTMLButtonElement;
    const clickSpy = vi.spyOn(submitButton, 'click');

    const sendResponse = vi.fn();
    getMessageListener()(
      {
        type: 'AUTOFILL_ENTRIES',
        payload: [{ date: '2026-05-01', project: 'C0007012.1.1', hours: 8 }],
      },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(clickSpy).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: { applied: 0, failedDates: ['2026-05-01'] } });
  });

  it('skips a date that is a mandatory holiday (weekendRow with comment text)', () => {
    document.body.innerHTML = `
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B1">May</button>
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B2">2026</button>
      <ul id="application-timesheet-my-component---idMaster--idNavigationProjectCodes-subtree">
        <li class="sapTntNLI sapTntNLISecondLevel sapTntNLISelected">
          <a title="C0007012.1.1 - Politie DPC - Signalen" aria-current="page">Selected project</a>
        </li>
      </ul>
      <table id="application-timesheet-my-component---idDetail--idMonthTable-listUl">
        <tbody id="application-timesheet-my-component---idDetail--idMonthTable-tblBody">
          <tr id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0"
              class="sapMListTblRow weekendRow">
            <td></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell0"><bdi>Thu 21</bdi></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell1">
              <input value="Ascension Day">
            </td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell2"></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell3"><input value="00:00"></td>
          </tr>
        </tbody>
      </table>
    `;

    const sendResponse = vi.fn();
    getMessageListener()(
      {
        type: 'AUTOFILL_ENTRIES',
        payload: [{ date: '2026-05-21', project: 'C0007012.1.1', hours: 8 }],
      },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    const hoursInput = document.querySelector('#__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell3 input') as HTMLInputElement;
    expect(hoursInput.value).toBe('00:00'); // untouched
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: { applied: 0, failedDates: ['2026-05-21'] } });
  });

  it('does not skip a weekendRow when the comment input is empty (regular weekend)', () => {
    document.body.innerHTML = `
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B1">May</button>
      <button id="application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B2">2026</button>
      <ul id="application-timesheet-my-component---idMaster--idNavigationProjectCodes-subtree">
        <li class="sapTntNLI sapTntNLISecondLevel sapTntNLISelected">
          <a title="C0007012.1.1 - Politie DPC - Signalen" aria-current="page">Selected project</a>
        </li>
      </ul>
      <table id="application-timesheet-my-component---idDetail--idMonthTable-listUl">
        <tbody id="application-timesheet-my-component---idDetail--idMonthTable-tblBody">
          <tr id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0"
              class="sapMListTblRow weekendRow">
            <td></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell0"><bdi>Sat 2</bdi></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell1">
              <input value="">
            </td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell2"></td>
            <td id="__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell3"><input value="00:00"></td>
          </tr>
        </tbody>
      </table>
      <button id="application-timesheet-my-component---idDetail--idSubmitTimesheet">Submit</button>
    `;

    const sendResponse = vi.fn();
    getMessageListener()(
      {
        type: 'AUTOFILL_ENTRIES',
        payload: [{ date: '2026-05-02', project: 'C0007012.1.1', hours: 4 }],
      },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    const hoursInput = document.querySelector('#__item22-application-timesheet-my-component---idDetail--idMonthTable-0-cell3 input') as HTMLInputElement;
    expect(hoursInput.value).toBe('04:00');
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: { applied: 1, failedDates: [] } });
  });
});




