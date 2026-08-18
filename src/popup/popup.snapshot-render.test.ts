import { beforeEach, describe, expect, it } from 'vitest';

import type { TimesheetSnapshot } from '../shared/types';
import { resetPopupTestEnvironment } from './popup.test-helpers';

beforeEach(() => {
  resetPopupTestEnvironment();
});

describe('popup snapshot rendering', () => {
  describe('formatHours', () => {
    it('formats number with decimal separator as comma', async () => {
      const { formatHours } = await import('./popup');

      expect(formatHours(7.5)).toBe('7,5 u');
    });

    it('formats whole numbers without decimal', async () => {
      const { formatHours } = await import('./popup');

      expect(formatHours(8)).toBe('8 u');
    });

    it('returns "-" when value is null', async () => {
      const { formatHours } = await import('./popup');

      expect(formatHours(null)).toBe('-');
    });

    it('handles large numbers', async () => {
      const { formatHours } = await import('./popup');
      expect(formatHours(160.5)).toBe('160,5 u');
    });
  });

  describe('renderSnapshot', () => {
    it('displays month and year when both are provided', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projects: [],
        currentProjectCode: null,
        totals: {
          worked: 0,
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('period-value')?.textContent).toBe('4/2026');
    });

    it('displays "-" when month or year is null', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: null,
        year: null,
        projects: [],
        currentProjectCode: null,
        totals: {
          worked: 0,
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('period-value')?.textContent).toBe('-');
    });

    it('displays project codes joined by comma', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projects: [
          { code: 'ZMOCK_001.1.1', name: 'Mockproject' },
          { code: 'ZTEST_42', name: 'Testproject 42' },
        ],
        currentProjectCode: 'ZMOCK_001.1.1',
        totals: {
          worked: null,
          toBePerformed: null,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('projects-value')?.textContent).toBe('ZMOCK_001.1.1, ZTEST_42');
    });

    it('displays "-" when project codes array is empty', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projects: [],
        currentProjectCode: null,
        totals: {
          worked: null,
          toBePerformed: null,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('projects-value')?.textContent).toBe('-');
    });

    it('displays formatted hours for all totals', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projects: [],
        currentProjectCode: null,
        totals: {
          worked: 134.5,
          toBePerformed: 160,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('worked-hours-value')?.textContent).toBe('134,5 u');
      expect(document.getElementById('to-be-performed-hours-value')?.textContent).toBe('160 u');
    });

    it('unhides summary section after rendering', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projects: [],
        currentProjectCode: null,
        totals: {
          worked: 0,
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      const summarySection = document.getElementById('summary-section') as HTMLElement;
      expect(summarySection.hidden).toBe(true);

      renderSnapshot(snapshot);

      expect(summarySection.hidden).toBe(false);
    });

    it('displays null totals as "-"', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projects: [],
        currentProjectCode: null,
        totals: {
          worked: null,
          toBePerformed: null,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot);

      expect(document.getElementById('worked-hours-value')?.textContent).toBe('-');
      expect(document.getElementById('to-be-performed-hours-value')?.textContent).toBe('-');
    });

    it('hides scrape status indicator when all data is present', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projects: [],
        currentProjectCode: null,
        totals: {
          worked: 160,
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot, true);

      expect(document.getElementById('scrape-status')?.hidden).toBe(true);
    });

    it('shows subtle warning status indicator when data is incomplete', async () => {
      const { renderSnapshot } = await import('./popup');
      const snapshot: TimesheetSnapshot = {
        month: 4,
        year: 2026,
        projects: [],
        currentProjectCode: null,
        totals: {
          worked: 160,
          toBePerformed: 0,
        },
        sapStatus: 'editable',
      };

      renderSnapshot(snapshot, false);

      expect(document.getElementById('scrape-status')?.hidden).toBe(false);
      expect(document.getElementById('scrape-status')?.textContent).toBe('Onvolledig');
      expect(document.getElementById('scrape-status')?.classList.contains('warning')).toBe(true);
    });
  });
});
