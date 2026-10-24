---
id: IA-QS-03
title: Quick Start
subtitle: From a folder to a downloaded inventory report in five steps
audience: New users
---

# Quick Start

## 1 Quick start

This card takes you from a folder on your PC to a downloaded Excel inventory in five steps. Full details for every screen are in the User Guide (IA-UG-01).

> [!IMPORTANT]
> **Three rules**
>
> **Read-only:** your files are never created, changed, moved, renamed or deleted. **Nothing leaves your PC:** the scan runs in your browser and nothing is uploaded. **No guessing:** anything that could not be read is shown as unknown or unverified, never as empty or duplicate.

### 1.1 Before you start

| You need | Example |
|---|---|
| The app: the desktop launcher, the HTML file, or the shared link | Double-click `Start Inventory Analyzer.bat` |
| Microsoft Edge or Google Chrome (Firefox and Safari work with **Upload a folder** only) | Edge on Windows 11 |
| Read access to the folder you want to inventory | `S:\Shared Drive` or `C:\Users\you\Documents\Projects` |

### 1.2 The five steps

| Step | Screen | What you do | Takes |
|---|---|---|---|
| 1 | New Scan | Keep the default options. Tick **Detect duplicate files** only if you want to find identical copies. | 10 sec |
| 2 | New Scan | Click **Choose folder…**, pick the folder and confirm **View files**. (Firefox, Safari, or if the picker is blocked: **Upload a folder…**) | 10 sec |
| 3 | Scan progress | Wait. A few thousand files take seconds. **Cancel scan** keeps what was found so far. | sec to min |
| 4 | Dashboard | Read the totals and key findings. **Where your files are** shows the files per top-level folder; click one to open it in the **Folder Explorer**. If there is a yellow message, open **Scan Errors**. | 2 min+ |
| 5 | Any results screen | Click **Excel (.xlsx)** (or **All CSVs (.zip)**). The file goes to your Downloads folder. | 10 sec |

![Figure 1: The dashboard tells you what is in the folder and where the space goes](images/04-dashboard-marked.jpg)

### 1.3 Default options

| Option | Default | When to change |
|---|---|---|
| Include dot-prefixed items | On | You want to leave out `.git`, `.cache` and similar folders |
| Detect duplicate files (SHA-256) | Off | You want to find identical copies (slower; reads file contents locally) |
| Large-file threshold | 100 MB | You care about smaller or larger "large" files |
| Top-N report size | 25 | You want longer or shorter "largest" lists |
| Keep full results of past scans (Settings) | On | You do not want file names kept in this browser |

### 1.4 Where to find answers

| Question | Screen |
|---|---|
| Which folder has how many files? | **Folder Explorer** (tree with "files here" and "in total"), or **Folder Summary** |
| Where is a particular file? | **Folder Explorer**: type part of its name; or **File Inventory**: search, then 📍 |
| What takes up the space? | **Dashboard** charts, **Storage Analysis** |
| Are there duplicate copies? | **Duplicate Files** (scan with duplicate detection on) |
| Which folders are empty? | **Empty Folders** |
| What could not be read? | **Scan Errors** |
| Can I get last week's report again? | **Scan History**: **Open**, **Excel** or **CSVs** |

### 1.5 What the statuses mean

| Status | Meaning | Your action |
|---|---|---|
| Complete | Everything was read | None |
| Complete with errors | Some items could not be read | Open **Scan Errors**; totals of folders marked incomplete may be low |
| Cancelled — partial | You stopped the scan | Scan again for full results |
| Failed | The scan could not run | Read the message and scan again |
| unknown (folder) | The folder could not be opened | See Scan Errors; it is never counted as empty |
| unverified (file) | The file could not be compared for duplicates | Usually none; raise the hashing limit in Settings if it is a very large file |

### 1.6 Try it safely first

1. On **New Scan** click **Try with sample data**.
2. You should see 318 files, 27 folders, 1.03 GB and **Complete with errors** (one folder refuses access on purpose).
3. Open **Folder Explorer** and type `contract`: two files, in two different folders.
4. Click **Excel (.xlsx)** and open the workbook.

> [!TIP]
> **Where to get help**
>
> In the app: **Help & Documents** in the menu. Installing or sharing the app: Installation and Administration Guide (IA-IG-02). Error messages and common questions: FAQ and Troubleshooting (IA-FAQ-04).
