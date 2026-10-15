# Feature specification: More flexible schedules

**GitHub issue:** [#8: More flexible schedules](https://github.com/diongerritzensopra/sub/issues/8)

## Problem and context

Schedules currently apply the same weekly hours throughout a month. Users also need patterns such as different hours on alternating Fridays or hours on a particular day or ordinal weekday each month. Adding these options must not make routine schedule entry more cumbersome than entering timesheets manually.

## Goals

- Support useful recurring patterns beyond the existing weekly hours grid.
- Keep the current weekly schedule form simple for users who do not need advanced rules.
- Make recurrence rules predictable when multiple rules affect the same date.

## Non-goals

- Replacing reusable schedules with a date-by-date timesheet editor.
- Adding a preview of generated schedule dates or hours.

## User stories

- `As an extension user, I want to define advanced recurring hours when needed, so that I can reuse patterns that do not repeat identically every week.`
- `As an extension user, I want the basic weekly schedule form to remain simple, so that routine schedules are still quick to create.`

## Functional requirements

- The existing weekly hours grid must remain the default schedule form and retain its current behavior when no advanced rules are used.
- Advanced recurrence controls must be optional and collapsed by default. They must show only the inputs relevant to the selected rule type.
- Users must be able to add and remove multiple advanced rules in a schedule.
- An every-other-weekday rule must let users select a weekday, odd or even ISO week numbers, and hours for matching weeks.
- On matching ISO weeks, an every-other-weekday rule's hours must replace that weekday's weekly-grid value. On non-matching weeks, the weekly-grid value must apply.
- A monthly date rule must let users select a day number from 1 to 31 or the last day of the month, and specify its hours.
- A monthly ordinal-weekday rule must let users select a weekday, its occurrence from first through fifth or the last occurrence, and its hours.
- Monthly rules must replace the weekly-grid value on matching dates.
- If a selected day number or ordinal weekday does not occur in a month, that rule must not produce an entry for that month.
- Advanced rules that match the same date and specify the same hours must be allowed and produce one schedule entry for that date.
- Before saving, the form must detect advanced rules that can match the same date with different hours, identify the conflicting rules, and show an example date.
- The form must prevent saving while a different-hour rule conflict remains unresolved.
- Recurrence rules must be available for both project and general-hours schedules.
- Existing explicit zero-hour behavior must be preserved for dates to which the weekly grid applies.

## Expected behavior and flows

1. The user creates or edits a schedule using the existing weekly hours grid.
2. If needed, the user expands the advanced recurrence section and adds one or more rules.
3. For an every-other-weekday rule, the user selects a weekday, odd or even ISO weeks, and hours. Those hours apply on matching weeks; the weekly-grid hours apply on the other weeks.
4. For a monthly rule, the user selects a day number or an ordinal weekday and enters its hours. The rule replaces the weekly-grid value when its date occurs.
5. The form reports conflicting advanced rules and prevents saving until the conflict is resolved.
6. The user saves the schedule and applies it through the existing schedule flow.

## Edge cases

- A day-number rule for the 29th, 30th, or 31st produces no entry in months without that date.
- An ordinal-weekday rule produces no entry in months without that occurrence, such as a fifth Monday in a month with only four Mondays.
- A last-day-of-month rule applies on the final calendar day of each month.
- A last-occurrence weekday rule applies on the final occurrence of its selected weekday in each month, whether it is the fourth or fifth occurrence.
- ISO week parity must remain consistent across month and year boundaries, including years with week 53.
- A weekday with a weekly-grid value of zero must still preserve existing zero-hour behavior on weeks not matched by its every-other-week rule.
- If advanced rules can match the same date with different hours, the form must identify the rules and an example date and prevent saving until the conflict is resolved.
- If advanced rules match the same date with the same hours, the overlap is allowed and produces one schedule entry.

## Acceptance criteria

- `Given a schedule with no advanced rules, when it is saved and applied, then the existing weekly behavior is unchanged.`
- `Given an every-other-weekday rule for a weekday, when the schedule is applied, then the rule's hours replace the weekly-grid value on the selected odd or even ISO weeks and the weekly-grid value applies on the other weeks.`
- `Given a monthly day-number rule, when its date occurs in the month, then the rule's hours replace the weekly-grid value for that date.`
- `Given a monthly date rule set to the last day of the month, when the schedule is applied, then its hours replace the weekly-grid value on the final calendar day.`
- `Given a monthly ordinal-weekday rule, when the selected occurrence exists in the month, then the rule's hours replace the weekly-grid value for that date.`
- `Given a monthly ordinal-weekday rule set to the last occurrence, when the schedule is applied, then its hours replace the weekly-grid value on the final occurrence of the selected weekday.`
- `Given a selected monthly date or ordinal weekday does not occur in a month, when the schedule is applied, then no entry is produced for that rule in that month.`
- `Given two advanced rules can match the same date with different hours, when the user attempts to save the schedule, then both rules and an example date are identified and saving is prevented.`
- `Given two advanced rules match the same date with the same hours, when the schedule is saved and applied, then the date is included once with that value.`
- `Given a user does not need advanced recurrence, when the schedule form opens, then the existing weekly grid remains the primary form and advanced controls are collapsed.`
- `Given a project or general-hours schedule uses advanced recurrence, when it is saved and applied, then the same recurrence behavior is supported.`

## Constraints and dependencies

- Advanced recurrence must preserve the existing schedule application behavior for project and general-hours targets.
- Weekly-grid values remain the baseline for dates not overridden by monthly rules or matching every-other-weekday rules.

## Open questions

None.
