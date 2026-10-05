import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeeklySchedule } from '../shared/types';
import {
  addFailedDatesForProject,
  addTargetDatesForProject,
  autofillScheduleEntries,
  buildApplyStatusMessage,
  formatStatusDate,
  buildTimesheetUrlForProject,
  navigateToProject,
} from './schedule-apply';

const {
  mockGetSAPBusyStateForTab,
  mockExpandWeeklyScheduleToMonthEntries,
  mockAutofillEntriesViaUi5,
} = vi.hoisted(() => ({
  mockGetSAPBusyStateForTab: vi.fn<(tabId: number) => Promise<boolean>>(),
  mockExpandWeeklyScheduleToMonthEntries: vi.fn(),
  mockAutofillEntriesViaUi5:
    vi.fn<
      (
        tabId: number,
        entries: Array<{ date: string; hours: number }>,
      ) => Promise<any>
    >(),
}));

vi.mock('../shared/busy-state', () => ({
  getSAPBusyStateForTab: mockGetSAPBusyStateForTab,
}));

vi.mock('../shared/schedule-expansion', () => ({
  expandWeeklyScheduleToMonthEntries: mockExpandWeeklyScheduleToMonthEntries,
}));

vi.mock('./ui5-scripting', () => ({
  autofillEntriesViaUi5: mockAutofillEntriesViaUi5,
}));

const mockChromeTabsGet = vi.fn<(tabId: number) => Promise<chrome.tabs.Tab>>();
const mockChromeTabsUpdate =
  vi.fn<
    (
      tabId: number,
      updateProperties: chrome.tabs.UpdateProperties,
    ) => Promise<chrome.tabs.Tab>
  >();

const BASE_URL =
  'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet';

const BASE_SCHEDULE: WeeklySchedule = {
  id: 'schedule-1',
  label: 'Kantooruren',
  target: {
    targetType: 'project',
    targetCode: 'ZMOCK_001.1.1',
    targetLabel: 'Mockproject',
  },
  hoursPerWeekday: {
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();

  globalThis.chrome = {
    tabs: {
      get: mockChromeTabsGet,
      update: mockChromeTabsUpdate,
    },
  } as unknown as typeof chrome;

  mockChromeTabsGet.mockResolvedValue({
    id: 99,
    status: 'complete',
    url: BASE_URL,
  } as chrome.tabs.Tab);
  mockChromeTabsUpdate.mockResolvedValue({
    id: 99,
    status: 'complete',
    url: BASE_URL,
  } as chrome.tabs.Tab);
  mockGetSAPBusyStateForTab.mockResolvedValue(false);
});

describe('buildTimesheetUrlForProject', () => {
  it('replaces existing month/year/project route segment in URL', () => {
    const nextUrl = buildTimesheetUrlForProject(
      'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/4/2026/project/OLD',
      5,
      2026,
      'ZMOCK_001.1.1',
    );

    expect(nextUrl).toContain('&/5/2026/project/ZMOCK_001.1.1');
    expect(nextUrl).not.toContain('/4/2026/project/OLD');
  });

  it('appends a route segment when no month/year/project segment exists yet', () => {
    const nextUrl = buildTimesheetUrlForProject(
      'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet',
      5,
      2026,
      'ZTEST_42',
    );

    expect(nextUrl).toContain('&/5/2026/project/ZTEST_42');
  });

  it('appends route via hash query separator when URL has #timesheet-my without query', () => {
    const nextUrl = buildTimesheetUrlForProject(
      'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
      5,
      2026,
      'ZTEST_42',
    );

    expect(nextUrl).toBe(
      'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?/5/2026/project/ZTEST_42',
    );
  });

  it('falls back to ? or & when URL has no #timesheet-my route', () => {
    const withQuery = buildTimesheetUrlForProject(
      'https://example.test/path?foo=1',
      5,
      2026,
      'P1',
    );
    const withoutQuery = buildTimesheetUrlForProject(
      'https://example.test/path',
      5,
      2026,
      'P1',
    );

    expect(withQuery).toBe(
      'https://example.test/path?foo=1&/5/2026/project/P1',
    );
    expect(withoutQuery).toBe('https://example.test/path?/5/2026/project/P1');
  });

  it('URL-encodes project code safely', () => {
    const nextUrl = buildTimesheetUrlForProject(BASE_URL, 5, 2026, 'Z TEST/42');
    expect(nextUrl).toContain('project/Z%20TEST%2F42');
  });
});

