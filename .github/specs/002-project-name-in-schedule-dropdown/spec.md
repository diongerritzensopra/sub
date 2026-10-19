# Feature specification: Project names in the schedule dropdown

**GitHub issue:** [#2: Project name not visible in dropdown](https://github.com/diongerritzensopra/sub/issues/2)

## Problem and context

When adding or editing a schedule, the project dropdown shows project codes while the SAP timesheet shows project names. Users have difficulty identifying which project code corresponds to the project they want to select.

## Goals

- Help users identify the correct project when creating or editing a schedule.
- Keep the project code visible so projects with similar or identical names remain distinguishable.

## Non-goals

- Changing how schedules are created, stored, or applied.
- Changing the general-hours selector; this feature applies only to the project selector in project schedules.

## User stories

- `As an extension user, I want to see each project's name and code in the schedule dropdown, so that I can select the intended project confidently.`

## Functional requirements

- In the project schedule form, each available project option must display the project name followed by its code in square brackets, for example `Project name [ABC123]`.
- The format must be used when adding and editing a project schedule.
- The selected schedule target must continue to be identified by its project code.
- If a project name is missing, empty, or whitespace-only, its option must display the project code so that it remains identifiable.
- The project code must remain visible even when project names are duplicated.

## Expected behavior and flows

1. The user opens the form to add or edit a project schedule.
2. The project dropdown shows each available project as `Project name [project code]`.
3. The user selects the intended project and saves the schedule.
4. The schedule remains associated with the selected project code.

## Edge cases

- If two projects have the same name, their different codes must distinguish the options.
- If a project name is missing, empty, or whitespace-only, the dropdown must show its code without an empty name placeholder.

## Acceptance criteria

- `Given a project has a name and code, when the user opens the project dropdown, then its option displays the name followed by the code in square brackets.`
- `Given the user adds or edits a project schedule, when they select a project, then the schedule target is associated with that project's code.`
- `Given two projects have the same name, when the dropdown is displayed, then their codes make the options distinguishable.`
- `Given a project name is missing, empty, or whitespace-only, when the dropdown is displayed, then its code is still shown as the option label.`

## Constraints and dependencies

- Project names and codes must be available from the current SAP project data.

## Open questions

None.
