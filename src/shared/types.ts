/**
 * Shared TypeScript types used across popup and content script.
 */

/** SAP My Timesheet canonical URL pattern used for matching and validation. */
export const SAP_TIMESHEET_URL_PATTERN = 'p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site';

/** A single booked or to-be-booked hours entry. */
export interface HoursEntry {
  date: string;       // ISO date string: "YYYY-MM-DD"
  project: string;    // Project name or code
  hours: number;      // Hours logged (e.g. 7.5)
}

export interface TimesheetTotals {
  worked: number | null;
  toBePerformed: number | null;
}

export interface TimesheetSnapshot {
  month: number | null;
  year: number | null;
  projectCodes: string[];
  totals: TimesheetTotals;
  currentProjectCode: string | null;
}

/** Cache payload for a scraped timesheet snapshot. */
export interface CachedTimesheetSnapshot {
  snapshot: TimesheetSnapshot;
  cachedAt: string; // ISO timestamp
}

/** The days of the week, Monday-first. */
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** Planned hours for each day of the week. Zero means the day is skipped. */
export type WeeklyHours = Record<Weekday, number>;

/** A named, reusable weekly booking schedule for a single project code. */
export interface WeeklySchedule {
  id: string;          // Unique identifier (e.g. crypto.randomUUID())
  label: string;       // Human-readable name for the schedule
  projectCode: string; // SAP project code to book against
  hoursPerWeekday: WeeklyHours;
}

/** Detailed bookkeeping fields attached to a recorded SAP timesheet row. */
export interface SapTimesheetDataFields {
  ControllingArea?: string;
  SenderCostCenter?: string;
  ReceiverCostCenter?: string;
  ActivityType?: string;
  WBSElement?: string;
  TimeSheetTaskType?: string;
  TimeSheetTaskLevel?: string;
  TimeSheetTaskComponent?: string;
  TimeSheetNote?: string;
  PurchaseOrder?: string;
  PurchaseOrderItem?: string;
  HoursUnitOfMeasure?: string;
  TimeSheetOvertimeCategory?: string;
  BillingControlCategory?: string;
}

/** A recorded SAP timesheet row for a specific day. */
export interface SapTimesheetRecordedEntry {
  TimeSheetDataFields?: SapTimesheetDataFields;
  CompanyCode?: string;
  PersonWorkAgreement?: string;
  PersonWorkAgreementExternalID?: string;
  TimeSheetRecord?: string;
  TimeSheetStatus?: string;
}

/** SAP UI5 model data for a single day in a project's timesheet. */
export interface SapTimesheetDayEntry {
  Date: number;           // Unix timestamp in milliseconds
  ProjectCode: string;    // Project code (e.g., "C0007012.1.1")
  Comment: string;        // User comment for the day
  FullTime: string;       // Hours as "HH:MM"
  Others: string;         // Other hours as "HH:MM"
  IsWorkingDay: boolean;  // Whether it's a working day
  IsOnLeave: boolean;     // Whether the person is on leave
  IsHoliday: boolean;     // Whether it's a public holiday
  IsWeekEnd: boolean;     // Whether it's a weekend
  AvailabilityInHours: number; // Available capacity for the day — despite the name, the unit is minutes (e.g. 480 = 8 hours)
  FullTime_Entries: SapTimesheetRecordedEntry[]; // Detailed entry records
  Others_Entries: SapTimesheetRecordedEntry[];   // Detailed entry records
}

/** Totals data from SAP projectsmodel — totals for the current month. */
export interface SapTimesheetTotals {
  hoursToBePerformed: string;         // "HH:MM" format
  totalActualWorkHours: string;       // "HH:MM" format
  leaveHours: null;                   // Always null in the model
  // ... other fields omitted
}

/** User identification fields exposed on the SAP projectsmodel. */
export interface SapUserDetail {
  PersonWorkAgreement?: string;
  PersonWorkAgreementExternalID?: string;
  PersonExternalID?: string;
  CompanyCode?: string;
}

/** A project within the SAP projectsmodel. */
export interface SapProject {
  WorkPackage: string;                // Project code, e.g., "C0007012.1.1"
  WorkPackageName: string;            // Project name
  oTimeSheet: SapTimesheetDayEntry[]; // Days in this project
  EngagementProjectResource?: string;
  CostCenter?: string;
  CostCenterControllingArea?: string;
  CompanyCode?: string;
  EmploymentInternalID?: string;
  PurchaseOrder?: string;
  PurchaseOrderItem?: string;
  PurchaseOrderCalculated?: string;
  PurchaseOrderItemCalculated?: string;
}

/** SAP projectsmodel getData() result shape. */
export interface SapProjectsModelData {
  oMonth: number;                     // 0–11 (0 = January)
  oYear: number;                      // e.g., 2026
  oCurrentProject: SapProject | null; // Currently selected project
  oProjects: SapProject[];            // All available projects
  oTotals: {
    oTotals: SapTimesheetTotals;
  };
  UserDetail?: SapUserDetail;
}

/** Union of all message types sent between extension components. */
export type MessageType =
  | 'SAP_BUSY_STATE_CHANGED'
  | 'GET_SAP_BUSY_STATE';

export interface MessageRequest {
  type: MessageType;
  payload?: unknown;
}

export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
