// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
// The real worker module can't load under jsdom, and jsdom has no Worker, so the app takes its
// documented main-thread path. Worker behaviour is covered by controller tests and E2E.
vi.mock('../../src/worker/scan.worker?worker&inline', () => ({ default: class {} }));
import { act, fireEvent } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { strFromU8, unzipSync } from 'fflate';
import { downloadControl, network, saved } from './setup';
import {
  dir, installPicker, nav, renderApp, scanWithPicker, screen, stat, TREE, TREE_BYTES, TREE_FILES, TREE_FOLDERS,
  uploadFiles, user, waitFor, within, writeAttempts, type Spec,
} from './harness';

const blobBytes = (b: Blob) => new Promise<Uint8Array>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.onerror = rej; r.readAsArrayBuffer(b);
});
const blobText = async (b: Blob) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blobBytes(b));
const fileInput = () => document.querySelector('input[type=file]') as HTMLInputElement;
const rowsIn = (panelTitle: string) => {
  const panel = screen.getByRole('heading', { name: panelTitle }).closest('.panel') as HTMLElement;
  return within(panel).queryAllByRole('row').slice(1).filter((r) => !r.querySelector('.empty-cell'));
};
const upload = (files: File[]) => act(async () => {
  Object.defineProperty(fileInput(), 'files', { value: files, configurable: true });
  fireEvent.change(fileInput());
});

describe('S01 first visit', () => {
  it('shows scan options, both access modes and capabilities; data pages disabled', () => {
    installPicker(dir('Root', {}));
    renderApp();
    expect(screen.getByRole('heading', { name: 'New Scan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Choose folder/ })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: /Upload a folder/ })).toHaveProperty('disabled', false);
    expect(screen.getByText('Browser capability check')).toBeTruthy();
    for (const p of ['Dashboard', 'File Inventory', 'Folder Summary', 'Storage Analysis', 'Duplicate Files', 'Empty Folders', 'Scan Errors']) {
      expect(nav(p)).toHaveProperty('disabled', true);
    }
    expect(nav('Scan History')).toHaveProperty('disabled', false);
    expect((screen.getByLabelText(/Detect duplicate files/) as HTMLInputElement).checked).toBe(false);
  });
});

describe('S02 pick a folder and scan', () => {
  it('shows correct totals on the dashboard', async () => {
    await scanWithPicker();
    expect(stat('Files').getByText(String(TREE_FILES))).toBeTruthy();
    expect(stat('Folders').getByText(String(TREE_FOLDERS))).toBeTruthy();
    expect(stat('Accessible logical size').getByText(`${TREE_BYTES.toLocaleString()} bytes`)).toBeTruthy();
    expect(stat('Largest file').getByText('Root/media/video.mp4')).toBeTruthy();
    expect(stat('Largest subfolder').getByText('Root/media')).toBeTruthy();
    expect(screen.getAllByText('Complete with errors').length).toBeGreaterThan(0);
    expect(screen.getByText(/📁 Root/)).toBeTruthy();
    expect(nav('Dashboard')).toHaveProperty('disabled', false);
  });
});

describe('S03/S04/S05 picker outcomes', () => {
  it('S03 closing the picker does nothing', async () => {
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
    renderApp();
    await user().click(screen.getByRole('button', { name: /Choose folder/ }));
    expect(document.querySelector('.callout')).toBeNull();
    expect(screen.getByRole('heading', { name: 'New Scan' })).toBeTruthy();
  });
  it('S04 a blocked picker explains how to continue', async () => {
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = async () => { const e = new Error('Cross origin sub frames aren\'t allowed'); e.name = 'SecurityError'; throw e; };
    renderApp();
    await user().click(screen.getByRole('button', { name: /Choose folder/ }));
    expect((await screen.findByText(/folder picker is blocked/)).textContent).toMatch(/Upload a folder/);
  });
  it('S05 without the API the picker is disabled but upload works', () => {
    renderApp();
    expect(screen.getByRole('button', { name: /Choose folder/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Upload a folder/ })).toHaveProperty('disabled', false);
    expect(screen.getByText('Not supported in this browser')).toBeTruthy();
  });
});

describe('S06/S07 upload fallback', () => {
  it('S06 scans an uploaded folder and warns that empty folders are invisible', async () => {
    renderApp();
    await upload(uploadFiles(fileInput(), [['Up/a.txt', 'hello'], ['Up/sub/b.txt', 'world!'], ['Up/sub/deep/c.bin', '1234567']]));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(stat('Files').getByText('3')).toBeTruthy();
    expect(stat('Folders').getByText('3')).toBeTruthy();
    expect(stat('Accessible logical size').getByText('18 bytes')).toBeTruthy();
    expect(screen.getByText(/Folder upload/)).toBeTruthy();
    await user().click(nav('Empty Folders'));
    expect(screen.getByText(/do not expose empty folders/)).toBeTruthy();
  });
  it('S07 an empty selection is explained', async () => {
    renderApp();
    await upload([]);
    expect(await screen.findByText(/returned no files/)).toBeTruthy();
    expect(nav('Dashboard')).toHaveProperty('disabled', true);
  });
});

describe('S08 dot-prefixed items', () => {
  it('excluded items are skipped and counted', async () => {
    await scanWithPicker(TREE, { dots: false });
    expect(stat('Files').getByText(String(TREE_FILES - 1))).toBeTruthy();
    expect(stat('Status').getByText(/1 skipped/)).toBeTruthy();
  });
});

describe('S09/S10 duplicates', () => {
  it('S09 off by default; the page explains and sets up a scan with it enabled', async () => {
    const u = await scanWithPicker();
    await u.click(nav('Duplicate Files'));
    expect(screen.getByText(/Duplicate detection was/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Set up a scan with duplicate detection/ }));
    expect(screen.getByRole('heading', { name: 'New Scan' })).toBeTruthy();
    expect((screen.getByLabelText(/Detect duplicate files/) as HTMLInputElement).checked).toBe(true);
  });
  it('S10 finds identical content only; same name or same size is not a duplicate', async () => {
    const u = await scanWithPicker(TREE, { dup: true });
    expect(stat('Duplicate copies').getByText('10 B')).toBeTruthy();
    await u.click(nav('Duplicate Files'));
    expect(stat('Duplicate groups').getByText('1')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Group 1/ }));
    expect(screen.getByText('Root/a.txt')).toBeTruthy();
    expect(screen.getByText('Root/docs/copy-of-a.txt')).toBeTruthy();
    expect(screen.queryByText('Root/docs/a.txt')).toBeNull();
    expect(screen.queryByText('Root/docs/same-size.txt')).toBeNull();
  });
});

