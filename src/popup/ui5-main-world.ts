/**
 * UI5 main-world injected functions.
 *
 * These three functions are serialised and injected into the SAP page's main-world
 * context via chrome.scripting.executeScript. They MUST be self-contained: no
 * imports from the extension runtime are available when they execute inside the page.
 * Type imports below are erased at compile time and do not affect the injected code.
 */

import type {
  SapProject,
  SapProjectsModelData,
  SapTimesheetDayEntry,
  SapTimesheetRecordedEntry,
  SapUserDetail,
  TimesheetSnapshot,
} from '../shared/types';

export type Ui5AutofillArgs = {
  entries: Array<{ date: string; hours: number }>;
};

export type Ui5AutofillResult = {
  appliedDaysCount: number;
  failedDates: string[];
  submissionAttempted: boolean;
  submissionConfirmed: boolean;
  error?: string;
};

export type Ui5SnapshotReadResult = {
  success: boolean;
  snapshot?: TimesheetSnapshot;
  error?: string;
};

export function ui5MainWorldReadSnapshot(): Ui5SnapshotReadResult {
  const mapSapStatus = (status: string | undefined | null): TimesheetSnapshot['sapStatus'] => {
    return (status ?? '').trim().toUpperCase() === 'U' ? 'editable' : 'locked';
  };

  type Ui5ProjectsDataModelLike = { getData?: () => SapProjectsModelData };
  type Ui5TimesheetComponentLike = { getModel?: (name?: string) => Ui5ProjectsDataModelLike | undefined };
  type Ui5Core = { byId?: (id: string) => Ui5TimesheetComponentLike | undefined };

  const parseTimeValue = (timeStr: string | null | undefined): number | null => {
    const match = (timeStr ?? '').match(/^(-?\d+):(\d{2})$/);
    if (!match) {
      return null;
    }

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }

    return hours + minutes / 60;
  };
  const getUi5Core = (targetWindow: Window): Ui5Core | null => {
    const uiWindow = targetWindow as Window & { sap?: { ui?: { getCore?: () => Ui5Core } } };
    return uiWindow.sap?.ui?.getCore?.() ?? null;
  };
  const resolveTimesheetComponent = (sapCore: Ui5Core): Ui5TimesheetComponentLike | undefined => {
    const totalsComponent = sapCore.byId?.('application-timesheet-my-component---idDetailTotals');
    if (totalsComponent?.getModel) {
      return totalsComponent;
    }

    return sapCore.byId?.('application-timesheet-my-component---idDetail');
  };
  const getProjectsModel = (targetWindow: Window): SapProjectsModelData | null => {
    const sapCore = getUi5Core(targetWindow);
    if (!sapCore?.byId) {
      return null;
    }

    const timesheetComponent = resolveTimesheetComponent(sapCore);
    const projectsModel = timesheetComponent?.getModel?.('projectsmodel');
    return projectsModel?.getData?.() ?? null;
  };

  try {
    const preferredFrame = document.querySelector<HTMLIFrameElement>('iframe[data-sap-ushell-active="true"], iframe[src*="ui5appruntime.html"], iframe[src*="#timesheet-my"]');
    const timesheetWindow = preferredFrame?.contentWindow ?? window;
    const modelData = getProjectsModel(timesheetWindow);
    if (!modelData || !Array.isArray(modelData.oProjects)) {
      return {
        success: false,
        error: 'SAP projectsmodel kon niet worden gelezen via de UI5 pagina-context.',
      };
    }

    const month = typeof modelData.oMonth === 'number' && modelData.oMonth >= 0 && modelData.oMonth <= 11
      ? modelData.oMonth + 1
      : null;
    const year = typeof modelData.oYear === 'number' ? modelData.oYear : null;
    const projectsByCode = new Map<string, string>();

    modelData.oProjects.forEach((project) => {
      const code = project.WorkPackage.trim().toUpperCase();
      if (!code) {
        return;
      }

      const name = (project.WorkPackageName ?? '').trim();
      const existingName = projectsByCode.get(code);
      if (!projectsByCode.has(code) || (!existingName && name)) {
        projectsByCode.set(code, name);
      }
    });

    const projects = Array.from(projectsByCode.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((left, right) => left.code.localeCompare(right.code));

    const currentProjectCode = modelData.oCurrentProject?.WorkPackage
      ? modelData.oCurrentProject.WorkPackage.trim().toUpperCase()
      : null;

    return {
      success: true,
      snapshot: {
        month,
        year,
        projects,
        currentProjectCode,
        sapStatus: mapSapStatus(modelData.oTotals.oStatus),
        totals: {
          worked: parseTimeValue(modelData.oTotals?.oTotals?.totalActualWorkHours),
          toBePerformed: parseTimeValue(modelData.oTotals?.oTotals?.hoursToBePerformed),
        },
      },
    };
  } catch {
    return {
      success: false,
      error: 'SAP projectsmodel kon niet worden gelezen via de UI5 pagina-context.',
    };
  }
}

