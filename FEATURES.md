# FEATURES

Shared feature roadmap for `sub`.

## Planned

### Popup unit test refactoring
#### Feature description
- [ ] Refactor the popup unit tests so that each popup module (`popup-actions.ts`, `popup-dom.ts`, `popup-gateway.ts`, `popup-model.ts`, `popup-render.ts`) has its own dedicated unit test file.
  - The existing test files (`popup.core.test.ts`, `popup.lock-state.test.ts`, `popup.schedule-apply.test.ts`, `popup.schedule-delete.test.ts`, `popup.schedule-form.test.ts`, `popup.snapshot-render.test.ts`, `popup.status-cache.test.ts`) currently test behaviour at the level of the assembled popup (`popup.ts`) rather than individual modules; they rely on the full popup being wired up.
  - After the refactor, each module's test file should import and exercise only that module, with its dependencies (other popup modules, storage, scripting wrappers, etc.) mocked via Vitest's `vi.mock`.
  - Shared test helpers in `popup.test-helpers.ts` should be reviewed; keep only the helpers that remain relevant for module-level tests and move or remove the rest.
  - The existing functional test coverage (core init, lock state, schedule apply, schedule delete, schedule form, snapshot render, status cache) must be preserved in the refactored files — no test cases may be dropped, only reorganised and re-scoped.
  - **Integration tests are explicitly out of scope for this refactor.** Any existing test cases that cross multiple popup modules, cannot be cleanly attributed to a single module, and are necessary to maintain coverage must be identified and documented in Chunk 1 so they can be picked up in a dedicated *Popup integration tests* feature (see planned feature below). Those cases must **not** be deleted during this refactor; keep them in a clearly labelled holding file (e.g. `popup.integration.test.ts`) until the separate feature is implemented.

#### Implementation chunks
- [x] Chunk 1 - Audit and map existing tests to modules.
  - Read all current popup test files and map each test case to the module it actually exercises.
  - Identify which tests are genuinely unit-level (single module) and which are effectively integration tests (multiple modules wired together).
  - For any test that cannot be mapped to a single module: determine whether it is redundant (safe to drop after per-module coverage is in place) or load-bearing (must be kept to maintain coverage). Document load-bearing cases explicitly — they will be preserved and handed off to the *Popup integration tests* feature.
  - Produce a mapping table (or inline comments in the test files) that drives the subsequent chunks.
  - Mapping output: `src/popup/popup-test-refactor-audit.md`.
- [x] Chunk 2 - Unit tests for `popup-model.ts`.
  - Create `popup-model.test.ts` covering state initialization, mutations, and derived state logic.
  - Mock storage helpers and any other external dependencies.
  - Output: `src/popup/popup-model.test.ts` (model-focused unit coverage for state defaults, editability/completeness checks, period parsing/fallback, and schedule selection).
- [x] Chunk 3 - Unit tests for `popup-dom.ts`.
  - Create `popup-dom.test.ts` covering DOM query helpers and element accessors.
  - Use jsdom; mock only cross-module imports, not the DOM itself.
  - Output: `src/popup/popup-dom.test.ts` (DOM ref mapping and element accessor coverage).
- [x] Chunk 4 - Unit tests for `popup-render.ts`.
  - Create `popup-render.test.ts` covering all render functions (snapshot display, schedule list, status messages, lock state, button states).
  - Use jsdom-backed `PopupDomRefs` fixtures and module-local test data so render logic is tested directly without popup bootstrap wiring.
  - Output: `src/popup/popup-render.test.ts` (render helpers, snapshot rendering, schedule list interactions, form rendering, and button/status state coverage).
- [ ] Chunk 5 - Unit tests for `popup-actions.ts`.
  - Create `popup-actions.test.ts` covering every user-action handler (refresh, apply, schedule save/delete, status dismiss).
  - Mock `popup-model.ts`, `popup-render.ts`, `popup-gateway.ts`, storage, and scripting wrappers.
