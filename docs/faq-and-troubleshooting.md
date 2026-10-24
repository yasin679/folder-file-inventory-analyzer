---
id: IA-FAQ-04
title: FAQ and Troubleshooting
subtitle: Answers to common questions and fixes for common problems
audience: Users, administrators and support teams
---

# FAQ and Troubleshooting

## 1 Frequently asked questions

### 1.1 General

**Does the app ever change, move or delete my files?**

No. Folders are opened with read-only permission, and the app contains no code that writes to, moves, renames or deletes files. You can scan the same folder as often as you like.

**Is anything uploaded? Where do my files go?**

Nowhere. The scan runs inside your browser on your PC. No file, name or result is sent over the network, and there is no analytics or tracking. The "upload" in **Upload a folder…** is only the browser's name for the permission dialog; nothing is uploaded.

**Do I need to install anything or be an administrator?**

No. The app is a single web page. On Windows, double-click `Start Inventory Analyzer.bat`; it needs no administrator rights.

**Which browser should I use?**

Microsoft Edge or Google Chrome. They support every feature, including empty-folder detection. Firefox and Safari can scan with **Upload a folder…** but cannot see empty folders.

**Can it scan a network drive, OneDrive or SharePoint folder?**

It can scan any folder that appears in the folder picker with a drive letter or path, including mapped network drives and synced OneDrive or SharePoint folders. Files that are "online only" may report their full size without being downloaded, or fail to read and appear in Scan Errors. It cannot connect to a SharePoint site or cloud storage directly.

**Can it scan a whole drive such as C:\?**

Browsers do not allow picking a whole system drive or system folders such as `C:\Windows`. Pick a folder instead. Very large trees (several hundred thousand files) may exhaust the browser's memory; scan them in parts.

**Why are there no full paths like C:\Users\...?**

Browsers deliberately hide where the chosen folder is on disk. Paths start at the folder you chose, for example `Shared Drive/Finance/2024/invoice_001.pdf`.

**Why are there no "created" or "last accessed" dates, or hidden files?**

Browsers only expose a file's last-modified date. They also do not reveal the Windows or macOS "hidden" attribute. The app does not guess these. Names starting with "." can be included or left out with **Include dot-prefixed items**.

### 1.2 Counts and sizes

**What is the difference between "files here" and "in total"?**

"Files here" (direct) counts files sitting directly in a folder. "In total" (recursive) also counts every file in all its subfolders, at any depth. Each file is counted once in its own folder's "here" count and once in the "in total" count of every folder above it.

**Why does the size differ from what Windows Explorer shows?**

The app shows **logical size**: the size of the files' contents. Windows Explorer's "Size on disk" also includes unused space in disk clusters, compression and cloud placeholders. Compare against Explorer's "Size", not "Size on disk". Also check that dot-prefixed items were included and that there were no Scan Errors.

**Why does the file count differ from Windows Explorer?**

Check three things: whether **Include dot-prefixed items** was on (Explorer also counts these), whether Scan Errors lists folders that could not be opened (their files are not counted), and whether Explorer is showing hidden and system files. Folders that could not be opened are marked incomplete.

**Why is a folder "unknown" and not "empty"?**

Because the app could not open it, so it does not know what is inside. Reporting it as empty would be a guess. It appears in Scan Errors with the reason.

**How are duplicates found? Are files with the same name duplicates?**

No: the name does not matter. Files are grouped by size; files that share a size are read and fingerprinted with SHA-256; only files with identical fingerprints are duplicates. Duplicate detection is off by default because reading contents takes time.

**The app found duplicates. Will it remove them?**

No. It never deletes anything. Use the Duplicate Files screen or the Duplicate Files sheet to decide what to keep, then tidy up in Windows Explorer.

### 1.3 Reports and history

**Which report should I send to someone?**

The Excel workbook (**Excel (.xlsx)**). It has an Executive Summary and every report on its own sheet. The **Folder Tree** sheet answers "which folder has how many files, and where is each file".

**What if the folder has more than a million files?**

Excel sheets hold at most 1,048,576 rows. Larger reports continue on numbered sheets, for example "File Inventory (2)". Nothing is cut off. CSV files have no row limit.

**Can I get the reports of an earlier scan again?**

Yes, from **Scan History**: **Open** shows every screen again; **Excel** and **CSVs** download the reports straight away. Full results are kept for the newest 20 scans.

**Where is the scan history stored? Can colleagues see it?**

In your browser's storage on your PC only. Nobody else can see it. The desktop launcher and the shared link keep separate histories, and a private window keeps none.

**Can I compare two scans to see what changed?**

