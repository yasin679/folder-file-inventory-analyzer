---
id: IA-IG-02
title: Installation and Administration Guide
subtitle: Installing, sharing, hosting, updating and supporting Inventory Analyzer
audience: Administrators, IT support and the people who share the app with their team
---

# Installation and Administration Guide

## 1 About this guide

This guide explains how to install, share, host, update and support Inventory Analyzer. It is written for the person who sets the app up for themselves or a team: on Windows PCs, as a shared link, or on an internal web server.

For day-to-day use of the screens, see the User Guide (IA-UG-01). For the design and data model, see the Technical Design (IA-TD-05).

> [!WARNING]
> **Before you scan important folders**
>
> Version 1.2 is tested automatically in Chromium with 98 tests, including scans of 26,000 files. The folder picker itself was tested with a stand-in, because automated tests cannot click a real system dialog. Before rolling the app out, complete the go-live checklist in section 10 on your own PCs, with your own folders.

### 1.1 What is in the repository

| Part | Where it lives | Notes |
|---|---|---|
| Ready-to-run app | `Inventory Analyzer.html` | The whole application in one file, including the guides |
| Windows launcher | `Start Inventory Analyzer.bat` | Opens the HTML file in its own Microsoft Edge window |
| Source code | `src/` | React and TypeScript |
| Build scripts | `scripts/`, `vite.config.ts`, `package.json` | Build the single-file app and embed the guides |
| Documentation | `docs/` | These guides as Markdown, `docs/pdf/` as PDF, screenshots in `docs/images/`, builders in `docs/build/` |
| Product requirements | `docs/PRD and Master Prompt.docx` | The PRD v3.0 the app was built from |
| Tests | `tests/` | Unit, UI-scenario and end-to-end tests; `tests/SCENARIOS.md` lists the user scenarios |
| Test results | `test-reports/` | The latest test report |
| Sample exports | `sample-exports/` | An Excel workbook and CSVs produced from the test folder |

The app has no server, no database, no account system and no installer. It is a web page that runs entirely in the browser. Everything it stores stays in that browser on that PC.

## 2 Requirements

### 2.1 For people using the app

| Item | Requirement |
|---|---|
| Operating system | Windows 10 or 11 for the desktop launcher. Any desktop operating system with a supported browser for the HTML file or the shared link. |
| Browser | Microsoft Edge or Google Chrome (current version) for every feature. Firefox and Safari work with **Upload a folder** only. |
| Rights | No administrator rights. Read access to the folders being scanned. |
| Memory | 4 GB minimum. The whole inventory is held in memory, so a few hundred thousand files is the practical limit on a typical laptop. |
| Disk | A few megabytes for the app. Scan history uses browser storage, which grows with the size of the saved scans; only the newest 20 scans keep full results. |
| Network | None. The app works offline. The shared link needs access to claude.ai to open. |

### 2.2 Browser support

| Browser | Choose folder (picker) | Upload a folder | Empty folders | Duplicate detection | Scan history |
|---|---|---|---|---|---|
| Microsoft Edge (Windows 10, 11) | Yes | Yes | Yes (picker) | Yes | Yes |
| Google Chrome (desktop) | Yes | Yes | Yes (picker) | Yes | Yes |
| Firefox | No | Yes | No | Yes | Yes |
| Safari (macOS) | No | Yes | No | Yes | Yes |
| Phone and tablet browsers | No | Varies | No | Varies | Yes |

The New Scan screen checks the browser (**Browser capability check**) and greys out any option it cannot support.

### 2.3 For people building from source

| Item | Requirement |
|---|---|
| Node.js | Version 18 or later (built and tested with Node 22) |
| npm | Comes with Node.js |
| Python | 3.10 or later, only to rebuild the PDF guides |
| Git | To clone the repository |

## 3 Installation

Choose one of four ways to run the app. All four run the same app and produce identical reports.

| Option | Best for | Section |
|---|---|---|
| Windows desktop launcher | Everyday use on Windows PCs | 3.1 |
| The HTML file on any computer | macOS, Linux, or when .bat files are blocked | 3.2 |
| Shared link | Demos, colleagues outside your network, trying it out | 3.3 |
| Your own web server | A team-wide internal address | 3.4 |

### 3.1 Windows desktop launcher

Setup takes about a minute and needs no administrator rights.

