/**
 * Shared TypeScript types used across popup and content script.
 */

/** SAP My Timesheet canonical URL pattern used for matching and validation. */
export const SAP_TIMESHEET_URL_PATTERN = 'p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site';

/** A single booked or to-be-booked hours entry. */
export interface HoursEntry {
  date: string;       // ISO date string: "YYYY-MM-DD"
  project: string;    // Project name or code
  activity: string;   // Activity / task description
  hours: number;      // Hours logged (e.g. 7.5)
}

export interface TimesheetTotals {
  worked: number | null;
  absent: number | null;
  toBePerformed: number | null;
}

export interface TimesheetSnapshot {
  month: number | null;
  year: number | null;
  projectCodes: string[];
  totals: TimesheetTotals;
}

/** Cache payload for a scraped timesheet snapshot. */
export interface CachedTimesheetSnapshot {
  snapshot: TimesheetSnapshot;
  cachedAt: string; // ISO timestamp
}

/** The days of the week, Monday-first. */
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** Ordered list of all weekday keys, Monday-first. */
export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Planned hours for each day of the week. Zero means the day is skipped. */
export type WeeklyHours = Record<Weekday, number>;

/** A named, reusable weekly booking schedule for a single project code. */
export interface WeeklySchedule {
  id: string;          // Unique identifier (e.g. crypto.randomUUID())
  label: string;       // Human-readable name for the schedule
  projectCode: string; // SAP project code to book against
  hoursPerWeekday: WeeklyHours;
}

/** Union of all message types sent between extension components. */
export type MessageType =
  | 'SCRAPE_ENTRIES'
  | 'SCRAPE_TIMESHEET_SUMMARY'
  | 'AUTOFILL_ENTRY'
  | 'AUTOFILL_ENTRIES'
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
