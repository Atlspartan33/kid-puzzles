# Puzzle Time (kid-puzzles)

Offline jigsaw PWA for Tori (≈7) and TJ (≈4). No build step, no dependencies.

- Run: `node server.mjs 5236` → http://localhost:5236 (launch entry `kid-puzzles`)
- Files: `index.html`, `styles.css`, `app.js` (gallery + puzzle engine), `audio.js` (synth SFX + speech), `store.js` (IndexedDB photos), `sw.js` (offline), `manifest.webmanifest`, `art/` (8 Book 4 pages, 1600px webp + 480px thumbs), `icons/`.

## How it plays
- **TJ**: 4 / 6 / 9 pieces, faint ghost picture + outlines on the board, very generous snap (0.85 × piece), number spoken on each snap, auto-hint after 20 s idle.
- **Tori**: 12 / 24 / 48 pieces, optional "Picture helper" ghost, tighter snap, "spread out" button.
- Every puzzle shows the whole picture first, then the pieces fly into the tray. Tray pieces are shrunk to fit and grow under the finger when picked up.
- Snap = pop + rising pentatonic note + bounce + sparkles + vibration. Finish = clean picture, confetti, fanfare, spoken "You did it, NAME!".
- Own pictures: "Add your picture" → Android photo picker/camera → cropped to a sane aspect, stored in IndexedDB on the device.

## Offline / install
The service worker only runs on **HTTPS or localhost**. Over LAN `http://192.168.x.x:5236` the tablet can play but can't install or work offline. Host it (GitHub Pages / Vercel) to install it as an app. Bump `VERSION` in `sw.js` when shipping changes.

Test hook: `window.__kp.pieces()` gives piece and target screen centers.
