# WPM Tracker — Claude Code Context

## Project

A macOS menu-bar WPM tracker built with Electron. It hooks system-wide keyboard events, calculates typing speed in real time, and displays a floating overlay widget. No visible dock icon — lives entirely in the system tray.

**Version:** 0.1.2  
**Platform:** macOS only (uses `uiohook-napi`, `vibrancy`, tray template images)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 28 |
| Renderer | React 18 + TypeScript + Tailwind CSS |
| Build | Vite 5 + `vite-plugin-electron` |
| Keyboard hook | `uiohook-napi` (native, system-wide) |
| Settings persistence | Custom JSON file via `fs` in `app.getPath('userData')` |
| Overlay position | `electron-store` (`window-position` store) |
| Icons | `lucide-react` |
| Color picker | `react-colorful` |

---

## Architecture

```
src/
├── main/
│   ├── index.ts          — app lifecycle, BrowserWindow management, tray, IPC handlers
│   ├── keyboardTracker.ts — uiohook-napi setup, WPM calculation (10s rolling window)
│   ├── wpmCalculator.ts  — UNUSED. Dead code. WPM math lives in keyboardTracker.ts
│   └── settings.ts       — load/save/validate settings JSON from userData
├── preload/
│   └── index.ts          — contextBridge, exposes `window.electronAPI`, defines types
└── renderer/
    ├── index.html
    └── src/
        ├── main.tsx       — React entry, hash-router (/ = overlay, #/settings = settings, #/stats = stats)
        ├── App.tsx        — Overlay widget component (WPM number + color animation)
        ├── Settings.tsx   — Settings window (5 tabs: General, Appearance, Behaviour, Tracking, Advanced)
        ├── Stats.tsx      — Stats window (This Session / Lifetime toggle, hero stat, grid cards)
        └── index.css      — Tailwind + custom frosted-glass styles
```

Three separate Electron windows:
- **Overlay** (`/`) — frameless, transparent, always-on-top, draggable, 145×100px (medium) or 180×110px (large)
- **Settings** (`/#/settings`) — 780×560px, `vibrancy: sidebar`, frameless with inset title bar
- **Stats** (`/#/stats`) — 480×460px, `vibrancy: sidebar`, frameless with inset title bar

---

## IPC Pattern

All renderer→main communication goes through `window.electronAPI` (contextBridge). Never use `ipcRenderer` directly in renderer code.

**Fire-and-forget (ipcMain.on / ipcRenderer.send):**
- `set-launch-at-login`
- `set-show-menu-bar-wpm`
- `set-show-overlay`
- `set-smart-colouring`
- `set-lock-overlay-to-desktop`
- `set-wpm-text-size`
- `set-color-ranges`
- `reset-all-settings`

**Request/response (ipcMain.handle / ipcRenderer.invoke):**
- `set-opacity` → void
- `set-blur` → void
- `set-global-shortcut` → `boolean` (success)
- `get-global-shortcut` → `string`
- `get-color-ranges` → `ColorRanges`
- `get-session-stats` → `{ wpm, accuracy, totalKeystrokes, backspaces }` (mock — accuracy/backspaces always 0)

**Main→renderer push:**
- `wpm:update` → `WPMStats` (broadcast every 100ms via `safeSend`)

### Rules
1. **Never break the contextBridge.** If you add a new IPC channel, you must add it in all four places: `main/index.ts` handler, `preload/index.ts` implementation, `preload/index.ts` `ElectronAPI` interface, and `src/renderer/src/types/electron.d.ts` `ElectronAPI` interface.
2. **Always update the `ElectronAPI` interface** in both `preload/index.ts` and `types/electron.d.ts` when adding new channels — TypeScript will not catch a missing type at runtime.
3. **Test in dev (`npm run dev`) before suggesting build changes.** The build pipeline (`npm run dist`) has not been verified in recent development.
4. Use `safeSend()` for all main→renderer sends — it guards against destroyed windows.

---

## Known IPC Bugs / Mismatches

| Issue | Location | Notes |
|---|---|---|
| `getContextMenu` called outside its scope | `main/index.ts` | `getContextMenu` is a closure inside `createTray()`. Calling it from `ipcMain.handle('set-global-shortcut')` and `ipcMain.on('reset-all-settings')` is a `ReferenceError` at runtime. |

---

## What's Working

- System-wide keyboard hook (`uiohook-napi`)
- Keystroke filtering — keycode whitelist (a–z, 0–9, space, punctuation) so only real typing increments WPM
- WPM calculation — 10s rolling window, configurable min keystrokes, inactivity timeout
- Overlay widget with smooth animated WPM display + idle decay
- Smart colouring (4 tiers: <60 red, 60–90 yellow, 90–120 green, 120+ blue)
- Customizable color ranges per tier
- Overlay opacity control
- Blur/vibrancy effect on overlay (`vibrancy: 'under-window'`, set at BrowserWindow construction time, `visualEffectState: 'active'`)
- WPM text size toggle (medium/large) — also resizes the window
- Draggable overlay with position persistence (electron-store)
- Always-on-top, visible on all workspaces including fullscreen
- Global shortcut (default `Alt+Shift+W`) to show/hide overlay
- Tray icon with context menu (Show/Hide, Settings, Stats, Quit)
- Optional WPM in menu bar (animated tray title)
- Launch at login
- Lock overlay to desktop (disable visible-on-all-workspaces)
- Settings persistence (JSON in userData with deep merge + validation)
- Reset all settings
- **Stats window** — opens from tray, 480×460px, vibrancy sidebar; This Session / Lifetime toggle with smooth fade transition; hero stat (Peak WPM); grid cards (Accuracy, Avg WPM, Keys, Time Typed); Reset Session button

## What's NOT Working / Unwired

| Feature | Status |
|---|---|
| Behaviour tab IPC | UI-only. `inactivityTimeout` and `minKeystrokes` update React state but are never sent to main. Changes are lost on reload. |
| Tracking tab toggles | UI-only. `trackAccuracy` and `trackRawWpm` have no IPC handlers. The settings keys exist in `settings.ts` but are never read. |
| Advanced tab debug mode | UI-only. `debugMode` has no effect — no IPC, no handler. |
| Stats logic | `get-session-stats` returns live `wpm` + `charCount` from `getWPM()` but accuracy, peak WPM, avg WPM, backspaces, and time typed are all placeholder `0` / `"00:00"`. No tracking in `keyboardTracker.ts` yet. |
| Lifetime stats | No persistence. All lifetime values in Stats window are `0` / `"00:00"` placeholders. |
| Session persistence / stats DB | No stats are persisted anywhere. `stats.db` is configured for MCP but the app doesn't write to it. |
| `wpmCalculator.ts` | Entire file is dead code — never imported. |

---

## File Structure (full)

```
electron-app/
├── .claude/
│   ├── CLAUDE.md
│   ├── notes.md
│   ├── project-state.json
│   └── settings.local.json    ← Claude Code permissions (do not edit manually)
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── keyboardTracker.ts
│   │   ├── wpmCalculator.ts   ← dead code
│   │   └── settings.ts
│   ├── preload/
│   │   └── index.ts
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── Settings.tsx
│           ├── Stats.tsx
│           ├── main.tsx
│           ├── index.css
│           └── types/
├── public/
│   └── trayTemplate.png
├── dist/                      ← Vite renderer output
├── dist-electron/             ← Vite electron output
├── release/                   ← electron-builder output
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── tsconfig.node.json
```
