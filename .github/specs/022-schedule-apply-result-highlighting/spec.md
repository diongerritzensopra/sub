# Feature specification: Schedule apply result highlighting

**GitHub issue:** [#22: Display schedule apply result in-page](https://github.com/diongerritzensopra/sub/issues/22)

## Problem and context

The popup's textual apply summary does not make it easy to see whether the timesheet month is complete. Although the SAP page shows updated hour fields, those changes are not very noticeable.

## Goals

- Make successful and failed schedule updates easy to identify on the timesheet page.
- Keep the page highlights consistent with the apply result shown in the popup.

## Non-goals

- Replacing the apply summary in the popup.
- Changing schedule submission behavior or how apply results are determined.

## User stories

- `As an extension user, I want updated timesheet fields highlighted by their apply result, so that I can quickly see which dates succeeded or failed.`

## Functional requirements

- After a schedule apply attempt, the timesheet page must highlight the hour-entry field for each schedule date according to that date's result in the popup summary.
- A field whose date succeeded in the popup summary must be highlighted in green.
- A field whose date failed to update in the popup summary must be highlighted in red.
- The date and success or failure status of each highlighted field must match the corresponding entry in the popup's apply summary.
- A non-color visual cue, such as a success or warning marker, must also distinguish successful and failed fields.
- Highlights must remain visible until another schedule is applied or the timesheet page is reloaded.
- Fields not included in the apply result must not be highlighted.
- The apply flow must remain on the timesheet page after submitting the schedule so users can see the highlights.

## Expected behavior and flows

1. The user applies a schedule through the extension popup.
2. The popup displays the apply summary for the schedule.
3. The timesheet page highlights the hour-entry field for each schedule date in green if the popup summary reports success or red if it reports failure.
4. The user reviews the page; the highlights remain until another schedule is applied or the page is reloaded.

## Edge cases

- If an apply has mixed results, each date's hour-entry field must show the status for that date in the popup summary.
- If the apply attempt produces no affected date fields, the page must not highlight unrelated fields; the popup summary remains available.
- When another schedule is applied, its results replace the previous highlights.
- Reloading the timesheet page clears the highlights.

## Acceptance criteria

- `Given an applied schedule with successful dates, when the result is displayed, then the corresponding hour-entry fields are highlighted in green.`
- `Given an applied schedule with failed dates, when the result is displayed, then the corresponding hour-entry fields are highlighted in red.`
- `Given an apply result is shown in both the popup and timesheet page, when their dates and statuses are compared, then they match.`
- `Given a schedule has been applied, when the user reviews the timesheet page, then the highlights remain until another schedule is applied or the page is reloaded.`
- `Given another schedule is applied or the timesheet page is reloaded, when the page is displayed, then the prior highlights are replaced by the new result or cleared, respectively.`
- `Given the page displays success and failure highlights, when a user distinguishes their status, then a non-color visual cue is available alongside the colors.`

## Constraints and dependencies

- This feature depends on issue [#21](https://github.com/diongerritzensopra/sub/issues/21), which prevents the apply flow from navigating away after schedule application.
- The popup's apply summary remains available and must agree with the page highlights.

## Open questions

None.