describe('S11/S12 progress and cancellation', () => {
  it('shows honest progress, cancels, and labels the result partial everywhere', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const tree: Record<string, Spec> = { 'f1.txt': '1', 'slow.bin': { gate, content: 'zz' }, later: { dir: { 'x.txt': 'x', 'y.txt': 'y' } } };
    installPicker(dir('Slow', tree));
    renderApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: /Choose folder/ }));
    const cancel = await screen.findByRole('button', { name: /Cancel scan/ });
    expect(screen.getByText(/Inventorying files and folders/)).toBeTruthy();
    expect(screen.getByText(/percentage isn't shown/)).toBeTruthy();
    expect(screen.getByText('Elapsed')).toBeTruthy();
    expect(nav('Settings')).toHaveProperty('disabled', true); // can't navigate away mid-scan
    await u.click(cancel);
    release();
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getAllByText('Cancelled — partial').length).toBeGreaterThan(0);
    expect(screen.getByText(/stopped before it finished/)).toBeTruthy();
    expect(Number(stat('Files').getByText(/^\d+$/).textContent)).toBeLessThan(4);
    await u.click(nav('Scan History'));
    expect(await screen.findByText('Cancelled — partial')).toBeTruthy();
  });
});

describe('S13 errors', () => {
  it('surfaces errors, hints, and incomplete/unknown folders', async () => {
    const u = await scanWithPicker();
    expect(screen.getByText(/could not be fully read/)).toBeTruthy();
    await u.click(nav('Scan Errors'));
    expect(rowsIn('Scan errors')).toHaveLength(2);
    expect(screen.getByText(/refused access/)).toBeTruthy();
    expect(screen.getByText(/locked by another program/)).toBeTruthy();
    await u.click(nav('Folder Summary'));
    const locked = screen.getByRole('button', { name: 'locked' }).closest('tr') as HTMLElement;
    expect(within(locked).getByText('unknown')).toBeTruthy();
    expect(within(locked).getByText('incomplete')).toBeTruthy();
  });
});

