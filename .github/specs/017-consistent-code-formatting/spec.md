# Feature specification: Consistent code formatting

**GitHub issue:** [#17: Use Prettier for consistent code formatting](https://github.com/diongerritzensopra/sub/issues/17)

## Problem and context

Generated and edited code can have inconsistent indentation, spacing, and line lengths. This creates avoidable cleanup and makes changes harder to review.

## Goals

- Apply consistent formatting to code changes and generated code.
- Make formatting a routine part of the development workflow.

## Non-goals

- Automatically sorting imports or reordering function and variable declarations; these remain separate code organization conventions.
- Enforcing semantic code quality or lint rules beyond formatting.

## User stories

- `As a maintainer, I want changed and generated code to follow the project's formatting rules, so that reviews focus on behavior rather than inconsistent style.`

## Functional requirements

- The project must use Prettier with a shared configuration for supported files.
- The project must provide `npm run format` to format the repository and `npm run format:check` to check whether files follow the configured format.
- Copilot instructions must require formatting every file it creates or edits after making code changes or generating code.
- Formatting must use the shared project configuration.

## Expected behavior and flows

1. A developer or Copilot creates or edits code.
2. Prettier formats each created or edited supported file using the project configuration.
3. The developer can run the project formatting check to identify files that do not conform.

## Edge cases

- If a changed file type is not supported by Prettier, the formatting workflow must not claim that the file was formatted.

## Acceptance criteria

- `Given a supported file has inconsistent indentation, spacing, or line wrapping, when Prettier formats it, then it follows the shared project configuration.`
- `Given a file has not been formatted, when the project formatting check runs, then it reports the file as not conforming.`
- `Given Copilot creates or edits a supported file, when the change is complete, then the file has been formatted with Prettier.`

## Constraints and dependencies

- The formatter depends on the project's shared Prettier configuration.
- Formatting behavior applies only to file types supported by Prettier.

## Open questions

None.
