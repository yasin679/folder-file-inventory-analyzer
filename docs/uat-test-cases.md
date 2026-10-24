---
id: IA-UAT-06
title: UAT Test Cases
subtitle: User acceptance tests for the desktop launcher, the shared link and every screen
audience: Testers, product owner and IT support
landscape: true
---

# UAT Test Cases

## 1 Introduction

### 1.1 Purpose

These test cases confirm that Inventory Analyzer v1.2 works on your own PCs, in your own browsers and on your own folders before it is used for real work. They cover every screen, both ways of choosing a folder, every status, the reports, scan history, privacy and the shared link.

### 1.2 How to use this document

1. Set up the test environment in section 1.3.
2. Run the cases in order. Later cases reuse scans made earlier.
3. Write P (pass) or F (fail) in the last column. For a fail, note the scan ID and what you saw in section 15 (Defect log).
4. Sign off in section 16 when all mandatory cases pass.

### 1.3 Test environment

| Item | Value |
|---|---|
| PC | A standard Windows 10 or 11 user PC, without administrator rights |
| App | `Start Inventory Analyzer.bat` and `Inventory Analyzer.html` v1.2 in one folder; the shared link, if your team will use it |
| Browsers | Microsoft Edge and Google Chrome (all cases); Firefox or Safari (cases marked "upload") |
| Sample data | Built in: New Scan > **Try with sample data** |
| Test folder | A copy of a real team folder with at least 1,000 files and a few subfolders. Add: one empty folder; one folder containing only an empty subfolder; two identical files with different names; one file named `=1+1.txt`; one file with accents in its name, such as `Résumé – Ünïcødé.docx`; one folder named `.hidden-test` with one file in it |
| Locked file | Any Office document in the test folder, open in Word or Excel during case UAT-24 |
| Reference counts | Right-click the test folder in Windows Explorer > **Properties**: note the number of files and folders and the **Size** |

> [!NOTE]
> **Expected sample counts**
>
> The sample folder always gives: 318 files, 27 folders, 1.03 GB (1,111,158,476 bytes), status Complete with errors, 1 error (`Shared Drive/Finance/Audit (restricted)`, permission-denied), 7 empty folders, 3 files at or above 100 MB, 21 file types. Without dot-prefixed items: 305 files, 26 folders, 2 skipped. With duplicate detection: 2 groups, 4 files, 475 KB redundant.

### 1.4 Priority

| Priority | Meaning |
|---|---|
| M | Mandatory for go-live |
| H | High: fix before wide roll-out |
| L | Low: can be accepted with a workaround |

## 2 Starting the app

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-01 | M | Launcher opens the app | Double-click `Start Inventory Analyzer.bat` | The app opens in its own Edge window on **New Scan**; no install, no admin prompt | |
| UAT-02 | H | Launcher without the HTML file | Copy only the .bat file to another folder and run it | Message says it could not find `Inventory Analyzer.html` and to keep both files together | |
| UAT-03 | M | HTML file directly | Open `Inventory Analyzer.html` in Chrome | The same app opens; **Choose folder…** is enabled | |
| UAT-04 | M | Menu before a scan | Look at the menu | Dashboard to Scan Errors are greyed out; New Scan, Scan History, Settings and Help & Documents work | |
| UAT-05 | H | Capability check | Expand **Browser capability check** in Edge | All six items show Available | |

## 3 Sample data

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-06 | M | Sample scan | **Try with sample data** | Dashboard with **Sample data** label; counts as in the note in section 1.3 | |
| UAT-07 | M | Where your files are | Read the table | Engineering 139, Photos 70, Finance 55, Marketing 30, HR 22, files directly in Shared Drive 2, Empty project 0 | |
| UAT-08 | M | Sample not recorded | Open **Scan History** | No sample run is listed | |

