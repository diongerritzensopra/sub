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

/** Union of all message types sent between extension components. */
export type MessageType =
  | 'SCRAPE_ENTRIES'
  | 'AUTOFILL_ENTRY';

export interface MessageRequest {
  type: MessageType;
  payload?: unknown;
}

export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