describe('addFailedDatesForProject', () => {
  it('does nothing when no failed dates are provided', () => {
    const failed = new Map<string, Set<string>>([
      ['Z1', new Set(['2026-05-01'])],
    ]);
    addFailedDatesForProject(failed, 'Z1', []);

    expect(failed.get('Z1')).toEqual(new Set(['2026-05-01']));
    expect(failed.size).toBe(1);
  });

  it('deduplicates failed dates in the target set', () => {
    const failed = new Map<string, Set<string>>([
      ['Z1', new Set(['2026-05-01'])],
    ]);
    addFailedDatesForProject(failed, 'Z1', ['2026-05-01', '2026-05-02']);
    addFailedDatesForProject(failed, 'Z2', ['2026-05-03']);

    expect(failed.get('Z1')).toEqual(new Set(['2026-05-01', '2026-05-02']));
    expect(failed.get('Z2')).toEqual(new Set(['2026-05-03']));
  });
});

describe('formatStatusDate', () => {
  it('formats ISO dates with a weekday and without a year in the requested locale', () => {
    expect(formatStatusDate('2026-10-05', 'en-US')).toBe('Mon, Oct 5');
    expect(formatStatusDate('2026-10-05', 'nl-NL')).toBe('ma 5 okt');
  });

  it('rejects invalid ISO calendar dates', () => {
    expect(() => formatStatusDate('2026-02-30', 'en-US')).toThrow(
      'Invalid ISO date: 2026-02-30',
    );
  });
});

describe('buildApplyStatusMessage', () => {
  it('builds status for one schedule without submit attempt', () => {
    const message = buildApplyStatusMessage(
      [BASE_SCHEDULE],
      new Map([['Mockproject', new Set(['2026-05-01', '2026-05-02'])]]),
      new Map(),
      new Map([
        ['Mockproject', new Set(['2026-05-01', '2026-05-02', '2026-05-03'])],
      ]),
      0,
      0,
    );

    expect(message).toEqual([
      { label: "Toegepaste schema's:", items: ['Kantooruren'] },
      {
        label: 'Bijgewerkte dagen:',
        text: '2/3',
        items: [
          {
            text: 'Mockproject:',
            items: [
              formatStatusDate('2026-05-01'),
              formatStatusDate('2026-05-02'),
            ],
          },
        ],
      },
      {
        label: 'Verwerkt door SAP:',
        text: '0/0 (niets ingediend)',
      },
    ]);
  });

  it('lists sorted unique failed dates per target and full submit confirmation', () => {
    const message = buildApplyStatusMessage(
      [
        BASE_SCHEDULE,
        {
          ...BASE_SCHEDULE,
          id: 'schedule-2',
          label: 'Deeltijd',
          target: {
            targetType: 'project',
            targetCode: 'ZTEST_42',
            targetLabel: 'Testproject 42',
          },
        },
      ],
      new Map([['Mockproject', new Set(['2026-05-01', '2026-05-03'])]]),
      new Map([
        ['Mockproject', new Set(['2026-05-02', '2026-05-04', '2026-05-05'])],
      ]),
      new Map([
        [
          'Mockproject',
          new Set([
            '2026-05-01',
            '2026-05-02',
            '2026-05-03',
            '2026-05-04',
            '2026-05-05',
          ]),
        ],
      ]),
      2,
      2,
    );

    expect(message).toEqual([
      {
        label: "Toegepaste schema's:",
        items: ['Kantooruren', 'Deeltijd'],
      },
      {
        label: 'Bijgewerkte dagen:',
        text: '2/5',
        items: [
          {
            text: 'Mockproject:',
            items: [
              formatStatusDate('2026-05-01'),
              formatStatusDate('2026-05-03'),
            ],
          },
        ],
      },
      {
        label: 'Mislukte dagen:',
        text: '3/5',
        items: [
          {
            text: 'Mockproject:',
            items: [
              formatStatusDate('2026-05-02'),
              formatStatusDate('2026-05-04'),
              formatStatusDate('2026-05-05'),
            ],
          },
        ],
      },
      {
        label: 'Verwerkt door SAP:',
        text: '2/2 (alles ingediend)',
      },
    ]);
  });

  it('states that all days failed instead of listing them for a fully failed target', () => {
    const message = buildApplyStatusMessage(
      [BASE_SCHEDULE],
      new Map(),
      new Map<string, Set<string>>([
        ['Mockproject', new Set(['2026-05-01', '2026-05-02'])],
        ['Testproject 42', new Set(['2026-05-04'])],
      ]),
      new Map([
        ['Mockproject', new Set(['2026-05-01', '2026-05-02'])],
        ['Testproject 42', new Set(['2026-05-04', '2026-05-05'])],
      ]),
      1,
      1,
    );

    expect(message[2]).toEqual({
      label: 'Mislukte dagen:',
      text: '3/4',
      items: [
        'Mockproject: alle dagen mislukt',
        {
          text: 'Testproject 42:',
          items: [formatStatusDate('2026-05-04')],
        },
      ],
    });
  });

  it('uses distinct target dates when schedules overlap and one fails', () => {
    const targetDates = new Map<string, Set<string>>();
    addTargetDatesForProject(targetDates, 'Mockproject', [
      '2026-05-01',
      '2026-05-02',
    ]);
    addTargetDatesForProject(targetDates, 'Mockproject', [
      '2026-05-01',
      '2026-05-02',
    ]);

    const message = buildApplyStatusMessage(
      [BASE_SCHEDULE, { ...BASE_SCHEDULE, id: 'schedule-2' }],
      new Map(),
      new Map([['Mockproject', new Set(['2026-05-01', '2026-05-02'])]]),
      targetDates,
      0,
      0,
    );

    expect(message[1]).toMatchObject({
      label: 'Bijgewerkte dagen:',
      text: '0/2',
    });
    expect(message[2]).toEqual({
      label: 'Mislukte dagen:',
      text: '2/2',
      items: ['Mockproject: alle dagen mislukt'],
    });
  });

  it('distinguishes partial confirmation from full confirmation', () => {
    const message = buildApplyStatusMessage(
      [BASE_SCHEDULE],
      new Map(),
      new Map(),
      new Map(),
      2,
      1,
    );
    expect(message.at(-1)).toEqual({
      label: 'Verwerkt door SAP:',
      text: '1/2 (gedeeltelijk ingediend)',
    });
  });
});