## 4 Choosing a folder and scanning

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-09 | M | Choose folder | New Scan > **Choose folder…** > pick the test folder > **View files** | Scan runs and the dashboard opens with access mode **Folder picker** | |
| UAT-10 | M | Counts match Windows | Compare files, folders and size with the Windows Properties reference | Files and folders match (folders on the dashboard include the selected folder itself, so expect one more than Windows shows). Size matches Explorer's **Size**, not "Size on disk" | |
| UAT-11 | M | Read-only | Before and after the scan, compare the test folder's file count, names and modified dates | Nothing changed | |
| UAT-12 | H | Cancel the picker | **Choose folder…**, then close the picker | Nothing happens; no error | |
| UAT-13 | M | Progress | Scan a large folder (10,000+ files) | Phase, moving bar, counters, current path and elapsed time update; no fake percentage | |
| UAT-14 | M | Cancel a scan | During UAT-13, click **Cancel scan** | Results so far are shown, labelled **Cancelled — partial** on the dashboard, in the history and in the Excel summary | |
| UAT-15 | M | Upload a folder (upload) | In Firefox or Safari: **Upload a folder…** > pick the test folder > confirm | Scan completes; access mode **Folder upload**; nothing is sent over the network | |
| UAT-16 | H | Upload hides empty folders (upload) | After UAT-15 open **Empty Folders** | Warning that upload mode cannot see empty folders | |
| UAT-17 | M | Exclude dot-prefixed items | Untick **Include dot-prefixed items**, scan the test folder | `.hidden-test` and its file are not listed; the dashboard counts them as skipped | |
| UAT-18 | H | Options remembered | Change Top-N to 10, close and reopen the app | Top-N is still 10; duplicate detection is off | |

## 5 Dashboard

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-19 | M | Totals | Scan the test folder; read the totals | Files, folders, size, average, largest file and subfolder with paths, duration and status are shown | |
| UAT-20 | M | Where your files are | Click the first folder in **Where your files are** | Folder Explorer opens with that folder highlighted and expanded | |
| UAT-21 | H | Key findings and charts | Read key findings; hover over a chart bar | Sensible findings; the bar shows its value | |

## 6 Folder Explorer

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-22 | M | Counts per folder | Open a folder you know; compare **files here** and **in total** with Windows Explorer | Both counts correct | |
| UAT-23 | M | Find a file | Type part of a known file name | Only matches and their folders show, opened, with a match count | |
| UAT-24 | H | Locked file | Rescan while an Office document in the folder is open | The file is listed; any read problem appears in Scan Errors as not-readable or metadata error, with a hint | |
| UAT-25 | M | Empty folders in the tree | Find the empty test folders | Shown as **empty** and **no files (only empty subfolders)** | |

## 7 File Inventory and Folder Summary

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-26 | M | Search and filters | Search a name; filter by extension, size and date; **Reset** | Count updates with each filter; Reset shows all files | |
| UAT-27 | M | Show in folder tree | Click 📍 on any file | Folder Explorer opens with the file selected inside its folder | |
| UAT-28 | M | Unicode name | Search `Résumé` | The file shows with its exact name | |
| UAT-29 | M | Direct vs recursive | In Folder Summary find a folder with subfolders | Recursive files and size ≥ direct; values match Windows Explorer | |
| UAT-30 | H | Open a folder's files | Click a folder name in Folder Summary | File Inventory shows **In folder** with that path, and only files in that folder and below (not in a folder whose name merely starts the same) | |
| UAT-31 | H | Paging and sorting | Change rows per page to 100; sort by Size, then by Modified | Pages and sorting work | |

## 8 Storage Analysis

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-32 | M | Top N | Change **Top N** to 5 | Lists show 5 items; headings say "Top 5" | |
| UAT-33 | M | Large-file threshold | Change **Large-file threshold (MB)** to 1 | **Large files (≥ 1 MB)** lists every file of 1 MB or more | |
| UAT-34 | H | Extension summary | Read the table | Percentages add up to about 100%; counts match File Inventory per extension | |

## 9 Duplicate Files

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-35 | M | Off by default | Open **Duplicate Files** after a normal scan | Says detection was off; **Set up a scan with duplicate detection** returns to New Scan with it ticked | |
| UAT-36 | M | Duplicates found | Scan the test folder with duplicate detection on | The two identical files form one group; redundant size equals one file's size | |
| UAT-37 | M | Same name is not a duplicate | Add two different files with the same name in two folders; scan with detection on | They are not grouped | |
| UAT-38 | H | Never deletes | After UAT-36 check the folder | Both copies are still there | |

