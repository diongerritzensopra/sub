/**
 * Background service worker — MV3 lifecycle entry point.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[service-worker] sub installed.');
});
