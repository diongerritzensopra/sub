# sub

`sub` stands for **snel uren boeken**: a Chromium browser extension for supporting hour booking in **SAP My Timesheet**.

## Goal
- Analyze and fill in hours more quickly from the SAP My Timesheet page.

## Current scope
- Popup to analyze the active SAP page.
- Content script with the initial scraping/autofill structure.
- MV3 service worker as the lifecycle entry point.

## Feature roadmap
- Planned and completed features are tracked in `FEATURES.md`.

## Target URL
- Full URL:
  - `https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet`
- In `manifest.json`, only the host/path can be matched (no `#fragment`), so this pattern is used:
  - `https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site*`

## Development workflow
```bash
npm install
npm run dev
npm run build
npm test
```

## Release workflow
- `npm run release` runs the release automation for `sub`.
- Before doing anything, the release script requires:
  - a clean git working tree,
  - the `main` branch to be checked out,
  - no existing version tag on the current commit.
- The script runs unit tests and a production build before updating version files.
- On success it updates `manifest.json`, `package.json`, and `package-lock.json`, creates a `[release] v<version>` commit, tags that commit as `v<version>`, and produces a distributable zip.

Examples:

```bash
# Default minor bump
npm run release

# Patch bump
npm run release -- --patch

# Major bump
npm run release -- --major

# Explicit version
npm run release -- 1.2.3
```

## Manual testing in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Choose **Load unpacked**
4. Select the `dist/` folder

## TODO
- Map the real SAP My Timesheet selectors in `src/content/content-script.ts` for actual scraping/autofill.