1. Get the two files: download the ZIP from https://github.com/yasin679/folder-file-inventory-analyzer (**Code > Download ZIP**), or use the shared package you were sent.
2. Copy these two files into one folder, for example `C:\Users\<you>\Tools\Inventory Analyzer\`:
    - `Start Inventory Analyzer.bat`
    - `Inventory Analyzer.html`
3. Double-click **Start Inventory Analyzer.bat**. The app opens in its own Microsoft Edge window.
4. Optional: right-click the .bat file, choose **Send to > Desktop (create shortcut)** and rename the shortcut "Inventory Analyzer".
5. First run: click **Try with sample data** and check the dashboard shows 318 files (User Guide, Appendix A). Then scan a real folder.

> [!NOTE]
> **How the launcher works**
>
> The launcher runs `msedge --app="file:///…/Inventory Analyzer.html"`. If Edge is not found it opens the HTML file in the default browser. It installs nothing, changes no settings and needs no network. Keep the two files in the same folder.

If Windows shows **Windows protected your PC** the first time, click **More info > Run anyway**, or open the HTML file directly (section 3.2).

### 3.2 The HTML file on any computer

Open `Inventory Analyzer.html` in Edge or Chrome: double-click it if one of them is your default browser, or drag it into a browser window. Every feature works, including the folder picker and scan history.

In Firefox or Safari the app opens and scans with **Upload a folder**. Empty folders are not visible in that mode.

### 3.3 Shared link

The app is published as an artifact on claude.ai. The link is **private** until its owner shares it:

1. Open the Inventory Analyzer artifact on claude.ai while signed in as its owner.
2. Click **Share** and choose **Anyone with the link**.
3. Copy the link and send it.

Until step 2 is done, anyone else sees "Sign in to view this page". On the shared link:

- The browser asks you to confirm each download.
- The hosting page may block the folder picker. The app then says so and **Upload a folder…** works instead.
- Scan history is kept for that site in that browser, separate from the desktop launcher's history.
- The guides are built in (**Help & Documents**), so the one link carries everything.

### 3.4 Your own web server

`Inventory Analyzer.html` is a static file. It needs no server-side code.

1. Copy `Inventory Analyzer.html` to any static web host: IIS, nginx, Apache, an Azure Static Web App, GitHub Pages, or an internal file share published over HTTPS. Rename it `index.html` if you want it to open at the folder address.
2. Serve it over **HTTPS**. Browsers only allow the folder picker, duplicate fingerprinting and background scanning on secure pages (HTTPS or `localhost`).
3. Open the address in Edge or Chrome and run the sample-data check.

No configuration, database or environment variables are needed. The page makes no network requests after it loads.

### 3.5 Developer build

1. `git clone https://github.com/yasin679/folder-file-inventory-analyzer.git`
2. `cd folder-file-inventory-analyzer`
3. `npm install`
4. `npm run dev` and open http://localhost:5173

## 4 Configuration

There are no configuration files. Each person's settings live in their own browser.

| Setting | Where | Default | Stored in |
|---|---|---|---|
| Include dot-prefixed items | New Scan or Settings | On | Browser local storage |
| Detect duplicate files (SHA-256) | New Scan or Settings | Off; switches itself off for each new session | Not stored |
| Large-file threshold | New Scan or Settings | 100 MB | Browser local storage |
| Top-N report size | New Scan or Settings | 25 | Browser local storage |
| Hashing size limit (per file) | Settings | 1,024 MB | Browser local storage |
| Keep full results of past scans on this PC | Settings | On | Browser local storage |

**Restore defaults** in Settings resets the scan options. To change the defaults for everyone, change `DEFAULT_CONFIG` in `src/core/types.ts` and rebuild (section 7).

## 5 Data, privacy and security

### 5.1 What the app stores

| Data | Where it lives | How long | How to remove it |
|---|---|---|---|
| The open scan (file and folder names, paths, sizes, dates) | Browser memory | Until the window closes | Close the window |
| Scan summaries | Browser IndexedDB on this PC | Until deleted, or until the browser clears site data | Scan History > **Delete** or **Clear all history** |
| Full results of the newest 20 scans (names, paths, sizes, dates; never contents) | Browser IndexedDB on this PC | Until deleted, pushed out by newer scans, or cleared by the browser | As above, or Settings > **Clear stored scan history** |
| Scan options | Browser local storage | Until changed or cleared | Settings > **Restore defaults** |
| Downloaded reports | Wherever the user saves them (default Downloads) | The user's choice | Delete the files |

File contents are read only to compute fingerprints when duplicate detection is on, and are never stored.

### 5.2 Security controls

| Control | How it is applied |
|---|---|
| Read-only access | The folder picker is opened with read permission only. The app contains no code that creates, writes, moves, renames or deletes files. |
| No network use | The app makes no network requests with scan data, and has no analytics or telemetry. An automated test fails if any request leaves the page during a scan or export. |
| Least exposure | Browsers expose only the chosen folder, paths relative to it, and the last-modified date. Full disk paths and other folders are never visible. |
| Formula-injection protection | CSV cells starting with `=`, `+`, `-` or `@` are prefixed with `'`. Excel cells are written as plain values, never formulas. |
| No secrets | There are no accounts, passwords, keys or tokens anywhere in the app. |
| Supply chain | Five runtime libraries (React, ExcelJS, fflate, Recharts, and marked for the guides), all bundled into the file at build time. Nothing is loaded from the internet at run time. |

