import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CachedTimesheetSnapshot } from '../shared/types';
import { createSnapshot, mockChromeTabsQuery } from './popup.test-helpers';
import {
  getActiveTab,
  getValidCachedSnapshot,
  readTimesheetSnapshotViaUi5,
  setCachedTimesheetSnapshot,
} from './popup-gateway';
import {
  clearCachedTimesheetSnapshot,
  getCachedTimesheetSnapshot,
  isCacheStale,
  setCachedTimesheetSnapshot as setCachedTimesheetSnapshotToStorage,
} from '../shared/storage';
import { resolveValidationPeriod } from './popup-model';
import { readTimesheetSnapshotViaUi5 as readTimesheetSnapshotViaUi5FromScripting } from './ui5-scripting';

vi.mock('../shared/storage', () => ({
  clearCachedTimesheetSnapshot: vi.fn(),
  getCachedTimesheetSnapshot: vi.fn(),
  isCacheStale: vi.fn(),
  setCachedTimesheetSnapshot: vi.fn(),
}));

vi.mock('./popup-model', () => ({
  resolveValidationPeriod: vi.fn(),
}));

vi.mock('./ui5-scripting', () => ({
  readTimesheetSnapshotViaUi5: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockChromeTabsQuery.mockResolvedValue([]);

  vi.mocked(getCachedTimesheetSnapshot).mockResolvedValue(undefined);
  vi.mocked(clearCachedTimesheetSnapshot).mockResolvedValue();
  vi.mocked(isCacheStale).mockReturnValue(false);
  vi.mocked(resolveValidationPeriod).mockReturnValue({ month: 8, year: 2026 });
  vi.mocked(setCachedTimesheetSnapshotToStorage).mockResolvedValue();
  vi.mocked(readTimesheetSnapshotViaUi5FromScripting).mockResolvedValue(
    createSnapshot(),
  );
});

describe('getActiveTab', () => {
  it('returns first active tab from chrome query result', async () => {
    const tab = { id: 42, url: 'https://example.test' } as chrome.tabs.Tab;
    mockChromeTabsQuery.mockResolvedValue([tab]);

    const result = await getActiveTab();

    expect(mockChromeTabsQuery).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(result).toBe(tab);
  });

  it('returns undefined when no active tab exists', async () => {
    mockChromeTabsQuery.mockResolvedValue([]);

    await expect(getActiveTab()).resolves.toBeUndefined();
  });
});

describe('getValidCachedSnapshot', () => {
  it('returns undefined when there is no cache', async () => {
    vi.mocked(getCachedTimesheetSnapshot).mockResolvedValue(undefined);

    const result = await getValidCachedSnapshot(undefined);

    expect(result).toBeUndefined();
    expect(isCacheStale).not.toHaveBeenCalled();
  });

  it('clears and returns undefined when cache is stale', async () => {
    const cache: CachedTimesheetSnapshot = {
      snapshot: createSnapshot(),
      cachedAt: '2026-08-01T00:00:00.000Z',
    };
    const tab = { id: 11, url: 'https://example.test' } as chrome.tabs.Tab;

    vi.mocked(getCachedTimesheetSnapshot).mockResolvedValue(cache);
    vi.mocked(resolveValidationPeriod).mockReturnValue({
      month: 8,
      year: 2026,
    });
    vi.mocked(isCacheStale).mockReturnValue(true);

    const result = await getValidCachedSnapshot(tab);

    expect(resolveValidationPeriod).toHaveBeenCalledWith(tab);
    expect(isCacheStale).toHaveBeenCalledWith(cache, { month: 8, year: 2026 });
    expect(clearCachedTimesheetSnapshot).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });

  it('returns cache when it is not stale', async () => {
    const cache: CachedTimesheetSnapshot = {
      snapshot: createSnapshot(),
      cachedAt: '2026-08-01T00:00:00.000Z',
    };

    vi.mocked(getCachedTimesheetSnapshot).mockResolvedValue(cache);
    vi.mocked(isCacheStale).mockReturnValue(false);

    const result = await getValidCachedSnapshot(undefined);

    expect(result).toBe(cache);
    expect(clearCachedTimesheetSnapshot).not.toHaveBeenCalled();
  });
});

describe('readTimesheetSnapshotViaUi5', () => {
  it('delegates to ui5-scripting module', async () => {
    const snapshot = createSnapshot();
    vi.mocked(readTimesheetSnapshotViaUi5FromScripting).mockResolvedValue(
      snapshot,
    );

    await expect(readTimesheetSnapshotViaUi5(77)).resolves.toBe(snapshot);
    expect(readTimesheetSnapshotViaUi5FromScripting).toHaveBeenCalledWith(77);
  });
});

describe('setCachedTimesheetSnapshot', () => {
  it('delegates to storage module', async () => {
    const cache: CachedTimesheetSnapshot = {
      snapshot: createSnapshot(),
      cachedAt: '2026-08-20T10:00:00.000Z',
    };

    await setCachedTimesheetSnapshot(cache);

    expect(setCachedTimesheetSnapshotToStorage).toHaveBeenCalledWith(cache);
  });
});
