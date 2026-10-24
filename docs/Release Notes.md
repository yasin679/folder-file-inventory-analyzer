# Inventory Analyzer – Release Notes

Versions 1.0 – 1.2 · 24 Oct 2026 · Yasin Jariwala

Inventory Analyzer is a browser app that inventories any folder you choose, analyzes storage, and exports Excel and CSV reports. It runs locally and uploads nothing. The current release, v1.2, passes all 92 automated tests.

## What's new in v1.2 (24 Oct 2026)

v1.2 lets you go back to an earlier scan and download its reports, even after closing the app. All 92 automated tests pass, up from 81.

| Change | Where |
| --- | --- |
| **Open** any saved scan: every screen, the Folder Explorer and all exports work as if it had just run | Scan History |
| **Excel / CSVs** downloads for any saved scan, without opening it | Scan History |
| **Open last scan** offer when the app starts | New Scan |
| Redesigned history table: full folder names, scan ID, start → end times and buttons no longer cut off | Scan History |
| **Keep full results of past scans on this PC** (on by default; newest 20 scans) | Settings |

Scans made before v1.2 kept only a summary, so they show as "Summary only" and can't be reopened. Rescan those folders once to save them.

Tested at size: a 26,160-file, 22,000-folder scan reopened in 0.4 s after a page reload, and its Excel rebuilt from history in 6.2 s.

## What's new in v1.1 (24 Oct 2026)

v1.1 answers "which folder has how many files, and where is each file?" All 81 automated tests pass, up from 70.

| Change | Where |
| --- | --- |
| **Folder Explorer**: an expandable folder tree with "files here" and "in total" counts on every folder, and each file listed under its folder | New menu item after Dashboard |
| Find a file or folder by name: only matches and their folders show, with a match count | Folder Explorer |
| **Where your files are**: files and size per top-level folder; click to open in the explorer | Dashboard |
| Show in folder tree: jump from any file to its spot in the tree | File Inventory |
| **Folder Tree** sheet: the whole tree indented by level, with files here and in total | Excel (2nd sheet) and `folder_tree.csv` |

Built test-first: four new scenarios (S35–S38) were written as tests and failed (14 failing tests) before the feature was built.

## What's in v1.0

| Area | Feature | PRD |
| --- | --- | --- |
| Folder access | Read-only folder picker (Edge/Chrome); folder-upload fallback (Firefox/Safari); browser capability check | FR-01 |
| Scanning | Recursive inventory in a background worker; progress, elapsed time, honest % and ETA; cancel with partial results kept | FR-02, FR-11 |
| Calculations | Direct vs recursive file counts, folder counts and sizes; completeness per folder; each file counted once | FR-03 |
| Dashboard | KPIs, 4 charts, key findings, status and error banner | FR-04 |
| File Inventory | Search; filters for extension, folder, size, date and duplicates; sorting; paging; relative path and dot-prefixed columns | FR-05 |
| Folder Summary | Per-folder direct/recursive metrics; click through to a folder's files | FR-06 |
| Storage Analysis | Top-N files and folders, extension table, large files, size by depth, subfolder-only folders | FR-07 |
| Duplicates (optional) | Size grouping, then SHA-256 confirmation; redundant bytes; unverified handling | FR-08 |
| Exports | 9-sheet Excel workbook; 8 CSVs; ZIP bundle; formula-injection protection; row-count reconciliation; sheet splitting over 1,048,575 rows | FR-09, FR-10 |
| Errors | Categorized errors with fixes; folders that can't be read marked unknown, never empty | FR-12 |
| History and settings | Local scan history (delete/clear); remembered defaults | FR-13 |
| Delivery | Desktop launcher for Windows (no install); published link; developer build | — |

## Quality

v1.0 was built test-first against 34 user scenarios taken from the PRD. All 70 automated tests passed, covering 97.5% of statements and 89.3% of branches.

| Suite | Tests | Result |
| --- | --- | --- |
| Unit (engine, exports, history, worker) | 34 | Pass |
| UI scenarios (real clicks and typing) | 30 | Pass |
| End-to-end (production build in Chromium) | 6 | Pass |

Writing the tests before fixing anything exposed 8 defects, all fixed in v1.0:

| Defect found by tests | Fix in v1.0 |
| --- | --- |
| Duplicates never confirmed on browsers without `Blob.arrayBuffer` (Safari < 14) | Hashing falls back to FileReader |
| File Inventory lacked relative path and dot-prefixed columns | Columns added |
| Opening `docs` also listed `docs-archive` | Drill-down matches the exact subtree |
| Number boxes couldn't be cleared and retyped (typing 10 gave 110) | New number field |
| Declining a save showed "Export failed" | Now says "Save cancelled" |
| Scan History lacked scan ID and completion time | Columns added |
| Page buttons had no accessible names | Labels added for screen readers |
| CSV ZIP could fill with junk entries | Data normalized before zipping |

## Known limitations

- **Upload mode can't see empty folders.** Use Edge or Chrome for full empty-folder detection.
- **The published link may block the folder picker.** Use Upload a folder, or the desktop launcher.
- **The inventory is held in memory.** A few hundred thousand files is the practical ceiling on a typical laptop.
- **Only last-modified dates are available.** Browsers don't expose full disk paths, created or accessed dates, or the OS hidden attribute.
- **Sizes are logical file sizes,** not space used on disk.
- **Duplicate hashing reads each candidate file whole.** Files over the hashing limit are marked unverified.
- **Each mode keeps its own history.** Scans made in the desktop launcher don't appear in the published link, and vice versa.
- **Testing scope:** end-to-end tests ran in Chromium only, and the native picker was tested with a stand-in.

## Planned next

- Scan comparison: what changed between two scans (deferred from the MVP by PRD decision)
- Streaming very large inventories to local storage instead of memory
- Virtualized tables for faster scrolling through huge lists
- End-to-end tests in Firefox and Safari
