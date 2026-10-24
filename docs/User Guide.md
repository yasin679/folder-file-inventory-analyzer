# Inventory Analyzer – User Guide

Version 1.2 · 24 Oct 2026 · Yasin Jariwala

Inventory Analyzer lists every file and folder inside a folder you choose, shows what uses the space, and exports the inventory to Excel or CSV. It runs on your computer and never changes, moves or uploads your files.

## Quick start

Most folders take seconds to scan. You'll have an Excel report in under a minute.

1. Open the app: double-click **Start Inventory Analyzer.bat**, or open the published link.
2. On **New Scan**, leave the defaults, or tick **Detect duplicate files** if you want to find copies.
3. Click **Choose folder…** (Edge or Chrome) and pick the folder. In Firefox or Safari, or if the picker is blocked, click **Upload a folder…** instead. Nothing is actually uploaded.
4. Watch the progress panel. Click **Cancel scan** at any time; the results so far are kept and marked partial.
5. Review the **Dashboard**, then click **Excel (.xlsx)** or **All CSVs (.zip)** at the top right.

Need help later? Open **Help & Documents** in the left menu for this guide and the others, or download them as PDF or Word.

Want to look around first? Click **Try with sample data** on New Scan. It runs the real engine on a made-up "Shared Drive" with about 320 files.

## See which folder has how many files, and where each file is

Open **Folder Explorer** (new in v1.1). It shows your folder as a tree, like Windows Explorer, with two counts on every folder.

| On a folder row | Means |
| --- | --- |
| **N files here** (blue) | Files sitting directly in that folder |
| **N in total** (grey) | Files in that folder plus all of its subfolders |
| empty / no files (only empty subfolders) | Nothing to count inside |
| couldn't be opened | The browser was denied access, so the contents are unknown |

1. Click **▸** next to a folder to open it. You'll see its subfolders first, then its files with size and modified date.
2. Use **Expand all** to open every folder at once, or **Collapse all** to start over.
3. To find where a file is, type part of its name in **Find a file or folder**. Only matching items and the folders that contain them stay visible, highlighted, with a match count.
4. From the **Dashboard**, the **Where your files are** table lists each top-level folder by number of files. Click one to open it in the explorer.
5. From **File Inventory**, click the pin icon next to any file's path to jump to that file in the tree.

The Excel report has the same tree on its **Folder Tree** sheet, indented by level, with Files here and Files in total columns.

## Go back to an earlier scan and download its reports

Every scan is saved on this PC (new in v1.2), so you can come back to it after closing the app.

1. Click **Scan History**. Each row shows the folder name, scan ID, date, start → end time, status, file and folder counts, and size.
2. Click **Open** to reload that scan. Every screen works as if it had just run, including the Folder Explorer and all downloads. A note on the Dashboard says it is a saved scan, showing the folder as it was then.
3. Or click **Excel** or **CSVs** to download that scan's reports without opening it.
4. When the app starts, **New Scan** offers **Open last scan** for your most recent saved scan.

Full results are kept for the newest 20 scans; older ones keep only a summary. Scans made before v1.2 show **Summary only** and can't be reopened, so rescan those folders once. To keep only summaries, turn off **Keep full results of past scans on this PC** in Settings.

## Scan options

Set these on New Scan before you choose a folder. Your choices are remembered, except duplicate detection, which starts off each session.

| Option | Default | What it does |
| --- | --- | --- |
| Include dot-prefixed items | On | Includes names starting with "." (e.g. `.git`, `.env`). Turned off, they are skipped and counted under "skipped". Browsers don't expose the Windows "hidden" attribute. |
| Detect duplicate files (SHA-256) | Off | Reads same-size files and compares their content hashes. This is slower on big folders, and contents are never stored. |
| Large-file threshold | 100 MB | Files at or above this size appear in the Large files list and key findings. |
| Top-N report size | 25 | How many items the Largest files and Largest folders lists show. |
| Hashing size limit (Settings) | 1,024 MB | Files above this aren't hashed and are marked "unverified". |

## The screens

Result screens unlock after your first scan. The left menu stays locked while a scan runs.

