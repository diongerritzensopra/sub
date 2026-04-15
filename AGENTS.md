# AGENTS.md

## Scope and Current State
- This repository is currently a minimal scaffold: `.gitignore`, `.idea/`, and `sub.iml` only.
- There are no application source files, package manifests, or test suites yet.
- Treat this as a bootstrap workspace; start each task by discovering what has been added since this file was written.

## Ground Truth Files to Check First
- `sub.iml`: IntelliJ module is `type="GENERAL_MODULE"` with `content url="file://$MODULE_DIR$"`.
- `.gitignore`: includes sections for `macOS`, `JetBrains`, and `Node` artifacts.
- `.git/config`: local git config only; no remotes are configured in this snapshot.

## Architecture Guidance (As-Found)
- No service boundaries or runtime architecture are defined yet.
- Default assumption: single-module project rooted at repository top-level.
- If new components appear, document boundaries in this file with concrete path examples.

## Developer Workflow (Discovery-First)
- Before editing, re-scan root files and detect newly added manifests (`package.json`, `pyproject.toml`, `pom.xml`, etc.).
- Choose commands from discovered tooling, not from generic defaults.
- If no build/test tooling exists, avoid inventing complex scaffolding unless explicitly requested.

## Conventions Inferred From Repo
- Keep OS/editor noise out of commits (matches `.gitignore` entries like `.DS_Store`, `.idea/`, `*.iml`).
- Node-related ignores (`node_modules/`, `dist/`, `.next`, `.nuxt`, `*.tsbuildinfo`) suggest JS/TS work is expected when code is added.
- JetBrains metadata is present; prefer project-root-relative paths that work in IntelliJ.

## Integration and Dependency Notes
- No external services, APIs, or package dependencies are declared yet.
- Treat all integration points as undefined until manifests/configs are added.
- When introducing an integration, add its setup/usage location to this file.

## Agent Operating Rules for This Repo
- Be explicit about what is confirmed vs. assumed from current files.
- When proposing structure, keep it minimal and aligned with discovered tooling.
- Update `AGENTS.md` whenever architecture, workflows, or conventions become concrete.
- Prefer evidence-backed instructions (path + observable pattern), not aspirational guidance.