## 10 Empty Folders and Scan Errors

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-39 | M | Empty folders | Open **Empty Folders** after UAT-09 | Both empty test folders are listed with the right classification | |
| UAT-40 | M | Denied folder | Scan a folder containing a subfolder you have no access to (or use the sample data) | Dashboard warning; Scan Errors lists it as permission-denied with a hint; the folder is unknown, never empty; its parents are incomplete | |

## 11 Reports

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-41 | M | Excel | Click **Excel (.xlsx)**; open the file | Message confirms sheets and rows matched; Executive Summary, Folder Tree, File Inventory, Folder Summary, Extension Summary, Largest Files, Largest Folders, Empty Folders and Scan Errors sheets present | |
| UAT-42 | M | Excel row counts | Compare the File Inventory sheet's rows with the dashboard's file count | Equal | |
| UAT-43 | M | Folder Tree sheet | Read the Folder Tree sheet | Indented by level, folders bold, files under their folders, files here and in total per folder | |
| UAT-44 | M | CSV ZIP | Click **All CSVs (.zip)**; open each CSV in Excel | One CSV per report; accented names correct | |
| UAT-45 | M | Formula injection | Find `=1+1.txt` in the CSV and the Excel file | Shown as text, never calculated as 2 | |
| UAT-46 | H | Single CSV | **Single CSV…** > Scan Errors | One CSV with the stated number of rows | |
| UAT-47 | H | Duplicate sheet | Export after UAT-36 | Duplicate Files sheet and CSV present, with group and SHA-256 | |

## 12 Scan History

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-48 | M | Recorded | Open **Scan History** after UAT-09 and UAT-14 | Both scans listed with ID, times, status, counts and size; the open one says **open now** | |
| UAT-49 | M | Reopen after closing | Close the app window; open it again | New Scan offers **Open last scan**; it opens the scan labelled **Saved scan** with every screen working | |
| UAT-50 | M | Download from history | In Scan History click **Excel** and **CSVs** for an older scan | Both download for that scan without changing the open one | |
| UAT-51 | M | Delete | **Delete** one scan | It disappears; the others remain | |
| UAT-52 | H | Summary only | Settings > untick **Keep full results of past scans on this PC**; scan a folder | The new scan shows **Summary only**; Open, Excel and CSVs are greyed out | |
| UAT-53 | H | Clear all | **Clear all history** | The list is empty | |

## 13 Settings, privacy and Help

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-54 | M | No network | Press F12 > **Network**, clear it; scan the test folder and download Excel | No request is made to any other site | |
| UAT-55 | H | Restore defaults | Change options; click **Restore defaults** | Options return to: dot-items on, duplicates off, 100 MB, 25, 1,024 MB | |
| UAT-56 | M | Guides in the app | Open **Help & Documents**; open each tab | All seven guides readable with screenshots | |
| UAT-57 | H | Guide PDF | Click **PDF** on the User Guide | A formatted PDF with cover, contents and page numbers downloads | |
| UAT-58 | L | Phone width | Open the shared link on a phone; run the sample data | Every screen fits the width without sideways scrolling | |
| UAT-59 | H | Keyboard only | Using only Tab, Enter and the arrow keys, run the sample data and open File Inventory | Everything can be reached and used | |

## 14 Shared link

| ID | Pri | Test | Steps | Expected result | P/F |
|---|---|---|---|---|---|
| UAT-60 | M | Link is shared | Open the link in a private window, not signed in | The app opens (not "Sign in to view this page") | |
| UAT-61 | M | Scan on the link | **Choose folder…**; if blocked, **Upload a folder…** | Either the picker works, or a message explains it is blocked and upload works | |
| UAT-62 | M | Download on the link | Click **Excel (.xlsx)**; confirm the save prompt | The workbook downloads; declining says "Save cancelled — no file was saved" | |

## 15 Defect log

| # | UAT ID | Scan ID | Description | Severity | Status |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

## 16 Sign-off

| Summary | Count |
|---|---|
| Cases run | |
| Passed | |
| Failed | |
| Mandatory cases failed | |

| Role | Name | Decision | Signature and date |
|---|---|---|---|
| Product owner | | Accept / Reject | |
| IT support | | Accept / Reject | |
| Information security | | Accept / Reject | |