describe('S14 file inventory', () => {
  it('shows relative path and dot-prefixed status, and filters/sorts correctly', async () => {
    const u = await scanWithPicker();
    await u.click(nav('File Inventory'));
    expect(screen.getByRole('columnheader', { name: /Relative path/ })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Dot-prefixed/ })).toBeTruthy();
    expect(screen.getByText('Root/docs/a.txt')).toBeTruthy();
    const rows = () => rowsIn('File inventory');
    expect(rows()).toHaveLength(TREE_FILES);
    expect(within(rows()[0]).getByText('video.mp4')).toBeTruthy(); // default sort: size desc
    const envRow = screen.getByText('.env').closest('tr') as HTMLElement;
    expect(within(envRow).getByText('Yes')).toBeTruthy();

    await u.type(screen.getByPlaceholderText(/Search file name/), 'RÉSUMÉ');
    expect(rows()).toHaveLength(1);
    await u.clear(screen.getByPlaceholderText(/Search file name/));
    await u.selectOptions(screen.getByDisplayValue('All extensions'), '.txt');
    expect(rows()).toHaveLength(5);
    await u.click(screen.getByRole('button', { name: 'Reset' }));
    await u.type(screen.getByPlaceholderText('Min MB'), '0.001');
    expect(rows()).toHaveLength(2);
    await u.click(screen.getByRole('button', { name: 'Reset' }));
    await u.click(screen.getByRole('columnheader', { name: /File name/ }));
    expect(within(rows()[0]).getByText('.env')).toBeTruthy();
  });
});

describe('S15 folder summary', () => {
  it('shows direct vs recursive and drills into exactly one subtree', async () => {
    const u = await scanWithPicker();
    await u.click(nav('Folder Summary'));
    const root = screen.getByRole('button', { name: 'Root' }).closest('tr') as HTMLElement;
    const cells = within(root).getAllByRole('cell').map((c) => c.textContent);
    expect(cells.slice(1, 6)).toEqual(['0', '4', String(TREE_FILES), '6', '7']);
    await u.click(screen.getByRole('button', { name: 'docs' }));
    expect(screen.getByRole('heading', { name: 'File Inventory' })).toBeTruthy();
    expect(rowsIn('File inventory')).toHaveLength(5);
    expect(screen.queryByText('old.txt')).toBeNull();
  });
});

describe('S16 storage analysis', () => {
  it('Top-N and threshold controls update the lists', async () => {
    const u = await scanWithPicker();
    await u.click(nav('Storage Analysis'));
    const topN = screen.getByLabelText(/Top N/);
    await u.clear(topN); await u.type(topN, '2');
    expect(rowsIn('Top 2 largest files')).toHaveLength(2);
    const th = screen.getByLabelText(/Large-file threshold/);
    await u.clear(th); await u.type(th, '0.001');
    expect(rowsIn('Large files (≥ 0.001 MB)')).toHaveLength(2);
  });
});

describe('S17 empty folders', () => {
  it('lists empty and empty-tree folders, never unreadable ones', async () => {
    const u = await scanWithPicker();
    await u.click(nav('Empty Folders'));
    const rows = rowsIn('Empty folders');
    expect(rows.map((r) => (r as HTMLTableRowElement).cells[0].textContent).sort()).toEqual(['Root/empty', 'Root/shell', 'Root/shell/inner']);
    expect(screen.getByText(/1 folder\(s\) could not be listed/)).toBeTruthy();
  });
});

