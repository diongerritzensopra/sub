# Feature specification: Project schedules

**GitHub issue:** [#26](https://github.com/diongerritzensopra/sub/issues/26)

## Problem and context

Entering planned project hours day by day each month is repetitive. Users need to save weekly hour patterns by project code and apply them to the currently opened month.

## Goals

- Let users create, edit, reuse, and delete weekly schedules per project code.
- Apply planned hours across the current month through the extension popup.
- Preserve explicit zero-hour days so existing SAP values can be reset.

## Non-goals

- Applying schedules to projects that are not present in the current SAP snapshot.
- Requiring users to enter hours manually for each date during application.

## User stories

- `As an extension user, I want to save planned hours for each weekday and project, so that I can reuse my weekly pattern.`
- `As an extension user, I want to apply a saved schedule to the open month, so that I do not enter hours day by day.`
- `As an extension user, I want to select which schedules to apply, so that I can control the projects updated.`

## Functional requirements

- Each project schedule must define planned hours for Monday through Sunday and be stored for reuse.
- Users must be able to create, edit, and delete schedules in the popup.
- The form must offer project codes available in the current SAP snapshot.
- A schedule must expand to entries for every applicable date in the selected month, preserving configured zero-hour days.
- Applying a schedule must target the currently opened month and use the extension flow without manual day-by-day entry.
- The target project must be present in the current snapshot's project codes before the apply flow proceeds.
- Applying a schedule must navigate to its project page when needed and submit entries through SAP UI5 access.
- Users must explicitly select one or more schedules before applying; only selected schedules are applied.
- Apply status must persist across popup close/reopen, expire after 30 minutes, and be dismissible.
- When SAP indicates the timesheet is locked, apply must be disabled and a lock message shown, while refresh and schedule management remain usable.

## Expected behavior and flows

1. The popup loads the saved schedules and displays an empty state if none exist.
2. The user creates or edits a schedule by selecting a project code from the snapshot and entering planned hours for each weekday, then saves it.
3. The user selects one or more saved schedules and activates apply.
4. Before applying, the extension verifies that each target project is available and navigates to the project's SAP timesheet page when necessary.
5. The extension expands the weekly schedule across the open month and submits the entries, including explicit zero-hour days.
6. The popup displays and persists the apply result; the message can be dismissed and expires after 30 minutes.

## Edge cases

- If the target project code is missing from the current snapshot, that schedule must not be applied to an invalid target.
- If the timesheet is locked, only the apply flow is disabled; refresh and schedule management remain available.
- If the popup is reopened before the status expires, the last apply/error status is restored; an expired status is not shown as current.
- If a schedule has zero planned hours for a weekday, matching dates remain part of the apply data to reset existing SAP values.

## Acceptance criteria

- `Given no saved schedules, when the popup opens, then it shows an empty schedule state.`
- `Given a project code is present in the snapshot, when the user saves a weekly schedule, then the schedule is stored and appears in the list with weekday hours.`
- `Given a saved schedule, when the user edits or deletes it, then the stored schedule and list reflect that change.`
- `Given one or more schedules are selected and their project codes are present in the snapshot, when the user applies them, then only the selected schedules are expanded over the currently opened month and submitted.`
- `Given a target project is absent from the current snapshot, when its schedule is applied, then the extension does not proceed against that project.`
- `Given a schedule specifies zero hours on a weekday, when the schedule is expanded, then each matching date is included with zero hours.`
- `Given the timesheet is locked, when the popup renders, then apply is disabled and a lock message is shown while refresh and schedule management remain usable.`
- `Given an apply or error status is saved, when the popup is reopened within 30 minutes, then the status is restored and can be dismissed; after expiry it is not restored as current.`

## Constraints and dependencies

- Project availability is determined from the current SAP snapshot's project codes.
- Applying entries depends on SAP's UI5 `projectsmodel` and `postTimeSheet` API.
- A locked SAP timesheet must not be modified by the apply flow.

## Open questions

None.
