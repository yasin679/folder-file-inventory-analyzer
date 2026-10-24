# Documentation

| ID | Document | For | Read online | PDF |
|---|---|---|---|---|
| IA-UG-01 | User Guide | Everyone who scans folders | [user-guide.md](user-guide.md) | [PDF](pdf/IA-UG-01_User_Guide.pdf) |
| IA-IG-02 | Installation and Administration Guide | Administrators, IT support | [installation-and-administration.md](installation-and-administration.md) | [PDF](pdf/IA-IG-02_Installation_and_Administration_Guide.pdf) |
| IA-QS-03 | Quick Start | New users | [quick-start.md](quick-start.md) | [PDF](pdf/IA-QS-03_Quick_Start.pdf) |
| IA-FAQ-04 | FAQ and Troubleshooting | Everyone | [faq-and-troubleshooting.md](faq-and-troubleshooting.md) | [PDF](pdf/IA-FAQ-04_FAQ_and_Troubleshooting.pdf) |
| IA-TD-05 | Technical Design | Developers, reviewers, security | [technical-design.md](technical-design.md) | [PDF](pdf/IA-TD-05_Technical_Design.pdf) |
| IA-UAT-06 | UAT Test Cases | Testers, sign-off owners | [uat-test-cases.md](uat-test-cases.md) | [PDF](pdf/IA-UAT-06_UAT_Test_Cases.pdf) |
| IA-RN-07 | Release Notes v1.2 | Everyone | [release-notes.md](release-notes.md) | [PDF](pdf/IA-RN-07_Release_Notes_v1.2.pdf) |

The same seven guides are built into the app under **Help & Documents**.

The product requirements the app was built from are in [PRD and Master Prompt.docx](PRD%20and%20Master%20Prompt.docx).

The Markdown files are the source. The PDFs are generated from them, with screenshots from `images/`:

```bash
pip install markdown pypdf playwright
playwright install chromium
python docs/build/build_pdfs.py
```

To refresh the screenshots, run the app with `npx vite build && npx vite preview --port 4173`, then `node docs/build/capture_screenshots.mjs`.
