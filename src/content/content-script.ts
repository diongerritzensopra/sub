/**
 * Content script — runs in the context of SAP My Timesheet.
 *
 * Responsibilities:
 * - Scrape month/year, available project codes, and high-level totals
 * - Inject UI hints or autofill fields when requested
 */

import type { HoursEntry, TimesheetSnapshot } from '../shared/types';

const SAP_SELECTORS = {
  monthButton: '#application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B1',
  yearButton: '#application-timesheet-my-component---idMaster--idSimpleCalendarHeader--Head-B2',
  projectCodesTree: '#application-timesheet-my-component---idMaster--idNavigationProjectCodes-subtree a[title]',
  totalPanelTitle: 'h5.sapUiFormTitle',
  totalPanelRows: '.sapUiFormElementLbl',
};

const PROJECT_CODE_PATTERN = /\b[A-Z][A-Z0-9._-]{2,20}\b/g;
const PERIOD_FROM_ROUTE_PATTERN = /(?:\/|#)(\d{1,2})\/(\d{4})(?:\/project\/|\b)/i;

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export function scrapeTimesheetSnapshot(rootDocument: Document = document): TimesheetSnapshot {
  const timesheetDocument = resolveTimesheetDocument(rootDocument);
  const period = extractPeriod(timesheetDocument, rootDocument);

  return {
    month: period.month,
    year: period.year,
    projectCodes: extractProjectCodes(timesheetDocument, rootDocument),
    totals: {
      worked: extractTotalsHours(timesheetDocument, [/number\s+of\s+hours\s+worked/i, /hours\s+worked/i]),
      absent: extractTotalsHours(timesheetDocument, [/number\s+of\s+hours\s+absent/i, /hours\s+absent/i]),
      toBePerformed: extractTotalsHours(timesheetDocument, [/hours\s+to\s+be\s+performed/i, /to\s+be\s+performed/i]),
    },
  };
}

function resolveTimesheetDocument(rootDocument: Document): Document {
  const frame = rootDocument.querySelector<HTMLIFrameElement>('#__container1, iframe[data-sap-ushell-active="true"]');
  if (!frame?.contentDocument) {
    return rootDocument;
  }

  try {
    void frame.contentDocument.body;
    return frame.contentDocument;
  } catch {
    return rootDocument;
  }
}

function extractPeriod(timesheetDocument: Document, rootDocument: Document): { month: number | null; year: number | null } {
  const selectorPeriod = extractPeriodFromSelectors(timesheetDocument);
  if (selectorPeriod) {
    return selectorPeriod;
  }

  const routePeriod = extractPeriodFromIframeRoute(rootDocument);
  if (routePeriod) {
    return routePeriod;
  }

  const titlePeriod = extractPeriodFromText(timesheetDocument.body?.textContent ?? '');
  if (titlePeriod) {
    return titlePeriod;
  }

  return { month: null, year: null };
}

function extractPeriodFromSelectors(timesheetDocument: Document): { month: number; year: number } | null {
  const monthText = normalizeWhitespace(timesheetDocument.querySelector<HTMLElement>(SAP_SELECTORS.monthButton)?.textContent ?? '');
  const yearText = normalizeWhitespace(timesheetDocument.querySelector<HTMLElement>(SAP_SELECTORS.yearButton)?.textContent ?? '');

  const month = monthFromText(monthText);
  const yearMatch = yearText.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : Number.NaN;

  if (month !== null && !Number.isNaN(year)) {
    return { month, year };
  }

  return null;
}

function monthFromText(text: string): number | null {
  const lower = text.toLowerCase();
  if (MONTH_NAME_TO_NUMBER[lower]) {
    return MONTH_NAME_TO_NUMBER[lower];
  }

  const numericMatch = lower.match(/\b(1[0-2]|0?[1-9])\b/);
  if (!numericMatch) {
    return null;
  }

  return Number.parseInt(numericMatch[1], 10);
}

function extractPeriodFromIframeRoute(rootDocument: Document): { month: number; year: number } | null {
  const frame = rootDocument.querySelector<HTMLIFrameElement>('#__container1, iframe[data-sap-ushell-active="true"]');
  const src = frame?.getAttribute('src') ?? '';
  const match = src.match(PERIOD_FROM_ROUTE_PATTERN);

  if (!match) {
    return null;
  }

  const month = Number.parseInt(match[1], 10);
  const year = Number.parseInt(match[2], 10);

  if (!Number.isNaN(month) && month >= 1 && month <= 12 && !Number.isNaN(year)) {
    return { month, year };
  }

  return null;
}

function extractPeriodFromText(text: string): { month: number; year: number } | null {
  const compactText = text.replace(/\s+/g, ' ').trim().toLowerCase();

  for (const [monthName, monthNumber] of Object.entries(MONTH_NAME_TO_NUMBER)) {
    const monthIndex = compactText.indexOf(monthName);
    if (monthIndex === -1) {
      continue;
    }

    const suffix = compactText.slice(monthIndex, monthIndex + 24);
    const yearMatch = suffix.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return { month: monthNumber, year: Number.parseInt(yearMatch[1], 10) };
    }
  }

  return null;
}

