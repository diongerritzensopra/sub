# FEATURES

Shared feature roadmap for `sub`.

## Planned

### Project schedules
#### Feature description
- [ ] Allow users to configure a weekly schedule per project code.
  - Per weekday (Mon-Sun), user can define planned hours.
  - Schedule is stored and reusable.
- [ ] Allow users to apply a saved project schedule to the currently opened month.
  - Filling planned hours should target the whole month.
  - Action should work from the extension flow without manual day-by-day entry.

#### Implementation chunks
- [ ] Chunk 1 - Define schedule types in shared types.
  - Add `WeeklySchedule` interface (project code + hours per weekday Mon–Sun) to `src/shared/types.ts`.
  - Add `AUTOFILL_ENTRIES` to `MessageType` for bulk autofill requests.
- [ ] Chunk 2 - Storage helpers for schedules.
  - Add CRUD helpers (`getSchedules`, `saveSchedule`, `deleteSchedule`) to `src/shared/storage.ts`.
  - Add tests in `src/shared/storage.test.ts`.
- [ ] Chunk 3 - Schedule list view in popup.
  - Show saved schedules in the popup with an empty state when none are configured.
  - Read-only; no create/edit yet.
- [ ] Chunk 4 - Add/edit schedule form in popup.
  - Form to pick a project code (from scraped snapshot) and set planned hours per weekday.
  - Save new or updated schedule to storage.
- [ ] Chunk 5 - Delete schedule in popup.
  - Add delete action per schedule in the list view.
- [ ] Chunk 6 - Schedule expansion logic.
  - Pure function that expands a `WeeklySchedule` into `HoursEntry[]` for a given month/year.
  - Skips weekends/weekdays with 0 hours; covers every applicable day in the month.
  - Fully unit-tested in isolation.
- [ ] Chunk 7 - Content script autofill implementation.
  - Map SAP My Timesheet form fields and implement `AUTOFILL_ENTRIES` message handler in `src/content/content-script.ts`.
- [ ] Chunk 8 - Popup apply action.
  - Add an "Apply" button per schedule that expands it for the current month and sends entries to the content script.
- [ ] Chunk 9 - Final polish.
  - Validation feedback, disable apply when SAP page is not ready, and UX cleanup.

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

### i18n
- [ ] Support both Dutch and English in the extension UI.
- [ ] Bundle user-facing text in language-specific localization files.
  - Keep localization structure extensible for additional languages later.
- [ ] Add a language selection menu in the popup.
  - Selection options are represented by country flag emojis.
  - Persist the selected language in local storage.

## Notes
- Keep message contracts typed in `src/shared/types.ts`.
- Keep storage helpers in `src/shared/storage.ts` when implementing cache behavior.

