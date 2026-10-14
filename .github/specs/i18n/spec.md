# Feature specification: i18n

## Problem and context

The extension currently presents its user-facing interface in Dutch. Users who prefer English need the popup and its messages to be available in English as well.

## Goals

- Provide Dutch and English text throughout the extension UI.
- Let users select a language in the popup and retain that choice.
- Keep localization organized so additional languages can be added later.

## Non-goals

- Supporting languages other than Dutch and English in this feature.

## User stories

- `As an extension user, I want to use the popup in Dutch or English, so that I can understand its controls and messages.`
- `As an extension user, I want my language choice to be remembered, so that the popup keeps using my preferred language.`

## Functional requirements

- The popup must offer Dutch and English choices, represented by 🇳🇱 and 🇬🇧.
- Dutch must be selected when no language preference has been saved.
- The selected language must be persisted in local storage.
- All user-facing popup text, including labels, buttons, statuses, and errors, must use the selected language.
- Changing the language must update the open popup without requiring it to be reopened.
- Localization messages must be organized by language and support adding further languages.

## Expected behavior and flows

1. When the popup opens, it loads the saved language preference; if none exists, it uses Dutch.
2. The popup renders its controls and messages in the selected language and shows the corresponding flag option.
3. When the user selects another language, the choice is saved and the open popup updates its user-facing text.
4. If a localized message is unavailable, the localization system uses its defined fallback behavior rather than displaying an undefined value.

## Edge cases

- If no preference is stored, Dutch is used.
- If a stored preference is invalid or a message is missing, the UI must use the localization fallback instead of failing to render.

## Acceptance criteria

- `Given no saved language preference, when the popup opens, then its user-facing text is in Dutch.`
- `Given Dutch is selected, when the user selects 🇬🇧 English, then the English preference is persisted and the open popup updates to English.`
- `Given English is saved, when the popup is reopened, then it renders in English.`
- `Given a requested message has no translation, when the message is retrieved, then the defined fallback is returned.`

## Constraints and dependencies

- Language preferences are stored in browser local storage.
- Supported languages for this feature are Dutch and English.

## Open questions

None.
