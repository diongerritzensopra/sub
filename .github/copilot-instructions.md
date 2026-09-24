# copilot-instructions.md

## Code Quality

- Run Prettier on all files you create or edit. After creating or editing any file, run `npx prettier --write <file-path>` or `npx prettier --write src/` to format according to `.prettierrc`.

## Project Goal

Chromium browser extension (Manifest V3) named `sub` ("snel uren boeken") for helping with hour booking in SAP My Timesheet. Built with TypeScript + Vite + `@crxjs/vite-plugin`.

## Architecture (Current)

### Popup Module Architecture

The popup is composed of modular, independently-testable layers:

- `src/popup/popup.ts`: composition root; wires together the popup initialization lifecycle, event listeners, and integration between DOM refs, state, rendering, actions, and gateway.
- `src/popup/popup-model.ts`: popup state definition (`PopupState`) and initialization logic; handles snapshot data, schedule selections, form state, and timesheet editability checks.
- `src/popup/popup-dom.ts`: DOM reference helpers; encapsulates selectors and provides typed element accessors for the popup controls.
- `src/popup/popup-render.ts`: rendering functions for snapshot display, schedule lists, schedule forms, status messages, lock state, and button state management.
- `src/popup/popup-actions.ts`: user action handlers (refresh, apply, schedule save/delete, status dismiss); orchestrates state mutations and re-renders.
- `src/popup/popup-gateway.ts`: communication layer; handles tab/scripting queries, caching decisions, and delegation to storage and UI5 scripting functions.
- `src/popup/schedule-apply.ts`: per-schedule apply orchestration; project navigation logic and apply status message composition.
- `src/popup/schedule-target.ts`: schedule targeting helpers; normalizes schedule target metadata (project code, general-hours identifier, label).
- `src/popup/ui5-main-world.ts`: self-contained SAP UI5 main-world functions for snapshot reading and timesheet autofill via the SAP `projectsmodel` and `postTimeSheet` API; serializable (runtime imports unavailable).
- `src/popup/ui5-scripting.ts`: `chrome.scripting.executeScript` wrappers that invoke `ui5-main-world` functions in the active SAP tab's MAIN world.
- `src/popup/popup.html` and `src/popup/popup.css`: extension popup UI markup and styling.

### Content Script & Service Worker

- `src/content/content-script.ts`: runs on SAP My Timesheet; monitors busy state via polling and sends `SAP_BUSY_STATE_CHANGED` messages so the service worker and popup can react to SAP readiness.
- `src/background/service-worker.ts`: MV3 messaging hub; manages per-tab icon state (no-match / loading / ready) via `busyStateByTabId` map; handles `GET_SAP_BUSY_STATE` queries and routing for content-script messages.

### Shared Utilities

- `src/shared/types.ts`: shared message and domain types (`HoursEntry`, `TimesheetSnapshot`, `CachedTimesheetSnapshot`, `WeeklySchedule`, `SapTimesheetDayEntry`, `SapProjectsModelData`, `SapGeneralHours`, `MessageType`, `MessageRequest`, `MessageResponse`).
- `src/shared/storage.ts`: typed helpers around `chrome.storage.local` for snapshot cache (`timesheetSnapshotCache`), schedules (`projectSchedules`), and status message persistence.
- `src/shared/busy-state.ts`: shared busy-state helpers; content script sends state changes, service worker tracks them, popup queries current state via `getSAPBusyStateForTab()`.
- `src/shared/schedule-expansion.ts`: pure function `expandWeeklyScheduleToMonthEntries(schedule, month, year)` that converts a `WeeklySchedule` into `HoursEntry[]` for a given month; handles explicit 0-hour days for reset behavior; fully unit-tested.

## Project Boundaries

- The extension runs locally in the browser as a standard MV3 extension.
- Cross-component communication goes through typed messages from `src/shared/types.ts`.
- Keep runtime behavior focused on SAP My Timesheet analysis and autofill support.

## URL Targeting

- Canonical SAP URL:
  - `https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet`
- Content script match pattern in `manifest.json` (host/path only; hash fragments are not supported by MV3 match patterns):
  - `https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site*`
- If SAP routing changes, update `manifest.json` `content_scripts.matches` first.

## Developer Workflow

| Task           | Command                 |
| -------------- | ----------------------- |
| Dev (HMR)      | `npm run dev`           |
| Build          | `npm run build`         |
| Test           | `npm test`              |
| Test (watch)   | `npm run test:watch`    |
| Coverage       | `npm run test:coverage` |
| Format         | `npm run format`        |
| Format (check) | `npm run format:check`  |
| Release        | `npm run release`       |
| Package zip    | `npm run package`       |

## Conventions to Follow

- Add new message kinds to `MessageType` before using them in popup/content scripts.
- Keep DOM selectors in `content-script.ts` SAP-specific and evidence-based; the current content script only inspects the timesheet iframe and busy indicator.
- SAP UI renders inside an `<iframe>`; popup-driven snapshot reading and autofill run in the SAP page's `MAIN` world through `chrome.scripting.executeScript` wrappers.
- Keep UI5 injected code in `src/popup/ui5-main-world.ts` self-contained: runtime imports are unavailable once the function is serialized into the SAP page context.
- The popup apply flow uses SAP `projectsmodel` data and `postTimeSheet`; prefer extending that path over reintroducing message-based content-script autofill.
- `SapTimesheetDayEntry.AvailabilityInHours` is in **minutes** despite its name (e.g., `480` = 8 hours).
- User-facing error messages shown by popup/UI5 apply flows remain in Dutch.
- Keep popup text and manifest metadata branded as `sub`.
- Keep tests next to source as `*.test.ts` (Vitest + jsdom via `vite.config.ts`).

## Maintenance Notes

- Update this file when architecture, workflow, or SAP-specific targeting changes.
- Prefer repository-specific instructions to generic advice.
- Track planned/completed product features in `FEATURES.md`.