Not yet. Scan comparison is on the roadmap (Release Notes, IA-RN-07).

## 2 Troubleshooting

### 2.1 Opening the app

| Problem | Likely cause | What to do |
|---|---|---|
| Double-clicking the .bat file does nothing, or says it could not find the HTML file | The HTML file is not in the same folder as the .bat file | Keep `Start Inventory Analyzer.bat` and `Inventory Analyzer.html` together |
| "Windows protected your PC" | SmartScreen warning for a downloaded .bat file | Click **More info > Run anyway**, or open the HTML file directly in Edge |
| The .bat file was blocked by email | Mail filters block .bat attachments | Send only the HTML file, or share the folder on a drive |
| The shared link shows "Sign in to view this page" | The link has not been shared | The owner opens it on claude.ai and chooses **Share > Anyone with the link** |
| The page is blank in an old browser | Browser too old | Update Edge or Chrome |

### 2.2 Choosing a folder

| Message or problem | Likely cause | What to do |
|---|---|---|
| **Choose folder…** is greyed out | Firefox, Safari, or a browser without the folder picker | Use **Upload a folder…**, or switch to Edge or Chrome |
| "The folder picker is blocked in this context" | Opened inside the shared link's hosting page | Use **Upload a folder…**, or the desktop launcher |
| The browser says it can't open the folder because it contains system files | You picked a drive or a system folder | Pick a folder inside it |
| Nothing happens after closing the picker | You cancelled | Click **Choose folder…** again |
| "The browser returned no files" | The folder is empty, holds only empty subfolders (which upload mode cannot see), or the dialog was cancelled | Check the folder; use **Choose folder…** in Edge or Chrome to see empty folders |
| The upload dialog takes a long time before the scan starts | The browser lists every file first in upload mode | Wait, or use **Choose folder…** in Edge or Chrome |

### 2.3 During and after the scan

| Message or problem | Likely cause | What to do |
|---|---|---|
| Many permission-denied errors | Protected or system folders inside the selection | Pick a narrower folder, or ask for access |
| not-readable on some files | Files open or locked in another program (Outlook data files, open Office documents) | Close the program and scan again |
| "Scanned on the main thread" message | The browser did not allow a background worker | No action needed; results are identical. The page may feel slower on big folders. |
| The browser becomes slow or the tab crashes | Hundreds of thousands of files held in memory | Close other tabs and scan subfolders separately |
| No percentage is shown | The total number of files is not known until the folder has been walked | Expected; the counters show progress |
| Duplicate detection is very slow | Many large files share a size and must be read | Lower the hashing size limit in Settings, or scan a smaller folder |
| Many files "unverified" | Files above the hashing limit, or unreadable | Raise the hashing size limit in Settings if needed |
| Empty Folders is empty after an upload scan | Upload mode cannot see empty folders | Scan with **Choose folder…** in Edge or Chrome |

### 2.4 Downloads

| Message or problem | Likely cause | What to do |
|---|---|---|
| "Save cancelled — no file was saved" | You declined the save prompt (shared link) | Click the download button again and confirm |
| "Export failed: … No partial file was produced" | Usually not enough browser memory to build the workbook of a very large scan | Use **All CSVs (.zip)**, which uses less memory |
| Names with accents look wrong in a CSV | The CSV was opened with an old text import setting | Open it by double-clicking; the files are UTF-8 with a byte-order mark that Excel recognises |
| A cell starts with an apostrophe in the CSV | Protection against spreadsheet formula injection | Expected for values starting with `=`, `+`, `-` or `@` |

### 2.5 Scan History

| Message or problem | Likely cause | What to do |
|---|---|---|
| A scan shows **Summary only** and cannot be opened | Older than the newest 20 scans, made before v1.2, or made with **Keep full results** off | Scan the folder again |
| Scan History is empty after reopening the app | Private window, browsing data cleared, or a different way of opening the app (launcher vs shared link) | Use a normal window and the same way of opening; keep the Excel reports you need |
| "Browser storage is full, so this scan could not be stored" | The browser's storage quota for the app is used up | Delete old scans in Scan History, or free disk space |
| "Scan history is open in another tab with an older version of the app" | Two versions of the app are open | Close the other Inventory Analyzer tabs and try again |
| "IndexedDB is not available … scan history is disabled" | Storage blocked by browser settings or policy | Scanning and downloads still work; download the reports you need |

> [!TIP]
> **Still stuck?**
>
> Note the scan ID (Scan History or the Executive Summary sheet), the screen, and the exact message. A screenshot of **Scan Errors** helps. Bugs and questions can be raised as issues on the GitHub repository.
