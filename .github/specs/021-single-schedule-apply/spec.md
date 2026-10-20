# Feature specification: Single schedule application

**GitHub issue:** [#21: Only allow a single schedule to be applied at a time](https://github.com/diongerritzensopra/sub/issues/21)

## Problem and context

When multiple schedules are selected, users cannot easily tell the order in which they will be applied, and the combined result summary is difficult to interpret. Applying multiple schedules for the same project at once is uncommon. Restricting each apply action to one schedule removes that ambiguity and avoids automatically continuing to another project.

## Goals

- Allow users to apply one selected schedule per apply action.
- Make it clear which schedule is being applied and which result belongs to it.
- Apply the selection limit consistently to project and general-hours schedules.

## Non-goals

- Displaying the apply result directly on the SAP timesheet page; single-schedule application may enable this as a future improvement.
- Changing how schedules are created, edited, stored, or applied to their target month.

## User stories

- `As an extension user, I want to apply one schedule at a time, so that I know which schedule is being applied and can understand its result.`

## Functional requirements

- Users must be able to select at most one saved schedule at a time across all schedule types.
- Selecting a different schedule must replace the current selection.
- The apply action must be unavailable when no schedule is selected.
- Applying a schedule must submit only the selected schedule; other saved schedules must not be applied as part of the same action.
- The popup must show the apply result for the selected schedule only.
- The applied and failed dates in the apply result must be shown as ungrouped date lists rather than grouped by project.
- The applied-schedule result heading must use the singular text `Toegepast schema:`.
- The apply flow must not automatically continue to another schedule or project after processing the selected schedule.
- The existing target validation, month selection, and locked-timesheet behavior must remain in effect for the selected schedule.

## Expected behavior and flows

1. The popup displays saved project and general-hours schedules.
2. The user selects one schedule. If another schedule was selected, it becomes unselected.
3. The user applies the selected schedule.
4. The extension applies that schedule to its target using the existing flow and displays its result in the popup without aggregating outcomes from other schedules. The result lists applied and failed dates without project grouping and identifies the applied schedule with the singular heading `Toegepast schema:`.

## Edge cases

- If no schedule is selected, the user cannot start an apply action.
- If the user selects another schedule before applying, only the most recently selected schedule is applied.
- If the selected schedule cannot be applied because its target is unavailable or the timesheet is locked, existing validation and lock behavior must be preserved and no other schedule may be applied instead.

## Acceptance criteria

- `Given multiple saved schedules, when the user selects a schedule and then selects another, then only the second schedule is selected.`
- `Given no schedule is selected, when the popup displays its apply controls, then applying is unavailable.`
- `Given one schedule is selected, when the user applies it, then only that schedule is submitted and the popup shows its result.`
- `Given a schedule apply result contains applied or failed dates, when the popup displays the result, then dates are listed without project grouping and the applied-schedule heading reads "Toegepast schema:".`
- `Given project and general-hours schedules are both available, when the user selects one schedule, then no other schedule of either type is selected.`
- `Given a schedule has been applied, when its apply flow completes, then the extension does not automatically continue to another schedule or project.`
- `Given the selected schedule's target is unavailable or its timesheet is locked, when the user applies it, then existing validation or lock behavior is preserved and no other schedule is applied.`

## Constraints and dependencies

- The selected schedule's target must be available and its timesheet must be editable for it to be applied.
- Showing results directly on the SAP timesheet page is outside this feature.

## Open questions

None.
