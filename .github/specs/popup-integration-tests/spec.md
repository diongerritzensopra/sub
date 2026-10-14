# Feature specification: Popup integration tests

## Problem and context

Module-level popup unit tests cannot verify that the assembled popup's modules work together across realistic flows. Load-bearing cross-module behaviors need integration coverage with internal popup modules wired together.

## Goals

- Verify important assembled-popup flows across module boundaries.
- Preserve load-bearing cases identified during the popup unit test refactoring.
- Keep integration tests focused on observable popup behavior rather than internal implementation details.

## Non-goals

- Replacing module-level unit tests.
- Mocking internal popup modules in these assembled-popup tests.

## User stories

- `As a maintainer, I want assembled-popup flows covered by integration tests, so that regressions in module wiring are detected.`

## Functional requirements

- Integration tests must exercise the assembled popup without mocking internal popup modules.
- Tests may mock external boundaries such as storage, Chrome APIs, and scripting wrappers.
- Coverage must include status restoration, apply-flow resilience to partial navigation failure, and skipping navigation when already on the target project.
- Coverage must include popup event wiring for status dismissal, adding a schedule, cancelling a form, and submitting a schedule form.
- Coverage must include URL matching for timesheet tabs, cached status restoration for invalid/expired/fresh timestamps, and form-opening error paths when no snapshot is loaded.
- Coverage must include automatically analyzing the active tab when SAP reports that it is ready.

## Expected behavior and flows

1. The integration test environment loads the assembled popup and substitutes mocks only at external boundaries.
2. A test drives a user action or external event through the popup's public interaction surface.
3. The assembled modules respond together, producing the expected visible state or external-boundary call.
4. Failures in wiring or end-to-end popup behavior are detected without duplicating behavior already adequately covered at module level.

## Edge cases

- If navigation fails for one target during an apply flow, the popup must retain meaningful status and continue handling other eligible work as expected.
- If the active SAP page is already on the selected target project, the popup must not perform unnecessary navigation.
- If no snapshot is loaded when a form action requires one, the popup must handle the condition as an error rather than proceeding.
- Cached status messages with invalid or expired timestamps must not be restored as current messages.

## Acceptance criteria

- `Given a status message was saved, when the assembled popup is reopened, then valid status is restored and invalid or expired status is not shown as current.`
- `Given navigation to one selected target fails, when the apply flow continues, then the popup reports the failure and handles remaining eligible targets.`
- `Given the active page is already on the selected project, when the user applies its schedule, then no redundant navigation is requested.`
- `Given the user dismisses status, adds a schedule, cancels a form, or submits a form, when the corresponding control is activated, then the assembled popup performs the expected action.`
- `Given SAP reports that it is ready, when the popup receives the busy-state change, then active-tab analysis is triggered.`
- `Given an action requiring a snapshot is requested without one, when the popup handles the action, then it presents the expected error behavior and does not proceed with incomplete data.`

## Constraints and dependencies

- Only external boundaries may be mocked; popup modules must remain wired together.
- The test suite depends on the popup DOM and its external browser/storage/scripting boundaries.

## Open questions

None.
