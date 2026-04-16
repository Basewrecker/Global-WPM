Execute the following 7-phase methodology for the task: $ARGUMENTS

---

## Phase 1: Plan

Read `AGENTS.md` in the project root. Then read the task description above carefully.

Build a structured todo list before touching any code:
- List every file that will be modified or created
- For each IPC change, list the channel name, direction (renderer→main or main→renderer), and type signature
- Assess complexity:
  - **Files affected**: how many, which layers (main / preload / renderer / types)
  - **Architectural impact**: does this add new IPC channels, new windows, new native module usage, or new persistent state?
  - **Risk level**: low (isolated renderer change), medium (IPC or settings), high (main process lifecycle, native modules, window management)

Do not write any code in this phase. Output the plan and wait if anything is ambiguous.

---

## Phase 2: Explore

Before referencing any method, type, interface, or channel — verify it exists.

Run targeted searches:
- Grep for every IPC channel name you plan to use in `src/main/index.ts` and `src/preload/index.ts`
- Grep for every type or interface you plan to extend in `src/preload/index.ts` and `src/renderer/src/types/electron.d.ts`
- Grep for every function you plan to call in the file where it is defined
- Grep for the `ElectronAPI` interface to confirm its current shape before adding to it
- If touching `keyboardTracker.ts` or `settings.ts`, read the relevant exported functions and types — do not assume their signatures

If anything you expected to find is missing or has a different signature than assumed, revise the plan from Phase 1 before continuing.

---

## Phase 3: Write Tests First

Write failing tests before implementing.

For this project:
- Unit-testable logic (WPM calculation, settings validation, key filtering) goes in `src/main/__tests__/`
- If no test runner is configured, note this explicitly and propose the minimal setup needed before writing tests

Tests must be mutation-resistant:
- Assert specific return values, not just that a function ran
- Assert side effects (e.g. that `updateSettings` was called with the correct payload, not just that it was called)
- For IPC handlers: test that the handler calls the right downstream function with the right arguments
- For renderer components: test that the correct `window.electronAPI.*` method is called with the correct value when an input changes

Run the tests and confirm they fail before moving to Phase 4. If tests pass before implementation, the test is wrong — fix it.

---

## Phase 4: Implement Minimum

Write only what is needed to make the failing tests pass.

Rules:
- Follow the existing IPC pattern exactly: fire-and-forget changes use `ipcMain.on` / `ipcRenderer.send`; request/response use `ipcMain.handle` / `ipcRenderer.invoke`
- Every new IPC channel must be added in all three places: `src/main/index.ts` handler, `src/preload/index.ts` bridge implementation, `src/preload/index.ts` `ElectronAPI` interface, and `src/renderer/src/types/electron.d.ts`
- Use `safeSend()` for all main→renderer pushes — never call `win.webContents.send()` directly
- Do not refactor surrounding code. Do not add comments to code you did not change. Do not add error handling for cases that cannot happen.
- If implementing a setting: persist it via `updateSettings()` in `src/main/settings.ts` — do not store ephemeral state in main process variables unless it is window state (position, opacity)

---

## Phase 5: Verify No Regressions

Run the full test suite, not just the new tests.

Also manually verify in dev (`npm run dev`):
- The overlay window still appears and displays WPM
- The settings window opens from the tray
- The global shortcut still toggles the overlay
- Any setting touched in this task persists correctly across a settings window close/reopen cycle
- The tray context menu still renders correctly

If any existing test fails, fix it before proceeding. Do not mark Phase 5 complete until the full suite is green.

---

## Phase 6: Document

While context is fresh, update:

1. **Inline comments** — only where the logic is non-obvious (e.g. why a particular inactivity threshold, why a specific Electron API is used over an alternative). Do not add comments that just restate what the code does.

2. **`.claude/notes.md`** — add an entry for:
   - Any architectural decision made (why this approach over alternatives considered)
   - Anything that was tried and didn't work
   - Any gotcha discovered that future sessions should know about

3. **`.claude/project-state.json`** — update:
   - Set the relevant `features` map entry to `true` if a feature is now complete
   - Remove fixed bugs from the `bugs` array
   - Update `nextPriorities` to reflect current state
   - Update `lastUpdated` to today's date

---

## Phase 7: Adversarial Review

Review your own implementation as an attacker. Work through each question systematically and report findings:

**General**
- What breaks if this code runs twice in quick succession?
- What happens if any value is `null`, `undefined`, or an empty string where a value is expected?
- What happens at the boundary values (min, max, zero, negative)?
- Is there any shared mutable state that could be corrupted by concurrent IPC messages?

**Electron-specific**
- `webContents` destroyed before send: does every main→renderer send go through `safeSend()`? Any direct `win.webContents.send()` calls that bypass the guard?
- IPC channel missing from preload: is the new channel present in all three locations (main handler, preload bridge, `ElectronAPI` interface in both `preload/index.ts` and `electron.d.ts`)?
- `BrowserWindow` lifecycle: does any handler reference `mainWindow` or `settingsWindow` without checking `.isDestroyed()` first?
- Native module failures: if `uiohook-napi` fails to start or emits an error, does the relevant code path handle it gracefully or crash the main process?
- Packaged build vs dev: does any code use `process.env.VITE_DEV_SERVER_URL` or `__dirname`-relative paths that would differ between `npm run dev` and a packaged `.app`? Does new code use `join(__dirname, ...)` correctly for both environments?
- Settings persistence: does the new setting survive `validateSettings()` in `src/main/settings.ts`? If not, it will be silently reset to the default on every launch.
- `getContextMenu` is module-scoped — if this task adds a new tray menu item, confirm it reads live state at call time and not a stale closure.

---

## Stop Here

Do not commit. Do not push. Do not run any `git` commands.

Present a structured report to the user:

1. **What changed** — files modified, IPC channels added, settings wired
2. **Tests** — what was tested and whether the suite is green
3. **Adversarial review findings** — list every issue found, with severity (blocking / warning / note). If nothing was found, say so explicitly.
4. **Recommended next steps** — what the user should manually verify or decide before this work is considered done

The user decides what happens next.
