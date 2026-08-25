# Popup Test Refactor Audit (Chunk 1)

This audit maps current popup test coverage to module-owned unit tests and identifies cross-module tests that must be preserved for the separate integration-test feature.

## Mapping Table

| Existing test file | Current scope | Classification | Target during unit-test refactor |
| --- | --- | --- | --- |
| `popup.snapshot-render.test.ts` | `popup-render.ts` render output + format helpers | Unit | Merge into new `popup-render.test.ts` |
| `popup.lock-state.test.ts` | lock-state rendering + apply/add button state | Mostly unit (render/model), with popup wiring | Move render/model assertions to `popup-render.test.ts` and `popup-model.test.ts`; keep wiring-only cases in integration holding file if needed |
| `popup.schedule-form.test.ts` | form open/edit/save flow across render + actions + storage | Mixed | Split into `popup-render.test.ts` (DOM/form render), `popup-actions.test.ts` (submit/save orchestration) |
| `popup.schedule-delete.test.ts` | delete UI + confirm/cancel + storage delete | Mixed | Split into `popup-render.test.ts` (UI states) and `popup-actions.test.ts` (delete orchestration) |
| `popup.schedule-apply.test.ts` | apply orchestration across actions + schedule-apply + render + gateway | Mixed, integration-heavy | Move action-owned orchestration to `popup-actions.test.ts`; park cross-module resilience flows in integration holding file |
| `popup.status-cache.test.ts` | status cache storage lifecycle + dismiss UI + restore on refresh | Mixed, integration-heavy | Move gateway/storage assertions to `popup-gateway.test.ts`; move pure render assertions to `popup-render.test.ts`; park restore lifecycle flow in integration holding file |
| `popup.core.test.ts` | bootstrap/init lifecycle, cache bootstrap, busy/ready transitions, status restore, schedule rendering | Integration | Keep out of module-unit scope; use as source for integration candidates only |
| `schedule-apply.test.ts` | `schedule-apply.ts` only | Unit | Keep as-is |
| `ui5-scripting.test.ts` | `ui5-scripting.ts` only | Unit | Keep as-is |
| `ui5-main-world.test.ts` | `ui5-main-world.ts` only | Unit | Keep as-is |

## Module Ownership Targets

- `popup-model.test.ts`
  - state creation and derived selectors from `popup-model.ts`
- `popup-dom.test.ts`
  - DOM accessor/query helpers from `popup-dom.ts`
- `popup-render.test.ts`
  - snapshot rendering, schedule list rendering, status/lock/button visual state from `popup-render.ts`
- `popup-actions.test.ts`
  - refresh/apply/save/delete/dismiss orchestration from `popup-actions.ts`
- `popup-gateway.test.ts`
  - tab/runtime/storage boundary calls from `popup-gateway.ts`

## Load-bearing Cross-module Tests (Preserve for separate integration feature)

These tests are not part of the module-unit refactor and must be preserved in a holding file (planned: `popup.integration.test.ts`) if they cannot be represented as single-module unit tests without losing behavior coverage.

1. Status restore lifecycle after refresh/loading transitions (from `popup.status-cache.test.ts`): validates real popup lifecycle sequencing, temporary status transitions, and persisted status restoration.
2. Apply flow resilience when one schedule navigation fails but remaining schedules continue (from `popup.schedule-apply.test.ts`): validates multi-schedule loop behavior across actions + apply orchestration + status rendering.
3. Apply flow skip-navigation branch when already on target project page (from `popup.schedule-apply.test.ts`): validates cross-module route-state + apply execution interplay.
4. Bootstrap cache/ready-state lifecycle assertions in `popup.core.test.ts` that depend on assembled-popup wiring rather than a single module.

## Redundant vs Load-bearing Decision Notes

- Redundant after module split (safe to remove once equivalent module tests exist):
  - duplicated render assertions that only verify static DOM text/visibility and do not depend on popup bootstrap sequencing.
  - duplicated button enabled/disabled assertions already covered via direct `popup-render.ts` unit tests.
- Load-bearing (must preserve until integration feature evaluates them):
  - assertions that require `popup.ts` bootstrap wiring, multi-module state propagation, or lifecycle ordering across async operations.

## Popup Integration Tests Feature - Chunk 1 Evaluation (2026-08-25)

Coverage review baseline: refactor Chunk 9 (`npm run test:coverage`) showed `popup.ts` at 61.19%, indicating remaining orchestration/lifecycle behavior beyond per-module unit scope.

| Candidate from `popup.integration.test.ts` | Decision | Why |
| --- | --- | --- |
| Status restore lifecycle after refresh/loading transitions | Load-bearing | Requires assembled-popup bootstrap wiring and lifecycle sequencing (persisted status -> temporary loading state -> restored status) across actions, storage, and rendering. |
| Apply flow resilience when one schedule navigation fails | Load-bearing | Requires real multi-schedule apply loop behavior with partial failure accumulation and final status composition across actions + apply orchestration + rendering. |
| Apply flow skip-navigation when already on target project | Load-bearing | Requires end-to-end route-state detection + apply execution interplay with popup state and rendered status output. |
| Bootstrap cache/ready-state lifecycle placeholder | Redundant for now | No concrete test case remains in the holding file; keep as future optional scope only if new regressions appear. |

Decision: keep `popup.integration.test.ts` and proceed with *Popup integration tests* Chunk 2.

## Next Refactor Driver

Use this file as the migration checklist for Chunks 2-7:

1. create module-level test files,
2. migrate unit-owned assertions first,
3. move unresolved cross-module cases to `popup.integration.test.ts` with a placeholder header,
4. remove legacy bucketed files only after coverage parity is confirmed.

