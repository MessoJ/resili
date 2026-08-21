# Teammate 5: Mobile & Offline UX Guide

## Your Mission
Ensure resili functions reliably for community members using feature phones via USSD and county field officers working in low-bandwidth / offline conditions (+1 bonus point in rubric).

## Files You Own
- `apps/command-centre/public/sw.js` (Service Worker)
- `apps/command-centre/public/manifest.json` (PWA Manifest)
- `packages/ussd-core/src/index.ts` (Swahili USSD logic)

## Your Bite-Sized TODOs
1. **TODO 1:** In `apps/command-centre/public/sw.js`, ensure the offline fallback message returns proper JSON if both cache and network fail during a risk fetch.
2. **TODO 2:** In `packages/ussd-core/src/index.ts`, review the Swahili menu options to make sure instructions remain clear, respectful, and attribute KMD/NDMA.
3. **TODO 3:** In `apps/command-centre/src/app/layout.tsx`, verify that the service worker is registered on window load:
   ```ts
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('/sw.js');
   }
   ```

## How to Test Your Work
1. **Test USSD:**
   ```bash
   curl -X POST http://localhost:8080/api/v1/ussd -d "text="
   curl -X POST http://localhost:8080/api/v1/ussd -d "text=1"
   ```
2. **Test Offline Mode:**
   Open Chrome DevTools &rarr; Application &rarr; Service Workers &rarr; Check "Offline". Reload the page &mdash; the cached map and ward cards should still load reliably!
