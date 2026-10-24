// Captures the screenshots used in the guides (docs/images/NN-name.jpg).
// Usage:  npx vite build && npx vite preview --port 4173   (in one terminal)
//         node docs/build/capture_screenshots.mjs [http://localhost:4173]
// "-marked" images carry orange numbered markers that match the "#" tables in the User Guide.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = new URL('../images/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });

// A mock folder picker that returns a realistic, fictional folder so Scan History has real entries
// (sample-data runs are deliberately not recorded in history). `slow` makes progress visible.
await ctx.addInitScript(() => {
  const T = Date.UTC(2026, 8, 14, 9, 30);
  const file = (name, size, slow) => ({ kind: 'file', name, getFile: async () => { if (slow) await new Promise((r) => setTimeout(r, 25)); return { size, lastModified: T - size % 9e9, name }; } });
  const dir = (name, kids) => ({ kind: 'directory', name, async *entries() { for (const k of kids) yield [k.name, k]; } });
  const many = (prefix, ext, n, base, slow) => Array.from({ length: n }, (_, i) => file(`${prefix}_${String(i + 1).padStart(3, '0')}.${ext}`, base + i * 7919, slow));
  const build = (root, slow) => dir(root, [
    dir('Budgets', [...many('budget_fy26', 'xlsx', 14, 180000, slow), dir('Archive', many('budget_fy24', 'xlsx', 9, 150000, slow))]),
    dir('Invoices', [dir('2025', many('INV-2025', 'pdf', 60, 90000, slow)), dir('2026', many('INV-2026', 'pdf', 48, 95000, slow))]),
    dir('Payroll', many('payslip_summary', 'csv', 24, 40000, slow)),
    dir('Audit Q3', [file('audit_findings.docx', 640000, slow), file('evidence.zip', 48000000, slow), dir('Working papers', [])]),
    file('README.txt', 2100, slow),
  ]);
  window.showDirectoryPicker = async () => {
    const n = Number(sessionStorage.getItem('pick') || 0) + 1; sessionStorage.setItem('pick', String(n));
    if (sessionStorage.getItem('slow')) return build('Finance Share', true);
    return n % 2 ? build('Finance Share', false) : build('Projects 2026', false);
  };
});

const page = await ctx.newPage();
const nav = (label) => page.locator('nav button', { hasText: label });
const heading = (name) => page.getByRole('heading', { name, level: 1 });

/** Draw orange outlines with numbered markers around the given locators. */
async function mark(items) {
  const boxes = [];
  for (const [n, loc, pad = 4] of items) {
    const b = await loc.first().boundingBox();
    if (!b) throw new Error(`marker ${n}: element not visible`);
    boxes.push({ n, x: b.x - pad, y: b.y - pad, w: b.width + pad * 2, h: b.height + pad * 2 });
  }
  await page.evaluate((boxes) => {
    document.getElementById('__marks')?.remove();
    const host = document.createElement('div');
    host.id = '__marks';
    host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none';
    for (const b of boxes) {
      const x = b.x + scrollX, y = b.y + scrollY;
      const r = document.createElement('div');
      r.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${b.w}px;height:${b.h}px;border:2.5px solid #f76707;border-radius:7px;box-shadow:0 0 0 2px rgba(255,255,255,.7)`;
      const c = document.createElement('div');
      c.textContent = String(b.n);
      c.style.cssText = `position:absolute;left:${Math.max(2, x - 13)}px;top:${Math.max(2, y - 13)}px;width:24px;height:24px;border-radius:50%;background:#f76707;color:#fff;font:700 13px/24px Inter,Segoe UI,Arial,sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.35);border:2px solid #fff`;
      host.append(r, c);
    }
    document.body.append(host);
  }, boxes);
}
const unmark = () => page.evaluate(() => document.getElementById('__marks')?.remove());
async function shot(name, opts = {}) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 74, ...opts });
  await unmark();
  console.log('saved', name);
}
const top = (h) => ({ clip: { x: 0, y: 0, width: 1400, height: h } });

// --- New Scan --------------------------------------------------------------------------------
await page.goto(BASE);
await heading('New Scan').waitFor();
await mark([
  [1, page.locator('.steps')],
  [2, page.getByRole('button', { name: /Read the User Guide/ })],
  [3, page.locator('.panel', { hasText: 'Scan options' }).first()],
  [4, page.getByRole('button', { name: /Choose folder/ })],
  [5, page.getByRole('button', { name: /Upload a folder/ })],
  [6, page.getByRole('button', { name: /Try with sample data/ })],
  [7, page.locator('details.caps summary')],
]);
await shot('02-new-scan-marked', { fullPage: true });

