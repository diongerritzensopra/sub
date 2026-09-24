# git-commit-instructions.md

## Assistant-Authored Commit Rules

**Use these rules only when you create a commit for agent- or assistant-generated changes.**

### Scope

- Wait for explicit user confirmation before creating the commit.
- These rules apply only to commits you create for agent- or assistant-generated changes.
- These rules do not apply to pre-existing commits, GitHub-created merge commits, or script-created release commits.

### Required Commit Message Format

- Use exactly 3 message sections, in this order:
  1. Subject: `[AI] <short imperative summary>`
  2. `Prompt summary: <imperative summary of the request>`
  3. `Step executed: <past-tense summary of the concrete changes made>`
- Use the literal labels `Prompt summary:` and `Step executed:`.
- Keep the subject short and imperative.
- Write `Prompt summary:` in imperative form.
- Write `Step executed:` in past tense.
- Use only simple quotes and avoid backticks in commit messages.

## Commit Command Usage

- Use one separate `-m` flag per message section so Git preserves the intended 3-part structure.
- Pass the `-m` flags in this order: subject, `Prompt summary:` section, `Step executed:` section.
- Example: `git commit -m '[AI] Commit message header' -m 'Prompt summary: Summarize the requested change.' -m 'Step executed: Summarized the concrete changes that were made.'`
