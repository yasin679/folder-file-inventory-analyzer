# Test report — Folder & File Inventory Analyzer

Run date: 2026-10-24 · Node 22 · Vitest 2.1.8 · Playwright 1.63 (Chromium 153)

## Result

| Suite | Command | Tests | Result |
|---|---|---|---|
| Unit: engine, exports, history, worker controller, folder tree | `npm run test:unit` | 42 | ✅ all pass |
| UI scenarios: React app in jsdom with real user events | `npm run test:ui` | 47 | ✅ all pass |
| End-to-end: production build in real Chromium | `npm run test:e2e` | 9 | ✅ all pass |
| **Total** | `npm run test:all` | **98** | ✅ |

Coverage across `src/` (unit + UI): **97.6 % statements, 89.8 % branches, 97.6 % lines.** Function coverage is 74 %. That figure is low because many small sort and render callbacks for table columns are never invoked in tests; the scenario behaviour behind them is exercised. Full HTML coverage is in `test-reports/coverage/index.html`.

The 44 user scenarios and the PRD requirements they cover are listed in `tests/SCENARIOS.md`. Each test name starts with its scenario ID, e.g. `npx vitest run -t "S15"`.

## How TDD was applied

1. Each user scenario was derived from the PRD (FR-01 to FR-13, acceptance criteria 1–18) and written as a test before any app code was changed.
2. **Red:** on first run, 12 of the 30 UI scenario tests failed (log: `test-reports/red-phase.txt`).
3. **Green:** the app was changed only to make those tests pass. The full suite was rerun after each change.

### What the red phase found

| Scenario | Failure | Cause | Fix |
|---|---|---|---|
| S10 | Duplicates never confirmed | Hashing needed `Blob.arrayBuffer()`, which is missing in Safari < 14 and some embedded views | Added `readBytes()` with a FileReader fallback |
| S14 | No relative path or dot-prefixed column in File Inventory | FR-05 requirement not met | Added Relative path, Parent folder and Dot-prefixed columns |
| S15 | Opening `docs` also listed `docs-archive` | Folder drill-down used a plain prefix match | Drill-down now matches the exact subtree and shows a removable "In folder" chip. The typed filter is now "contains". |
| S16, S23 | Typing 10 into a cleared number box gave 110 | Value was clamped on every keystroke, so a cleared box snapped back to 1 | New `NumberField`: free typing, commit when valid, restore on blur |
| S20b | Declining a save showed "Export failed" | Treated as an error | Now shows "Save cancelled — no file was saved." |
| S21 | History lacked Scan ID and Completed time | PRD scan-history fields missing | Added both columns |
| S27 | Pager buttons had no accessible name | « ‹ › » had no labels | Added aria-labels (First, Previous, Next and Last page) |
| S19 | CSV ZIP held thousands of stray entries | Typed arrays from another JavaScript realm were treated as folders by fflate | Normalised to a local `Uint8Array` before zipping |
| S01, S05 | Upload button disabled under test | jsdom doesn't implement `webkitdirectory` (environment gap, not an app bug) | Polyfilled in the test setup only |
| S17 | Ambiguous text match | Test was too loose | Tightened the matcher |

One E2E test (S34) initially failed because its locator also matched a second heading ("File inventory"). The locator was made exact; the app was not changed.

## What the end-to-end tests prove in a real browser
- **S06:** A real folder on disk is scanned through the upload path inside a Web Worker. Totals match the files on disk.
- **S02:** The picker path requests read-only access and reports correct totals.
- **S18/S19:** The downloaded `.xlsx` and `.zip` are reopened and their row counts match the scan.
- **S24:** No request leaves the page's origin during a scan, hashing and both exports.
- **S32:** At 390 px width, no screen scrolls horizontally.
- **S34:** A keyboard-only user can run a scan and navigate.

