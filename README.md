# Folder & File Inventory Analyzer — MVP prototype

A local-first browser app that inventories a folder you select, analyzes storage, and exports Excel and CSV reports. Built from *Folder_File_Inventory_Analyzer_PRD_and_Master_Prompt.docx* (PRD v3.0).

No backend, desktop app or agent. Nothing is uploaded. Source files are opened read-only and never modified.

## Documentation

Seven numbered guides, as Markdown (readable here) and as formatted PDFs. The same guides are built into the app under **Help & Documents**.

| ID | Document | For | Read online | PDF |
|---|---|---|---|---|
| IA-UG-01 | User Guide | Everyone who scans folders | [user-guide.md](docs/user-guide.md) | [PDF](docs/pdf/IA-UG-01_User_Guide.pdf) |
| IA-IG-02 | Installation and Administration Guide | Administrators, IT support | [installation-and-administration.md](docs/installation-and-administration.md) | [PDF](docs/pdf/IA-IG-02_Installation_and_Administration_Guide.pdf) |
| IA-QS-03 | Quick Start | New users | [quick-start.md](docs/quick-start.md) | [PDF](docs/pdf/IA-QS-03_Quick_Start.pdf) |
| IA-FAQ-04 | FAQ and Troubleshooting | Everyone | [faq-and-troubleshooting.md](docs/faq-and-troubleshooting.md) | [PDF](docs/pdf/IA-FAQ-04_FAQ_and_Troubleshooting.pdf) |
| IA-TD-05 | Technical Design | Developers, reviewers, security | [technical-design.md](docs/technical-design.md) | [PDF](docs/pdf/IA-TD-05_Technical_Design.pdf) |
| IA-UAT-06 | UAT Test Cases | Testers, sign-off owners | [uat-test-cases.md](docs/uat-test-cases.md) | [PDF](docs/pdf/IA-UAT-06_UAT_Test_Cases.pdf) |
| IA-RN-07 | Release Notes v1.2 | Everyone | [release-notes.md](docs/release-notes.md) | [PDF](docs/pdf/IA-RN-07_Release_Notes_v1.2.pdf) |

Also: [Product requirements (PRD v3.0)](docs/PRD%20and%20Master%20Prompt.docx) · [User scenarios](tests/SCENARIOS.md) · [Test report](test-reports/TEST_REPORT.md)

## How to run it

**Option 1 — on your PC, no install (recommended):** double-click **`Start Inventory Analyzer.bat`**. It opens `Inventory Analyzer.html` in its own Microsoft Edge window. Keep the two files together; you can copy them anywhere or share them. The folder picker, scan history and downloads all work in this mode. You can also open `Inventory Analyzer.html` directly in Chrome or Edge.

**Option 2 — the published link:** open the Inventory Analyzer artifact on claude.ai. It's private until you share it from its Share menu. If the hosted page blocks the folder picker, use **Upload a folder**, which works everywhere, or use Option 1.

**Option 3 — developers:** use the commands below. You need Node 18 or later.

## Run it

```bash
npm install          # Node 18+ (built and tested on Node 22)
npm run dev          # http://localhost:5173
npm test             # 89 unit and UI tests (Vitest); npm run test:e2e for 9 more in Chromium
npm run build        # production build -> dist/
npm run build:single # one self-contained HTML file -> dist-single/index.html
npm run samples      # regenerate sample-exports/ from the test fixture
```

`dist-single/index.html` can be opened straight from disk or hosted anywhere static. The folder picker needs a secure context: `https://`, `http://localhost`, or a file opened from disk in Edge or Chrome.

## What's in the MVP

| Screen | What it does |
|---|---|
| New Scan | Capability check, options (dot-items, duplicates, large-file threshold, top-N), folder picker or upload fallback, sample data |
| Folder Explorer | Expandable folder tree: files directly in each folder and in total, files listed under their folder, find-by-name, expand/collapse all |
| Dashboard | "Where your files are" by top-level folder; files, folders, logical size, average, largest file and folder, duration, status, errors and skipped items; four charts; key findings |
| File Inventory | Search, extension, folder, size range, date range and duplicate filters; sortable, paginated |
| Folder Summary | Direct vs recursive counts and sizes, empty status, completeness; click through to that folder's files |
| Storage Analysis | Top-N files and folders, extension table, adjustable large-file list, depth distribution, subfolder-only folders |
| Duplicate Files | Optional; size grouping, then SHA-256 confirmation; redundant bytes |
| Empty Folders / Scan Errors | Classification, plus actionable hints per error category |
| Scan History | Every scan on this PC; **Open** a saved scan (all screens and exports) or download its **Excel / CSVs** directly; full results kept for the newest 20 scans |
| Settings | Defaults; keep-full-results switch; clear history; privacy and limitations |

