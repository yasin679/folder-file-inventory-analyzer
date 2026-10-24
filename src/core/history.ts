import type { ScanRecord, ScanResult } from './types';

// Local scan history (FR-13), kept in this browser's IndexedDB on this PC only.
// - `scans`:   one summary (ScanRecord) per scan.
// - `results`: the full result of a scan (file and folder names, paths, sizes, dates, errors)
//              so it can be reopened and re-exported later. File CONTENTS are never stored.
// Only the newest MAX_SAVED_RESULTS scans keep full results; older ones remain as summaries.
// Browser storage may be evicted; this is best-effort.

const DB = 'folder-inventory-analyzer';
const VERSION = 2;
const SCANS = 'scans';
const RESULTS = 'results';
export const MAX_SAVED_RESULTS = 20;

interface StoredResult { scan_id: string; started_at: number; result: ScanResult }

export class HistoryError extends Error {
  constructor(message: string, readonly kind: 'unsupported' | 'quota' | 'failed') { super(message); }
}

function open(idb: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!idb) return reject(new HistoryError('IndexedDB is not available in this browser context; scan history is disabled.', 'unsupported'));
    let req: IDBOpenDBRequest;
    try { req = idb.open(DB, VERSION); } catch (e) { return reject(new HistoryError(`Could not open local storage: ${(e as Error).message}`, 'unsupported')); }
    req.onupgradeneeded = () => {
      // v1 → v2 keeps the existing `scans` store and its summaries untouched.
      const db = req.result;
      if (!db.objectStoreNames.contains(SCANS)) db.createObjectStore(SCANS, { keyPath: 'scan_id' });
      if (!db.objectStoreNames.contains(RESULTS)) db.createObjectStore(RESULTS, { keyPath: 'scan_id' }).createIndex('started_at', 'started_at');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new HistoryError(`Could not open local storage: ${req.error?.message ?? 'unknown error'}`, 'failed'));
    req.onblocked = () => reject(new HistoryError('Scan history is open in another tab with an older version of the app. Close other Inventory Analyzer tabs and try again.', 'failed'));
  });
}

/** Run `fn` in one transaction over `stores`; resolves with what `fn` returns once the transaction commits. */
function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => Promise<T> | T, idb?: IDBFactory): Promise<T> {
  return open(idb).then((db) => new Promise<T>((resolve, reject) => {
    let t: IDBTransaction;
    try { t = db.transaction(stores, mode); } catch (e) { db.close(); return reject(new HistoryError(`Local storage operation failed: ${(e as Error).message}`, 'failed')); }
    let value: T;
    Promise.resolve(fn(t)).then((v) => { value = v; }, () => { try { t.abort(); } catch { /* already done */ } });
    t.oncomplete = () => { db.close(); resolve(value); };
    const fail = () => {
      db.close();
      const err = t.error;
      if (err?.name === 'QuotaExceededError') reject(new HistoryError('Browser storage is full, so this scan could not be stored. Delete old scans in Scan History or free up browser storage.', 'quota'));
      else reject(new HistoryError(`Local storage operation failed: ${err?.message ?? 'unknown error'}`, 'failed'));
    };
    t.onerror = fail;
    t.onabort = fail;
  }));
}

const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const saveScan = (s: ScanRecord, idb?: IDBFactory) =>
  tx([SCANS], 'readwrite', (t) => { t.objectStore(SCANS).put(s); }, idb).then(() => undefined);

export const listScans = (idb?: IDBFactory) =>
  tx([SCANS], 'readonly', (t) => req(t.objectStore(SCANS).getAll() as IDBRequest<ScanRecord[]>), idb)
    .then((rows) => rows.sort((a, b) => b.started_at - a.started_at));

/** Store a scan's full result, then drop full results beyond the newest MAX_SAVED_RESULTS. */
export const saveResult = (r: ScanResult, idb?: IDBFactory) =>
  tx([RESULTS], 'readwrite', async (t) => {
    const store = t.objectStore(RESULTS);
    const rec: StoredResult = { scan_id: r.scan.scan_id, started_at: r.scan.started_at, result: r };
    await req(store.put(rec));
    const count = await req(store.count());
    let excess = count - MAX_SAVED_RESULTS;
    if (excess <= 0) return;
    await new Promise<void>((res, rej) => {
      const c = store.index('started_at').openKeyCursor(); // oldest first
      c.onsuccess = () => {
        const cur = c.result;
        if (!cur || excess <= 0) return res();
        store.delete(cur.primaryKey);
        excess--;
        cur.continue();
      };
      c.onerror = () => rej(c.error);
    });
  }, idb).then(() => undefined);

export const loadResult = (id: string, idb?: IDBFactory) =>
  tx([RESULTS], 'readonly', (t) => req(t.objectStore(RESULTS).get(id) as IDBRequest<StoredResult | undefined>), idb)
    .then((rec) => rec?.result ?? null);

export const savedResultIds = (idb?: IDBFactory) =>
  tx([RESULTS], 'readonly', (t) => req(t.objectStore(RESULTS).getAllKeys()), idb).then((keys) => keys.map(String));

export const deleteScan = (id: string, idb?: IDBFactory) =>
  tx([SCANS, RESULTS], 'readwrite', (t) => { t.objectStore(SCANS).delete(id); t.objectStore(RESULTS).delete(id); }, idb).then(() => undefined);

export const clearScans = (idb?: IDBFactory) =>
  tx([SCANS, RESULTS], 'readwrite', (t) => { t.objectStore(SCANS).clear(); t.objectStore(RESULTS).clear(); }, idb).then(() => undefined);
