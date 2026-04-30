/**
 * Shared TypeScript types used across popup and content script.
 */

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

/** Union of all message types sent between extension components. */
export type MessageType =
  | 'SCRAPE_ENTRIES'
  | 'SCRAPE_TIMESHEET_SUMMARY'
  | 'AUTOFILL_ENTRY'
  | 'SAP_BUSY_STATE_CHANGED';

export interface MessageRequest {
  type: MessageType;
  payload?: unknown;
}

export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
