# git-commit-instructions.md

## Commit Message Rules

**CRITICAL: Follow these rules consistently.**

- Wait for explicit user confirmation to commit each completed change.
- Prefix all commit messages for generated changes with `[AI]`.
- Include both a `Prompt summary` and a `Step executed` summary in the commit message body, in that order, separated by one blank line (paraphrasing is allowed when intent is preserved).
- Write the `Prompt summary` in imperative form.
- Write the `Step executed` in past tense, reflecting the concrete changes made in response to the prompt.
- Use only simple quotes and avoid backticks in commit messages to ensure terminal command compatibility.
- When committing with `git commit`, use a separate `-m` flag for each line of the commit message to preserve newlines between the prompt summary and step executed summary. Example: `git commit -m '[AI] Commit message header' -m 'Prompt summary' -m 'Step executed summary'`
