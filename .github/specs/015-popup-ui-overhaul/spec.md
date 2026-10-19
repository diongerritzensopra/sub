# Feature specification: Popup UI overhaul

**GitHub issue:** [#15: Popup UI overhaul](https://github.com/diongerritzensopra/sub/issues/15)

## Problem and context

The popup's single vertical stack makes its information and actions harder to scan in the limited space of a browser extension popup. Users need a clearer hierarchy while retaining existing capabilities.

## Goals

- Make the SAP snapshot, status messages, saved schedules, and schedule actions easy to find.
- Use a clear section structure and visual hierarchy suited to the popup's constrained size.
- Preserve existing functionality except for the explicitly updated apply-selection behavior.

## Non-goals

- Adding a dedicated SAP status badge.
- Using cards, shadows, or prominent borders to separate sections.

## User stories

- `As an extension user, I want the popup's information grouped clearly, so that I can quickly understand the timesheet state and available actions.`
- `As an extension user, I want each schedule to show its apply result, so that I can tell which schedule succeeded or failed.`

## Functional requirements

- The popup sections must appear in this order: header with title and refresh; snapshot summary; status and error messages; schedules list; schedule form when adding or editing.
- The snapshot summary must show the period, worked hours, and hours still to be performed, without a project list.
- The schedule form must only be shown while adding or editing a schedule.
- Applying schedules must require an explicit schedule selection; there must be no apply-all action.
- Each schedule row must show its own applying, success, or error result.
- Updated and failed dates must be presented in a readable, locale-aware format where relevant.
- When multiple schedules share a target, failed-date summaries must count distinct target dates.
- Loading, locked, cached, empty, and error states must remain understandable.
- Visual grouping must rely on spacing and subtle dividers, with refresh busy state and apply-button state serving as readiness indicators.

## Expected behavior and flows

1. The user opens the popup and sees the title and refresh action, followed by the snapshot summary and any status messages.
2. The user reviews saved schedules and their individual apply states.
3. To apply a schedule, the user explicitly selects one or more schedule rows and activates the apply button.
4. The selected rows show applying and then success or error results, including relevant updated or failed dates.
5. When the user adds or edits a schedule, the form appears below the schedules and is hidden when the form is not active.

## Edge cases

- Empty, cached, loading, locked, and error states must not obscure the popup's available local schedule-management controls.
- When multiple schedules target the same date, that date is counted once in the failed-date summary.
- If every relevant distinct date fails, the summary must accurately indicate that all applicable days failed.

## Acceptance criteria

- `Given the popup is open, when its main content renders, then sections appear in the specified order and the snapshot shows period, worked hours, and remaining hours.`
- `Given no schedule is selected, when the user views apply controls, then no apply-all action is available.`
- `Given one or more schedules are selected, when the user applies them, then only selected schedules are applied and each row shows its own result state.`
- `Given an add or edit operation is active, when the popup renders, then the schedule form is visible; otherwise it is hidden.`
- `Given multiple schedules share a target date, when failed dates are summarized, then the shared date contributes only once.`
- `Given the popup is loading, locked, cached, empty, or in an error state, when it renders, then state and available local controls remain clear.`

## Constraints and dependencies

- The interface must fit the browser extension popup's limited space.
- The existing refresh and schedule-management functionality must remain available.

## Open questions

None.
