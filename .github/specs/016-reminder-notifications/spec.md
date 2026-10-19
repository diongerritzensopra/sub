# Feature specification: Reminder notifications

**GitHub issue:** [#16: Reminder notifications](https://github.com/diongerritzensopra/sub/issues/16)

## Problem and context

Users may forget to submit their timesheet. A recurring reminder should notify them at a chosen weekly day and time, independently of which browser tab is active.

## Goals

- Let users enable a weekly reminder to submit their hours.
- Use Friday at 11:00 as the default schedule.
- Let users edit the reminder weekday and time.
- Provide a direct path from the notification to the SAP timesheet.

## Non-goals

- Guaranteeing reminders when the browser is closed. A browser-closed option is optional, must be disabled by default, and is only in scope if the extension runtime can trigger it reliably.

## User stories

- `As an extension user, I want a weekly reminder to submit my hours, so that I do not forget to complete my timesheet.`
- `As an extension user, I want to choose the reminder day and time, so that it fits my routine.`
- `As an extension user, I want to open the SAP timesheet from a reminder, so that I can act on it quickly.`

## Functional requirements

- Users must be able to enable and disable the weekly reminder.
- The default reminder schedule must be Friday at 11:00.
- Users must be able to choose the weekday and time.
- Reminder configuration, including enabled state and schedule, must persist.
- When due during normal browser use, a reminder notification must appear regardless of the active tab or page.
- Clicking the notification must open a new browser tab at the SAP timesheet application.
- A browser-closed reminder toggle may be provided only if reliably supported; if provided, it must default to disabled.

## Expected behavior and flows

1. The user opens reminder settings in the popup and sees whether reminders are enabled and the configured weekday and time.
2. The user enables reminders or changes the weekday or time and saves the settings.
3. The extension persists the settings and schedules future reminders accordingly.
4. At the configured weekly time while the browser is running, the extension displays a notification even if another tab or page is active.
5. When the user clicks the notification, a new tab opens to the SAP timesheet application.

## Edge cases

- With no saved configuration, reminders are disabled unless otherwise specified by the implementation; the schedule defaults to Friday at 11:00.
- Changing or disabling the reminder must not leave an obsolete reminder scheduled.
- If browser-closed triggering is unavailable or unreliable, the extension must not present it as a supported option.

## Acceptance criteria

- `Given no saved reminder configuration, when reminder settings are shown, then the default schedule is Friday at 11:00.`
- `Given reminders are enabled, when the user changes the weekday or time and saves, then the saved configuration is reflected in the next scheduled reminder.`
- `Given a reminder becomes due while the browser is open, when any page is active, then a notification is displayed.`
- `Given a reminder notification is displayed, when the user clicks it, then a new tab opens at the SAP timesheet application.`
- `Given browser-closed reminders cannot be triggered reliably, when the user views settings, then no browser-closed reminder option is offered.`

## Constraints and dependencies

- Reminder delivery depends on browser extension alarms/notifications and normal browser runtime availability.
- The browser-closed option is conditional on reliable runtime support and is disabled by default if offered.

## Open questions

None.
