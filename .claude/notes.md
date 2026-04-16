# Dev Notes & Decisions

## Architecture decisions

### Why settings.ts uses raw fs instead of electron-store
Overlay position uses `electron-store` (for its simple key/value API), but main app settings use a hand-rolled JSON file with `fs`. This was an intentional split: settings needed deep-merge and per-field validation logic that electron-store doesn't provide cleanly. The validation step in `settings.ts` means unknown keys from older versions are silently dropped and defaults fill gaps — safe across upgrades.

### Why two separate BrowserWindows
The overlay and the settings panel are separate windows rather than a single window with routed views. This lets the overlay be frameless/transparent/always-on-top while the settings window uses native vibrancy and a normal window chrome. Routing is hash-based (`/` = overlay, `/#/settings` = settings) with the same Vite dev server serving both.

### Why the WPM formula is chars/5 over actual elapsed time
Standard WPM definition. CPM/5 = WPM. The rolling window is 10 seconds (`ROLLING_WINDOW_MS = 10000`). Elapsed time is measured as `newest_keystroke - oldest_keystroke` within that window, not wall clock — this avoids inflating WPM for sparse typing at window boundaries.

### Inactivity detection is in two places on purpose
`keyboardTracker.ts` clears the keystroke buffer when `now - lastKeypressTime > inactivityTimeout` (hard reset). The renderer's `animate()` loop additionally applies an exponential decay (`* 0.92`) after `IDLE_THRESHOLD_MS = 3000ms` for a smooth visual fade. These are independent — the backend resets the data, the frontend smooths the display.

### safeSend() guard wrapper
All main→renderer sends go through `safeSend()` which checks `win !== null`, `!win.isDestroyed()`, and `!win.webContents.isDestroyed()`. This was added after crash reports from rapid show/hide cycling that destroyed windows mid-broadcast.

---

## Things tried that didn't work

### Using electron-store for all settings
Tried early on. The nested structure and per-field type coercion made it awkward — electron-store validates top-level keys only. Switched to raw JSON with a hand-written `validateSettings()` function.

### Showing WPM in tray title with ANSI colors
The color codes in `getMenuBarWpm()` using `\x1b[31m` etc. do not render as colors in the macOS menu bar — the title is plain text. This code is vestigial and has no visual effect. The tray title just shows the number.

### vite-plugin-electron renderer process loading
Initially the settings window was opened as a separate HTML file. Switched to hash routing on the same dev server URL to simplify hot-reloading in dev and avoid needing two entry points.

---

## Known gotchas

### uiohook-napi requires Accessibility permissions
On macOS, the app needs Accessibility access (System Settings → Privacy & Security → Accessibility) for `uiohook-napi` to capture keystrokes globally. Without it, the hook starts silently but no events fire.

### electron-builder not tested since v0.1.0
The `dist` and `release` scripts in `package.json` exist but haven't been run since early development. There may be issues with `uiohook-napi` native binaries needing `@electron/rebuild` during the build.

### wpmCalculator.ts is dead code
`src/main/wpmCalculator.ts` exports `createWPMCalculator` but is never imported anywhere. The WPM calculation was consolidated into `keyboardTracker.ts`. Safe to delete.

### getContextMenu scope bug
`getContextMenu` is defined inside `createTray()` as a local function. It's referenced from outside that function in two `ipcMain` handlers. This will throw `ReferenceError: getContextMenu is not defined` at runtime if the global shortcut is changed via settings or if "Reset All Settings" is used. Fix: hoist it to module scope.

### Opacity is stored as 0.0–1.0 in settings but sent as 0–100 from renderer
`setOpacity` in the renderer sends a 0–100 integer. The main handler normalizes it with `opacity / 100` before storing. Don't double-normalize.