function extractProjectCodes(timesheetDocument: Document, rootDocument: Document): string[] {
  const codes = new Set<string>();

  const routeFrame = rootDocument.querySelector<HTMLIFrameElement>('#__container1, iframe[data-sap-ushell-active="true"]');
  const routeSrc = routeFrame?.getAttribute('src') ?? '';
  const routeCodeMatch = routeSrc.match(/\/project\/([A-Z0-9._-]{2,20})/i);
  if (routeCodeMatch) {
    codes.add(routeCodeMatch[1].toUpperCase());
  }

  const projectLinks = timesheetDocument.querySelectorAll<HTMLAnchorElement>(SAP_SELECTORS.projectCodesTree);
  projectLinks.forEach((link) => {
    const title = link.getAttribute('title') ?? '';
    const leadingCode = title.match(/^\s*([A-Z][A-Z0-9._-]{2,20})\s*-/i);
    if (leadingCode?.[1]) {
      codes.add(leadingCode[1].toUpperCase());
    }
  });

  const projectCandidateElements = timesheetDocument.querySelectorAll<HTMLElement>(
    'option, [role="option"], [data-project], [data-project-code], input[value], button[value]'
  );

  projectCandidateElements.forEach((element) => {
    const candidateText = [
      element.getAttribute('value') ?? '',
      element.getAttribute('data-project') ?? '',
      element.getAttribute('data-project-code') ?? '',
      element.textContent ?? '',
    ].join(' ');

    const matches = candidateText.toUpperCase().match(PROJECT_CODE_PATTERN) ?? [];
    matches.forEach((match) => {
      if (match !== 'SAP' && match !== 'UI5') {
        codes.add(match);
      }
    });
  });

  return Array.from(codes).sort();
}

function extractTotalsHours(timesheetDocument: Document, labelPatterns: RegExp[]): number | null {
  const valueFromPanel = extractHoursFromTotalsPanel(timesheetDocument, labelPatterns);
  if (valueFromPanel !== null) {
    return valueFromPanel;
  }

  return extractLabeledHours(timesheetDocument, labelPatterns);
}

function extractHoursFromTotalsPanel(timesheetDocument: Document, labelPatterns: RegExp[]): number | null {
  const panelTitles = Array.from(timesheetDocument.querySelectorAll<HTMLElement>(SAP_SELECTORS.totalPanelTitle));
  const totalPanelTitle = panelTitles.find((title) => /total\s+of\s+the\s+month/i.test(title.textContent ?? ''));
  if (!totalPanelTitle) {
    return null;
  }

  const panelContainer = totalPanelTitle.closest<HTMLElement>('.sapUiRGLContainer');
  if (!panelContainer) {
    return null;
  }

  const labelRows = panelContainer.querySelectorAll<HTMLElement>(SAP_SELECTORS.totalPanelRows);
  for (const labelRow of labelRows) {
    const labelText = normalizeWhitespace(labelRow.textContent ?? '');
    const hasLabel = labelPatterns.some((pattern) => pattern.test(labelText));

    if (!hasLabel) {
      continue;
    }

    const valueRow = labelRow.nextElementSibling as HTMLElement | null;
    const valueText = normalizeWhitespace(valueRow?.textContent ?? '');
    const parsed = parseHoursNumber(valueText);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function extractLabeledHours(timesheetDocument: Document, labelPatterns: RegExp[]): number | null {
  const labelNodes = timesheetDocument.querySelectorAll<HTMLElement>('th, td, span, div, label, p');

  for (const node of labelNodes) {
    const labelText = normalizeWhitespace(node.textContent ?? '');
    if (!labelText) {
      continue;
    }

    const hasLabel = labelPatterns.some((pattern) => pattern.test(labelText));
    if (!hasLabel) {
      continue;
    }

    const directValue = parseHoursNumber(normalizeWhitespace(node.nextElementSibling?.textContent ?? ''));
    if (directValue !== null) {
      return directValue;
    }

    const inlineValue = parseHoursNumber(labelText);
    if (inlineValue !== null) {
      return inlineValue;
    }
  }

  const pageText = normalizeWhitespace(timesheetDocument.body?.textContent ?? '');
  for (const pattern of labelPatterns) {
    const fallbackPattern = new RegExp(`${pattern.source}[^0-9:.,-]*(-?\\d+(?::\\d{2}|[.,]\\d+)?)`, 'i');
    const match = pageText.match(fallbackPattern);
    if (match?.[1]) {
      const parsed = parseHoursNumber(match[1]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function parseHoursNumber(text: string): number | null {
  const compact = normalizeWhitespace(text);
  const colonMatch = compact.match(/(-?\d+):(\d{2})/);
  if (colonMatch) {
    const hours = Number.parseInt(colonMatch[1], 10);
    const minutes = Number.parseInt(colonMatch[2], 10);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return hours + minutes / 60;
    }
  }

  const allMatches = compact.match(/-?\d+(?:[.,]\d+)?/g);
  if (!allMatches || allMatches.length === 0) {
    return null;
  }

  const candidate = allMatches[allMatches.length - 1].replace(',', '.');
  const parsed = Number.parseFloat(candidate);

  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Autofill a single entry back into the page.
 * Replace selectors and interactions once SAP My Timesheet form fields are mapped.
 */
function autofillEntry(entry: HoursEntry): void {
  // TODO: Implement once SAP My Timesheet form fields are mapped
  console.log('[content-script] autofill (not yet implemented):', entry);
}

// Listen for messages from the popup or service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_TIMESHEET_SUMMARY') {
    sendResponse({ success: true, data: scrapeTimesheetSnapshot() });
  }

  if (message.type === 'AUTOFILL_ENTRY') {
    autofillEntry(message.payload as HoursEntry);
    sendResponse({ success: true });
  }
});


