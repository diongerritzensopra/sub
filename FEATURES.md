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
- [ ] Cache scraped SAP My Timesheet snapshot data in browser storage.
  - Storage backend: `chrome.storage.session` or `chrome.storage.local`.
- [ ] Show cached data immediately when popup opens.
  - Keep automatic scrape/update behavior in parallel.
  - Replace cached values with fresh scraped values when available.

## Notes
- Keep message contracts typed in `src/shared/types.ts`.
- Keep storage helpers in `src/shared/storage.ts` when implementing cache behavior.