**Exports:** XLSX with Executive Summary, Folder Tree (indented), File Inventory, Folder Summary, Extension Summary, Largest Files, Largest Folders, Duplicate Files (when enabled), Empty Folders and Scan Errors. Headers are frozen, filters applied, widths set and number formats used. Separate UTF-8 CSVs and a ZIP bundle are also available. Both formats are generated from the same table definitions (`src/export/tables.ts`), and row counts are reconciled before download.

## Architecture

```
src/core/scanner.ts     Scanner (aggregation rules) + two read-only walkers:
                        walkDirectoryHandle (File System Access API) and walkFileList (webkitdirectory)
src/core/controller.ts  Runs the scan in a Web Worker; falls back to main thread if a worker can't start
src/worker/             Worker entry
src/core/analysis.ts    Derived reports shared by UI and exports
src/core/history.ts     IndexedDB scan-summary store
src/export/             tables.ts (single source), xlsx.ts (ExcelJS), csv.ts (RFC 4180 + fflate ZIP), sanitize.ts
src/ui/                 React screens
tests/                  Deterministic fixtures (fake FSA handles, File lists) + tests
```

Library versions: React 18.3.1, TypeScript 5.6, Vite 5.4, ExcelJS 4.4.0, fflate 0.8.2, Recharts 2.15, Vitest 2.1 (exact versions are in `package-lock.json`).

### Calculation rules
- Bytes are used internally. Direct = immediate children. Recursive = all included descendants. Each file is counted once.
- Paths are relative to the selected folder and include its name, e.g. `Projects/docs/a.pdf`.
- Folder classes: `empty` (nothing inside), `no-files-only-subfolders` (only empty subfolders), `subfolders-only` (files only deeper down), `has-files`, and `unknown` (could not be listed — never reported as empty).
- A folder is `incomplete` if it, or anything below it, could not be fully read, or the scan was cancelled.
- Duplicates: zero-byte files are not compared. A unique size is proven unique. Files with the same size are SHA-256 hashed. A hash failure or a file over the size limit is marked `unverified`.

## Browser compatibility

| | Folder picker (preferred) | Upload fallback |
|---|---|---|
| Chrome / Edge / Opera (desktop) | ✅ | ✅ |
| Firefox | — | ✅ |
| Safari (macOS) | — | ✅ |
| Mobile browsers | — | varies |

In fallback mode browsers do **not** expose empty folders, and the browser lists every file before scanning starts. The app tells the user this before they scan.

## Known limitations
- The whole inventory is held in memory (compact records). Expect good behaviour up to a few hundred thousand files. Larger trees may exhaust tab memory. True streaming to IndexedDB is a Phase-2 item.
- Tables are paginated (not virtualized). Filtering very large inventories runs on the main thread.
- Only the last-modified time is available. Created and accessed times, absolute paths and the OS hidden attribute are not exposed by browsers. "Dot-prefixed" is reported instead of "hidden".
- Hashing reads each candidate file fully into memory (Web Crypto has no streaming API). The per-file limit is set in Settings (default 1 GB).
- Logical size ≠ size on disk. Cloud placeholders (OneDrive/iCloud) may report full size or fail to read.
- Excel export is built in memory. For inventories near a million rows, prefer the CSV ZIP.
- If the page is embedded in another site's iframe, browsers block the folder picker. Use the upload fallback or open the app in its own tab.
- Scan comparison is intentionally excluded from this MVP.

## Troubleshooting
- **"Choose folder" is disabled.** The browser isn't Chromium-based. Use "Upload a folder".
- **"The folder picker is blocked in this context".** The page is embedded or not served over https/localhost. Open it directly, or use upload.
- **Many `permission-denied` errors.** These are system or protected folders. Select a narrower folder.
- **`not-readable` on some files.** The file is open or locked in another app (e.g. Outlook PST, open Office docs). Close it and re-scan.
- **History not saving.** This happens in private windows or when storage is blocked or full. Scanning and exports still work.

## Tests (test-driven)
```bash
npm run test:unit      # 42 engine/export/controller/tree/history tests
npm run test:ui        # 47 user-scenario tests of the React app (jsdom + Testing Library)
npm run test:e2e       # 8 Playwright tests against the production build in Chromium
npm run test:coverage  # unit + UI with coverage -> test-reports/coverage
npm run test:all       # everything
```
`tests/SCENARIOS.md` lists the 44 user scenarios with their PRD references. `test-reports/TEST_REPORT.md` has the results, coverage and the red→green record. For E2E, install the browser once with `npx playwright install chromium`.
