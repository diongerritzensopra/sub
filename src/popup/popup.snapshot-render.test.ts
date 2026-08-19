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

    it('displays project names with codes as a list', async () => {
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

      const projectsList = document.getElementById('projects-value') as HTMLUListElement;
      expect(projectsList.querySelectorAll('li')).toHaveLength(2);
      const projectItems = projectsList.querySelectorAll('li');

      const firstProjectSpans = projectItems[0].querySelectorAll('span');
      expect(firstProjectSpans).toHaveLength(2);
      expect(firstProjectSpans[0].textContent).toBe('Mockproject');
      expect(firstProjectSpans[1].textContent).toBe('ZMOCK_001.1.1');
      expect(projectItems[0].childNodes).toHaveLength(3);
      expect(projectItems[0].childNodes[0].nodeName).toBe('SPAN');
      expect(projectItems[0].childNodes[1].nodeName).toBe('BR');
      expect(projectItems[0].childNodes[2].nodeName).toBe('SPAN');

      const secondProjectSpans = projectItems[1].querySelectorAll('span');
      expect(secondProjectSpans).toHaveLength(2);
      expect(secondProjectSpans[0].textContent).toBe('Testproject 42');
      expect(secondProjectSpans[1].textContent).toBe('ZTEST_42');
      expect(projectItems[1].childNodes).toHaveLength(3);
      expect(projectItems[1].childNodes[0].nodeName).toBe('SPAN');
      expect(projectItems[1].childNodes[1].nodeName).toBe('BR');
      expect(projectItems[1].childNodes[2].nodeName).toBe('SPAN');
    });

    it('displays "-" when projects array is empty', async () => {
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

      const projectsList = document.getElementById('projects-value') as HTMLUListElement;
      expect(projectsList.querySelectorAll('li')).toHaveLength(1);
      expect(projectsList.textContent).toBe('-');
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
