import { beforeEach, describe, expect, it, vi } from 'vitest';

import { storageGet, storageSet } from './storage';

type StorageMap = Record<string, unknown>;

const localState: StorageMap = {};
const mockGet = vi.fn((keys: string[], callback: (result: StorageMap) => void) => {
  const key = keys[0];
  callback({ [key]: localState[key] });
});
const mockSet = vi.fn((values: StorageMap, callback: () => void) => {
  Object.assign(localState, values);
  callback();
});

globalThis.chrome = {
  storage: {
    local: {
      get: mockGet,
      set: mockSet,
    },
  },
} as unknown as typeof chrome;

describe('storage helpers', () => {
  beforeEach(() => {
    Object.keys(localState).forEach((key) => delete localState[key]);
    mockGet.mockClear();
    mockSet.mockClear();
  });

  it('stores and retrieves values via chrome.storage.local', async () => {
    await storageSet('foo', 'bar');
    const value = await storageGet<string>('foo');

    expect(value).toBe('bar');
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});

