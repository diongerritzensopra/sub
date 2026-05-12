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
  periodKey: string; // e.g. "2026-05"
}

/** Union of all message types sent between extension components. */
export type MessageType =
  | 'SCRAPE_ENTRIES'
  | 'SCRAPE_TIMESHEET_SUMMARY'
  | 'AUTOFILL_ENTRY'
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
