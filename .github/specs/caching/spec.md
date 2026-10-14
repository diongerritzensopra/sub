# Feature specification: Caching

**GitHub issue:** [#24](https://github.com/diongerritzensopra/sub/issues/24)

## Problem and context

Reading the SAP timesheet can take time, especially while the SAP page is loading. Showing the most recent usable snapshot immediately makes the popup responsive while fresh data is retrieved.

## Goals

- Cache scraped SAP My Timesheet snapshot data in browser storage.
- Show cached data immediately when the popup opens.
- Continue automatic scraping and replace cached values when fresh data is available.

## Non-goals

- Treating stale cached data as fresh data.
- Replacing the automatic SAP scrape with cache-only behavior.

## User stories

- `As an extension user, I want to see the last available timesheet snapshot immediately, so that I can use the popup while SAP is loading.`
- `As an extension user, I want fresh SAP data to replace cached values automatically, so that the popup reflects the current timesheet when available.`

## Functional requirements

- Successfully scraped snapshot data must be written to browser storage.
- The popup must render a valid cached snapshot immediately on open.
- Automatic scraping must continue in parallel with display of cached data.
- Fresh successful scrape results must replace the cached snapshot and update the popup.
- Cache validity must be checked against the applicable timesheet period; stale cache data must be handled as stale rather than presented as current.
- The popup must distinguish cached data from fresh data.

## Expected behavior and flows

1. When the popup opens, it reads the cached snapshot and displays it immediately if valid.
2. In parallel, the extension checks SAP readiness and performs its normal scrape/update behavior.
3. When a fresh scrape succeeds, the extension stores the new snapshot and replaces the displayed cached values.
4. While SAP is loading, cached values remain visible with an indication that they are cached.
5. If cached data is stale for the current period, the popup handles it as stale and continues seeking fresh data.

## Edge cases

- With no cached snapshot, the popup proceeds with its normal loading and scrape behavior.
- If the cache belongs to a different timesheet period, it must not be presented as current-period data.
- If scraping does not yet succeed because SAP is loading, the cached snapshot remains visible when available.

## Acceptance criteria

- `Given a valid cached snapshot exists, when the popup opens, then the snapshot is displayed before a fresh scrape completes and is identified as cached.`
- `Given a cached snapshot is displayed, when a fresh scrape succeeds, then fresh values replace the displayed values and are saved to storage.`
- `Given SAP is still loading, when the popup is open, then available cached data remains visible while automatic scrape/update behavior continues.`
- `Given there is no cached snapshot, when the popup opens, then normal loading and scrape behavior proceeds without a cached display.`
- `Given cached data belongs to a different timesheet period, when the popup validates the cache, then it is treated as stale rather than shown as current-period data.`

## Constraints and dependencies

- Snapshot caching uses browser extension storage (`chrome.storage.session` or `chrome.storage.local`).
- Fresh data depends on the SAP My Timesheet scrape succeeding.

## Open questions

None.
