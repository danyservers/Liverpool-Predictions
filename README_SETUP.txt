# Prediction League v34 - Away scoring fix

SAFE TO UPGRADE FROM:
- v33 safe date + away flag

UPLOAD THESE FILES FROM CHANGED_FILES:
- app.js
- style.css
- index.html
- service-worker.js

DATABASE CHANGES:
- None

FIRESTORE RULE CHANGES:
- None

WHAT CHANGED:
- Fixed Liverpool away-match exact score logic.
- Away matches now support both internal Liverpool-first scoring and displayed opponent-first result order.
- History and Round Summary now swap both team names and score numbers for away matches.
- Made the (A) checkbox more compact.
- Kept prediction save/reveal/backup logic untouched.

IMPORTANT TEST:
1. Create Liverpool match vs Arsenal with (A) checked.
2. Predict Liverpool 3-1 Arsenal and choose a scorer.
3. Reveal with actual Liverpool 3-1 Arsenal.
4. You should get exact score points + scorer points.
5. History should display Arsenal 1-3 Liverpool.