- [ ] Chunk 6 - Unit tests for `popup-gateway.ts`.
  - Create `popup-gateway.test.ts` covering message dispatch, tab queries, and error paths.
  - Mock `chrome.*` APIs (tabs, scripting, runtime) via the existing Vitest chrome mock setup.
- [ ] Chunk 7 - Isolate load-bearing cross-module test cases.
  - Move any test cases identified in Chunk 1 as load-bearing integration tests into `popup.integration.test.ts` without modifying them.
  - Add a comment block at the top of the file explaining that these tests are placeholders pending the *Popup integration tests* feature.
- [ ] Chunk 8 - Clean up legacy test files and shared helpers.
  - Remove or repurpose the old functionality-bucketed test files once all their cases have been migrated into per-module files or moved to `popup.integration.test.ts`.
  - Prune `popup.test-helpers.ts` to only the helpers still needed after the refactor; delete the file if it becomes empty.
- [ ] Chunk 9 - Coverage and CI validation.
  - Run `npm test` and confirm all tests pass and coverage is at least equal to the pre-refactor baseline.
  - Fix any import or mock wiring issues discovered during the test run.

### Popup integration tests
#### Feature description
- [ ] Determine whether popup-level integration tests (tests that exercise multiple popup modules wired together) are necessary after the *Popup unit test refactoring* is complete.
  - This feature is a direct follow-up to the refactoring. The need for integration tests — and the scope of what they should cover — can only be assessed once the per-module unit tests exist and coverage results are known.
  - Candidate cases are the load-bearing cross-module tests parked in `popup.integration.test.ts` during the refactoring (see Chunk 7 of the refactoring feature). Each candidate must be evaluated: if per-module coverage now renders it redundant it can be dropped; if it still adds value it becomes a proper integration test.
  - Integration tests at this level must test the assembled popup behavior without mocking internal popup modules — only external boundaries (storage, `chrome.*` APIs, scripting wrappers) may be mocked.

#### Implementation chunks
- [ ] Chunk 1 - Evaluate coverage gap after unit test refactor.
  - Review the coverage report produced at the end of the refactoring feature.
  - Review every test case in `popup.integration.test.ts`; classify each as redundant or still load-bearing.
  - If all cases are redundant, delete `popup.integration.test.ts` and close this feature with no further work.
- [ ] Chunk 2 - Author integration tests (only if load-bearing cases exist).
  - Convert the load-bearing cases from `popup.integration.test.ts` into proper integration tests with clear, descriptive names and only external-boundary mocking.
  - Remove the placeholder comment block added during the refactoring.
- [ ] Chunk 3 - Coverage and CI validation.
  - Run `npm test` and confirm all tests pass and coverage meets or exceeds the pre-refactoring baseline.

### General hours schedules
#### Feature description
- [ ] Allow users to create and edit weekly schedules for SAP "general hours" timesheets.
  - General hours options come from `SapProjectsModelData.oGeneralHours`.
  - Users can manage general-hours schedules from the same popup schedule flow used for project schedules.
  - General hours use a different SAP data shape than `SapProject`; mapping must use the general-hours specific identifiers/labels.
- [ ] Allow users to apply saved general-hours schedules to the currently opened month.
  - Apply behavior matches existing schedule expansion rules (including explicit 0-hour days).

#### Implementation chunks
- [ ] Chunk 1 - Shared types for general hours.
  - Add typed interfaces for `oGeneralHours` entries in `src/shared/types.ts`.
  - Extend `TimesheetSnapshot` with general-hours options needed by the popup form.
  - Extend `WeeklySchedule` to represent schedule target type (`project` vs `general-hours`) and target identifier.
  - Add or update tests for the new shared type-driven schedule/storage behavior.
- [ ] Chunk 2 - Snapshot read support.
  - Update `src/popup/ui5-main-world.ts` snapshot extraction to read and normalize `oGeneralHours` options.
  - Treat missing or empty `oGeneralHours` as an invalid/incomplete SAP data model and surface an error instead of continuing.
  - Add or update snapshot/UI5 tests covering successful extraction and the new error path.
