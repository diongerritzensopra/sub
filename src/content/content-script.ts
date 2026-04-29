/**
 * Content script — runs in the context of SAP My Timesheet.
 *
 * Responsibilities:
 * - Scrape month/year, available project codes, and high-level totals
 * - Inject UI hints or autofill fields when requested
 */

import type { HoursEntry, TimesheetSnapshot } from '../shared/types';

const PROJECT_CODE_PATTERN = /\b[A-Z][A-Z0-9]{2,15}\b/g;
const PERIOD_FROM_ROUTE_PATTERN = /(\/|#)(\d{1,2})\/(\d{4})\/project\//i;

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
      worked: extractLabeledHours(timesheetDocument, [/hours\s*worked/i, /worked\s*hours/i]),
      absent: extractLabeledHours(timesheetDocument, [/hours\s*absent/i, /absent\s*hours/i]),
      toBePerformed: extractLabeledHours(timesheetDocument, [/hours\s*to\s*be\s*performed/i, /to\s*be\s*performed/i]),
    },
  };
}

function resolveTimesheetDocument(rootDocument: Document): Document {
  const frame = rootDocument.querySelector<HTMLIFrameElement>('#__container1, iframe[data-sap-ushell-active="true"]');
  if (!frame?.contentDocument) {
    return rootDocument;
  }

  try {
    // Access may fail if SAP changes iframe origin.
    void frame.contentDocument.body;
    return frame.contentDocument;
  } catch {
    return rootDocument;
  }
}

function extractPeriod(timesheetDocument: Document, rootDocument: Document): { month: number | null; year: number | null } {
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

function extractPeriodFromIframeRoute(rootDocument: Document): { month: number; year: number } | null {
  const frame = rootDocument.querySelector<HTMLIFrameElement>('#__container1, iframe[data-sap-ushell-active="true"]');
  const src = frame?.getAttribute('src') ?? '';
  const match = src.match(PERIOD_FROM_ROUTE_PATTERN);

  if (!match) {
    return null;
  }

  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);

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

  const periodRouteFrame = rootDocument.querySelector<HTMLIFrameElement>('#__container1, iframe[data-sap-ushell-active="true"]');
  const routeSrc = periodRouteFrame?.getAttribute('src') ?? '';
  const routeCodeMatch = routeSrc.match(/\/project\/([A-Z0-9_-]{2,20})/i);
  if (routeCodeMatch) {
    codes.add(routeCodeMatch[1].toUpperCase());
  }

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

    const nearbyText = normalizeWhitespace([
      node.textContent,
      node.nextElementSibling?.textContent,
      node.parentElement?.textContent,
    ].join(' '));

    const parsed = parseHoursNumber(nearbyText);
    if (parsed !== null) {
      return parsed;
    }
  }

  const pageText = normalizeWhitespace(timesheetDocument.body?.textContent ?? '');
  for (const pattern of labelPatterns) {
    const fallbackPattern = new RegExp(`${pattern.source}[^0-9-]*(-?\\d+(?:[.,]\\d+)?)`, 'i');
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
  const allMatches = text.match(/-?\d+(?:[.,]\d+)?/g);
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
