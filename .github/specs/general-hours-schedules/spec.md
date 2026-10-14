# Feature specification: General hours schedules

## Problem and context

Users need to reuse weekly hour patterns for SAP general-hours timesheets as well as project timesheets. General-hours entries use distinct SAP identifiers and labels and cannot be treated as project targets.

## Goals

- Let users create, edit, and manage weekly schedules targeting SAP general hours.
- Let users apply a saved general-hours schedule to the currently opened month.
- Preserve the existing schedule expansion behavior, including explicit zero-hour days.

## Non-goals

- Changing the SAP data model or schedule behavior for project targets.

## User stories

- `As an extension user, I want to save a weekly schedule for general hours, so that I can reuse my planned time entries.`
- `As an extension user, I want to apply a saved general-hours schedule to the open month, so that I do not enter each day manually.`

## Functional requirements

- General-hours options must be obtained from SAP's `oGeneralHours` data.
- The schedule form must let users choose between a project target and a general-hours target.
- Saved schedules must clearly identify the target type and label.
- General-hours schedules must be creatable, editable, and manageable in the same popup schedule flow as project schedules.
- Applying a general-hours schedule must target the currently opened month and use the general-hours-specific SAP identifiers and labels.
- Schedule expansion must cover each applicable date in the month and preserve explicitly configured zero-hour days.
- If required general-hours data is absent or empty, the extension must surface an error rather than continuing with incomplete data.

## Expected behavior and flows

1. The popup obtains the available general-hours options from the current SAP timesheet data.
2. The user opens the schedule form, chooses a general-hours target, and enters planned hours for each weekday.
3. The user saves the schedule; it appears in the schedule list with its type and label and can later be edited.
4. The user applies the saved schedule to the open month; the extension navigates to the relevant SAP timesheet route and submits the expanded entries using the general-hours target metadata.
5. Explicit zero-hour entries are included so existing SAP values for those dates can be reset.

## Edge cases

- If the SAP model has no general-hours options, the extension must show an error and must not proceed as if the data were complete.
- A mixed selection of project and general-hours schedules must apply each schedule using the correct target metadata.
- A missing or invalid target must produce an error instead of posting entries to the wrong target.

## Acceptance criteria

- `Given SAP provides general-hours options, when the user opens the schedule form, then those options are available as general-hours targets.`
- `Given the user saves a general-hours schedule, when the schedule list renders, then its target type and label are clear and it can be edited.`
- `Given a general-hours schedule is applied, when the current month is processed, then entries cover that month and use the selected general-hours identifiers.`
- `Given a schedule contains a zero-hour weekday, when it is expanded for a month, then matching dates are included with zero hours.`
- `Given the SAP model's general-hours options are missing or empty, when snapshot data is read, then an error is surfaced and application does not continue.`
- `Given project and general-hours schedules are selected together, when they are applied, then each uses its own target type and metadata.`

## Constraints and dependencies

- SAP general-hours options are supplied by `SapProjectsModelData.oGeneralHours`.
- The SAP general-hours data shape and identifiers differ from project data and must be handled accordingly.

## Open questions

None.
