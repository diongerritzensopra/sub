import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimesheetSnapshot } from '../shared/types';
import {
  autofillEntriesViaUi5,
  readTimesheetSnapshotViaUi5,
} from './ui5-scripting';

const mockExecuteScript = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  globalThis.chrome = {
    scripting: {
      executeScript: mockExecuteScript,
    },
  } as unknown as typeof chrome;
});

describe('autofillEntriesViaUi5', () => {
  it('returns the injected autofill result when available', async () => {
    mockExecuteScript.mockResolvedValueOnce([
      {
        documentId: 'doc',
        frameId: 0,
        result: {
          appliedDaysCount: 2,
          failedDates: ['2026-05-10'],
          submissionAttempted: true,
          submissionConfirmed: false,
        },
      },
    ]);

    const result = await autofillEntriesViaUi5(
      99,
      [
        { date: '2026-05-10', hours: 8 },
        { date: '2026-05-11', hours: 8 },
      ],
    );

    expect(result).toEqual({
      appliedDaysCount: 2,
      failedDates: ['2026-05-10'],
      submissionAttempted: true,
      submissionConfirmed: false,
    });
  });

  it('returns fallback autofill result with all entry dates when script result is missing', async () => {
    mockExecuteScript.mockResolvedValueOnce([]);

    const result = await autofillEntriesViaUi5(
      99,
      [
        { date: '2026-05-10', hours: 8 },
        { date: '2026-05-11', hours: 0 },
      ],
    );

    expect(result).toEqual({
      appliedDaysCount: 0,
      failedDates: ['2026-05-10', '2026-05-11'],
      submissionAttempted: false,
      submissionConfirmed: false,
      error: 'UI5 autofill leverde geen resultaat op.',
    });
  });
});

describe('readTimesheetSnapshotViaUi5', () => {
  it('returns snapshot when payload is successful', async () => {
    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projects: [{ code: 'ZMOCK_001.1.1', name: 'Mockproject' }],
      currentProjectCode: 'ZMOCK_001.1.1',
      totals: { worked: 120, toBePerformed: 160 },
      sapStatus: 'editable',
    };
    mockExecuteScript.mockResolvedValueOnce([
      {
        documentId: 'doc',
        frameId: 0,
        result: {
          success: true,
          snapshot,
        },
      },
    ]);

    const result = await readTimesheetSnapshotViaUi5(99);

    expect(result).toEqual(snapshot);
  });

  it('throws payload error when snapshot read is unsuccessful', async () => {
    mockExecuteScript.mockResolvedValueOnce([
      {
        documentId: 'doc',
        frameId: 0,
        result: {
          success: false,
          error: 'UI5 snapshot faalde',
        },
      },
    ]);

    await expect(readTimesheetSnapshotViaUi5(99)).rejects.toThrow('UI5 snapshot faalde');
  });

  it('throws default error when payload is missing', async () => {
    mockExecuteScript.mockResolvedValueOnce([]);

    await expect(readTimesheetSnapshotViaUi5(99)).rejects.toThrow('UI5 snapshot leverde geen resultaat op.');
  });
});

