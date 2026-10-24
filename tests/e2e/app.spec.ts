import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { unzipSync, strFromU8 } from 'fflate';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A real folder on disk for the upload path (S06): 5 files, 4 folders, 1,124 bytes.
function makeFolder(): string {
  const base = mkdtempSync(join(tmpdir(), 'fia-e2e-'));
  const root = join(base, 'Project');
  mkdirSync(join(root, 'docs', 'deep'), { recursive: true });
  mkdirSync(join(root, 'img'), { recursive: true });
  writeFileSync(join(root, 'readme.txt'), '0123456789');                 // 10
  writeFileSync(join(root, 'docs', 'copy.txt'), '0123456789');           // 10
  writeFileSync(join(root, 'docs', '=formula.csv'), 'a,b');               // 3
  writeFileSync(join(root, 'docs', 'deep', 'big.bin'), Buffer.alloc(1000)); // 1000
  writeFileSync(join(root, 'img', 'logo.png'), Buffer.alloc(101, 7));     // 101
  return root;
}

const statValue = (p: Page, label: string) => p.locator('.stat', { has: p.locator('.stat-label', { hasText: new RegExp(`^${label}$`, 'i') }) }).locator('.stat-value');
const nav = (p: Page, label: string) => p.locator('nav button', { hasText: label });

test('S06 E2E: real folder upload scans in a Web Worker with correct totals', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/Detect duplicate files/).check();
  await page.locator('input[type=file]').setInputFiles(makeFolder());
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(statValue(page, 'Files')).toHaveText('5');
  await expect(statValue(page, 'Folders')).toHaveText('4');
  await expect(page.getByText('1,124 bytes')).toBeVisible();
  await expect(statValue(page, 'Duplicate copies')).toHaveText('10 B');
  await expect(page.getByText(/Scanned on the main thread/)).toHaveCount(0); // the worker did the work
});

test('S02 E2E: folder picker path (picker stubbed) scans and reports', async ({ page }) => {
  await page.addInitScript(() => {
    const file = (name: string, text: string) => ({ kind: 'file', name, getFile: async () => new File([text], name, { lastModified: 0 }) });
    const dir = (name: string, kids: Array<[string, unknown]>) => ({ kind: 'directory', name, async *entries() { for (const k of kids) yield k; } });
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = async (o: { mode: string }) => {
      if (o.mode !== 'read') throw new Error('write access requested');
      return dir('Picked', [['a.txt', file('a.txt', 'aaaa')], ['sub', dir('sub', [['b.txt', file('b.txt', 'bb')]])], ['empty', dir('empty', [])]]);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Choose folder/ }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(statValue(page, 'Files')).toHaveText('2');
  await expect(statValue(page, 'Folders')).toHaveText('3');
  await nav(page, 'Empty Folders').click();
  await expect(page.getByText('Picked/empty')).toBeVisible();
});

test('S18/S19 E2E: Excel and CSV ZIP downloads open and reconcile', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(makeFolder());
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const [x] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Excel/ }).click()]);
  expect(x.suggestedFilename()).toMatch(/^Project_inventory_\d{4}-\d{2}-\d{2}\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(await x.path()));
  expect(wb.getWorksheet('File Inventory')!.rowCount - 1).toBe(5);
  expect(wb.getWorksheet('Folder Summary')!.rowCount - 1).toBe(4);
  await expect(page.getByText(/row count matched/)).toBeVisible();

  const [z] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /All CSVs/ }).click()]);
  const zip = unzipSync(readFileSync(await z.path()));
  const inv = strFromU8(zip['Project_file_inventory.csv']);
  expect(inv.trim().split('\r\n')).toHaveLength(6);
  expect(inv).toContain(`'=formula.csv`);
});

test('S24 E2E: no request leaves the page origin during scan and export', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
  await page.goto('/');
  await page.getByLabel(/Detect duplicate files/).check();
  await page.locator('input[type=file]').setInputFiles(makeFolder());
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Excel/ }).click()]);
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /All CSVs/ }).click()]);
  expect(external).toEqual([]);
});

test('S32 E2E: phone width has no horizontal scroll on any screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const widths: Record<string, number> = { 'New Scan': await page.evaluate(() => document.documentElement.scrollWidth) };
  await page.getByRole('button', { name: /sample data/ }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  for (const s of ['Dashboard', 'Folder Explorer', 'File Inventory', 'Folder Summary', 'Storage Analysis', 'Duplicate Files', 'Empty Folders', 'Scan Errors', 'Scan History', 'Settings']) {
    await nav(page, s).click();
    await page.waitForTimeout(150);
    widths[s] = await page.evaluate(() => document.documentElement.scrollWidth);
  }
  for (const [s, w] of Object.entries(widths)) expect(w, s).toBeLessThanOrEqual(390);
});

