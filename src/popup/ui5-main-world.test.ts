import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SapProjectsModelData, SapTimesheetDayEntry } from '../shared/types';
import { ui5MainWorldAutofill, ui5MainWorldReadSnapshot } from './ui5-main-world';

describe('ui5MainWorldReadSnapshot', () => {
  beforeEach(() => {
    delete (window as Window & { sap?: unknown }).sap;
  });

  it('converts 0-indexed SAP month to 1-indexed snapshot month', () => {
    (window as Window & { sap?: unknown }).sap = {
      ui: {
        getCore: () => ({
          byId: (id: string) => {
            if (id !== 'application-timesheet-my-component---idDetailTotals') {
              return null;
            }

            return {
              getModel: (name: string) => {
                if (name !== 'projectsmodel') {
                  return null;
                }

                return {
                  getData: () => ({
                    oMonth: 6,
                    oYear: 2026,
                    oCurrentProject: { WorkPackage: 'ZMOCK_001.1.1' },
                    oProjects: [{ WorkPackage: 'ZMOCK_001.1.1' }],
                    oTotals: {
                      oStatus: 'U',
                      oTotals: {
                        totalActualWorkHours: '08:00',
                        hoursToBePerformed: '160:00',
                        leaveHours: null,
                      },
                    },
                  }),
                };
              },
            };
          },
        }),
      },
    };

    const result = ui5MainWorldReadSnapshot();
    expect(result.success).toBe(true);
    expect(result.snapshot?.month).toBe(7);
    expect(result.snapshot?.year).toBe(2026);
    expect(result.snapshot?.sapStatus).toBe('editable');
  });

  it('returns a stable error when projectsmodel cannot be read', () => {
    (window as Window & { sap?: unknown }).sap = {
      ui: {
        getCore: () => ({
          byId: () => ({
            getModel: () => ({
              getData: () => {
                throw new Error('boom');
              },
            }),
          }),
        }),
      },
    };

    expect(ui5MainWorldReadSnapshot()).toEqual({
      success: false,
      error: 'SAP projectsmodel kon niet worden gelezen via de UI5 pagina-context.',
    });
  });
});