- [ ] Chunk 3 - Popup schedule form + list support.
  - Update schedule create/edit UI to let users pick either a project target or a general-hours target.
  - Show the selected target type and label clearly in the saved schedule list.
  - Add or update popup tests for creating, editing, and rendering general-hours schedules.
- [ ] Chunk 4 - Apply flow support for general hours.
  - Extend popup apply orchestration so general-hours schedules also navigate to the corresponding SAP timesheet route before applying.
  - Extend UI5 autofill path to post hours using general-hours target metadata from `oGeneralHours`.
  - Add or update apply-path tests for general-hours-only flows, mixed selections (project + general-hours), navigation, and error handling.

### i18n
#### Feature description
- [ ] Support both Dutch and English in the extension UI.
  - Bundle user-facing text in language-specific localization files.
  - Keep localization structure extensible for additional languages later.
- [ ] Add a language selection menu in the popup.
  - Selection options are represented by country flag emojis.
  - Persist the selected language in local storage.

#### Implementation chunks
- [ ] Chunk 1 - Localization infrastructure.
  - Define a localization module in `src/shared/i18n.ts` with language registry and message retrieval helpers.
  - Create language-specific message files (`src/shared/i18n/nl.ts`, `src/shared/i18n/en.ts`) mapping message keys to Dutch and English strings.
  - Add or update tests for language loading, message retrieval, and fallback behavior.
- [ ] Chunk 2 - Language persistence and defaults.
  - Add shared types for language preference in `src/shared/types.ts` (supported languages enum, language preference type).
  - Add storage helpers in `src/shared/storage.ts` to get/set the persisted language preference.
  - Default to Dutch if no preference is stored.
  - Add or update tests for language preference persistence and defaults.
- [ ] Chunk 3 - Language selection UI in popup.
  - Add a language selector control in the popup (flag emojis for 🇳🇱 Dutch and 🇬🇧 English).
  - Wire up the selector to update the language preference in storage when changed.
  - Add or update popup tests for language selector rendering and persistence behavior.
- [ ] Chunk 4 - UI text migration and rendering.
  - Identify all user-facing text in the popup HTML, CSS, and TypeScript.
  - Replace hardcoded Dutch strings with localization calls using the i18n module.
  - Update popup render functions to use the selected language for all messages (status, errors, buttons, labels).
  - Ensure the popup refreshes language when the preference changes without requiring a popup reopen.
  - Add or update popup tests for language-aware rendering across different states and messages.

### Popup UI overhaul
#### Feature description
- [ ] Redesign the popup so the layout is intentional instead of a single vertical stack of controls.
  - Start with a brainstorming/planning phase with Copilot to define the popup's information hierarchy, primary actions, and visual grouping.
  - The updated design should make the most important states and actions easy to scan: SAP status, refresh/snapshot state, saved schedules, and apply actions.
  - Rework the popup structure and styling to support clearer sections, spacing, and action emphasis without removing existing functionality.
  - Preserve current behavior while improving usability in the limited browser-extension popup space.

#### Implementation chunks
- [ ] Chunk 1 - Popup layout planning.
  - Brainstorm the popup layout with Copilot.
  - Define the target information architecture, section order, and primary/secondary actions.
  - Capture the agreed structure and UX goals before changing code.
- [ ] Chunk 2 - Popup DOM/render structure.
  - Refactor the popup markup/rendering so the UI is grouped into deliberate sections instead of a single continuous flow.
  - Ensure status, snapshot details, schedules, and apply controls each have clear structure and headings.
- [ ] Chunk 3 - Popup styling overhaul.
  - Update `popup.css` to implement the planned layout, spacing, grouping, and visual hierarchy.
  - Improve readability and button emphasis for the popup's constrained width.
- [ ] Chunk 4 - UX polish and regression coverage.
  - Verify loading, locked, cached, empty, and error states still render clearly in the new layout.
  - Add or update popup tests for the revised structure and state-specific rendering.

