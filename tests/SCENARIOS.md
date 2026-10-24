# User scenarios → tests

Each scenario was written as a failing test **before** the app code was changed (TDD).
IDs appear in the test names, so `npx vitest run -t "S12"` runs one scenario.

Layers: **U** = unit (engine/exports), **UI** = React app in jsdom (Testing Library, real user events),
**E2E** = built app in real Chromium (Playwright).

| ID | User scenario | PRD | Layer |
|---|---|---|---|
| S01 | First visit: New Scan shows options, both access modes and the capability check; data pages are disabled until a scan exists | FR-01, §6 | UI |
| S02 | Choose a folder with the picker → scan → dashboard shows correct files, folders, size, largest file/folder, status | FR-01–04, AC 2,4 | UI, E2E |
| S03 | User closes the folder picker without choosing → nothing happens, no error | FR-12 | UI |
| S04 | Picker blocked by the browser (embedded page / SecurityError) → actionable message pointing to Upload | FR-12, §6 | UI |
| S05 | Browser without the File System Access API → "Choose folder" disabled, upload still offered | §6, AC 3,17 | UI |
| S06 | Upload a folder (fallback) → scan → labelled "Folder upload"; Empty Folders warns that empty folders are invisible | §6, AC 17 | UI, E2E |
| S07 | Upload returns zero files → explanation instead of an empty report | FR-12 | UI |
| S08 | Exclude dot-prefixed items → they are skipped and counted as skipped | FR-01 | UI, U |
| S09 | Duplicate detection is off by default; Duplicates page explains and can set up a scan with it enabled | FR-08 | UI |
| S10 | Duplicate detection on → groups confirmed by hash, redundant bytes, expandable paths; same name ≠ duplicate | FR-08, AC 8 | UI, U |
| S11 | Progress shows counts and elapsed time; no fake percentage when the total is unknown | FR-11 | UI |
| S12 | Cancel a running scan → results kept, labelled partial/cancelled everywhere | FR-11, AC 9 | UI, U |
| S13 | Unreadable files / denied folders → dashboard warning, Scan Errors list with hints, folders marked incomplete, never "empty" | FR-12, AC 10 | UI, U |
| S14 | File Inventory: search, extension, folder, size and duplicate filters, reset, sort, full relative path and dot-prefixed status visible | FR-05 | UI |
| S15 | Folder Summary: direct vs recursive values; clicking a folder lists exactly that folder's subtree (not same-prefix siblings) | FR-06 | UI |
| S16 | Storage Analysis: changing Top-N and the large-file threshold updates the lists | FR-07 | UI |
| S17 | Empty Folders lists empty and only-empty-subfolder folders with classification | FR-07, AC 7 | UI, U |
| S18 | Download Excel → workbook with all sheets; row counts reconciled and confirmed to the user | FR-09, AC 11,13 | UI, E2E, U |
| S19 | Download a single CSV and the CSV ZIP → UTF-8, escaped, injection-safe, right row counts | FR-10, AC 12 | UI, E2E, U |
| S20 | Export fails → clear error, app keeps working | FR-12, AC 18 | UI |
| S21 | Scan History records each real scan (ID, root, start/end, status, counts, size, errors); delete one; clear all; sample runs aren't recorded | FR-13, history | UI |
| S22 | IndexedDB unavailable → History explains, scanning and export still work | FR-12/13, AC 18 | UI |
| S23 | Settings are remembered across visits; duplicate detection never silently defaults on | FR-01 | UI |
| S24 | Privacy: no network request carries scan data during scan or export | §11, AC 16 | UI, E2E |
| S25 | Read-only: picker asks for read mode only; no write/move/delete API is ever called | §11, AC 15 | UI |
| S26 | Sample data run works and is clearly labelled as sample | — | UI |
| S27 | Long lists paginate; page size can be changed | §9, AC 14 | UI |
| S28 | Empty selected folder → valid zero report, exports still work | FR-03 | UI |
| S29 | Unicode and unusual file names display and export intact | Testing | UI, U |
| S30 | Web Worker can't start → scan still completes on the main thread and says so | FR-12 | U |
| S31 | Stale progress from an old scan never overwrites a newer one | FR-11 | U |
| S32 | Phone-width layout has no horizontal scroll on every screen | UI | E2E |
| S33 | Dismiss a message; start a new scan from results; new results replace old ones | workflow | UI |
| S34 | Keyboard-only user can run a scan and move between screens | Accessibility | E2E |
| S35 | Folder Explorer: see every folder as an expandable tree with "files here" and "in total" counts, and the files listed under the folder they're in (also as an indented Folder Tree sheet in Excel/CSV) | FR-02, FR-06 | U, UI |
| S36 | Find where a file is: search the tree; only matches show, with their folders opened, and a match count | FR-05 | UI |
| S37 | Dashboard "Where your files are": top-level folders by file count; click one to open it in the explorer | FR-04 | UI |
| S38 | From File Inventory, "Show in folder tree" jumps to the file, selected inside its opened folder | FR-05 | UI |
| S39 | Reopen a past scan from Scan History after closing the app — all screens and exports work as if it had just run | FR-13, user request | U, UI |
| S40 | Download Excel or the CSV ZIP for any saved scan straight from its history row; the table shows full names, ID and times | FR-13 | UI |
| S41 | Keeping full results can be turned off in Settings; such scans show "Summary only" and can't be opened | §11 privacy | UI |
| S42 | New Scan offers "Open last scan" when a saved scan exists | workflow | UI |
| S43 | Deleting a scan removes its saved results; only the newest 20 scans keep full results; old history databases upgrade without loss | FR-13 | U, UI |
| S44 | Help & Documents inside the app: User Guide, Setup & Administration Guide and Release Notes readable in the app and downloadable as PDF and Word, so one shared link carries everything | Delivery | UI |