describe('addTargetDatesForProject', () => {
  it('keeps distinct dates per target', () => {
    const dates = new Map<string, Set<string>>();
    addTargetDatesForProject(dates, 'Z1', ['2026-05-01', '2026-05-02']);
    addTargetDatesForProject(dates, 'Z1', ['2026-05-02', '2026-05-03']);
    expect(dates.get('Z1')).toEqual(
      new Set(['2026-05-01', '2026-05-02', '2026-05-03']),
    );
  });
});

describe('navigateToProject', () => {
  it('throws when current tab has no URL', async () => {
    mockChromeTabsGet.mockResolvedValueOnce({
      id: 99,
      status: 'complete',
    } as chrome.tabs.Tab);

    await expect(
      navigateToProject(99, 5, 2026, 'ZMOCK_001.1.1'),
    ).rejects.toThrow('Kan niet navigeren zonder huidige tab-URL.');
    expect(mockChromeTabsUpdate).not.toHaveBeenCalled();
  });

  it('skips navigation when target URL equals current URL', async () => {
    const sameUrl = `${BASE_URL}&/5/2026/project/ZMOCK_001.1.1`;
    mockChromeTabsGet.mockResolvedValueOnce({
      id: 99,
      status: 'complete',
      url: sameUrl,
    } as chrome.tabs.Tab);

    await navigateToProject(99, 5, 2026, 'ZMOCK_001.1.1');

    expect(mockChromeTabsUpdate).not.toHaveBeenCalled();
  });

  it('updates tab URL and waits until tab is complete and not busy', async () => {
    vi.useFakeTimers();

    mockChromeTabsGet
      .mockResolvedValueOnce({
        id: 99,
        status: 'complete',
        url: BASE_URL,
      } as chrome.tabs.Tab) // pre-check
      .mockResolvedValueOnce({
        id: 99,
        status: 'loading',
        url: BASE_URL,
      } as chrome.tabs.Tab) // check 1
      .mockResolvedValueOnce({
        id: 99,
        status: 'complete',
        url: BASE_URL,
      } as chrome.tabs.Tab) // check 2
      .mockResolvedValueOnce({
        id: 99,
        status: 'complete',
        url: BASE_URL,
      } as chrome.tabs.Tab); // check 3
    mockGetSAPBusyStateForTab
      .mockResolvedValueOnce(true) // check 1
      .mockResolvedValueOnce(true) // check 2
      .mockResolvedValueOnce(false); // check 3

    const navigation = navigateToProject(99, 5, 2026, 'ZMOCK_001.1.1');
    await vi.advanceTimersByTimeAsync(450);
    await navigation;

    expect(mockChromeTabsUpdate).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        url: expect.stringContaining('&/5/2026/project/ZMOCK_001.1.1'),
      }),
    );
    expect(mockGetSAPBusyStateForTab).toHaveBeenCalledTimes(3);
  });

  it('times out when SAP stays busy too long', async () => {
    vi.useFakeTimers();
    const nowValues = [0, 0, 10_001];
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockImplementation(() => nowValues.shift() ?? 10_001);

    mockChromeTabsGet.mockResolvedValue({
      id: 99,
      status: 'complete',
      url: BASE_URL,
    } as chrome.tabs.Tab);
    mockGetSAPBusyStateForTab.mockResolvedValue(true);

    const navigation = navigateToProject(99, 5, 2026, 'ZMOCK_001.1.1');
    const rejection = expect(navigation).rejects.toThrow(
      'Navigatie naar projectpagina duurde te lang.',
    );
    await vi.advanceTimersByTimeAsync(250);

    await rejection;
    nowSpy.mockRestore();
  });
});

