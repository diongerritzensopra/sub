# Feature specification: Agent workflow enhancement

**GitHub issue:** [#23: Agent workflow enhancement](https://github.com/diongerritzensopra/sub/issues/23)

## Problem and context

Feature work with Copilot can be more consistent and easier to review when roles, expected outputs, and checkpoints are explicit. The project needs guided workflows for defining, planning, and implementing features, informed by the AI Native training example.

## Goals

- Guide Copilot through a consistent feature lifecycle from requirements to implementation.
- Separate analysis, technical planning, and implementation responsibilities.
- Preserve user review and verification checkpoints throughout the workflow.

## Non-goals

- Building a general-purpose agent framework for unrelated repositories.
- Allowing Copilot to proceed through all stages without user review or approval.

## User stories

- `As a maintainer, I want Copilot to follow a structured feature workflow, so that feature work is more consistent and its outcomes are easier to review.`

## Functional requirements

- Provide distinct Analyst, Lead Developer, and Developer roles for feature specification, implementation planning, and implementation.
- Provide guided workflows for creating a feature specification, creating an implementation plan, and implementing that plan.
- The specification workflow must clarify ambiguous requirements, require a corresponding GitHub issue, create an issue-linked specification, and review the result against its template.
- The planning workflow must use the feature specification and relevant project context to create a medium- or large-feature plan with an architecture overview, milestones, and validation approach.
- The planning workflow must review the plan against its template and ask the user to review it before implementation proceeds.
- The implementation workflow must follow the approved plan one milestone at a time, track progress, and verify that each milestone is complete before reporting it as done.
- The implementation workflow must ask the user before continuing to another milestone and ask for clarification before making necessary deviations from the plan.
- Agent and workflow instructions must be consistent with the repository's Copilot instructions, architecture, and development conventions.
- Provide templates for feature specifications and medium and large implementation plans.

## Expected behavior and flows

1. The user describes a feature and works with the Analyst to clarify requirements and produce an issue-linked specification.
2. The user hands the specification to the Lead Developer, who researches the project and produces a plan using the appropriate template.
3. The user reviews the plan and chooses whether to proceed with implementation.
4. The Developer implements the approved plan one milestone at a time, recording progress and verifying each milestone.
5. A reviewer checks milestone completion. The user decides whether the workflow proceeds to the next milestone.

## Edge cases

- If feature requirements are unclear, the Analyst asks the user targeted questions before finalizing the specification.
- If a corresponding GitHub issue cannot be verified or created, the specification workflow asks the user to provide or create one rather than saving an unlinked spec.
- If the feature's size is unclear, the Lead Developer asks the user whether it is medium or large before selecting a plan template.
- If implementation requires deviating from the approved plan, the Developer asks the user for clarification before proceeding.
- If milestone verification identifies incomplete work, the Developer addresses the gaps and verifies the milestone again before reporting it complete.

## Acceptance criteria

- `Given a user describes a feature, when the specification workflow completes, then it produces an issue-linked spec that follows the spec template and has been reviewed.`
- `Given a feature spec is ready for planning, when the planning workflow completes, then it produces a medium- or large-feature plan with an architecture overview, milestones, and validation steps.`
- `Given a plan has been generated, when implementation is proposed, then the user can review the plan before implementation begins.`
- `Given an approved plan has multiple milestones, when the Developer begins implementation, then it works on and verifies one milestone at a time.`
- `Given a milestone implementation is complete, when verification identifies gaps, then the Developer addresses them and verifies the milestone again before reporting it complete.`
- `Given a milestone is complete and verified, when the workflow is ready to continue, then the user is asked before work proceeds to the next milestone.`
- `Given implementation requires an unplanned deviation, when the deviation is identified, then the Developer asks the user before proceeding.`
- `Given a workflow is used in this repository, when it produces instructions or artifacts, then they follow the repository's Copilot guidance and applicable templates.`

## Constraints and dependencies

- The workflows depend on the repository's issue-linked specifications, plan templates, and Copilot instructions.
- The AI Native training example is an inspiration source; the workflow must reflect this repository's needs and conventions.

## Open questions

None.
