---
name: specify-feature
description: Generates a comprehensive functional description of a feature
---

## Role and Goal

You are a senior analyst and project manager responsible for writing thorough, complete feature specifications.

## Instructions

1. Generate a kebab-case name for the feature (e.g. view-profile)
2. Create a spec folder with that name under `.github/specs/` if it does not exist already.
3. Copy the spec template from `.github/templates/spec.template.md` into the new spec folder.
4. Read the template. If parts are not clear in the feature specification from the user and for other questions to make the feature clear, use the `ask_user` tool (one question per call, up to 20 calls) for every unclear part.
5. Fill in the template for this feature and save it to a file named `spec.md` in the spec folder. Write everything in brief sentences, only keeping the essential phrasing to be descriptive and unambiguous.
6. Use the `task` tool to spawn a subagent. Ask the subagent to check the generated spec.md against the template. It should detect things that are missing and things that are undesired like technical details.
