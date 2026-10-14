# Feature specification: Versioning, packaging and distribution

**GitHub issue:** [#25](https://github.com/diongerritzensopra/sub/issues/25)

## Problem and context

Preparing a distributable extension requires a consistent version across project metadata and a packaged build. A single release command reduces manual steps and ties the artifact to a tagged commit.

## Goals

- Bump the extension version and create a distributable zip with one command.
- Keep the manifest as the version source of truth and synchronize package metadata.
- Prevent releases from starting in an unsuitable Git state.

## Non-goals

- Including the build zip in the release commit.
- Repackaging an existing version; the existing package command remains available for that purpose.

## User stories

- `As a maintainer, I want one release command to version and package the extension, so that release artifacts and metadata stay consistent.`
- `As a maintainer, I want release preconditions checked before changes are made, so that releases are not created from an unsuitable branch or dirty worktree.`

## Functional requirements

- `manifest.json` must be the version source of truth; `package.json` and `package-lock.json` must be synchronized.
- With no version option, the command must increment the minor version and reset patch to zero.
- `--patch` must increment only the patch version; `--major` must increment major and reset minor and patch to zero.
- A literal `x.y.z` version may be supplied and must be validated.
- Before versioning or building, the command must require a clean worktree, the `main` branch, and a `HEAD` without an existing version tag.
- The command must run unit tests and build the extension, aborting if either fails.
- On success, the three version files must be committed with `[release] v<version>` and a `v<version>` tag must be created on that commit.
- The distributable must be `sub-extension-v<version>.zip`, containing the build output, and must not be included in the release commit.
- The existing package command must remain available for packaging without a version bump.

## Expected behavior and flows

1. The maintainer invokes the release command with no option, a bump flag, or a literal semantic version.
2. The command checks the branch, worktree, and current commit tag state before changing versions or building.
3. The command resolves and validates the target version, runs the unit tests, and builds the extension.
4. If tests or the build fail, the command stops with an error and does not perform the release commit and tagging steps.
5. If validation succeeds, the command updates version metadata, commits it, tags the commit, and creates the versioned zip artifact.

## Edge cases

- A dirty worktree, a branch other than `main`, or a version tag already on `HEAD` must stop the release before versioning or building.
- A malformed explicit version must be rejected.
- A test or build failure must abort release completion.
- The output artifact must not be added to the version commit.

## Acceptance criteria

- `Given a clean worktree on main with no version tag on HEAD, when the command is run without a version option, then the minor version is incremented, patch is reset to zero, and a versioned zip is produced.`
- `Given the same valid preconditions, when --patch or --major is supplied, then the specified version component is incremented and lower components are reset as defined.`
- `Given a valid literal x.y.z version, when it is supplied, then all three version files are updated to that version.`
- `Given a dirty worktree, a non-main branch, or an existing version tag on HEAD, when the command is invoked, then it aborts before versioning or building.`
- `Given tests or the build fail, when the release command runs, then it aborts without completing the release commit and tag.`
- `Given a successful release, when the resulting commit and artifact are inspected, then the three version files are committed and tagged, and the zip is excluded from the commit.`

## Constraints and dependencies

- The release command requires Git, the project's test runner, and the extension build tool.
- The release command is intended to run from the `main` branch with a clean working tree.

## Open questions

None.