describe('autofillScheduleEntries', () => {
  it('returns explanatory error when expanded period has no days', async () => {
    mockExpandWeeklyScheduleToMonthEntries.mockReturnValue([]);

    const result = await autofillScheduleEntries(99, BASE_SCHEDULE, 5, 2026);

    expect(result).toEqual({
      totalDaysCount: 0,
      appliedDates: [],
      failedDates: [],
      submissionAttempted: false,
      submissionConfirmed: false,
      error:
        'Geen toepasbare dagen gevonden voor schema Kantooruren in periode 5/2026.',
    });
    expect(mockAutofillEntriesViaUi5).not.toHaveBeenCalled();
  });

  it('returns failed entries when UI5 autofill returns an error', async () => {
    const entries = [
      { date: '2026-05-01', hours: 8 },
      { date: '2026-05-02', hours: 0 },
    ];
    mockExpandWeeklyScheduleToMonthEntries.mockReturnValue(entries);
    mockAutofillEntriesViaUi5.mockResolvedValue({
      appliedDates: [],
      failedDates: [],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'autofill failed',
    });

    const result = await autofillScheduleEntries(99, BASE_SCHEDULE, 5, 2026);

    expect(result).toEqual({
      totalDaysCount: 2,
      appliedDates: [],
      failedDates: ['2026-05-01', '2026-05-02'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'autofill failed',
    });
  });

  it('uses autofill error result as-is when provided', async () => {
    mockExpandWeeklyScheduleToMonthEntries.mockReturnValue([
      { date: '2026-05-01', hours: 8 },
    ]);
    mockAutofillEntriesViaUi5.mockResolvedValue({
      appliedDates: [],
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'Geen maandgegevens beschikbaar voor autofill in SAP.',
    });

    const result = await autofillScheduleEntries(99, BASE_SCHEDULE, 5, 2026);

    expect(result.error).toBe(
      'Geen maandgegevens beschikbaar voor autofill in SAP.',
    );
  });

  it('maps successful UI5 autofill result into summary', async () => {
    const entries = [
      { date: '2026-05-01', hours: 8 },
      { date: '2026-05-02', hours: 0 },
    ];
    mockExpandWeeklyScheduleToMonthEntries.mockReturnValue(entries);
    mockAutofillEntriesViaUi5.mockResolvedValue({
      appliedDates: ['2026-05-01'],
      failedDates: ['2026-05-02'],
      submissionAttempted: true,
      submissionConfirmed: true,
    });

    const result = await autofillScheduleEntries(99, BASE_SCHEDULE, 5, 2026);

    expect(mockAutofillEntriesViaUi5).toHaveBeenCalledWith(99, [
      { date: '2026-05-01', hours: 8 },
      { date: '2026-05-02', hours: 0 },
    ]);
    expect(result).toEqual({
      totalDaysCount: 2,
      appliedDates: ['2026-05-01'],
      failedDates: ['2026-05-02'],
      submissionAttempted: true,
      submissionConfirmed: true,
      error: undefined,
    });
  });

  it('converts UI5 autofill error into full failure for the period', async () => {
    mockExpandWeeklyScheduleToMonthEntries.mockReturnValue([
      { date: '2026-05-01', hours: 8 },
      { date: '2026-05-02', hours: 0 },
    ]);
    mockAutofillEntriesViaUi5.mockResolvedValue({
      appliedDates: ['2026-05-01', '2026-05-02'],
      failedDates: [],
      submissionAttempted: true,
      submissionConfirmed: false,
      error: 'submit failed',
    });

    const result = await autofillScheduleEntries(99, BASE_SCHEDULE, 5, 2026);

    expect(result).toEqual({
      totalDaysCount: 2,
      appliedDates: [],
      failedDates: ['2026-05-01', '2026-05-02'],
      submissionAttempted: true,
      submissionConfirmed: false,
      error: 'submit failed',
    });
  });
});
