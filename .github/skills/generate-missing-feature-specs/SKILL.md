---
name: generate-missing-feature-specs
description: 'Creates template-based feature specifications for features listed in FEATURES.md that do not yet have a spec under .github/specs/.'
---

## Goal

Create a `spec.md` for each feature in `FEATURES.md` that is not yet represented in `.github/specs/`, without changing existing specs or the roadmap.

## Workflow

1. Read `FEATURES.md` and `.github/templates/spec.template.md`. Inspect the names and contents of existing entries under `.github/specs/`, if that directory exists.
2. Identify feature entries from the `###` headings under both `## Planned` and `## Completed`. Do not treat headings such as `Feature description` or `Implementation chunks`, chunk names, or nested checklist items as separate features.
3. For each feature, derive a stable kebab-case directory name from its heading: lowercase it, replace runs of non-alphanumeric characters with a single hyphen, and trim leading or trailing hyphens.
4. Compare the derived name with existing spec directory names. Treat a feature as already represented when a spec directory name normalizes to the same kebab-case name. Never overwrite an existing `spec.md`. If a matching directory has no `spec.md`, create the spec there; otherwise create a new feature directory under `.github/specs/`.
5. For every missing feature, use its `Feature description` as the primary source of user needs, goals, and behavior. Consult its implementation chunks only to clarify intended behavior or constraints. Translate implementation details into user-visible requirements where appropriate; do not turn internal file names, test tasks, or chunk sequencing into product requirements.
6. Fill every section of the spec template in brief, unambiguous language. Preserve meaningful scope, defaults, options, and behavior stated in the roadmap. Write `None` for non-goals, constraints and dependencies, or open questions only when none are known. Do not invent requirements. If a material user-facing decision cannot be inferred, ask the user one short question at a time; if an answer is not necessary to write a useful spec, record the unresolved issue under Open questions.
7. Create each missing spec at `.github/specs/<feature-name>/spec.md`. Keep existing content and unrelated files untouched.
8. Review every created spec against the template: ensure all sections are present, each acceptance criterion is observable, no roadmap behavior was omitted, and no unsupported assumptions or implementation plans were introduced.
9. Report which specs were created and which features were already represented. If there were no missing features, make no changes and report that.
