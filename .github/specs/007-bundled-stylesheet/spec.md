# Feature specification: Bundled stylesheet

**GitHub issue:** [#7: Add bundled stylesheet](https://github.com/diongerritzensopra/sub/issues/7)

## Problem and context

The SAP My Timesheet decluttering stylesheet by @Caster is currently applied through a separate browser extension, such as Stylus. Users must install and maintain an additional extension to enhance their timesheet experience.

## Goals

- Let users apply the hosted stylesheet through `sub` without installing a separate extension.
- Keep the stylesheet reasonably current by retrieving updates from its existing source.
- Preserve a simple opt-in control and handle source outages without disrupting SAP My Timesheet.

## Non-goals

- Supporting arbitrary user stylesheets or editing stylesheet contents in `sub`.
- Applying the stylesheet to SAP pages other than My Timesheet.
- Automatically checking for stylesheet updates more than once every 24 hours.

## User stories

- `As an extension user, I want to enable the My Timesheet stylesheet in sub, so that I do not need a separate styling extension.`
- `As an extension user, I want the stylesheet to update automatically, so that I can receive improvements from its existing source.`

## Functional requirements

- The popup must provide an opt-in toggle for the stylesheet, disabled by default, and retain the user's preference.
- The stylesheet must be applied only to SAP My Timesheet pages.
- When the user changes the toggle while a matching page is open, the stylesheet must be applied or removed immediately without requiring a page reload.
- The stylesheet must be retrieved from [the My Timesheet Declutter style on Userstyles.world](https://userstyles.world/style/11567/my-timesheet-declutter).
- When the stylesheet is enabled and a matching page is open, the extension must apply a cached copy immediately, then check for an update if at least 24 hours have passed since the previous attempt.
- If no cached stylesheet exists, the extension must attempt an initial retrieval immediately. A failed attempt counts toward the 24-hour limit for automatic retries.
- An automatic update check must not occur more than once every 24 hours, whether the previous attempt succeeded or failed.
- The popup must provide a manual retry control beside the stylesheet warning. A user-initiated retry may bypass the automatic 24-hour limit, and it resets the limit for the next automatic check.
- The extension must retain the last successfully retrieved stylesheet and apply it when available, including when the source cannot be reached.
- A response counts as a successful update only if it provides usable stylesheet content. Empty, unsuccessful, or non-stylesheet responses must not replace the cached version or clear a warning.
- A successfully retrieved update must replace the cached version and be applied to any currently open matching page.
- If an update check fails, the popup must show a non-blocking warning beside the stylesheet toggle and a manual retry control. It must not use the existing general status-message section.
- If retrieval fails and no cached stylesheet exists, the SAP page must remain usable without the stylesheet, and the warning must be shown beside the toggle.
- A successful update check must clear the stylesheet warning.
- While the stylesheet is disabled, its warning and retry control must be hidden. If the user re-enables it before a successful check clears the warning, they must be shown again.

## Expected behavior and flows

1. The stylesheet toggle is off by default. The user enables it in the popup.
2. When a SAP My Timesheet page is open, the extension applies a cached stylesheet immediately if one is available.
3. If the cached stylesheet is absent or an update check is due, the extension retrieves the hosted stylesheet. A successful response is cached and applied.
4. If automatic retrieval fails, the extension continues using the last successful copy when available and shows a warning and Retry control beside the toggle. Without a cached copy, the page remains unstyled but usable.
5. The user may select Retry to make an immediate update attempt, even if the automatic update interval has not elapsed.
6. If the user disables the toggle while a matching page is open, the stylesheet is removed immediately and the warning and Retry control are hidden.
7. When the user later enables the toggle, the cached copy is applied if available, and a due update check is performed.

## Edge cases

- If Userstyles.world is unavailable but a cached copy exists, the cached copy remains applied and the user sees a non-blocking warning beside the toggle.
- If Userstyles.world is unavailable and no cached copy exists, the stylesheet is not applied, SAP My Timesheet remains usable, and the user sees the warning.
- If the user disables the stylesheet, it is removed from the currently open matching page and no update check is performed while disabled.
- If the source returns an unsuccessful response or content that is not usable stylesheet content, it must not replace the last successfully cached stylesheet or clear the warning.
- If a manual retry fails, the warning remains visible while the stylesheet is enabled, and the next automatic attempt is not made until the 24-hour interval has elapsed.

## Acceptance criteria

- `Given a user has not enabled the stylesheet, when a SAP My Timesheet page opens, then the stylesheet is not applied.`
- `Given the user enables the stylesheet, when a matching SAP page is open, then the stylesheet is applied without requiring a page reload.`
- `Given the stylesheet is enabled and a cached copy exists, when the source is unavailable, then the cached copy remains applied and a warning appears beside the toggle.`
- `Given the stylesheet is enabled and no cached copy exists, when the source is unavailable, then the page remains usable without the stylesheet and a warning appears beside the toggle.`
- `Given the source returns a successful stylesheet update, when the update is applied, then the cached copy and any currently open matching page use the new stylesheet.`
- `Given the user disables the stylesheet while a matching page is open, when the toggle changes, then the stylesheet is removed immediately.`
- `Given an update check fails, when the popup shows a warning, then the warning and Retry control appear beside the stylesheet toggle and not in the general status-message section.`
- `Given an update check succeeds, when the popup is displayed, then the stylesheet warning is cleared.`
- `Given an automatic update check has been attempted, when another automatic check is due, then at least 24 hours have elapsed, including after a failed attempt.`
- `Given the user selects Retry, when the automatic update interval has not elapsed, then the extension attempts an update immediately and resets the interval for the next automatic check.`
- `Given a response is empty, unsuccessful, or not usable stylesheet content, when the extension processes it, then the cached copy is retained and the warning is not cleared.`
- `Given the user disables the stylesheet, when the popup is displayed, then the warning and Retry control are hidden.`

## Constraints and dependencies

- The stylesheet depends on the availability of the Userstyles.world source for updates.
- Use of the stylesheet must follow its author's applicable attribution and licensing terms.

## Open questions

None.