> [!IMPORTANT]
> **Reports contain folder and file names**
>
> The Excel and CSV reports list every file and folder name in the scanned folder. Treat them with the same care as the folder itself before sending them to anyone.

## 6 Distributing and updating

| Task | How |
|---|---|
| Share with colleagues | Send the two files (zipped), put them on a shared drive, or send the shared link. Some mail filters block .bat files: then send only the HTML file. |
| Update to a new version | Replace `Inventory Analyzer.html` with the new one. The launcher does not change. Scan history and settings are kept. |
| Update the shared link | Republish the artifact; the link stays the same. |
| Check the version | Settings > **About** shows it. The current release is **v1.2**. |
| Remove the app | Delete the two files. To remove stored history too, first use Settings > **Clear stored scan history**, or clear the browser's site data. |

## 7 Building from source

| Task | Command | Output |
|---|---|---|
| Install dependencies | `npm install` | `node_modules/` |
| Run for development | `npm run dev` | http://localhost:5173 |
| Production build (several files) | `npm run build` | `dist/` |
| Single-file build | `npm run build:single` | `dist-single/index.html`; copy it over `Inventory Analyzer.html` |
| Embed the guides only | `npm run docs:embed` | `src/generated/docs.ts` |
| Regenerate sample exports | `npm run samples` | `sample-exports/` |

Both builds run `docs:embed` first, which bundles the Markdown guides, their screenshots and the PDFs into the app for **Help & Documents**.

### 7.1 Rebuilding the guides

The Markdown files in `docs/` are the source. The PDFs and screenshots are generated:

```
pip install markdown pypdf playwright
playwright install chromium
python docs/build/build_pdfs.py                  # all guides -> docs/pdf/
python docs/build/build_pdfs.py user-guide       # one guide
```

To refresh the screenshots, start the app with `npx vite build && npx vite preview --port 4173`, then run `node docs/build/capture_screenshots.mjs` in a second terminal. Then rebuild the PDFs and the app.

## 8 Verifying a build

Run the automated tests before distributing a new build. Version 1.2 passes all 98.

| Suite | Command | Tests | What it proves |
|---|---|---|---|
| Unit | `npm run test:unit` | 42 | Counts, direct and recursive sizes, duplicates, errors, cancellation, folder tree, history storage, Excel and CSV correctness |
| UI scenarios | `npm run test:ui` | 47 | Every user scenario driven through the real app with clicks and typing |
| End-to-end | `npm run test:e2e` | 9 | The production build in Chromium: real folder scan, downloads reopened, no network, phone layout, keyboard use, large scan reopened after reload |
| Everything with coverage | `npm run test:all` | 98 | Writes coverage to `test-reports/coverage` |

Before the first end-to-end run, install the test browser once: `npx playwright install chromium`. The scenarios are listed in `tests/SCENARIOS.md`; the UAT cases for people are in IA-UAT-06.

## 9 Backup and retention

The app keeps no data of its own outside the browser, so there is nothing to back up on a server.

- **Reports are the record.** Download the Excel workbook for any scan you must keep, and store it with your other records.
- **Scan history is a convenience, not an archive.** Browsers can remove it at any time (private windows, clearing browsing data, low disk space). Only the newest 20 scans keep full results.
- **Moving to another PC** does not move history. Scan again on the new PC, or keep the reports.

## 10 Go-live checklist

| # | Check | Done |
|---|---|---|
| 1 | The app opens on a standard user PC with the launcher (or your chosen option) | |
| 2 | **Try with sample data** gives 318 files, 27 folders, 1.03 GB (IA-UG-01, Appendix A) | |
| 3 | **Choose folder…** works on a real folder; the folder's file count matches Windows Explorer's Properties | |
| 4 | **Upload a folder…** works in the browsers your team uses | |
| 5 | Excel and CSV downloads open in your version of Excel | |
| 6 | A scan reopens from Scan History after closing and reopening the app | |
| 7 | The mandatory UAT cases in IA-UAT-06 pass | |
| 8 | People know where the guides are (**Help & Documents**) and who to ask for help | |
| 9 | If you use the shared link: it is set to **Anyone with the link** and opens in a private window | |

## 11 Getting help

For error messages and common questions, see the FAQ and Troubleshooting guide (IA-FAQ-04). Bugs and requests can be raised as issues on the GitHub repository: https://github.com/yasin679/folder-file-inventory-analyzer.