## Known limits of this test run
- The browser's native folder picker can't be driven by automation. The picker path is tested with a stub that behaves like the real API. The real upload path is tested with a real folder.
- Very large folders (hundreds of thousands of files) were not load-tested. Excel sheet splitting is verified with a small artificial row limit.
- E2E ran in Chromium only. Firefox and Safari run the upload path, which is the same code exercised here, but were not executed.

## v1.1 — Folder Explorer (S35–S38), test-first

The user feedback was that they couldn't see which folder holds how many files, or where a file is. Four new scenarios were written as tests before any code was changed. On first run **14 tests failed** (log: `test-reports/red-phase-folder-tree.txt`): 8 new tests plus 6 existing export tests whose expected sheet list now includes Folder Tree. The tree model, the Folder Explorer screen, the dashboard's "Where your files are" panel, the "Show in folder tree" links, and the Folder Tree sheet in Excel and CSV were then built until all of them passed.

Two test-side fixes were needed. The sidebar helper also matched the new "Open Folder Explorer →" button, so it is now scoped to the menu. A text check matched both a folder literally named "empty" and its "empty" badge, so it now targets the badge. A look at the rendered screens prompted three wording and layout fixes with no test impact: "1 file here" instead of "1 files here", a "no files (only empty subfolders)" badge, and a search highlight that fits the name.

## v1.2 — Reopen past scans and download from history (S39–S43), test-first

The user couldn't go back to an earlier scan to download its reports. Five new scenarios were written as tests first. **11 tests failed** on the first run (log: `test-reports/red-phase-reopen.txt`): 10 new tests plus S21, whose expected history columns changed.

What was built:
- **Full results in history:** history now keeps each scan's full result (names, paths, sizes, dates; never file contents) in a second IndexedDB store, for the newest 20 scans.
- **Database upgrade:** the store upgrades from the v1 database without losing existing summaries. Those older scans show as "Summary only".
- **History actions:** each history row has Open, ⬇ Excel, ⬇ CSVs and Delete.
- **Open last scan:** New Scan offers the most recent saved scan.
- **Settings:** a switch turns full-result keeping off.
- **History table:** redesigned so long folder names, scan IDs and actions no longer truncate.

One test-side fix: the first S39 run restarted the app before the background save had finished. The tests now wait until that scan's history row is ready, as a user would.

**Large-scan check (E2E, Chromium):** a synthetic folder with 26,160 files in about 22,000 folders.

| Step | Time |
| --- | --- |
| Scan | 0.7 s |
| Save to history | under 0.1 s |
| Reopen after a page reload | 0.4 s |
| Build the Excel from history | 6.2 s |

The reopened workbook's File Inventory row count matched the scan.

## v1.2 — Help & Documents inside the app (S44), test-first

To share the complete application through one link, the three guides were embedded in the app with PDF and Word downloads. **4 tests failed** on the first run (log: `test-reports/red-phase-help.txt`) before the screen was built.

The live published app was also checked in a real browser signed in to claude.ai:
- **Working:** sample scan, Where your files are, Folder Explorer, and the Help screen rendering.
- **Defect found:** the scan's report buttons showed on the Help screen. A test was added (S44b) and the defect fixed.
- **Sharing:** viewed by someone else, the link showed "Sign in to view this page". It is private until the owner chooses Share → Anyone with the link.

## Documentation release (v1.2 guides)

The documentation was rebuilt as seven numbered guides (IA-UG-01 to IA-RN-07), each as Markdown and a formatted PDF, and all seven were built into Help & Documents.

- **S44 rewritten first (red):** the Help tests were changed to expect seven guides with document IDs, bundled screenshots and numbered PDF downloads. All 4 changed tests failed before the code was changed, then passed.
- **Defect found while capturing screenshots:** on Storage Analysis, the Top N and Large-file threshold boxes were squeezed into a 12-pixel strip, because the toolbar's style name (`bar`) was also used by the progress bar. jsdom has no layout, so the UI tests could not see it. A new end-to-end test (S16 E2E) checks that both boxes are fully visible and change the lists. It failed, the style was renamed, and it passed.
- Final run: 89 unit and UI tests, 9 end-to-end tests, all passing.
