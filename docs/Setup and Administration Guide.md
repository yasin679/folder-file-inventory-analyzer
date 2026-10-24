# Inventory Analyzer – Setup & Administration Guide

Version 1.2 · 24 Oct 2026 · Yasin Jariwala

Inventory Analyzer v1.2 runs entirely in the browser. On any Windows PC with Microsoft Edge, double-click **Start Inventory Analyzer.bat**. There is nothing to install, no server, and no admin rights are needed.

## Ways to run it

Use the desktop launcher for real work. Use the published link to demo or try it, and the developer build only to change the code.

| Mode | Best for | You need | Folder picker | Scan history | Downloads |
| --- | --- | --- | --- | --- | --- |
| Desktop launcher (`Start Inventory Analyzer.bat` + `Inventory Analyzer.html`) | Everyday use on a Windows PC | Microsoft Edge (built into Windows 10/11) | Yes | Yes | Yes |
| Published link on claude.ai | Demos, quick checks, sharing with colleagues | The link must be shared (Share → Anyone with the link); until then others see "Sign in to view this page" | May be blocked by the hosted page — use Upload a folder | Yes | Yes, after you confirm each save |
| Developer build (`npm run dev`) | Changing code, running tests | Node.js 18 or later | Yes | Yes | Yes |

All three run the same app and produce identical reports. Each keeps its own scan history.

## Install on a Windows PC

Setup takes about a minute and needs no admin rights.

1. Copy two files into any folder, e.g. `C:\Users\<you>\Tools\Inventory Analyzer\`:
    - `Start Inventory Analyzer.bat`
    - `Inventory Analyzer.html`
2. Double-click **Start Inventory Analyzer.bat**. The app opens in its own Microsoft Edge window.
3. Optional: right-click the .bat file → **Send to → Desktop (create shortcut)**. Rename the shortcut "Inventory Analyzer".
4. If Edge isn't available, the launcher opens the .html file in your default browser instead. You can also open the .html file directly in Chrome or Edge.
5. First run: choose **Try with sample data** to confirm the reports and Excel export work, then scan a real folder.

Keep the two files in the same folder. The launcher looks for `Inventory Analyzer.html` next to itself.

## Browser support

Chromium browsers (Edge, Chrome, Opera) support every feature. Firefox and Safari use the folder-upload mode, which can't see empty folders.

| Browser | Choose folder (picker) | Upload a folder | Empty-folder detection | Duplicate detection |
| --- | --- | --- | --- | --- |
| Microsoft Edge (Windows 10/11) | Yes | Yes | Yes (picker mode) | Yes |
| Google Chrome (desktop) | Yes | Yes | Yes (picker mode) | Yes |
| Firefox | No | Yes | No | Yes |
| Safari (macOS) | No | Yes | No | Yes |
| Mobile browsers | No | Varies | No | Varies |

The app checks the browser on the New Scan screen (**Browser capability check**) and disables any option it can't support.

## Data, privacy and local storage

The app sends no data anywhere and never changes your files. Folders are opened read-only.

| Data | Where it lives | How long | How to remove it |
| --- | --- | --- | --- |
| The open scan's file list and hashes (before it is saved) | Browser memory only | Until the tab or window closes | Close the window |
| Scan summaries, plus full results (file and folder names, paths, sizes, dates — never contents) for the newest 20 scans | Browser IndexedDB on this PC | Until cleared, or until the browser evicts site data | Scan History → **Clear all history**, or Settings → **Clear stored scan history** |
| Default scan options | Browser local storage on this PC | Until changed or browser data is cleared | Settings → **Restore defaults** |
| Exported reports (.xlsx, .csv, .zip) | Wherever you save them (default: Downloads) | Your choice | Delete the files |

- File contents are read only to compute SHA-256 hashes when duplicate detection is on. They are never stored.
- There is no telemetry, no analytics and no network call carrying scan data. The automated tests check this.
- Private/InPrivate windows and "clear browsing data" remove scan history. Export reports you must keep. To store only summaries, turn off Settings → Keep full results of past scans on this PC.

## Distributing and updating

To give the app to colleagues, send them the two files or share the published link. To update it, replace `Inventory Analyzer.html`.

- **Share the files:** zip `Start Inventory Analyzer.bat` and `Inventory Analyzer.html` and send them by email or Teams, or place them on a shared drive. Some mail filters block .bat files. If yours does, send only the .html file and ask people to open it in Edge or Chrome.
- **Share the link:** the Inventory Analyzer app is private until you open it on claude.ai and choose **Share → Anyone with the link**. Until then, anyone else sees "Sign in to view this page". The guides are built into the app (Help & Documents), so one link gives people everything.
- **Update:** overwrite `Inventory Analyzer.html` with the new build. The launcher doesn't change, and saved scan history and settings are kept.
- **Rebuild from source** (project folder `folder-file-inventory-analyzer`):
    1. `npm install`
    2. `npm run build:single` → `dist-single/index.html`
    3. Copy that file over `Inventory Analyzer.html`.
- The Settings → About panel shows the version; the current release is **v1.2**.

## Verifying a build

v1.2 passes all 97 automated tests, covering 44 user scenarios. Rerun them before you distribute a new build.

| Suite | Command | Tests | What it proves |
| --- | --- | --- | --- |
| Unit | `npm run test:unit` | 42 | Counts, direct and recursive sizes, duplicates, errors, cancellation, folder tree, history storage, Excel and CSV correctness |
| UI scenarios | `npm run test:ui` | 47 | Every user scenario driven through the real app with clicks and typing |
| End-to-end | `npm run test:e2e` | 8 | Production build in Chromium: real folder scan, downloads reopened, no network, phone layout, keyboard use, large scan reopened after reload |
| Everything + coverage | `npm run test:all` | 97 | Writes coverage to `test-reports/coverage` (97.7% of statements) |

Before the first end-to-end run, install the test browser once with `npx playwright install chromium`. The scenario list is in `tests/SCENARIOS.md` and the results are in `test-reports/TEST_REPORT.md`.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Double-clicking the .bat does nothing | Edge missing, or the .html isn't next to the .bat | Keep both files in one folder; open the .html in Chrome directly |
| Windows shows "Windows protected your PC" | SmartScreen warning for a downloaded .bat | Click **More info → Run anyway**, or open the .html directly |
| **Choose folder…** is greyed out | Firefox/Safari, or the browser lacks the folder picker | Use **Upload a folder**, or switch to Edge/Chrome |
| "The folder picker is blocked in this context" | Opened inside the published page on claude.ai | Use **Upload a folder**, or the desktop launcher |
| Many `permission-denied` errors | System or protected folders inside the selection | Select a narrower folder |
| `not-readable` on some files | File open or locked in another app (Outlook PST, open Office files) | Close the app and re-scan |
| "Scanned on the main thread" notice | Background worker not allowed (e.g. opened from disk) | No action needed; results are identical |
| Scan History shows "Summary only" | Scan made before v1.2, older than the newest 20, or full results turned off | Rescan the folder |
| Scan History is empty after reopening | Private window, browser data cleared, or a different mode (launcher vs link) | Use a normal window and the same mode; export reports to keep results |
| Browser slows down on a huge folder | Hundreds of thousands of files held in memory | Scan subfolders separately; prefer the CSV ZIP export |
| Excel export fails | Out of memory on a very large inventory | Use **All CSVs (.zip)** |