| Screen | What it shows | What you can do |
| --- | --- | --- |
| Dashboard | Files, folders, total size, average size, largest file and folder, duration, status, errors; Where your files are (files per top-level folder); four charts; key findings | Jump to errors; download reports |
| Folder Explorer | Your folder as a tree: files here and in total on every folder; each file listed under its folder | Open/close folders; expand or collapse all; find a file or folder by name |
| File Inventory | One row per file: name, relative path, parent folder, extension, size, modified date, dot-prefixed, status, duplicate status | Search; filter by extension, folder, size (MB), date and duplicate status; sort any column; change rows per page |
| Folder Summary | One row per folder: depth, direct and recursive files, subfolders and size, contents, completeness | Search and filter; click a folder name to list only that folder's files |
| Storage Analysis | Top-N largest files and folders, extension table, large files, size by depth, folders with only subfolders | Change Top-N and the large-file threshold on the spot |
| Duplicate Files | Duplicate groups, copies, redundant storage, unverified count | Expand a group to see every path |
| Empty Folders | Folders with no files anywhere inside | Review before a cleanup |
| Scan Errors | Every item that couldn't be read, with a category and a suggested fix | Filter by category |
| Scan History | Every scan on this PC: folder, scan ID, date and times, status, counts, size, errors | Open a saved scan; download its Excel or CSVs; delete one, or clear all |
| Settings | Defaults, hashing limit, local data, privacy and limitations | Restore defaults; clear stored history |
| Help & Documents | This User Guide, the Setup & Administration Guide and the Release Notes, inside the app | Read them; download each as PDF or Word |

## Reading the results

**Direct** counts only what sits immediately inside a folder. **Recursive** counts everything below it. Each file is counted once in the totals.

Example: `Project/docs` holds 2 files (300 KB) and a subfolder `old` with 3 files (700 KB). Docs then shows 2 files and 300 KB direct, and 5 files and 1,000 KB recursive.

| Label | Meaning |
| --- | --- |
| Complete | Everything inside the folder was read |
| Incomplete | Something inside couldn't be read, or the scan was cancelled. Totals are a lower bound. |
| Empty | No files and no subfolders |
| Empty tree | No files anywhere — only empty subfolders |
| Subfolders only | No files directly inside, but files exist deeper down |
| Unknown | The folder couldn't be opened, so its contents are unknown (never shown as empty) |
| Duplicate #n | Same size and same SHA-256 content as other files in group n, whatever their names |
| Unique | No other file has the same content (or the same size) |
| Unverified | Couldn't be hashed (unreadable, or over the hashing limit) |

Sizes are logical file sizes, not disk space used. Compression, cluster size and cloud placeholders (OneDrive, iCloud) can make real disk usage differ.

## Reports you can download

The Excel workbook and the CSV files contain the same data. Before you download, the app checks that every row count matches the scan, then confirms it on screen.

| Excel sheet | CSV file | Contents |
| --- | --- | --- |
| Executive Summary | — | Root, scan ID, mode, status, start/end, duration, totals, settings, key findings, row-count reconciliation |
| Folder Tree | `folder_tree.csv` | Every folder and file in tree order, indented by level: type, files here, files in total, size, relative path |
| File Inventory | `file_inventory.csv` | Every file with path, parent, extension, size in bytes and formatted, modified date, status (+ duplicate status and SHA-256 when enabled) |
| Folder Summary | `folder_summary.csv` | Every folder, including the root, with direct and recursive counts and sizes, empty status, completeness |
| Extension Summary | `extension_summary.csv` | Per extension: file count, total size, % of total, average, largest (Excel adds a totals row) |
| Largest Files | `largest_files.csv` | Top-N files by size |
| Largest Folders | `largest_folders.csv` | Top-N folders by recursive size |
| Duplicate Files | `duplicate_files.csv` | Only when duplicate detection was on: group, hash, path, size, copies |
| Empty Folders | `empty_folders.csv` | Empty and empty-tree folders with their classification |
| Scan Errors | `scan_errors.csv` | Every error with path, type, category, message and time |

- Use **Single CSV…** to download just one file, or **All CSVs (.zip)** for all of them.
- Excel sheets have frozen headers and filters. Tables over 1,048,575 rows are split into numbered sheets, e.g. "File Inventory (2)"; nothing is dropped.
- CSV values starting with = + − or @ get a leading ' so Excel never runs them as formulas.

## Good to know

- **Is anything uploaded?** No. Even "Upload a folder" only gives this page read access. Everything stays on your computer.
- **Can it delete or tidy files?** No. It is read-only by design and only reports.
- **Why is there no full path like C:\\…?** Browsers don't reveal it. Paths start at the folder you picked.
- **Why only a modified date?** Browsers don't expose created or accessed dates.
- **Empty folders missing in Firefox or Safari?** Upload mode can't see empty folders. Use Edge or Chrome.
- **How big a folder can I scan?** Up to a few hundred thousand files works well on a typical laptop. For bigger trees, scan subfolders separately.
- **Where did my last scan go?** In Scan History. Click Open to reload it, or download its reports from its row. Browsers can clear this storage, so export reports you must keep.
- **Where are downloaded reports saved?** In your browser's Downloads folder (normally `C:\Users\<you>\Downloads`).
- **Comparing two scans** is planned for a later release.
