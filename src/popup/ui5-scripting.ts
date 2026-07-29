/**
 * UI5 scripting bridges.
 *
 * Thin wrappers around chrome.scripting.executeScript that inject the ui5-main-world
 * functions into the SAP page's MAIN world and return their results.
 */

import type { TimesheetSnapshot } from '../shared/types';
import {
  ui5MainWorldAutofill,
  ui5MainWorldReadSnapshot,
} from './ui5-main-world';
import type { Ui5AutofillArgs, Ui5AutofillResult, Ui5SnapshotReadResult } from './ui5-main-world';

export async function autofillEntriesViaUi5(tabId: number, entries: Array<{ date: string; hours: number }>): Promise<Ui5AutofillResult> {
  const [result] = await chrome.scripting.executeScript<Ui5AutofillArgs[], Promise<Ui5AutofillResult>>({
    target: { tabId },
    world: 'MAIN',
    func: ui5MainWorldAutofill,
    args: [{ entries }],
  });

  return result?.result ?? {
    appliedDaysCount: 0,
    failedDates: entries.map((entry) => entry.date),
    submissionAttempted: false,
    submissionConfirmed: false,
    error: 'UI5 autofill leverde geen resultaat op.',
  };
}

export async function readTimesheetSnapshotViaUi5(tabId: number): Promise<TimesheetSnapshot> {
  const [result] = await chrome.scripting.executeScript<[], Ui5SnapshotReadResult>({
    target: { tabId },
    world: 'MAIN',
    func: ui5MainWorldReadSnapshot,
    args: [],
  });

  const payload = result?.result;
  if (!payload?.success || !payload.snapshot) {
    throw new Error(payload?.error ?? 'UI5 snapshot leverde geen resultaat op.');
  }

  return payload.snapshot;
}