describe('S18/S19 exports', () => {
  it('S18 Excel workbook has every sheet, reconciled counts and a confirmation', async () => {
    const u = await scanWithPicker(TREE, { dup: true });
    await u.click(screen.getByRole('button', { name: /Excel/ }));
    await screen.findByText(/row count matched/);
    expect(saved).toHaveLength(1);
    expect(saved[0].filename).toMatch(/^Root_inventory_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await blobBytes(saved[0].data)).buffer as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Executive Summary', 'Folder Tree', 'File Inventory', 'Folder Summary', 'Extension Summary', 'Largest Files', 'Largest Folders', 'Duplicate Files', 'Empty Folders', 'Scan Errors']);
    expect(wb.getWorksheet('File Inventory')!.rowCount - 1).toBe(TREE_FILES);
    expect(wb.getWorksheet('Folder Summary')!.rowCount - 1).toBe(TREE_FOLDERS);
  });
  it('S19 single CSV and ZIP are UTF-8, escaped, injection-safe and complete', async () => {
    const u = await scanWithPicker();
    await u.selectOptions(screen.getByLabelText('Download one CSV'), 'file_inventory.csv');
    await screen.findByText(/File Inventory CSV created/);
    const csv = await blobText(saved[0].data);
    expect(saved[0].filename).toMatch(/_file_inventory\.csv$/);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(`'=SUM(1).csv`);
    expect(csv).toContain('Root/docs/résumé 文件.pdf');
    expect(csv.trim().split('\r\n')).toHaveLength(TREE_FILES + 1);
    await u.click(screen.getByRole('button', { name: /All CSVs/ }));
    await screen.findByText(/ZIP of all CSV/);
    const zip = unzipSync(await blobBytes(saved[1].data));
    expect(Object.keys(zip)).toHaveLength(8); // duplicates sheet omitted when detection is off
    expect(strFromU8(zip['Root_folder_summary.csv']).trim().split('\r\n')).toHaveLength(TREE_FOLDERS + 1);
  });
  it('S20 a failed export is reported and the app keeps working', async () => {
    const u = await scanWithPicker();
    downloadControl.fail = { code: 'bad_request', message: 'Disk is full' };
    await u.click(screen.getByRole('button', { name: /Excel/ }));
    expect(await screen.findByText(/Export failed/)).toBeTruthy();
    await u.click(nav('File Inventory'));
    expect(screen.getByRole('heading', { name: 'File Inventory' })).toBeTruthy();
  });
  it('S20b a declined save is not reported as a crash', async () => {
    const u = await scanWithPicker();
    downloadControl.fail = { code: 'declined', message: 'no' };
    await u.click(screen.getByRole('button', { name: /Excel/ }));
    expect(await screen.findByText(/cancelled/i)).toBeTruthy();
    expect(screen.queryByText(/Export failed/)).toBeNull();
  });
});