// --- Progress (slow mock folder) -------------------------------------------------------------
await page.evaluate(() => sessionStorage.setItem('slow', '1'));
await page.getByRole('button', { name: /Choose folder/ }).click();
await page.getByText('Inventorying files and folders').waitFor();
await page.waitForTimeout(1600);
await mark([
  [1, page.locator('.phase')],
  [2, page.locator('.bar')],
  [3, page.locator('.stats.compact')],
  [4, page.locator('p.current')],
  [5, page.getByRole('button', { name: 'Cancel scan' })],
]);
await shot('03-scan-progress-marked', top(560));
await heading('Dashboard').waitFor({ timeout: 60000 });
await page.evaluate(() => sessionStorage.removeItem('slow'));

// --- Sample data scan: dashboard and all report screens ----------------------------------------
await nav('New Scan').click();
await page.getByRole('button', { name: /Try with sample data/ }).click();
await heading('Dashboard').waitFor();
await shot('01-dashboard');
await mark([
  [1, page.locator('aside nav')],
  [2, page.locator('.crumbs')],
  [3, page.locator('.exports')],
  [4, page.locator('.content > .callout').first()],
  [5, page.locator('.stats').first()],
  [6, page.locator('.panel', { hasText: 'Key findings' })],
]);
await shot('04-dashboard-marked');
await page.locator('.panel', { hasText: 'Where your files are' }).scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollTo(0, document.querySelector('.panel .where').closest('.panel').getBoundingClientRect().top + scrollY - 110));
await mark([
  [1, page.locator('table.where tbody tr').first().locator('button')],
  [2, page.locator('table.where thead')],
  [3, page.getByRole('button', { name: /Open Folder Explorer/ })],
]);
await shot('05-where-files-are-marked');
await page.evaluate(() => window.scrollTo(0, document.querySelector('.grid2').getBoundingClientRect().top + scrollY - 110));
await shot('06-dashboard-charts');
await page.evaluate(() => window.scrollTo(0, 0));

// Export toolbar close-up with the single-CSV list open is a native control; show the toolbar instead.
await mark([
  [1, page.getByRole('button', { name: /Excel \(\.xlsx\)/ })],
  [2, page.getByRole('button', { name: /All CSVs/ })],
  [3, page.getByRole('combobox', { name: 'Download one CSV' })],
]);
await shot('07-export-buttons-marked', { clip: { x: 760, y: 0, width: 640, height: 92 } });

// --- Folder Explorer -----------------------------------------------------------------------------
await page.evaluate(() => window.scrollTo(0, document.querySelector('table.where').getBoundingClientRect().top + scrollY - 200));
await page.locator('table.where tbody tr').first().locator('button').click();
await heading('Folder Explorer').waitFor();
await page.waitForTimeout(300);
await page.evaluate(() => window.scrollTo(0, 0));
const sel = page.locator('.tree-row.selected');
await mark([
  [1, page.getByRole('textbox', { name: 'Find a file or folder' })],
  [2, page.locator('.panel .filters').getByRole('button', { name: 'Expand all' })],
  [3, page.locator('.tree-row.folder').first().locator('.twisty')],
  [4, sel.locator('.tmeta')],
  [5, sel.locator('.tsize')],
  [6, page.locator('.tree-row.file').first()],
]);
await shot('08-folder-explorer-marked');
await page.getByRole('textbox', { name: 'Find a file or folder' }).fill('contract');
await page.waitForTimeout(300);
await mark([
  [1, page.getByRole('textbox', { name: 'Find a file or folder' })],
  [2, page.locator('.panel .filters .muted')],
  [3, page.locator('.tree-row.match').first()],
]);
await shot('09-folder-explorer-search-marked');

// --- File Inventory ------------------------------------------------------------------------------
await nav('File Inventory').click();
await heading('File Inventory').waitFor();
await page.locator('.pager select').selectOption('25');
await mark([
  [1, page.locator('.panel-note').first()],
  [2, page.locator('.panel .filters').first()],
  [3, page.locator('th', { hasText: 'Size' }).first()],
  [4, page.getByRole('button', { name: /^Show .* in folder tree$/ }).first(), 3],
  [5, page.locator('.pager')],
]);
await shot('10-file-inventory-marked', { fullPage: true });

// --- Folder Summary --------------------------------------------------------------------------------
await nav('Folder Summary').click();
await heading('Folder Summary').waitFor();
await mark([
  [1, page.locator('.panel .filters').first()],
  [2, page.locator('td button.link.strong').first()],
  [3, page.locator('th', { hasText: 'Files (direct)' })],
  [4, page.locator('th', { hasText: 'Files (recursive)' })],
  [5, page.locator('th', { hasText: 'Contents' })],
  [6, page.locator('th', { hasText: 'Completeness' })],
]);
await shot('11-folder-summary-marked');