### Reminder notifications
#### Feature description
- [ ] Allow users to enable a weekly reminder notification to submit their hours.
  - Default schedule: every Friday at 11:00.
  - Users can edit both the weekday and time of the reminder.
  - The notification should appear regardless of the active browser tab/page.
  - Clicking the notification opens a new browser tab that navigates to the SAP timesheet application.
  - Optionally support a browser-closed reminder toggle, disabled by default, if the extension/runtime can reliably trigger it.

#### Implementation chunks
- [ ] Chunk 1 - Notification schedule model and persistence.
  - Add shared types for reminder configuration in `src/shared/types.ts`.
  - Persist the enabled state, weekday, time, and browser-closed toggle in storage.
  - Add or update tests for schedule serialization and defaults.
- [ ] Chunk 2 - Background alarm/notification plumbing.
  - Add a background mechanism to evaluate the configured reminder and trigger a notification at the chosen time.
  - Ensure the notification is independent of the active tab and survives normal browser usage.
  - Add or update tests for alarm scheduling and notification dispatch behavior.
- [ ] Chunk 3 - Notification click handling.
  - Handle notification click events in the background service worker.
  - Open a new tab to the canonical SAP timesheet URL when the notification is clicked.
  - Add or update tests for click behavior and tab creation.
- [ ] Chunk 4 - Popup settings UI.
  - Add popup controls to enable/disable reminders and choose weekday/time.
  - Add a browser-closed toggle when supported by the implementation.
  - Add or update popup tests for editing, saving, and rendering reminder settings.



## Completed

### Versioning, packaging and distribution
#### Feature description
- [x] Bump the extension version and produce a distributable zip with a single command.
  - `manifest.json` remains the single source of truth for the version; `package.json` and `package-lock.json` are kept in sync automatically.
  - Default bump is minor (resets patch to 0). Optional `--patch` flag bumps patch only; optional `--major` flag bumps major and resets minor and patch to 0.
  - A specific version can be supplied as an argument (e.g. `npm run release -- 1.2.3`).
  - Pre-flight git checks must pass before any versioning or building takes place: working tree must be clean, the `main` branch must be checked out, and the current commit must not already carry a version tag.
  - After writing the new version, `manifest.json` and `package(-lock).json` are committed with a `[release] v<version>` commit message and a `v<version>` git tag is created on that commit. The build artifact (zip) is not included in the commit.

#### Implementation chunks
- [x] Chunk 1 - Release script.
  - Add `scripts/release.mjs` that:
    1. Runs pre-flight git checks (clean working tree, `main` branch checked out, no existing version tag on `HEAD`); aborts with a clear error if any check fails.
    2. Resolves the new version from the current `manifest.json` version using the supplied flag (`--patch`, `--major`) or a literal semver argument; defaults to minor bump.
    3. Validates any literal version argument against semver `x.y.z` format.
    4. Runs the unit tests (`vitest run`); aborts if any test fails.
    5. Runs `vite build`; aborts if the build fails.
    6. Writes the new version to `manifest.json`, `package.json`, and `package-lock.json`.
    7. Commits the three changed files with message `[release] v<version>` and creates a `v<version>` git tag on that commit.
    8. Zips `dist/` to `sub-extension-v<version>.zip`.
- [x] Chunk 2 - npm script wiring.
  - Add a `"release"` script to `package.json` that invokes `node scripts/release.mjs`.
  - Existing `"package"` script remains unchanged for re-packaging without a version bump.
- [x] Chunk 3 - AGENTS.md / README documentation.
  - Add `release` to the Developer Workflow table in `AGENTS.md`.
  - Add usage examples to `README.md` (default minor bump, `--patch`, `--major`, and explicit version).

### Project schedules
#### Feature description
- [x] Allow users to configure a weekly schedule per project code.
  - Per weekday (Mon-Sun), user can define planned hours.
  - Schedule is stored and reusable.
- [x] Allow users to apply a saved project schedule to the currently opened month.
  - Filling planned hours should target the whole month.
  - Action should work from the extension flow without manual day-by-day entry.

#### Implementation chunks
- [x] Chunk 1 - Define schedule types in shared types.
  - Add `WeeklySchedule` interface (project code + hours per weekday Mon–Sun) to `src/shared/types.ts`.
  - Add `AUTOFILL_ENTRIES` to `MessageType`.
