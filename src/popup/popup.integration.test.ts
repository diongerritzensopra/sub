/**
 * Popup integration tests (placeholder for feature: Popup integration tests)
 *
 * This file holds load-bearing cross-module test cases that cannot be cleanly
 * attributed to a single popup module and are necessary to maintain coverage.
 * These tests validate real popup lifecycle sequencing, multi-module state
 * propagation, and resilience flows that depend on the assembled popup behavior.
 *
 * Each test in this file was identified during the Popup unit test refactoring
 * (see popup-test-refactor-audit.md, section "Load-bearing Cross-module Tests")
 * as requiring:
 * - Popup bootstrap wiring (`popup.ts` initializing multiple modules together)
 * - Multi-module state propagation across async operations
 * - Lifecycle ordering that spans actions, rendering, storage, and messaging
 *
 * When the dedicated Popup integration tests feature is implemented, these tests
 * should be evaluated: if per-module coverage renders them redundant, they can be
 * dropped; if they still add value, they become proper integration tests with
 * clear descriptive names and only external-boundary mocking.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimesheetSnapshot, WeeklySchedule } from '../shared/types';
import { STORAGE_KEYS } from '../shared/storage';
import {
  flushAsyncWork,
  mockChromeRuntimeSendMessage,
  mockChromeScriptingExecuteScript,
  mockChromeStorageLocalGet,
  mockChromeStorageLocalSet,
  mockChromeTabsGet,
  mockChromeTabsQuery,
  mockChromeTabsUpdate,
  resetPopupTestEnvironment,
} from './popup.test-helpers';

beforeEach(() => {
  resetPopupTestEnvironment();
});

describe('popup integration tests', () => {
  /**
   * Load-bearing test: Status restore lifecycle after refresh/loading transitions
   *
   * Validates real popup lifecycle sequencing, temporary status transitions,
   * and persisted status restoration after user-triggered refresh cycles.
   * Depends on popup bootstrap coordinating actions, storage, and rendering.
   */
  describe('status restore lifecycle', () => {
    it('restores persisted status after pressing refresh and temporary loading messages', async () => {
      const sapTab = {
        id: 99,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/8/2026/project/ZSST',
        status: 'complete',
      } as chrome.tabs.Tab;
      const storedValues: Record<string, unknown> = {};

      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeRuntimeSendMessage.mockResolvedValue({ success: true, data: { busy: false } });
      mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
        if (injection.func?.name === 'ui5MainWorldReadSnapshot') {
          return [{
            documentId: 'mock-id',
            frameId: 0,
            result: {
              success: true,
              snapshot: {
                month: 8,
                year: 2026,
                projects: [],
                currentProjectCode: null,
                totals: { worked: null, toBePerformed: null },
                sapStatus: 'editable',
              },
            },
          }];
        }

        return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
      });
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: storedValues[keys[0]] });
      });
      mockChromeStorageLocalSet.mockImplementation((values, callback) => {
        Object.assign(storedValues, values);
        callback();
      });

      const { setStatus } = await import('./popup');
      await flushAsyncWork();

      setStatus('Eerder resultaat: 5 dagen bijgewerkt.', true);
      expect(document.getElementById('status-message')?.textContent).toBe('Eerder resultaat: 5 dagen bijgewerkt.');

      (document.getElementById('btn-scrape') as HTMLButtonElement).click();
      await flushAsyncWork();

      expect(document.getElementById('status-message')?.textContent).toBe('Eerder resultaat: 5 dagen bijgewerkt.');
      expect(document.getElementById('btn-status-dismiss')?.hidden).toBe(false);
    });
  });

  /**
   * Load-bearing test: Apply flow resilience when one schedule navigation fails
   *
   * Validates multi-schedule loop behavior across actions + apply orchestration +
   * status rendering. Tests that the apply flow continues with remaining schedules
   * when one navigation fails, properly accumulating error state while maintaining
   * partial success reporting.
   */
  describe('apply flow resilience', () => {
    const makeSchedule = (id: string, label: string, projectCode: string): WeeklySchedule => ({
      id,
      label,
      projectCode,
      hoursPerWeekday: { monday: 8, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
    });

    const snapshot: TimesheetSnapshot = {
      month: 5,
      year: 2026,
      projects: [
        { code: 'ZMOCK_001.1.1', name: 'Mockproject' },
        { code: 'ZTEST_42', name: 'Testproject 42' },
      ],
      currentProjectCode: 'ZMOCK_001.1.1',
      totals: { worked: 120, toBePerformed: 160 },
      sapStatus: 'editable',
    };

    const sapTab = {
      id: 99,
      url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my',
      status: 'complete',
    } as chrome.tabs.Tab;

    it('continues with remaining schedules when navigation fails for one schedule', async () => {
      const storedValues: Record<string, unknown> = {
        [STORAGE_KEYS.projectSchedules]: [
          makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1'),
          makeSchedule('s2', 'Deeltijd', 'ZTEST_42'),
        ],
      };
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: storedValues[keys[0]] });
      });

      const { renderSchedules, renderSnapshot } = await import('./popup');
      await renderSchedules();
      renderSnapshot(snapshot);

      vi.clearAllMocks();
      mockChromeTabsQuery.mockResolvedValue([sapTab]);
      mockChromeTabsGet.mockResolvedValue({ ...sapTab, status: 'complete' } as chrome.tabs.Tab);
      mockChromeTabsUpdate.mockImplementation(async (tabId, updateProperties) => {
        if ((updateProperties.url ?? '').includes('project/ZMOCK_001.1.1')) {
          throw new Error('Navigatie mislukt voor project');
        }
        return {
          id: tabId,
          status: 'complete',
          url: updateProperties.url,
        } as chrome.tabs.Tab;
      });

      let autofillCalls = 0;
      mockChromeScriptingExecuteScript.mockImplementation(async (injection) => {
        const funcName = injection.func?.name;
        if (funcName === 'ui5MainWorldAutofill') {
          autofillCalls += 1;
          return [{
            documentId: 'mock-id',
            frameId: 0,
            result: {
              appliedDaysCount: 1,
              failedDates: [],
              submissionAttempted: true,
              submissionConfirmed: true,
            },
          }];
        }

        return [{ documentId: 'mock-id', frameId: 0, result: undefined }];
      });

      const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
      applyButton.click();
      await flushAsyncWork();

      const statusMessage = document.getElementById('status-message')?.textContent ?? '';
      expect(autofillCalls).toBe(1);
      expect(statusMessage).toContain('Schema\'s toegepast: Kantooruren, Deeltijd.');
      expect(statusMessage).toContain('Fouten:');
      expect(statusMessage).toContain('Mockproject: Navigatie mislukt voor project');
    });

    /**
     * Load-bearing test: Apply flow skip-navigation branch when already on target project
     *
     * Validates cross-module route-state + apply execution interplay. Tests that the apply
     * flow correctly detects when the SAP tab is already on the target project page and
     * skips navigation in that case.
     */
    it('applies without navigation when already on the same project page', async () => {
      const storedValues: Record<string, unknown> = {
        [STORAGE_KEYS.projectSchedules]: [makeSchedule('s1', 'Kantooruren', 'ZMOCK_001.1.1')],
      };
      mockChromeStorageLocalGet.mockImplementation((keys, callback) => {
        callback({ [keys[0]]: storedValues[keys[0]] });
      });

      const { renderSchedules, renderSnapshot } = await import('./popup');
      await renderSchedules();
      renderSnapshot(snapshot);

      vi.clearAllMocks();
      const sameProjectTab = {
        ...sapTab,
        url: 'https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet&/5/2026/project/ZMOCK_001.1.1',
      } as chrome.tabs.Tab;
      mockChromeTabsQuery.mockResolvedValue([sameProjectTab]);
      mockChromeTabsGet.mockResolvedValue(sameProjectTab);

      const applyButton = document.getElementById('btn-apply-schedules') as HTMLButtonElement;
      applyButton.click();
      await flushAsyncWork();

      expect(mockChromeTabsUpdate).not.toHaveBeenCalled();
      expect(mockChromeTabsGet).toHaveBeenCalledTimes(1);
      expect(mockChromeScriptingExecuteScript).toHaveBeenCalledTimes(1);
      expect(document.getElementById('status-message')?.textContent).toContain('Schema toegepast: Kantooruren.');
      expect(document.getElementById('status-message')?.textContent).toContain('1/');
      expect(document.getElementById('status-message')?.textContent).toContain('dagen bijgewerkt');
      expect(document.getElementById('status-message')?.textContent).toContain('SAP bevestiging: ontvangen (1/1)');
    });
  });

  /**
   * Load-bearing test: Bootstrap cache/ready-state lifecycle
   *
   * Validates popup initialization flow that loads cached data, queries SAP busy state,
   * and transitions through ready states. Tests that depend on popup.ts bootstrap
   * orchestration rather than individual module behavior.
   * [Placeholder for specific bootstrap lifecycle tests from popup.core.test.ts if needed]
   */
});

