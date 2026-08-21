# Teammate 2: Frontend Guide

## Your Mission
Build user interface components that help county disaster teams, local administrators, and small business owners understand flood risks and act quickly.

## Files You Own
- `apps/console/src/components/SmePreparednessCard.tsx`
- `apps/console/src/components/WardList.tsx`
- `apps/console/src/components/DetailPanel.tsx`

## Your Bite-Sized TODOs
Open `apps/console/src/components/SmePreparednessCard.tsx`:
1. **TODO 1:** Connect the checklist checkboxes to state so users can tick off tasks (e.g. "Elevate grain bags 1m off ground").
2. **TODO 2:** Test the "Copy SMS Broadcast" button to make sure it copies the SMS text cleanly to the clipboard.
3. **TODO 3:** In `apps/console/src/app/page.tsx`, import and place `<SmePreparednessCard ward={selectedWard} />` at the bottom of the `DetailPanel` view.

## How to Test Your Work
```bash
cd apps/console
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Click on Nyando Ward on the map to see the detail panel and your new SME preparedness card!