export async function ui5MainWorldAutofill(args: Ui5AutofillArgs): Promise<Ui5AutofillResult> {
  const parseIsoDate = (isoDate: string): { year: number; month: number; day: number } => {
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new Error(`Ongeldige ISO datum: ${isoDate}.`);
    }

    return {
      year: Number.parseInt(match[1], 10),
      month: Number.parseInt(match[2], 10),
      day: Number.parseInt(match[3], 10),
    };
  };

  const getUi5Core = (targetWindow: Window): Ui5Core | null => {
    const uiWindow = targetWindow as Window & { sap?: { ui?: { getCore?: () => Ui5Core } } };
    return uiWindow.sap?.ui?.getCore?.() ?? null;
  };

  const getModelDataForDate = (isoDate: string): SapTimesheetDayEntry | null => {
    const dateParts = parseIsoDate(isoDate);
    const dateObj = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
    const timestamp = dateObj.getTime();

    // SAP model dates can be serialized around local midnight, so exact UTC timestamp
    // equality is unreliable. Use a wide tolerance around midnight to still map the
    // intended calendar day and keep AvailabilityInHours guards effective.
    const MODEL_DATE_MATCH_TOLERANCE_MS = 18 * 60 * 60 * 1000;
    return monthData.find((entry) => Math.abs(entry.Date - timestamp) <= MODEL_DATE_MATCH_TOLERANCE_MS) ?? null;
  };

  const isNonWritableDayRow = (isoDate: string, requestedHours: number): boolean => {
    const modelEntry = getModelDataForDate(isoDate);
    if (!modelEntry) {
      return true;
    }

    const requestedMinutes = Math.round(requestedHours * 60);
    return requestedMinutes > modelEntry.AvailabilityInHours;
  };

  const normalizeNumberString = (value: number): string => {
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
  };

  type ODataCallFunctionParameters = {
    method: 'POST';
    urlParameters: Record<string, string>;
    success?: () => void;
    error?: (error: unknown) => void;
  };

  type ODataModelLike = {
    callFunction?: (path: string, parameters: ODataCallFunctionParameters) => void;
  };

  type TotalsRefreshControllerLike = {
    _refreshTotalsModels?: () => void;
  };

  type Ui5ProjectsDataModelLike = { getData?: () => SapProjectsModelData };
  type Ui5TimesheetComponentLike = {
    getModel?: (name?: string) => Ui5ProjectsDataModelLike | undefined;
    getController?: () => TotalsRefreshControllerLike;
  };
  type Ui5Core = { byId?: (id: string) => Ui5TimesheetComponentLike | undefined };

  type PostTimeSheetGeneralCreateOrUpdate = {
    TimeSheetDataFields: {
      ControllingArea: string;
      SenderCostCenter: string;
      ReceiverCostCenter: string;
      ActivityType: string;
      WBSElement: string;
      TimeSheetTaskType: string;
      TimeSheetTaskLevel: string;
      TimeSheetTaskComponent: string;
      TimeSheetNote: string;
      RecordedHours: string;
      PurchaseOrder: string;
      PurchaseOrderItem: string;
      RecordedQuantity: string;
      HoursUnitOfMeasure: string;
      TimeSheetOvertimeCategory: string;
      BillingControlCategory: string;
    };
    CompanyCode: string;
    TimeSheetOperation: 'C' | 'U';
    PersonWorkAgreement: string;
    TimeSheetDate: string;
    TimeSheetStatus: string;
    TimeSheetIsExecutedInTestRun: false;
    TimeSheetIsReleasedOnSave: true;
    TimeSheetRecord?: string;
  };

  type PostTimeSheetGeneralDelete = {
    TimeSheetOperation: 'D';
    TimeSheetRecord: string;
    PersonWorkAgreement: string;
    TimeSheetIsReleasedOnSave: true;
  };

  type PostTimeSheetGeneralRow = PostTimeSheetGeneralCreateOrUpdate | PostTimeSheetGeneralDelete;

  const resolveTimesheetComponent = (sapCore: Ui5Core): Ui5TimesheetComponentLike | undefined => {
    const totalsComponent = sapCore.byId?.('application-timesheet-my-component---idDetailTotals');
    if (totalsComponent?.getModel) {
      return totalsComponent;
    }

    return sapCore.byId?.('application-timesheet-my-component---idDetail');
  };

  const getUi5ProjectsModelData = (targetWindow: Window): SapProjectsModelData | null => {
    const sapCore = getUi5Core(targetWindow);
    if (!sapCore?.byId) {
      return null;
    }

    const timesheetComponent = resolveTimesheetComponent(sapCore);
    const projectsModel = timesheetComponent?.getModel?.('projectsmodel');
    return projectsModel?.getData?.() ?? null;
  };

  const getMonthData = (): SapTimesheetDayEntry[] => {
    const preferredFrame = document.querySelector<HTMLIFrameElement>('iframe[data-sap-ushell-active="true"], iframe[src*="ui5appruntime.html"], iframe[src*="#timesheet-my"]');
    const timesheetWindow = preferredFrame?.contentWindow ?? window;
    const modelData = getUi5ProjectsModelData(timesheetWindow);
    const currentProject = modelData?.oCurrentProject ?? null;
    return Array.isArray(currentProject?.oTimeSheet) ? currentProject.oTimeSheet : [];
  };

  const monthData = getMonthData();

  const resolveTimesheetDateValue = (isoDate: string, modelEntry: SapTimesheetDayEntry): string => {
    if (Number.isFinite(modelEntry.Date)) {
      return `/Date(${Math.trunc(modelEntry.Date)})/`;
    }

    const dateParts = parseIsoDate(isoDate);
    return `/Date(${Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)})/`;
  };

  const callPostTimesheet = (
    postModel: ODataModelLike,
    urlParameters: Record<string, string>,
  ): Promise<void> => new Promise((resolve, reject) => {
    postModel.callFunction?.('/postTimeSheet', {
      method: 'POST',
      urlParameters,
      success: () => resolve(),
      error: (error) => reject(error),
    });
  });

  const refreshTotalsModels = (controller: TotalsRefreshControllerLike | null): void => {
    try {
      controller?._refreshTotalsModels?.();
    } catch {
      // Keep submission success intact if SAP refresh hook is unavailable or throws.
    }
  };

  const extractErrorMessage = (error: unknown): string => {
    let errorMessage = '';
    if (error instanceof Error && error.message) {
      errorMessage += error.message;
    }

    if (typeof error === 'object' && error !== null) {
      const responseText = (error as { responseText?: unknown }).responseText;
      if (typeof responseText === 'string' && responseText.length > 0) {
        errorMessage += '' + responseText;
      }

      const body = (error as { body?: unknown }).body;
      if (typeof body === 'string' && body.length > 0) {
        errorMessage += '' + body;
      }
    }

    return errorMessage.trim() || 'Posten van timesheet uren is mislukt.';
  };

  try {
    const preferredFrame = document.querySelector<HTMLIFrameElement>('iframe[data-sap-ushell-active="true"], iframe[src*="ui5appruntime.html"], iframe[src*="#timesheet-my"]');
    const timesheetWindow = preferredFrame?.contentWindow ?? window;
    const sapCore = getUi5Core(timesheetWindow);
    if (!sapCore?.byId) {
      return {
        appliedDaysCount: 0,
        failedDates: args.entries.map((entry) => entry.date),
        submissionAttempted: false,
        submissionConfirmed: false,
        error: 'sap.ui.getCore is niet beschikbaar in de pagina-context.',
      };
    }

    const timesheetComponent = resolveTimesheetComponent(sapCore);
    const projectsModel = timesheetComponent?.getModel?.('projectsmodel') as Ui5ProjectsDataModelLike | null;
    const projectsModelData = projectsModel?.getData?.() ?? null;
    if (!projectsModelData) {
      return {
        appliedDaysCount: 0,
        failedDates: args.entries.map((entry) => entry.date),
        submissionAttempted: false,
        submissionConfirmed: false,
        error: 'ProjectsModel data kon niet worden gelezen via UI5.',
      };
    }

    const currentProject: SapProject | null = projectsModelData.oCurrentProject ?? null;
    if (!currentProject) {
      return {
        appliedDaysCount: 0,
        failedDates: args.entries.map((entry) => entry.date),
        submissionAttempted: false,
        submissionConfirmed: false,
        error: 'Geen actief project geselecteerd in SAP.',
      };
    }

    const monthData = Array.isArray(currentProject.oTimeSheet) ? currentProject.oTimeSheet : [];
    if (monthData.length === 0) {
      return {
        appliedDaysCount: 0,
        failedDates: args.entries.map((entry) => entry.date),
        submissionAttempted: false,
        submissionConfirmed: false,
        error: 'Geen maandgegevens beschikbaar voor autofill in SAP.',
      };
    }

    const postModel = timesheetComponent?.getModel?.() as ODataModelLike | null;
    if (!postModel?.callFunction) {
      return {
        appliedDaysCount: 0,
        failedDates: args.entries.map((entry) => entry.date),
        submissionAttempted: false,
        submissionConfirmed: false,
        error: 'SAP OData model ondersteunt postTimeSheet niet in deze context.',
      };
    }

    const userDetail: SapUserDetail | undefined = projectsModelData.UserDetail;
    const personWorkAgreement =
      (userDetail?.PersonWorkAgreement ?? '').trim();
    const personWorkAgreementExternalID =
      (userDetail?.PersonWorkAgreementExternalID ?? '').trim()
      || (userDetail?.PersonExternalID ?? '').trim();
    const companyCode =
      (userDetail?.CompanyCode ?? '').trim();

    if (!personWorkAgreement || !personWorkAgreementExternalID || !companyCode) {
      return {
        appliedDaysCount: 0,
        failedDates: args.entries.map((entry) => entry.date),
        submissionAttempted: false,
        submissionConfirmed: false,
        error: 'Kan vereiste SAP identificatievelden niet bepalen voor postTimeSheet.',
      };
    }

    const defaultControllingArea = (currentProject.CostCenterControllingArea ?? '').trim();
    const defaultSenderCostCenter = (currentProject.CostCenter ?? '').trim();
    const defaultActivityType = (currentProject.EngagementProjectResource ?? '').trim();
    const defaultWbsElement = (currentProject.WorkPackage ?? '').trim();
    const defaultPurchaseOrder =
      (currentProject.PurchaseOrderCalculated ?? '').trim()
      || (currentProject.PurchaseOrder ?? '').trim();
    const defaultPurchaseOrderItem =
      (currentProject.PurchaseOrderItemCalculated ?? '').trim()
      || (currentProject.PurchaseOrderItem ?? '').trim()
      || '00000';

    const failedDates: string[] = [];
    let appliedDaysCount = 0;
    const generalRows: PostTimeSheetGeneralRow[] = [];

    for (const entry of args.entries) {
      if (!Number.isFinite(entry.hours) || entry.hours < 0) {
        failedDates.push(entry.date);
        continue;
      }

      if (isNonWritableDayRow(entry.date, entry.hours)) {
        failedDates.push(entry.date);
        continue;
      }

      const dayEntry = getModelDataForDate(entry.date);
      if (!dayEntry) {
        failedDates.push(entry.date);
        continue;
      }

      const existingFullTimeEntry: SapTimesheetRecordedEntry | undefined = dayEntry.FullTime_Entries[0];
      const isDeleteOperation = entry.hours === 0;

      if (isDeleteOperation) {
        if (!existingFullTimeEntry) {
          // Zero hours on an empty day is a no-op.
          continue;
        }

        if (!existingFullTimeEntry.TimeSheetRecord?.trim()) {
          failedDates.push(entry.date);
          continue;
        }

        generalRows.push({
          TimeSheetOperation: 'D',
          TimeSheetRecord: existingFullTimeEntry.TimeSheetRecord,
          PersonWorkAgreement: (existingFullTimeEntry.PersonWorkAgreement ?? personWorkAgreement).trim(),
          TimeSheetIsReleasedOnSave: true,
        });
        appliedDaysCount += 1;
        continue;
      }

      const operation: 'C' | 'U' = existingFullTimeEntry ? 'U' : 'C';
      if (operation === 'U' && !existingFullTimeEntry?.TimeSheetRecord?.trim()) {
        failedDates.push(entry.date);
        continue;
      }

      const row: PostTimeSheetGeneralCreateOrUpdate = {
        TimeSheetDataFields: {
          ControllingArea:
            (existingFullTimeEntry?.TimeSheetDataFields?.ControllingArea ?? '').trim()
            || defaultControllingArea
            || 'A000',
          SenderCostCenter:
            (existingFullTimeEntry?.TimeSheetDataFields?.SenderCostCenter ?? '').trim()
            || defaultSenderCostCenter,
          ReceiverCostCenter: (existingFullTimeEntry?.TimeSheetDataFields?.ReceiverCostCenter ?? '').trim(),
          ActivityType:
            (existingFullTimeEntry?.TimeSheetDataFields?.ActivityType ?? '').trim()
            || defaultActivityType,
          WBSElement:
            (existingFullTimeEntry?.TimeSheetDataFields?.WBSElement ?? '').trim()
            || defaultWbsElement,
          TimeSheetTaskType: (existingFullTimeEntry?.TimeSheetDataFields?.TimeSheetTaskType ?? '').trim(),
          TimeSheetTaskLevel: (existingFullTimeEntry?.TimeSheetDataFields?.TimeSheetTaskLevel ?? '').trim(),
          TimeSheetTaskComponent: (existingFullTimeEntry?.TimeSheetDataFields?.TimeSheetTaskComponent ?? '').trim(),
          TimeSheetNote: (existingFullTimeEntry?.TimeSheetDataFields?.TimeSheetNote ?? '').trim(),
          RecordedHours: normalizeNumberString(entry.hours),
          PurchaseOrder:
            (existingFullTimeEntry?.TimeSheetDataFields?.PurchaseOrder ?? '').trim()
            || defaultPurchaseOrder,
          PurchaseOrderItem:
            (existingFullTimeEntry?.TimeSheetDataFields?.PurchaseOrderItem ?? '').trim()
            || defaultPurchaseOrderItem,
          RecordedQuantity: normalizeNumberString(entry.hours),
          HoursUnitOfMeasure:
            (existingFullTimeEntry?.TimeSheetDataFields?.HoursUnitOfMeasure ?? '').trim()
            || 'H',
          TimeSheetOvertimeCategory: (existingFullTimeEntry?.TimeSheetDataFields?.TimeSheetOvertimeCategory ?? '').trim(),
          BillingControlCategory: (existingFullTimeEntry?.TimeSheetDataFields?.BillingControlCategory ?? '').trim(),
        },
        CompanyCode: companyCode,
        TimeSheetOperation: operation,
        PersonWorkAgreement: operation === 'U' ? (existingFullTimeEntry?.PersonWorkAgreement ?? '').trim() : '',
        TimeSheetDate: resolveTimesheetDateValue(entry.date, dayEntry),
        TimeSheetStatus: (existingFullTimeEntry?.TimeSheetStatus ?? '').trim(),
        TimeSheetIsExecutedInTestRun: false,
        TimeSheetIsReleasedOnSave: true,
      };

      if (operation === 'U') {
        row.TimeSheetRecord = existingFullTimeEntry?.TimeSheetRecord;
      }

      generalRows.push(row);
      appliedDaysCount += 1;
    }

    const submissionAttempted = generalRows.length > 0;
    if (generalRows.length > 0) {
      try {
        await callPostTimesheet(postModel, {
          CompanyCode: companyCode,
          PersonWorkAgreement: personWorkAgreement,
          PersonWorkAgreementExternalID: personWorkAgreementExternalID,
          payload: JSON.stringify({
            v_General: generalRows,
            v_StandBy: [],
            v_reversal: { type: 'internal', documents: [] },
          }),
        });
        // SAP exposes this private hook on the controller to refresh model totals/month data in-page.
        const timesheetController = timesheetComponent?.getController?.() ?? null;
        refreshTotalsModels(timesheetController);
      } catch (error) {
        return {
          appliedDaysCount: 0,
          failedDates: args.entries.map((entry) => entry.date),
          submissionAttempted,
          submissionConfirmed: false,
          error: extractErrorMessage(error),
        };
      }
    }

    return {
      appliedDaysCount,
      failedDates,
      submissionAttempted,
      submissionConfirmed: submissionAttempted,
    };
  } catch (error) {
    return {
      appliedDaysCount: 0,
      failedDates: args.entries.map((entry) => entry.date),
      submissionAttempted: false,
      submissionConfirmed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

