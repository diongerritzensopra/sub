# Feature specification: Popup unit test refactoring

**GitHub issue:** [#9](https://github.com/diongerritzensopra/sub/issues/9)

## Problem and context

Popup tests grouped by feature currently exercise the assembled popup rather than isolating individual modules. This makes it harder for maintainers to identify which module a failure concerns and to test module behavior independently.

## Goals

- Give each popup module a dedicated unit test suite.
- Preserve the existing functional test coverage while separating unit and integration concerns.
- Keep shared test helpers relevant to the resulting module-level tests.

## Non-goals

- Replacing or removing load-bearing integration coverage; assembled-popup integration tests are handled separately.
- Changing popup runtime behavior.

## User stories

- `As a maintainer, I want popup modules tested independently, so that failures identify the behavior and module that need attention.`
- `As a maintainer, I want existing functional coverage preserved, so that refactoring the tests does not reduce regression protection.`

## Functional requirements

- Dedicated unit test files must exercise `popup-actions`, `popup-dom`, `popup-gateway`, `popup-model`, and `popup-render`.
- Each unit test file must import and exercise its target module, mocking dependencies across module boundaries as needed.
- Existing coverage for initialization, lock state, schedule apply/delete/form, snapshot rendering, and status caching must be retained.
- Cross-module cases needed to maintain coverage must be identified and preserved for a separate integration-test suite rather than discarded.
- Shared helpers must be retained only where relevant to the resulting tests.
- The refactoring must not change product behavior.

## Expected behavior and flows

1. A maintainer runs the popup unit tests for an individual module.
2. The selected tests exercise that module directly and mock dependent modules or external boundaries as needed.
3. Cross-module scenarios remain available as integration coverage.
4. The complete test suite continues to cover the existing popup behaviors after tests are reorganized.

## Edge cases

- A test that depends on multiple popup modules must not be incorrectly treated as a unit test or silently dropped if it is load-bearing.
- Removing redundant helpers or legacy test files must not remove the only coverage for an existing behavior.

## Acceptance criteria

- `Given a popup module, when its dedicated unit test file runs, then it exercises that module without bootstrapping the assembled popup.`
- `Given an existing popup behavior was covered before refactoring, when the refactor is complete, then that behavior remains covered by a unit or integration test.`
- `Given a load-bearing test crosses module boundaries, when tests are reorganized, then it remains in integration coverage.`
- `Given the full test suite runs after refactoring, then no popup runtime behavior has been changed by the test-only work.`

## Constraints and dependencies

- The feature concerns popup test structure and coverage, not user-visible runtime behavior.
- Integration tests must be maintained separately from module-level unit tests.

## Open questions

None.
