# sub

`sub` stands for **snel uren boeken**: a Chromium browser extension for supporting hour booking in **SAP My Timesheet**.

## Goal

- Support faster hour booking in SAP My Timesheet by streamlining analysis, schedule management, and autofill workflows.

## Current scope

- Popup for analyzing the active SAP My Timesheet page and managing saved schedules.
- UI5-based snapshot reading and autofill that run in the SAP page's MAIN world.
- Content script and MV3 service worker that monitor SAP page readiness and keep the extension state in sync.

## Feature roadmap

- See `FEATURES.md` for the current roadmap and feature status.

## Target URL

- Full URL:
  - `https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site#timesheet-my?sap-ui-app-id-hint=saas_approuter_mytimesheet`
- In `manifest.json`, only the host/path can be matched (no `#fragment`), so this pattern is used:
  - `https://p10mq7ma.launchpad.cfapps.eu10.hana.ondemand.com/site*`

## Development workflow

- Install dependencies with `npm install`.
- Use `npm run dev` for CRXJS/Vite development mode while testing changes in Chrome.
- Use `npm run build` when you want a static `dist/` folder to load in Chrome.
- Run `npm test` for the unit test suite.
- Use `npm run test:watch` when you want Vitest to rerun tests as you edit files.

## Manual testing in Chrome

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Choose **Load unpacked**
5. Select the `dist/` folder

For dev-mode only:

6. Run `npm run dev` and keep the dev server running while you test changes in Chrome

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
