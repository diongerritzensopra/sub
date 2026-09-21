import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  SapGeneralHours,
  SapProject,
  SapProjectsModelData,
  SapTimesheetDayEntry,
} from '../shared/types';
import {
  ui5MainWorldAutofill,
  ui5MainWorldReadSnapshot,
} from './ui5-main-world';

function baseDay(
  date: string,
  overrides?: Partial<SapTimesheetDayEntry>,
): SapTimesheetDayEntry {
  return {
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
  };
}

function createProject(
  monthData: SapTimesheetDayEntry[] = [],
  overrides: Partial<SapProject> = {},
): SapProject {
  return {
    WorkPackage: 'ZMOCK_001.1.1',
    WorkPackageName: 'Mockproject',
    oTimeSheet: monthData,
    EngagementProjectResource: 'T001',
    CompanyCode: '1000',
    EmploymentInternalID: '40001234',
    BillingControlCategory: '',
    PurchaseOrder: '',
    PurchaseOrderItem: '00000',
    PurchaseOrderCalculated: '',
    PurchaseOrderItemCalculated: '00000',
    ...overrides,
  };
}

function createGeneralHours(
  monthData: SapTimesheetDayEntry[] = [],
  overrides: Partial<SapGeneralHours> = {},
): SapGeneralHours {
  return {
    TimeSheetTaskType: 'MISC',
    TimeSheetTaskTypeText: 'Commercial hours',
    oTimeSheet: monthData,
    ...overrides,
  };
}

function createProjectsModelData(
  overrides: Partial<SapProjectsModelData> = {},
): SapProjectsModelData {
  return {
    oMonth: 6,
    oYear: 2026,
    UserDetail: {
      PersonWorkAgreement: '40001234',
      PersonWorkAgreementExternalID: '00045678',
      CompanyCode: '1000',
      ControllingArea: 'A000',
      CostCenter: '90392131',
    },
    oCurrentProject: createProject(),
    oProjects: [createProject()],
    oGeneralHours: [createGeneralHours()],
    oTotals: {
      oStatus: 'U',
      oTotals: {
        totalActualWorkHours: '08:00',
        hoursToBePerformed: '160:00',
        leaveHours: null,
      },
    },
    ...overrides,
  };
}

function installReadSnapshotContext(
  modelDataOrFactory: unknown | (() => unknown),
): void {
  (window as Window & { sap?: unknown }).sap = {
    ui: {
      getCore: () => ({
        byId: (id: string) => {
          if (id !== 'application-timesheet-my-component---idDetail') {
            return null;
          }

          return {
            getModel: (name?: string) => {
              if (name !== 'projectsmodel') {
                return undefined;
              }

              return {
                getData: () =>
                  typeof modelDataOrFactory === 'function'
                    ? (modelDataOrFactory as () => unknown)()
                    : modelDataOrFactory,
              };
            },
          };
        },
      }),
    },
  };
}

function installAutofillContext(
  modelData: SapProjectsModelData | null,
  callFunctionSpy?: (path: string, params: any) => void,
  refreshTotalsModelsSpy?: () => void,
): void {
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
                return { getData: () => modelData };
              }

              return callFunctionSpy ? { callFunction: callFunctionSpy } : {};
            },
          };
        },
      }),
    },
  };
}

