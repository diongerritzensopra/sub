# FEATURES

Shared feature roadmap for `sub`.

## Planned

### Project schedules
- [ ] Allow users to configure a weekly schedule per project code.
  - Per weekday (Mon-Sun), user can define planned hours.
  - Schedule is stored and reusable.
- [ ] Allow users to apply a saved project schedule to the currently opened month.
  - Filling planned hours should target the whole month.
  - Action should work from the extension flow without manual day-by-day entry.

### Caching
#### Feature description
- [ ] Cache scraped SAP My Timesheet snapshot data in browser storage.
  - Storage backend: `chrome.storage.session` or `chrome.storage.local`.
- [ ] Show cached data immediately when popup opens.
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
- [ ] Chunk 5 - Busy/loading UX behavior.
  - Keep cached data visible while SAP page is still loading.
- [ ] Chunk 6 - Staleness/invalidation.
  - Add period-based validation and stale cache handling.
- [ ] Chunk 7 - Final polish.
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