describe('ui5MainWorldAutofill', () => {
  const baseDay = (date: string, overrides?: Partial<SapTimesheetDayEntry>): SapTimesheetDayEntry => ({
    Date: new Date(date).getTime(),
    ProjectCode: 'ZMOCK_001.1.1',
    Comment: '',
    FullTime: '00:00',
    Others: '00:00',
    IsWorkingDay: true,
    IsOnLeave: false,
    IsHoliday: false,
    IsWeekEnd: false,
    AvailabilityInHours: 480,
    FullTime_Entries: [],
    Others_Entries: [],
    ...overrides,
  });

  const setSapContext = (
    monthData: SapTimesheetDayEntry[],
    callFunctionSpy: (path: string, params: any) => void,
    refreshTotalsModelsSpy?: () => void,
    userDetailOverrides?: Partial<SapProjectsModelData['UserDetail']>,
  ): void => {
    const projectsModelData: SapProjectsModelData = {
      oMonth: 4,
      oYear: 2026,
      UserDetail: {
        PersonWorkAgreement: '40001234',
        PersonWorkAgreementExternalID: '00045678',
        CompanyCode: '1000',
        ...(userDetailOverrides ?? {}),
      },
      oCurrentProject: {
        WorkPackage: 'ZMOCK_001.1.1',
        WorkPackageName: 'Test project',
        oTimeSheet: monthData,
        EngagementProjectResource: 'T001',
        CostCenter: '10001234',
        CostCenterControllingArea: 'A000',
        CompanyCode: '1000',
        EmploymentInternalID: '40001234',
        PurchaseOrder: '',
        PurchaseOrderItem: '00000',
        PurchaseOrderCalculated: '',
        PurchaseOrderItemCalculated: '00000',
      },
      oProjects: [],
      oTotals: {
        oStatus: 'U',
        oTotals: {
          hoursToBePerformed: '00:00',
          totalActualWorkHours: '00:00',
          leaveHours: null,
        },
      },
    };

    (window as Window & { sap?: unknown }).sap = {
      ui: {
        getCore: () => ({
          byId: (id: string) => {
            if (id === 'application-timesheet-my-component---idDetailTotals') {
              return null;
            }
            if (id !== 'application-timesheet-my-component---idDetail') {
              return null;
            }

            return {
              getController: () => ({
                _refreshTotalsModels: refreshTotalsModelsSpy,
              }),
              getModel: (name?: string) => {
                if (name === 'projectsmodel') {
                  return { getData: () => projectsModelData };
                }
                return { callFunction: callFunctionSpy };
              },
            };
          },
        }),
      },
    };
  };

  it('returns a clear error when sap.ui.getCore is unavailable', async () => {
    delete (window as Window & { sap?: unknown }).sap;

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'sap.ui.getCore is niet beschikbaar in de pagina-context.',
    });
  });

  it('returns a clear error when month data is unavailable', async () => {
    setSapContext([], vi.fn());

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'Geen maandgegevens beschikbaar voor autofill in SAP.',
    });
  });

  it('returns an error when no current project is selected in SAP', async () => {
    (window as Window & { sap?: unknown }).sap = {
      ui: {
        getCore: () => ({
          byId: (id: string) => {
            if (id !== 'application-timesheet-my-component---idDetail') return null;
            return {
              getController: () => ({ _refreshTotalsModels: vi.fn() }),
              getModel: (name?: string) => {
                if (name === 'projectsmodel') {
                  return {
                    getData: () => ({
                      oMonth: 4,
                      oYear: 2026,
                      UserDetail: { PersonWorkAgreement: '40001234', PersonWorkAgreementExternalID: '00045678', CompanyCode: '1000' },
                      oCurrentProject: null,
                      oProjects: [],
                      oTotals: { oStatus: 'U', oTotals: { hoursToBePerformed: '00:00', totalActualWorkHours: '00:00', leaveHours: null } },
                    }),
                  };
                }
                return { callFunction: vi.fn() };
              },
            };
          },
        }),
      },
    };

    const result = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: 8 }] });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'Geen actief project geselecteerd in SAP.',
    });
  });

  it('returns an error when projectsModelData cannot be read', async () => {
    (window as Window & { sap?: unknown }).sap = {
      ui: {
        getCore: () => ({
          byId: (id: string) => {
            if (id !== 'application-timesheet-my-component---idDetail') return null;
            return {
              getController: () => ({ _refreshTotalsModels: vi.fn() }),
              getModel: (name?: string) => {
                if (name === 'projectsmodel') {
                  return { getData: () => null };
                }
                return { callFunction: vi.fn() };
              },
            };
          },
        }),
      },
    };

    const result = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: 8 }] });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'ProjectsModel data kon niet worden gelezen via UI5.',
    });
  });

  it('creates a postTimeSheet row for a valid create operation', async () => {
    const callFunctionSpy = vi.fn((path: string, params: any) => {
      expect(path).toBe('/postTimeSheet');
      params.success?.();
    });
    const refreshSpy = vi.fn();
    const monthData = [baseDay('2026-05-01')];
    setSapContext(monthData, callFunctionSpy, refreshSpy);

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 1,
      failedDates: [],
      submissionAttempted: true,
      submissionConfirmed: true,
    });

    const payload = JSON.parse(callFunctionSpy.mock.calls[0][1].urlParameters.payload) as { v_General: Array<any> };
    expect(payload.v_General[0].TimeSheetOperation).toBe('C');
    expect(payload.v_General[0].TimeSheetDataFields.RecordedHours).toBe('8');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('returns detailed error context when postTimeSheet fails', async () => {
    const callFunctionSpy = vi.fn((_path: string, params: any) => {
      const err = new Error('Network failed') as Error & { responseText?: string; body?: string };
      err.responseText = ' SAP backend';
      err.body = ' body payload';
      params.error?.(err);
    });

    setSapContext([baseDay('2026-05-01')], callFunctionSpy);

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: true,
      submissionConfirmed: false,
      error: 'Network failed SAP backend body payload',
    });
  });

  it('treats zero hours on an empty day as a no-op', async () => {
    const callFunctionSpy = vi.fn();
    setSapContext([baseDay('2026-05-02')], callFunctionSpy);

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-02', hours: 0 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: [],
      submissionAttempted: false,
      submissionConfirmed: false,
    });
    expect(callFunctionSpy).not.toHaveBeenCalled();
  });

  it('fails a day where the requested hours exceed day availability', async () => {
    // AvailabilityInHours is in minutes (480 = 8h). Requesting 9h (540 min) exceeds it.
    setSapContext([baseDay('2026-05-01', { AvailabilityInHours: 480 })], vi.fn());

    const result = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: 9 }] });

    expect(result.failedDates).toEqual(['2026-05-01']);
    expect(result.appliedDaysCount).toBe(0);
    expect(result.submissionAttempted).toBe(false);
  });

  it('fails a day with negative or non-finite hours', async () => {
    setSapContext([baseDay('2026-05-01'), baseDay('2026-05-02')], vi.fn());

    const negativeResult = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: -1 }] });
    expect(negativeResult.failedDates).toEqual(['2026-05-01']);

    const nanResult = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-02', hours: NaN }] });
    expect(nanResult.failedDates).toEqual(['2026-05-02']);
  });

  it('returns an error when required SAP identification fields are missing', async () => {
    setSapContext([baseDay('2026-05-01')], vi.fn(), undefined, {
      PersonWorkAgreement: '',
      PersonWorkAgreementExternalID: '',
      CompanyCode: '',
    });

    const result = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: 8 }] });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'Kan vereiste SAP identificatievelden niet bepalen voor postTimeSheet.',
    });
  });

  it('returns an error when the OData model does not support postTimeSheet', async () => {
    // Override the SAP context to return a model without callFunction
    (window as Window & { sap?: unknown }).sap = {
      ui: {
        getCore: () => ({
          byId: (id: string) => {
            if (id !== 'application-timesheet-my-component---idDetail') return null;
            return {
              getController: () => ({ _refreshTotalsModels: vi.fn() }),
              getModel: (name?: string) => {
                if (name === 'projectsmodel') {
                  return {
                    getData: () => ({
                      oMonth: 4,
                      oYear: 2026,
                      UserDetail: { PersonWorkAgreement: '40001234', PersonWorkAgreementExternalID: '00045678', CompanyCode: '1000' },
                      oCurrentProject: {
                        WorkPackage: 'ZMOCK_001.1.1',
                        oTimeSheet: [baseDay('2026-05-01')],
                        EngagementProjectResource: 'T001',
                        CostCenter: '10001234',
                        CostCenterControllingArea: 'A000',
                        CompanyCode: '1000',
                        EmploymentInternalID: '40001234',
                        PurchaseOrder: '',
                        PurchaseOrderItem: '00000',
                        PurchaseOrderCalculated: '',
                        PurchaseOrderItemCalculated: '00000',
                      },
                      oProjects: [],
                      oTotals: { oStatus: 'U', oTotals: { hoursToBePerformed: '00:00', totalActualWorkHours: '00:00', leaveHours: null } },
                    }),
                  };
                }
                // Return model without callFunction
                return {};
              },
            };
          },
        }),
      },
    };

    const result = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: 8 }] });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'SAP OData model ondersteunt postTimeSheet niet in deze context.',
    });
  });

  it('returns a clear error for invalid ISO dates', async () => {
    setSapContext([baseDay('2026-05-03')], vi.fn());

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026/05/03', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026/05/03'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'Ongeldige ISO datum: 2026/05/03.',
    });
  });

  it('creates a delete (D) row when zero hours are submitted for a day with an existing TimeSheetRecord', async () => {
    const callFunctionSpy = vi.fn((_: string, params: any) => {
      params.success?.();
    });
    const refreshSpy = vi.fn();
    const monthData = [
      baseDay('2026-05-01', {
        FullTime_Entries: [{ TimeSheetRecord: 'REC001', PersonWorkAgreement: '40001234' }],
      }),
    ];
    setSapContext(monthData, callFunctionSpy, refreshSpy);

    const result = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: 0 }] });

    expect(result).toEqual({
      appliedDaysCount: 1,
      failedDates: [],
      submissionAttempted: true,
      submissionConfirmed: true,
    });
    const payload = JSON.parse(callFunctionSpy.mock.calls[0][1].urlParameters.payload) as { v_General: Array<any> };
    expect(payload.v_General[0].TimeSheetOperation).toBe('D');
    expect(payload.v_General[0].TimeSheetRecord).toBe('REC001');
  });

  it('fails a zero-hours day when the existing entry has no TimeSheetRecord', async () => {
    setSapContext(
      [baseDay('2026-05-01', { FullTime_Entries: [{ TimeSheetRecord: '' }] })],
      vi.fn(),
    );

    const result = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: 0 }] });

    expect(result.failedDates).toEqual(['2026-05-01']);
    expect(result.appliedDaysCount).toBe(0);
    expect(result.submissionAttempted).toBe(false);
  });

  it('creates an update (U) row when hours are submitted for a day with an existing TimeSheetRecord', async () => {
    const callFunctionSpy = vi.fn((_: string, params: any) => {
      params.success?.();
    });
    const monthData = [
      baseDay('2026-05-01', {
        FullTime_Entries: [{ TimeSheetRecord: 'REC002', PersonWorkAgreement: '40001234' }],
      }),
    ];
    setSapContext(monthData, callFunctionSpy, vi.fn());

    const result = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: 6 }] });

    expect(result.appliedDaysCount).toBe(1);
    const payload = JSON.parse(callFunctionSpy.mock.calls[0][1].urlParameters.payload) as { v_General: Array<any> };
    expect(payload.v_General[0].TimeSheetOperation).toBe('U');
    expect(payload.v_General[0].TimeSheetRecord).toBe('REC002');
  });

  it('fails an update when the existing entry has no TimeSheetRecord', async () => {
    setSapContext(
      [baseDay('2026-05-01', { FullTime_Entries: [{ TimeSheetRecord: '' }] })],
      vi.fn(),
    );

    const result = await ui5MainWorldAutofill({ entries: [{ date: '2026-05-01', hours: 8 }] });

    expect(result.failedDates).toEqual(['2026-05-01']);
    expect(result.appliedDaysCount).toBe(0);
    expect(result.submissionAttempted).toBe(false);
  });
});