// --- Storage Analysis ------------------------------------------------------------------------------
await nav('Storage Analysis').click();
await heading('Storage Analysis').waitFor();
await mark([
  [1, page.locator('.filters.toolbar')],
  [2, page.locator('.panel', { hasText: /largest files/ }).first()],
  [3, page.locator('.panel', { hasText: /largest folders/ }).first()],
]);
await shot('12-storage-analysis-marked');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot('13-storage-analysis-lower');
await page.evaluate(() => window.scrollTo(0, 0));

// --- Empty folders, errors, duplicates (off) ----------------------------------------------------------
await nav('Empty Folders').click();
await heading('Empty Folders').waitFor();
await shot('14-empty-folders', top(560));
await nav('Scan Errors').click();
await heading('Scan Errors').waitFor();
await mark([
  [1, page.locator('p.hint').first()],
  [2, page.locator('th', { hasText: 'Category' })],
  [3, page.locator('th', { hasText: 'Message' })],
]);
await shot('15-scan-errors-marked', top(520));
await nav('Duplicate Files').click();
await shot('16-duplicates-off', top(330));

// --- Duplicates on (sample data with SHA-256) -------------------------------------------------------
await nav('New Scan').click();
await page.getByText('Detect duplicate files (SHA-256)').click();
await page.getByRole('button', { name: /Try with sample data/ }).click();
await heading('Dashboard').waitFor();
await nav('Duplicate Files').click();
await page.locator('.dup-head').first().click();
await mark([
  [1, page.locator('.stats').first()],
  [2, page.locator('.dup-head').first()],
  [3, page.locator('.dup ul').first()],
]);
await shot('17-duplicates-marked', top(700));

// --- Scan History (two recorded scans via the folder picker) -------------------------------------
for (let i = 0; i < 2; i++) {
  await nav('New Scan').click();
  await page.getByRole('button', { name: /Choose folder/ }).click();
  await heading('Dashboard').waitFor();
  await page.waitForTimeout(600);
}
await nav('Scan History').click();
await page.waitForTimeout(500);
await mark([
  [1, page.locator('tbody tr').first().locator('td').first()],
  [2, page.locator('tbody tr').first().locator('td').nth(1)],
  [3, page.getByRole('button', { name: /^Open scan of/ }).nth(1)],
  [4, page.getByRole('button', { name: /^Download Excel for/ }).nth(1)],
  [5, page.getByRole('button', { name: /^Download CSV ZIP for/ }).nth(1)],
  [6, page.getByRole('button', { name: /^Delete scan of/ }).nth(1)],
  [7, page.getByRole('button', { name: 'Clear all history' })],
]);
await shot('18-scan-history-marked', top(560));

// Reload = closing and reopening the app: New Scan offers the last scan.
await page.reload();
await heading('New Scan').waitFor();
await page.waitForTimeout(500);
await mark([[1, page.getByRole('button', { name: 'Open last scan' })]]);
await shot('19-open-last-scan-marked', top(250));
await nav('Scan History').click();
await page.getByRole('button', { name: /^Open scan of Finance Share/ }).first().click();
await heading('Dashboard').waitFor();
await mark([[1, page.locator('.crumbs .badge', { hasText: 'Saved scan' })], [2, page.locator('.content > .callout', { hasText: 'Saved scan from' })]]);
await shot('20-reopened-scan-marked', top(300));

// --- Settings ------------------------------------------------------------------------------------
await nav('Settings').click();
await heading('Settings').waitFor();
await mark([
  [1, page.locator('.panel', { hasText: 'Default scan options' }).locator('.options')],
  [2, page.getByRole('spinbutton', { name: 'Hashing size limit (MB)' })],
  [3, page.getByRole('button', { name: 'Restore defaults' })],
  [4, page.getByText('Keep full results of past scans on this PC')],
  [5, page.getByRole('button', { name: 'Clear stored scan history' })],
  [6, page.locator('.panel', { hasText: 'Privacy & limitations' })],
]);
await shot('21-settings-marked', { fullPage: true });

// --- Help & Documents -------------------------------------------------------------------------------
await nav('Help & Documents').click();
await heading('Help & Documents').waitFor();
await mark([
  [1, page.locator('.help-tabs')],
  [2, page.locator('.doc-head .doc-id')],
  [3, page.getByRole('button', { name: /as PDF$/ })],
  [4, page.locator('article.doc figure').first()],
]);
await shot('22-help-marked');

// --- Phone width ---------------------------------------------------------------------------------
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await phone.goto(BASE);
await phone.getByRole('button', { name: /Try with sample data/ }).click();
await phone.getByRole('heading', { name: 'Dashboard', level: 1 }).waitFor();
await phone.evaluate(() => window.scrollTo(0, 0));
await phone.waitForTimeout(300);
await phone.screenshot({ path: `${OUT}23-phone.jpg`, type: 'jpeg', quality: 72 });
console.log('saved 23-phone');

await browser.close();
