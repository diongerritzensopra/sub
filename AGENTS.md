# AGENTS.md

## Project Goal
Chromium browser extension (Manifest V3) named `sub` ("snel uren boeken") for helping with hour booking in SAP My Timesheet. Built with TypeScript + Vite + `@crxjs/vite-plugin`.

## Architecture (Current)
- `src/popup/`: extension UI (`popup.html`, `popup.ts`, `popup.css`) triggers page analysis and renders cached/live snapshot data and saved schedules.
- `src/content/content-script.ts`: runs on SAP My Timesheet and monitors busy state via polling so the service worker and popup can react to SAP readiness.
- `src/background/service-worker.ts`: MV3 messaging hub; manages per-tab icon state (no-match / loading / ready) via `busyStateByTabId`, and handles `GET_SAP_BUSY_STATE` queries.
- `src/shared/types.ts`: shared message and domain types (`HoursEntry`, `TimesheetSnapshot`, `CachedTimesheetSnapshot`, `WeeklySchedule`, `SapTimesheetDayEntry`, `SapProjectsModelData`, `MessageRequest`, `MessageResponse`).
- `src/shared/storage.ts`: typed helpers around `chrome.storage.local` for snapshot cache (`timesheetSnapshotCache`) and schedules (`projectSchedules`).
- `src/shared/busy-state.ts`: shared busy-state helpers; content script sends `SAP_BUSY_STATE_CHANGED`, service worker tracks it; popup queries via `getSAPBusyStateForTab()`.
- `src/shared/schedule-expansion.ts`: pure function `expandWeeklyScheduleToMonthEntries(schedule, month, year)` that converts a `WeeklySchedule` into `HoursEntry[]`; fully unit-tested.
- `src/popup/ui5-main-world.ts`: self-contained SAP UI5 main-world functions for snapshot reading and timesheet autofill via the SAP `projectsmodel` and `postTimeSheet` API.
- `src/popup/ui5-scripting.ts`: `chrome.scripting.executeScript` wrappers that invoke the `ui5-main-world` functions in the active SAP tab.
- `src/popup/schedule-apply.ts`: popup-side project navigation, per-schedule apply orchestration, and apply status message composition.

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
| Task | Command |
|------|---------|
| Dev (HMR) | `npm run dev` |
| Build | `npm run build` |
| Test | `npm test` |
| Test (watch) | `npm run test:watch` |
| Coverage | `npm run test:coverage` |
| Release | `npm run release` |
| Package zip | `npm run package` |

## Agent Execution Rules
- Do not commit automatically after each generated or edited step; wait for explicit user confirmation to commit.
- Commit messages for generated changes MUST start with `[AI]`.
- The commit message body MUST include both a `Prompt summary` and a `Step executed` summary; order them as prompt first, then step, with one blank line between them (paraphrasing is allowed when intent is preserved).

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
- Prefer repository-specific instructions over generic advice.
- Track planned/completed product features in `FEATURES.md`.

## Active TODO Surface
- i18n: Dutch and English UI text, language selector in popup, persisted language preference.