beforeEach(() => {
  delete (window as Window & { sap?: unknown }).sap;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('ui5MainWorldReadSnapshot', () => {
  it('reads and normalizes projects and general-hours options', () => {
    installReadSnapshotContext(
      createProjectsModelData({
        oProjects: [
          createProject([], {
            WorkPackage: ' zmock_001.1.1 ',
            WorkPackageName: 'Mockproject',
          }),
          createProject([], {
            WorkPackage: 'ZMOCK_001.1.1',
            WorkPackageName: '',
          }),
          createProject([], {
            WorkPackage: 'ZTEST_42',
            WorkPackageName: 'Testproject 42',
          }),
        ],
        oGeneralHours: [
          createGeneralHours([], {
            TimeSheetTaskType: ' misc ',
            TimeSheetTaskTypeText: 'Commercial hours',
          }),
          createGeneralHours([], {
            TimeSheetTaskType: 'MISC',
            TimeSheetTaskTypeText: '',
          }),
          createGeneralHours([], {
            TimeSheetTaskType: 'ADM',
            TimeSheetTaskTypeText: 'Administration',
          }),
        ],
        oCurrentProject: createProject([], {
          WorkPackage: ' ztest_42 ',
          WorkPackageName: 'Testproject 42',
        }),
      }),
    );

    const result = ui5MainWorldReadSnapshot();

    expect(result).toEqual({
      success: true,
      snapshot: {
        month: 7,
        year: 2026,
        targets: [
          {
            targetType: 'general-hours',
            targetCode: 'ADM',
            targetLabel: 'Administration',
          },
          {
            targetType: 'general-hours',
            targetCode: 'MISC',
            targetLabel: 'Commercial hours',
          },
          {
            targetType: 'project',
            targetCode: 'ZMOCK_001.1.1',
            targetLabel: 'Mockproject',
          },
          {
            targetType: 'project',
            targetCode: 'ZTEST_42',
            targetLabel: 'Testproject 42',
          },
        ],
        currentProjectCode: 'ZTEST_42',
        sapStatus: 'editable',
        totals: {
          worked: 8,
          toBePerformed: 160,
        },
      },
    });
  });

  it('uses the current general-hours task type as currentProjectCode', () => {
    installReadSnapshotContext(
      createProjectsModelData({
        oCurrentProject: createGeneralHours([], {
          TimeSheetTaskType: ' adm ',
          TimeSheetTaskTypeText: 'Administration',
        }),
      }),
    );

    const result = ui5MainWorldReadSnapshot();

    expect(result.success).toBe(true);
    expect(result.snapshot?.currentProjectCode).toBe('ADM');
  });

  it('returns a stable error when projectsmodel cannot be read', () => {
    installReadSnapshotContext(() => {
      throw new Error('boom');
    });

    expect(ui5MainWorldReadSnapshot()).toEqual({
      success: false,
      error:
        'SAP projectsmodel kon niet worden gelezen via de UI5 pagina-context.',
    });
  });

  it('returns an error when general-hours data is missing', () => {
    installReadSnapshotContext({
      ...createProjectsModelData(),
      oGeneralHours: undefined,
    } as unknown as SapProjectsModelData);

    expect(ui5MainWorldReadSnapshot()).toEqual({
      success: false,
      error: 'SAP projectsmodel bevat geen geldige algemene uren.',
    });
  });

  it('returns an error when general-hours data is empty after normalization', () => {
    installReadSnapshotContext(
      createProjectsModelData({
        oGeneralHours: [
          createGeneralHours([], {
            TimeSheetTaskType: '   ',
            TimeSheetTaskTypeText: 'Ignored',
          }),
        ],
      }),
    );

    expect(ui5MainWorldReadSnapshot()).toEqual({
      success: false,
      error: 'SAP projectsmodel bevat geen geldige algemene uren.',
    });
  });
});

describe('ui5MainWorldAutofill', () => {
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
    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: createProject([]),
      }),
      vi.fn(),
    );

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
    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: null,
      }),
      vi.fn(),
    );

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'Geen actief project geselecteerd in SAP.',
    });
  });

  it('returns an error when projectsModel data cannot be read', async () => {
    installAutofillContext(null, vi.fn());

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

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

    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: createProject([baseDay('2026-05-01')], {
          BillingControlCategory: 'BC01',
        }),
      }),
      callFunctionSpy,
      refreshSpy,
    );

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 1,
      failedDates: [],
      submissionAttempted: true,
      submissionConfirmed: true,
    });

    const payload = JSON.parse(
      callFunctionSpy.mock.calls[0][1].urlParameters.payload,
    ) as { v_General: Array<any> };
    expect(payload.v_General[0]).toMatchObject({
      CompanyCode: '1000',
      TimeSheetOperation: 'C',
      PersonWorkAgreement: '',
      TimeSheetDate: `/Date(${new Date('2026-05-01').getTime()})/`,
      TimeSheetStatus: '20',
      TimeSheetIsExecutedInTestRun: false,
      TimeSheetIsReleasedOnSave: true,
      TimeSheetDataFields: {
        ControllingArea: 'A000',
        SenderCostCenter: '90392131',
        ReceiverCostCenter: '',
        ActivityType: 'T001',
        WBSElement: 'ZMOCK_001.1.1',
        TimeSheetTaskType: '',
        TimeSheetTaskLevel: '',
        TimeSheetTaskComponent: '',
        TimeSheetNote: '',
        RecordedHours: '8',
        PurchaseOrder: '',
        PurchaseOrderItem: '00000',
        RecordedQuantity: '8',
        HoursUnitOfMeasure: 'H',
        TimeSheetOvertimeCategory: '',
        BillingControlCategory: 'BC01',
      },
    });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('returns detailed error context when postTimeSheet fails', async () => {
    const callFunctionSpy = vi.fn((_path: string, params: any) => {
      const err = new Error('Network failed') as Error & {
        responseText?: string;
        body?: string;
      };
      err.responseText = ' SAP backend';
      err.body = ' body payload';
      params.error?.(err);
    });

    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: createProject([baseDay('2026-05-01')]),
      }),
      callFunctionSpy,
    );

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
    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: createProject([baseDay('2026-05-02')]),
      }),
      callFunctionSpy,
    );

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
    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: createProject([
          baseDay('2026-05-01', { AvailabilityInHours: 480 }),
        ]),
      }),
      vi.fn(),
    );

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 9 }],
    });

    expect(result.failedDates).toEqual(['2026-05-01']);
    expect(result.appliedDaysCount).toBe(0);
    expect(result.submissionAttempted).toBe(false);
  });

  it('fails a day with negative or non-finite hours', async () => {
    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: createProject([
          baseDay('2026-05-01'),
          baseDay('2026-05-02'),
        ]),
      }),
      vi.fn(),
    );

    const negativeResult = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: -1 }],
    });
    expect(negativeResult.failedDates).toEqual(['2026-05-01']);

    const nanResult = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-02', hours: Number.NaN }],
    });
    expect(nanResult.failedDates).toEqual(['2026-05-02']);
  });

  it('returns an error when required SAP identification fields are missing', async () => {
    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        UserDetail: {
          PersonWorkAgreement: '',
          PersonWorkAgreementExternalID: '',
          CompanyCode: '',
        },
        oCurrentProject: createProject([baseDay('2026-05-01')]),
      }),
      vi.fn(),
    );

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error:
        'Kan vereiste SAP identificatievelden niet bepalen voor postTimeSheet.',
    });
  });

  it('returns an error when the OData model does not support postTimeSheet', async () => {
    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: createProject([baseDay('2026-05-01')]),
      }),
      undefined,
    );

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-01'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'SAP OData model ondersteunt postTimeSheet niet in deze context.',
    });
  });

  it('populates TimeSheetTaskType for general-hours entries', async () => {
    const callFunctionSpy = vi.fn((path: string, params: any) => {
      expect(path).toBe('/postTimeSheet');
      params.success?.();
    });

    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: createGeneralHours([baseDay('2026-05-01')]),
      }),
      callFunctionSpy,
    );

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-05-01', hours: 8 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 1,
      failedDates: [],
      submissionAttempted: true,
      submissionConfirmed: true,
    });

    // Verify that the general-hours task type is populated in the posting
    const payload = JSON.parse(
      callFunctionSpy.mock.calls[0][1].urlParameters.payload,
    ) as { v_General: Array<any> };
    expect(payload.v_General[0]).toMatchObject({
      CompanyCode: '1000',
      TimeSheetOperation: 'C',
      PersonWorkAgreement: '',
      TimeSheetDate: `/Date(${new Date('2026-05-01').getTime()})/`,
      TimeSheetStatus: '20',
      TimeSheetIsExecutedInTestRun: false,
      TimeSheetIsReleasedOnSave: true,
      TimeSheetDataFields: {
        ControllingArea: 'A000',
        SenderCostCenter: '',
        ActivityType: '',
        WBSElement: '',
        TimeSheetTaskType: 'MISC',
        TimeSheetTaskLevel: 'NONE',
        TimeSheetTaskComponent: 'WORK',
        TimeSheetNote: '',
        RecordedHours: '8',
        RecordedQuantity: '8',
        HoursUnitOfMeasure: 'H',
        TimeSheetOvertimeCategory: '',
      },
    });
    expect(payload.v_General[0].TimeSheetDataFields).not.toHaveProperty(
      'ReceiverCostCenter',
    );
    expect(payload.v_General[0].TimeSheetDataFields).not.toHaveProperty(
      'PurchaseOrder',
    );
    expect(payload.v_General[0].TimeSheetDataFields).not.toHaveProperty(
      'PurchaseOrderItem',
    );
    expect(payload.v_General[0].TimeSheetDataFields).not.toHaveProperty(
      'BillingControlCategory',
    );
  });

  it('handles general-hours update with existing task type preservation', async () => {
    const callFunctionSpy = vi.fn((path: string, params: any) => {
      expect(path).toBe('/postTimeSheet');
      params.success?.();
    });
    const existingEntry = baseDay('2026-04-01', {
      AvailabilityInHours: 480,
      FullTime_Entries: [
        {
          TimeSheetRecord: 'RECORD-001',
          PersonWorkAgreement: 'PWA-001',
          TimeSheetDataFields: {
            TimeSheetTaskType: 'MISC',
            ControllingArea: 'A000',
            SenderCostCenter: 'CC001',
            ReceiverCostCenter: '',
            ActivityType: '',
            WBSElement: '',
            TimeSheetTaskLevel: '',
            TimeSheetTaskComponent: '',
            TimeSheetNote: '',
            PurchaseOrder: '',
            PurchaseOrderItem: '00000',
            RecordedHours: '8.00',
            RecordedQuantity: '8.000',
            HoursUnitOfMeasure: 'H',
            TimeSheetOvertimeCategory: '',
            BillingControlCategory: '',
          },
          TimeSheetStatus: '',
        },
      ],
    });

    installAutofillContext(
      createProjectsModelData({
        oMonth: 4,
        oCurrentProject: createGeneralHours([existingEntry]),
      }),
      callFunctionSpy,
    );

    const result = await ui5MainWorldAutofill({
      entries: [{ date: '2026-04-01', hours: 6 }],
    });

    expect(result).toEqual({
      appliedDaysCount: 1,
      failedDates: [],
      submissionAttempted: true,
      submissionConfirmed: true,
    });

    // Verify the update operation with the general-hours field shape.
    const payload = JSON.parse(
      callFunctionSpy.mock.calls[0][1].urlParameters.payload,
    ) as { v_General: Array<any> };
    expect(payload.v_General[0]).toMatchObject({
      CompanyCode: '1000',
      TimeSheetOperation: 'U',
      PersonWorkAgreement: 'PWA-001',
      TimeSheetDate: `/Date(${Date.UTC(2026, 3, 1)})/`,
      TimeSheetStatus: '20',
      TimeSheetIsExecutedInTestRun: false,
      TimeSheetIsReleasedOnSave: true,
      TimeSheetRecord: 'RECORD-001',
      TimeSheetDataFields: {
        ControllingArea: 'A000',
        SenderCostCenter: '',
        ReceiverCostCenter: '90392131',
        ActivityType: '',
        WBSElement: '',
        TimeSheetTaskType: 'MISC',
        TimeSheetTaskLevel: 'NONE',
        TimeSheetTaskComponent: 'WORK',
        TimeSheetNote: '',
        RecordedHours: '6',
        RecordedQuantity: '6',
        HoursUnitOfMeasure: 'H',
        TimeSheetOvertimeCategory: '',
      },
    });
    expect(payload.v_General[0].TimeSheetDataFields).not.toHaveProperty(
      'PurchaseOrder',
    );
    expect(payload.v_General[0].TimeSheetDataFields).not.toHaveProperty(
      'PurchaseOrderItem',
    );
    expect(payload.v_General[0].TimeSheetDataFields).not.toHaveProperty(
      'BillingControlCategory',
    );
  });
});
