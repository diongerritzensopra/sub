# AGENTS.md

## Project Goal
Chromium browser extension (Manifest V3) named `sub` ("snel uren boeken") for helping with hour booking in SAP My Timesheet. Built with TypeScript + Vite + `@crxjs/vite-plugin`.

## Architecture (Current)
- `src/popup/`: extension UI (`popup.html`, `popup.ts`, `popup.css`) triggers page analysis.
- `src/content/content-script.ts`: runs on SAP My Timesheet and contains DOM scrape/autofill logic.
- `src/background/service-worker.ts`: minimal MV3 lifecycle entry point.
- `src/shared/types.ts`: shared message and domain types (`HoursEntry`, `MessageRequest`, `MessageResponse`).
- `src/shared/storage.ts`: typed helpers around `chrome.storage.local`.

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
| Package zip | `npm run package` |

## Agent Execution Rules
- Every executed step that generates or edits code/files MUST be committed to git immediately after the step.
- Commit messages for generated changes MUST start with `[AI]`.
- The commit message body MUST include both a `Prompt summary` and a `Step executed` summary; order them as prompt first, then step, with one blank line between them (paraphrasing is allowed when intent is preserved).
- After each generation/edit step, provide a brief summary of produced changes, including any class, function, or config file created/edited.

## Conventions to Follow
- Add new message kinds to `MessageType` before using them in popup/content scripts.
- Keep DOM selectors in `content-script.ts` SAP-specific and evidence-based (no generic placeholders once known).
- Keep popup text and manifest metadata branded as `sub`.
- Keep tests next to source as `*.test.ts` (Vitest + jsdom via `vite.config.ts`).

## Maintenance Notes
- Update this file when architecture, workflow, or SAP-specific targeting changes.
- Prefer repository-specific instructions over generic advice.

## Active TODO Surface
- Map real SAP My Timesheet selectors in `src/content/content-script.ts` for scraping and autofill.
- Add/adjust tests when selector logic becomes concrete.
