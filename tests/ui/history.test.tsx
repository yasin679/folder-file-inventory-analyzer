// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/worker/scan.worker?worker&inline', () => ({ default: class {} }));
import { cleanup } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { saved } from './setup';
import { nav, renderApp, scanWithPicker, screen, stat, TREE_FILES, TREE_FOLDERS, user, waitFor, within } from './harness';

const blobBytes = (b: Blob) => new Promise<Uint8Array>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.onerror = rej; r.readAsArrayBuffer(b);
});
const historyRows = () => {
  const panel = screen.getByRole('heading', { name: 'Scan history' }).closest('.panel') as HTMLElement;
  return within(panel).queryAllByRole('row').slice(1).filter((r) => !r.querySelector('.empty-cell'));
};
/** Close the app and open it again; IndexedDB survives, memory does not. */
const restart = () => { cleanup(); renderApp(); return user(); };
/** Saving to history happens in the background after a scan; wait until that row's actions are live. */
const enabled = async (name: string) => {
  const b = await screen.findByRole('button', { name });
  await waitFor(() => expect(b).toHaveProperty('disabled', false));
  return b;
};
/** Wait for the background save after a scan to finish (the last-scan offer appears once it is stored). */
const savedInBackground = async (u: ReturnType<typeof user>) => {
  await u.click(nav('Scan History'));
  await enabled('Open scan of Root');
};

describe('S39 reopen a past scan', () => {
  it('after closing the app, a scan can be reopened from history with all screens and exports', async () => {
    await savedInBackground(await scanWithPicker());
    const u = restart();
    expect(nav('Dashboard')).toHaveProperty('disabled', true);
    await u.click(nav('Scan History'));
    await waitFor(() => expect(historyRows()).toHaveLength(1));
    await u.click(await enabled('Open scan of Root'));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(stat('Files').getByText(String(TREE_FILES))).toBeTruthy();
    expect(screen.getByText(/Saved scan from/)).toBeTruthy();
    await u.click(nav('Folder Explorer'));
    expect(screen.getByRole('treeitem', { name: /^docs —/ })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Excel/ }));
    await screen.findByText(/row count matched/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await blobBytes(saved[0].data)).buffer as ArrayBuffer);
    expect(wb.getWorksheet('File Inventory')!.rowCount - 1).toBe(TREE_FILES);
    expect(wb.getWorksheet('Folder Summary')!.rowCount - 1).toBe(TREE_FOLDERS);
  });
});

describe('S40 download straight from history', () => {
  it('each saved scan has Excel and CSV ZIP downloads in its history row', async () => {
    await savedInBackground(await scanWithPicker());
    const u = restart();
    await u.click(nav('Scan History'));
    await u.click(await enabled('Download Excel for Root'));
    await screen.findByText(/Excel workbook created/);
    expect(saved[0].filename).toMatch(/^Root_inventory_\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(screen.getByRole('heading', { name: 'Scan History' })).toBeTruthy(); // stays on history
    await u.click(screen.getByRole('button', { name: 'Download CSV ZIP for Root' }));
    await screen.findByText(/ZIP of all CSV/);
    expect(saved[1].filename).toMatch(/_csv\.zip$/);
  });
  it('the history table shows the full folder name, ID and times without truncating actions', async () => {
    await scanWithPicker();
    const u = user();
    await u.click(nav('Scan History'));
    await waitFor(() => expect(historyRows()).toHaveLength(1));
    expect(screen.getByRole('columnheader', { name: 'Scan' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'When' })).toBeTruthy();
    const row = historyRows()[0];
    expect(within(row).getByText('Root')).toBeTruthy();
    expect(within(row).getByText(/^scan-\d{14}-/)).toBeTruthy();
    expect(within(row).getByText('→', { exact: false })).toBeTruthy();
    for (const name of ['Open scan of Root', 'Download Excel for Root', 'Download CSV ZIP for Root', 'Delete scan of Root']) expect(within(row).getByRole('button', { name })).toBeTruthy();
  });
});

describe('S41 summary-only scans', () => {
  it('when keeping full results is turned off, the row says so and cannot be opened', async () => {
    renderApp();
    const u = user();
    await u.click(nav('Settings'));
    const keep = screen.getByLabelText(/Keep full results of past scans/) as HTMLInputElement;
    expect(keep.checked).toBe(true); // on by default
    await u.click(keep);
    cleanup();
    await scanWithPicker();
    const u2 = user();
    await u2.click(nav('Scan History'));
    await waitFor(() => expect(historyRows()).toHaveLength(1));
    expect(within(historyRows()[0]).getByText(/Summary only/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open scan of Root' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Download Excel for Root' })).toHaveProperty('disabled', true);
  });
});

describe('S42 open the last scan from New Scan', () => {
  it('offers the most recent saved scan when the app opens', async () => {
    await savedInBackground(await scanWithPicker());
    const u = restart();
    const offer = await screen.findByText(/Your last scan of/);
    expect(offer.textContent).toMatch(/Root/);
    await u.click(screen.getByRole('button', { name: /Open last scan/ }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(stat('Files').getByText(String(TREE_FILES))).toBeTruthy();
  });
});

describe('S43 delete removes the saved results', () => {
  it('a deleted scan disappears and the last-scan offer goes with it', async () => {
    await savedInBackground(await scanWithPicker());
    const u = restart();
    await u.click(nav('Scan History'));
    await u.click(await screen.findByRole('button', { name: 'Delete scan of Root' }));
    await waitFor(() => expect(historyRows()).toHaveLength(0));
    await u.click(nav('New Scan'));
    expect(screen.queryByText(/Your last scan of/)).toBeNull();
  });
});
