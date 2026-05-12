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

## Manual testing in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Choose **Load unpacked**
4. Select the `dist/` folder

## TODO
- Map the real SAP My Timesheet selectors in `src/content/content-script.ts` for actual scraping/autofill.
