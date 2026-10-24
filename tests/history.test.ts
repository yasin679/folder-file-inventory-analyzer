import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { clearScans, deleteScan, HistoryError, listScans, saveScan } from '../src/core/history';
import { DEFAULT_CONFIG, type ScanRecord } from '../src/core/types';

const rec = (id: string, t: number): ScanRecord => ({
  scan_id: id, root_label: 'R', access_mode: 'file-system-access', started_at: t, completed_at: t + 5, status: 'completed',
  configuration: DEFAULT_CONFIG, files_discovered: 1, folders_discovered: 1, total_accessible_size_bytes: 1, error_count: 0,
  skipped_count: 0, duplicate_groups: 0, redundant_bytes: 0,
});

describe('scan history (IndexedDB)', () => {
  it('saves, lists newest first, deletes and clears', async () => {
    const idb = new IDBFactory();
    await saveScan(rec('a', 1), idb);
    await saveScan(rec('b', 2), idb);
    expect((await listScans(idb)).map((s) => s.scan_id)).toEqual(['b', 'a']);
    await deleteScan('b', idb);
    expect((await listScans(idb)).map((s) => s.scan_id)).toEqual(['a']);
    await clearScans(idb);
    expect(await listScans(idb)).toEqual([]);
  });
  it('reports unsupported IndexedDB clearly', async () => {
    await expect(listScans(undefined as unknown as IDBFactory)).rejects.toBeInstanceOf(HistoryError);
  });
  it('reports open failures as HistoryError', async () => {
    const broken = { open: () => { throw new Error('blocked'); } } as unknown as IDBFactory;
    await expect(saveScan(rec('x', 1), broken)).rejects.toMatchObject({ kind: 'unsupported' });
  });
});

// ---- v1.2: full results are kept so past scans can be reopened (S39–S43) ----
import { loadResult, saveResult, savedResultIds, MAX_SAVED_RESULTS } from '../src/core/history';
import { runScan, Scanner } from '../src/core/scanner';
import { fakeDir, MAIN_TREE } from './fixtures';

const scanAt = async (t: number, id = `scan-${t}`) => {
  const s = new Scanner(id, 'Root', 'file-system-access', DEFAULT_CONFIG);
  const r = await runScan({ kind: 'handle', handle: fakeDir('Root', MAIN_TREE) }, s);
  r.scan.started_at = t;
  return r;
};

describe('S39 saved scan results', () => {
  it('saves and reloads a full result identical to the original', async () => {
    const idb = new IDBFactory();
    const r = await scanAt(1000);
    await saveScan(r.scan, idb);
    await saveResult(r, idb);
    expect(await savedResultIds(idb)).toEqual(['scan-1000']);
    const back = await loadResult('scan-1000', idb);
    expect(back).toEqual(r);
    expect(await loadResult('nope', idb)).toBeNull();
  });
  it('delete and clear remove saved results too', async () => {
    const idb = new IDBFactory();
    for (const t of [1, 2]) { const r = await scanAt(t); await saveScan(r.scan, idb); await saveResult(r, idb); }
    await deleteScan('scan-1', idb);
    expect(await savedResultIds(idb)).toEqual(['scan-2']);
    expect(await loadResult('scan-1', idb)).toBeNull();
    await clearScans(idb);
    expect(await savedResultIds(idb)).toEqual([]);
  });
  it(`keeps full results for the newest ${20} scans; older ones stay as summaries`, async () => {
    expect(MAX_SAVED_RESULTS).toBe(20);
    const idb = new IDBFactory();
    for (let t = 1; t <= 22; t++) { const r = await scanAt(t); await saveScan(r.scan, idb); await saveResult(r, idb); }
    const ids = await savedResultIds(idb);
    expect(ids).toHaveLength(20);
    expect(ids).not.toContain('scan-1');
    expect(ids).not.toContain('scan-2');
    expect(await listScans(idb)).toHaveLength(22);
  });
  it('upgrades a v1.0/v1.1 history database without losing existing summaries', async () => {
    const idb = new IDBFactory();
    await new Promise<void>((res, rej) => {
      const req = idb.open('folder-inventory-analyzer', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('scans', { keyPath: 'scan_id' });
      req.onsuccess = () => {
        const tx = req.result.transaction('scans', 'readwrite');
        tx.objectStore('scans').put(rec('old', 5));
        tx.oncomplete = () => { req.result.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
      req.onerror = () => rej(req.error);
    });
    expect((await listScans(idb)).map((s) => s.scan_id)).toEqual(['old']);
    expect(await savedResultIds(idb)).toEqual([]);
    expect(await loadResult('old', idb)).toBeNull();
  });
});