- [x] Chunk 2 - Storage helpers for schedules.
  - Add CRUD helpers (`getSchedules`, `saveSchedule`, `deleteSchedule`) to `src/shared/storage.ts`.
  - Add tests in `src/shared/storage.test.ts`.
- [x] Chunk 3 - Schedule list view in popup.
  - Show saved schedules in the popup with an empty state when none are configured.
  - Read-only; no create/edit yet.
- [x] Chunk 4 - Add/edit schedule form in popup.
  - Form to pick a project code (from scraped snapshot) and set planned hours per weekday.
  - Save new or updated schedule to storage.
- [x] Chunk 5 - Delete schedule in popup.
  - Add delete action per schedule in the list view.
- [x] Chunk 6 - Schedule expansion logic.
  - Pure function that expands a `WeeklySchedule` into `HoursEntry[]` for a given month/year.
  - Covers every applicable day in the month and preserves explicit 0-hour days so the apply flow can reset existing SAP values when needed.
  - Fully unit-tested in isolation.
- [x] Chunk 7 - Content script autofill implementation.
  - Map SAP My Timesheet form fields and implement `AUTOFILL_ENTRIES` message handler in `src/content/content-script.ts`.
- [x] Chunk 8 - Popup apply action.
  - Add one primary apply button in the popup.
  - Default state is "Apply all" and applies every saved schedule.
  - Allow selecting individual schedules; when one or more are selected, the button changes to "Apply" and applies only selected schedules.
  - Before applying a schedule, navigate to its project page first; this only proceeds when the target project code is present in the current snapshot `projectCodes` array derived from the SAP `projectsmodel`.
  - Use SAP UI5 `projectsmodel`/`postTimeSheet` access via `chrome.scripting` instead of the old message-based content-script autofill path.
- [x] Chunk 9 - Final polish.
  - Rename `SapProjectsModel` → `SapProjectsModelData` (the interface represents the data payload, not the model itself).
  - Persist the last apply/error status message so it survives popup close/reopen; messages expire after 30 minutes and can be dismissed with an × button.
  - Detect SAP timesheet lock state via `SapProjectsModelData.oTotals.oStatus` (`"U"` = editable, `"S"` = locked); map to descriptive `TimesheetSnapshot.sapStatus` values (`'editable' | 'locked'`). When locked, disable only the apply flow and show a lock message — local controls (refresh, schedule management) remain usable.
  - Tightened apply UX and state handling: persistent status restore behavior, lock-aware apply-only gating, and clearer apply button states (`is-locked` vs `is-applying` / `Bezig...`).

### Caching
#### Feature description
- [x] Cache scraped SAP My Timesheet snapshot data in browser storage.
  - Storage backend: `chrome.storage.session` or `chrome.storage.local`.
- [x] Show cached data immediately when popup opens.
  - Keep automatic scrape/update behavior in parallel.
  - Replace cached values with fresh scraped values when available.

#### Implementation chunks
- [x] Chunk 1 - Define cache contract in shared types.
  - Added `CachedTimesheetSnapshot` in `src/shared/types.ts`.
- [x] Chunk 2 - Add typed storage helpers and tests.
  - Added cache helpers in `src/shared/storage.ts`.
  - Added/updated tests in `src/shared/storage.test.ts`.
- [x] Chunk 3 - Popup read path.
  - Render cached snapshot immediately when popup opens.
- [x] Chunk 4 - Popup write-through path.
  - Save fresh scrape results to cache after successful scrape.
- [x] Chunk 5 - Busy/loading UX behavior.
  - Keep cached data visible while SAP page is still loading.
- [x] Chunk 6 - Staleness/invalidation.
  - Add period-based validation and stale cache handling.
- [x] Chunk 7 - Final polish.
  - Add subtle cached/fresh indicators and final cleanup.

## Notes
- Keep message contracts typed in `src/shared/types.ts`.
- Keep storage helpers in `src/shared/storage.ts` when implementing cache behavior.