test('S34 E2E: keyboard-only user can run the sample scan and reach results', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /sample data/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await nav(page, 'File Inventory').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'File Inventory', exact: true })).toBeVisible();
});

test('S35 E2E: Folder Explorer shows real folder counts and where each file is', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(makeFolder());
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Where your files are' })).toBeVisible();
  await page.getByRole('button', { name: 'docs', exact: true }).click();
  const docs = page.getByRole('treeitem', { name: /^docs —/ });
  await expect(docs).toContainText('2 files here');
  await expect(docs).toContainText('3 in total');
  await expect(page.getByRole('treeitem', { name: /^copy\.txt —/ })).toBeVisible();
  await page.getByLabel('Find a file or folder').fill('big');
  await expect(page.getByText('1 match')).toBeVisible();
  await expect(page.getByRole('treeitem')).toHaveCount(4); // Project › docs › deep › big.bin
});

test('S39 E2E: a large scan (~26,000 files, ~22,000 folders) survives a page reload and can be reopened and exported', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    // 22,000 folders × ~1.4 files each, built lazily in the page (no real disk needed).
    const file = (name: string, size: number) => ({ kind: 'file', name, getFile: async () => ({ size, lastModified: 1_700_000_000_000, name }) });
    const dir = (name: string, kids: () => Array<[string, unknown]>) => ({ kind: 'directory', name, async *entries() { for (const k of kids()) yield k; } });
    let fileNo = 0;
    const leaf = (i: number) => dir(`case-${i}`, () => (i % 5 === 0 ? [] : [[`doc-${++fileNo}.pdf`, file(`doc-${fileNo}.pdf`, 1000 + (i % 97))], ...(i % 2 ? [[`scan-${++fileNo}.jpg`, file(`scan-${fileNo}.jpg`, 50_000)]] : [])] as Array<[string, unknown]>));
    const mid = (m: number) => dir(`dept-${m}`, () => Array.from({ length: 100 }, (_, i) => [`case-${m * 100 + i}`, leaf(m * 100 + i)] as [string, unknown]));
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = async () => dir('BIG', () => Array.from({ length: 218 }, (_, m) => [`dept-${m}`, mid(m)] as [string, unknown]));
  });
  await page.goto('/');
  let t = Date.now();
  await page.getByRole('button', { name: /Choose folder/ }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 180_000 });
  const files = Number((await page.locator('.stat', { hasText: /^Files/ }).first().locator('.stat-value').innerText()).replace(/,/g, ''));
  expect(files).toBeGreaterThan(25_000);
  console.log(`scan: ${Date.now() - t} ms, ${files} files`);
  await page.locator('nav button', { hasText: 'Scan History' }).click();
  t = Date.now();
  await expect(page.getByRole('button', { name: 'Open scan of BIG' })).toBeEnabled({ timeout: 60_000 });
  console.log(`saved to history: ${Date.now() - t} ms`);

  await page.reload();
  t = Date.now();
  await page.getByRole('button', { name: /Open last scan/ }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });
  console.log(`reopened: ${Date.now() - t} ms`);
  await expect(page.locator('.stat', { hasText: /^Files/ }).first().locator('.stat-value')).toHaveText(files.toLocaleString('en-US'));

  await page.locator('nav button', { hasText: 'Scan History' }).click();
  t = Date.now();
  const [x] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.getByRole('button', { name: 'Download Excel for BIG' }).click()]);
  console.log(`excel from history: ${Date.now() - t} ms`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(await x.path()));
  expect(wb.getWorksheet('File Inventory')!.rowCount - 1).toBe(files);
});

test('S16 E2E: Storage Analysis Top-N and threshold boxes are visible and usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /sample data/ }).click();
  await page.locator('nav button', { hasText: 'Storage Analysis' }).click();
  for (const name of ['Top N', 'Large-file threshold (MB)']) {
    const box = await page.getByRole('spinbutton', { name, exact: true }).boundingBox();
    expect(box && box.height).toBeGreaterThan(20);
    await expect(page.getByRole('spinbutton', { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
  await page.getByRole('spinbutton', { name: 'Top N', exact: true }).fill('5');
  await expect(page.getByRole('heading', { name: 'Top 5 largest files' })).toBeVisible();
});