describe('S21/S22 scan history', () => {
  it('S21 records scan details; delete and clear work', async () => {
    const u = await scanWithPicker();
    await u.click(nav('Scan History'));
    await waitFor(() => expect(rowsIn('Scan history')).toHaveLength(1));
    expect(screen.getByRole('columnheader', { name: 'Scan' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'When' })).toBeTruthy();
    expect(screen.getByText(/^scan-\d{14}-/)).toBeTruthy();
    // second scan
    await u.click(nav('New Scan'));
    installPicker(dir('Second', { 'z.txt': 'z' }));
    await u.click(screen.getByRole('button', { name: /Choose folder/ }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    await u.click(nav('Scan History'));
    await waitFor(() => expect(rowsIn('Scan history')).toHaveLength(2));
    await u.click(screen.getAllByRole('button', { name: /^Delete scan of/ })[0]);
    await waitFor(() => expect(rowsIn('Scan history')).toHaveLength(1));
    await u.click(screen.getByRole('button', { name: /Clear all history/ }));
    await waitFor(() => expect(rowsIn('Scan history')).toHaveLength(0));
  });
  it('S22 without IndexedDB, history explains and scanning/export still work', async () => {
    const saveIdb = globalThis.indexedDB;
    (globalThis as unknown as { indexedDB: unknown }).indexedDB = undefined;
    try {
      const u = await scanWithPicker();
      await u.click(screen.getByRole('button', { name: /Excel/ }));
      await screen.findByText(/row count matched/);
      await u.click(nav('Scan History'));
      expect(await screen.findByText(/IndexedDB is not available/)).toBeTruthy();
    } finally { (globalThis as unknown as { indexedDB: unknown }).indexedDB = saveIdb; }
  });
});

describe('S23 settings persistence', () => {
  it('remembers defaults across visits, but never defaults duplicates on', async () => {
    installPicker(dir('Root', {}));
    const { unmount } = renderApp();
    const u = user();
    await u.click(nav('Settings'));
    const th = screen.getByLabelText(/Large-file threshold/);
    await u.clear(th); await u.type(th, '50');
    const n = screen.getByLabelText(/Top-N report size/);
    await u.clear(n); await u.type(n, '10');
    await u.click(screen.getByLabelText(/Include dot-prefixed items/));
    await u.click(screen.getByLabelText(/Detect duplicate files/));
    unmount();
    renderApp();
    expect((screen.getByLabelText(/Large-file threshold/) as HTMLInputElement).value).toBe('50');
    expect((screen.getByLabelText(/Top-N report size/) as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText(/Include dot-prefixed items/) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/Detect duplicate files/) as HTMLInputElement).checked).toBe(false);
  });
});

describe('S24/S25 privacy and read-only', () => {
  it('S24 scanning, hashing and exporting make no network requests', async () => {
    const u = await scanWithPicker(TREE, { dup: true });
    await u.click(screen.getByRole('button', { name: /Excel/ }));
    await screen.findByText(/row count matched/);
    await u.click(screen.getByRole('button', { name: /All CSVs/ }));
    await screen.findByText(/ZIP of all CSV/);
    expect(network.fetch).not.toHaveBeenCalled();
    expect(network.beacon).not.toHaveBeenCalled();
    expect(network.xhr).not.toHaveBeenCalled();
  });
  it('S25 requests read-only access and never calls a write, move or delete API', async () => {
    writeAttempts.length = 0;
    const calls = installPicker(dir('Root', TREE));
    renderApp();
    const u = user();
    await u.click(screen.getByLabelText(/Detect duplicate files/));
    await u.click(screen.getByRole('button', { name: /Choose folder/ }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(calls[0]).toMatchObject({ mode: 'read' });
    expect(writeAttempts).toEqual([]);
  });
});

describe('S26 sample data', () => {
  it('runs on synthetic data, is labelled, and is not saved to history', async () => {
    renderApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: /sample data/ }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByText('Sample data')).toBeTruthy();
    await u.click(nav('Scan History'));
    expect(await screen.findByText('No saved scans yet.')).toBeTruthy();
  });
});

describe('S27 pagination', () => {
  it('pages long lists and lets the user change page size', async () => {
    const tree: Record<string, Spec> = {};
    for (let i = 0; i < 120; i++) tree[`f${String(i).padStart(3, '0')}.txt`] = 'x'.repeat(i + 1);
    const u = await scanWithPicker(tree);
    await u.click(nav('File Inventory'));
    expect(screen.getByText('120 rows')).toBeTruthy();
    expect(screen.getByText('Page 1 / 3')).toBeTruthy();
    expect(rowsIn('File inventory')).toHaveLength(50);
    await u.selectOptions(screen.getByLabelText(/Rows/), '25');
    expect(screen.getByText('Page 1 / 5')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 / 5')).toBeTruthy();
    expect(within(rowsIn('File inventory')[0]).getByText('f094.txt')).toBeTruthy(); // 26th largest
  });
});

describe('S28 empty selected folder', () => {
  it('gives a valid zero report and exports still work', async () => {
    const u = await scanWithPicker({});
    expect(stat('Files').getByText('0')).toBeTruthy();
    expect(stat('Folders').getByText('1')).toBeTruthy();
    expect(screen.getAllByText('Complete').length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: /Excel/ }));
    await screen.findByText(/row count matched/);
    await u.click(nav('Empty Folders'));
    expect(rowsIn('Empty folders')).toHaveLength(1);
  });
});

describe('S29 unicode names', () => {
  it('displays and finds unicode names', async () => {
    const u = await scanWithPicker();
    await u.click(nav('File Inventory'));
    await u.type(screen.getByPlaceholderText(/Search file name/), '文件');
    expect(screen.getByText('résumé 文件.pdf')).toBeTruthy();
  });
});

describe('S33 workflow', () => {
  it('dismisses messages and replaces results with a new scan', async () => {
    const u = await scanWithPicker();
    await u.click(screen.getByRole('button', { name: /Excel/ }));
    await screen.findByText(/row count matched/);
    await u.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/row count matched/)).toBeNull();
    await u.click(nav('New Scan'));
    expect(screen.getByText(/Back to the dashboard/)).toBeTruthy();
    installPicker(dir('Other', { 'one.txt': '1' }));
    await u.click(screen.getByRole('button', { name: /Choose folder/ }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByText(/📁 Other/)).toBeTruthy();
    expect(stat('Files').getByText('1')).toBeTruthy();
  });
});
