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

const ROUTE_PERIOD_PATTERN = /(?:\/|#)(\d{1,2})\/(\d{4})(?:\/project\/|\b)/i;

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
  const period = resolvePeriodWithFallbacks(timesheetDocument, rootDocument);

  return {
    month: period.month,
    year: period.year,
    projectCodes: extractProjectCodes(timesheetDocument),
    totals: {
      worked: resolveHoursWithFallbacks(timesheetDocument, [/number\s+of\s+hours\s+worked/i, /hours\s+worked/i]),
      absent: resolveHoursWithFallbacks(timesheetDocument, [/number\s+of\s+hours\s+absent/i, /hours\s+absent/i]),
      toBePerformed: resolveHoursWithFallbacks(timesheetDocument, [/hours\s+to\s+be\s+performed/i, /to\s+be\s+performed/i]),
    },
  };
}

function resolveTimesheetDocument(rootDocument: Document): Document {
  const frame = resolveTimesheetFrame(rootDocument);
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

function resolveTimesheetFrame(rootDocument: Document): HTMLIFrameElement | null {
  const preferredSelectors = [
    'iframe[data-sap-ushell-active="true"]',
    'iframe[src*="ui5appruntime.html"]',
    'iframe[src*="#timesheet-my"]',
  ];

  for (const selector of preferredSelectors) {
    const frame = rootDocument.querySelector<HTMLIFrameElement>(selector);
    if (frame) {
      return frame;
    }
  }

  return rootDocument.querySelector<HTMLIFrameElement>('iframe');
}

function resolvePeriodWithFallbacks(timesheetDocument: Document, rootDocument: Document): { month: number | null; year: number | null } {
  const calendarHeaderPeriod = extractPeriodFromCalendarHeader(timesheetDocument);
  if (calendarHeaderPeriod) {
    return calendarHeaderPeriod;
  }

  const routeFallbackPeriod = extractPeriodFromRouteFallback(rootDocument);
  if (routeFallbackPeriod) {
    return routeFallbackPeriod;
  }

  const textFallbackPeriod = extractPeriodFromPageTextFallback(timesheetDocument.body?.textContent ?? '');
  if (textFallbackPeriod) {
    return textFallbackPeriod;
  }

  return { month: null, year: null };
}

function extractPeriodFromCalendarHeader(timesheetDocument: Document): { month: number; year: number } | null {
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

function extractPeriodFromRouteFallback(rootDocument: Document): { month: number; year: number } | null {
  const frame = resolveTimesheetFrame(rootDocument);
  const routeCandidates = [
    frame?.getAttribute('src') ?? '',
    rootDocument.location.href,
    rootDocument.location.hash,
  ];

  const match = routeCandidates
    .map((candidate) => candidate.match(ROUTE_PERIOD_PATTERN))
    .find((candidateMatch) => candidateMatch !== null);

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

function extractPeriodFromPageTextFallback(text: string): { month: number; year: number } | null {
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

function extractProjectCodes(timesheetDocument: Document): string[] {
  const codes = new Set<string>();

  // Project codes are exclusively found in the navigation tree links.
  // Each link's title attribute starts with the project code followed by a dash,
  // e.g. "C0007012.1.1 - Politie DPC - Signalen".
  const projectLinks = timesheetDocument.querySelectorAll<HTMLAnchorElement>(SAP_SELECTORS.projectCodesTree);
  projectLinks.forEach((link) => {
    const title = link.getAttribute('title') ?? '';
    const leadingCode = title.match(/^\s*([A-Z][A-Z0-9._-]{2,20})\s*-/i);
    if (leadingCode?.[1]) {
      codes.add(leadingCode[1].toUpperCase());
    }
  });

  return Array.from(codes).sort();
}

function resolveHoursWithFallbacks(timesheetDocument: Document, labelPatterns: RegExp[]): number | null {
  const totalsPanelHours = extractHoursFromTotalsPanel(timesheetDocument, labelPatterns);
  if (totalsPanelHours !== null) {
    return totalsPanelHours;
  }

  return extractHoursFromLabeledNodesFallback(timesheetDocument, labelPatterns);
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

function extractHoursFromLabeledNodesFallback(timesheetDocument: Document, labelPatterns: RegExp[]): number | null {
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

    const siblingValueFallback = parseHoursNumber(normalizeWhitespace(node.nextElementSibling?.textContent ?? ''));
    if (siblingValueFallback !== null) {
      return siblingValueFallback;
    }

    const inlineValueFallback = parseHoursNumber(labelText);
    if (inlineValueFallback !== null) {
      return inlineValueFallback;
    }
  }

  const pageTextFallback = normalizeWhitespace(timesheetDocument.body?.textContent ?? '');
  for (const pattern of labelPatterns) {
    const fallbackPattern = new RegExp(`${pattern.source}[^0-9:-]*(-?\\d+:\\d{2})`, 'i');
    const match = pageTextFallback.match(fallbackPattern);
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

  if (!colonMatch) {
    return null;
  }

  const hours = Number.parseInt(colonMatch[1], 10);
  const minutes = Number.parseInt(colonMatch[2], 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours + minutes / 60;
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

