import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startScan, type RunningScan } from '../core/controller';
import { formatBytes, formatDate, formatDuration } from '../core/format';
import { clearScans, deleteScan, listScans, loadResult, saveResult, saveScan, savedResultIds } from '../core/history';
import { sampleFolder } from '../core/sample';
import type { DirHandleLike, FileLike } from '../core/scanner';
import { DEFAULT_CONFIG, type ScanConfig, type ScanProgress, type ScanRecord, type ScanResult } from '../core/types';
import { csvBundle, tableToCsv } from '../export/csv';
import { buildTables } from '../export/tables';
import { buildWorkbook } from '../export/xlsx';
import { Badge, Callout, NumberField, Panel } from './components';
import { FolderExplorer, type TreeFocus } from './explorer';
import { HelpDocs, type DocKind } from './help';
import { Dashboard, Duplicates, EmptyFolders, Errors, FileInventory, FolderSummary, History, STATUS_LABEL, STATUS_TONE, StorageAnalysis } from './screens';

type Screen = 'scan' | 'dashboard' | 'explorer' | 'files' | 'folders' | 'storage' | 'duplicates' | 'empty' | 'errors' | 'history' | 'settings' | 'help';

const NAV: Array<{ id: Screen; label: string; icon: string; needsData?: boolean }> = [
  { id: 'scan', label: 'New Scan', icon: '＋' },
  { id: 'dashboard', label: 'Dashboard', icon: '◧', needsData: true },
  { id: 'explorer', label: 'Folder Explorer', icon: '⊟', needsData: true },
  { id: 'files', label: 'File Inventory', icon: '≡', needsData: true },
  { id: 'folders', label: 'Folder Summary', icon: '▤', needsData: true },
  { id: 'storage', label: 'Storage Analysis', icon: '◔', needsData: true },
  { id: 'duplicates', label: 'Duplicate Files', icon: '⧉', needsData: true },
  { id: 'empty', label: 'Empty Folders', icon: '▢', needsData: true },
  { id: 'errors', label: 'Scan Errors', icon: '⚠', needsData: true },
  { id: 'history', label: 'Scan History', icon: '↺' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'help', label: 'Help & Documents', icon: '?' },
];

function caps() {
  let embedded = false;
  try { embedded = window.self !== window.top; } catch { embedded = true; }
  return {
    fsa: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    dirInput: 'webkitdirectory' in document.createElement('input'),
    worker: typeof Worker !== 'undefined',
    idb: typeof indexedDB !== 'undefined',
    secure: window.isSecureContext,
    subtle: !!globalThis.crypto?.subtle,
    embedded,
  };
}

const SETTINGS_KEY = 'fia.settings.v1';
function loadSettings(): ScanConfig {
  try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw), detectDuplicates: false }; } catch { /* storage blocked */ }
  return DEFAULT_CONFIG;
}
function storeSettings(c: ScanConfig) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(c)); } catch { /* ignore */ } }

type DownloadsApi = { save: (r: { filename: string; data: Blob }) => Promise<unknown> } | null;
let downloadsApi: Promise<DownloadsApi> | null = null;
/** When hosted as a claude.ai artifact, files must go through the `downloads` capability. */
function hostDownloads(): Promise<DownloadsApi> {
  const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!c?.use) return Promise.resolve(null);
  downloadsApi ??= c.use('downloads').then((d) => d as DownloadsApi).catch(() => null);
  return downloadsApi;
}

class SaveDeclined extends Error { constructor() { super('Save declined'); } }

async function download(name: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const host = await hostDownloads();
  if (host) {
    try { await host.save({ filename: name, data: blob }); return; } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'declined') throw new SaveDeclined();
      if (code && !['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(code)) throw new Error((e as Error).message || code);
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'scan';

export default function App() {
  const cap = useMemo(caps, []);
  const [screen, setScreen] = useState<Screen>('scan');
  const [config, setConfig] = useState<ScanConfig>(loadSettings);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [meta, setMeta] = useState<{ engine: string; note?: string; sample: boolean; saved?: boolean } | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [historyBusy, setHistoryBusy] = useState<string | null>(null);
  const [running, setRunning] = useState<RunningScan | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [runningRoot, setRunningRoot] = useState('');
  const [message, setMessage] = useState<{ tone: 'info' | 'warn' | 'bad' | 'good'; text: string } | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | undefined>();
  const [treeFocus, setTreeFocus] = useState<TreeFocus | undefined>();
  const showInTree = (kind: TreeFocus['kind'], id: number) => { setTreeFocus({ kind, id, token: Date.now() }); setScreen('explorer'); };
  const inputRef = useRef<HTMLInputElement>(null);
  const activeId = useRef<string | null>(null);

  const refreshHistory = useCallback(() => {
    Promise.all([listScans(), savedResultIds()])
      .then(([r, ids]) => { setHistory(r); setSavedIds(new Set(ids)); setHistoryErr(null); })
      .catch((e) => setHistoryErr(e.message));
  }, []);
  useEffect(refreshHistory, [refreshHistory]);
  useEffect(() => { inputRef.current?.setAttribute('webkitdirectory', ''); inputRef.current?.setAttribute('directory', ''); }, []);

  const begin = (src: { mode: 'file-system-access' | 'directory-input'; rootLabel: string; handle?: DirHandleLike; files?: FileLike[]; sample?: boolean }) => {
    setMessage(null);
    setRunningRoot(src.rootLabel);
    setProgress(null);
    const run = startScan({ ...src, forceMainThread: src.sample }, config, (id, p) => { if (id === activeId.current) setProgress(p); });
    activeId.current = run.id;
    setRunning(run);
    run.promise.then(({ result: r, engine, workerNote }) => {
      if (activeId.current !== run.id) return; // stale
      activeId.current = null;
      setRunning(null);
      setResult(r);
      setMeta({ engine, note: workerNote, sample: !!src.sample });
      setFolderFilter(undefined);
      setScreen('dashboard');
      if (!src.sample) {
        saveScan(r.scan)
          .then(() => (config.keepResults ? saveResult(r).catch((e) => setHistoryErr(`The scan summary was saved, but its full results could not be stored, so it can't be reopened later: ${e.message}`)) : undefined))
          .then(refreshHistory)
          .catch((e) => setHistoryErr(`Scan finished but could not be saved to history: ${e.message}`));
      }
    }).catch((e) => {
      activeId.current = null;
      setRunning(null);
      setMessage({ tone: 'bad', text: e.message });
    });
  };

  const pickFolder = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandleLike> }).showDirectoryPicker({ mode: 'read', id: 'fia-root' });
      begin({ mode: 'file-system-access', rootLabel: handle.name, handle });
    } catch (e) {
      const n = (e as Error).name;
      if (n === 'AbortError') return; // user closed the picker
      if (n === 'SecurityError' || n === 'NotAllowedError') setMessage({ tone: 'warn', text: `The folder picker is blocked in this context (${(e as Error).message}). ${cap.embedded ? 'This page is embedded in another site, which browsers restrict. Open the app in its own tab or run it locally, or use "Upload a folder" below.' : 'Use "Upload a folder" below instead.'}` });
      else setMessage({ tone: 'bad', text: `Could not open the folder: ${(e as Error).message}` });
    }
  };

  const onFiles = (list: FileList | null) => {
    if (!list || list.length === 0) { setMessage({ tone: 'warn', text: 'The browser returned no files. Either the folder is empty or contains only empty subfolders (which this upload mode cannot see), or the selection was cancelled.' }); return; }
    const files = Array.from(list);
    const root = (files[0].webkitRelativePath || '').split('/')[0] || 'Selected folder';
    begin({ mode: 'directory-input', rootLabel: root, files });
    if (inputRef.current) inputRef.current.value = '';
  };

  const doExport = async (kind: 'xlsx' | 'zip' | string, source: ScanResult | null = result) => {
    const result = source;
    if (!result) return;
    setExporting(kind);
    setMessage(null);
    const base = `${safeName(result.scan.root_label)}_inventory_${new Date(result.scan.started_at).toISOString().slice(0, 10)}`;
    try {
      await new Promise((r) => setTimeout(r, 30));
      if (kind === 'xlsx') {
        const { buffer, reconciliation } = await buildWorkbook(result);
        await download(`${base}.xlsx`, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const total = reconciliation.reduce((s, r) => s + r.written, 0);
        setMessage({ tone: 'good', text: `Excel workbook created — ${reconciliation.length} report sheets, ${total.toLocaleString()} rows; every sheet's row count matched the scan.` });
      } else if (kind === 'zip') {
        await download(`${base}_csv.zip`, csvBundle(buildTables(result), safeName(result.scan.root_label)), 'application/zip');
        setMessage({ tone: 'good', text: 'ZIP of all CSV reports created.' });
      } else {
        const t = buildTables(result).find((x) => x.file === kind)!;
        await download(`${base}_${t.file}`, tableToCsv(t), 'text/csv;charset=utf-8');
        setMessage({ tone: 'good', text: `${t.name} CSV created — ${t.rows.length.toLocaleString()} rows.` });
      }
    } catch (e) {
      if (e instanceof SaveDeclined) { setMessage({ tone: 'info', text: 'Save cancelled — no file was saved.' }); return; }
      setMessage({ tone: 'bad', text: `Export failed: ${(e as Error).message}. No partial file was produced. For very large inventories, try the CSV ZIP, which uses less memory.` });
    } finally { setExporting(null); }
  };

  /** Reopen a saved scan exactly as it was: every screen and export works from the stored result. */
  const openSaved = async (id: string) => {
    setHistoryBusy(`${id}:open`);
    try {
      const r = await loadResult(id);
      if (!r) { setHistoryErr("This scan's full results are no longer stored on this PC, so it can't be opened."); refreshHistory(); return; }
      setResult(r); setMeta({ engine: 'saved', sample: false, saved: true }); setFolderFilter(undefined); setTreeFocus(undefined); setMessage(null);
      setScreen('dashboard');
    } catch (e) { setHistoryErr(`Could not open the saved scan: ${(e as Error).message}`); }
    finally { setHistoryBusy(null); }
  };
  const downloadSaved = async (id: string, kind: 'xlsx' | 'zip') => {
    setHistoryBusy(`${id}:${kind}`);
    try {
      const r = await loadResult(id);
      if (!r) { setHistoryErr("This scan's full results are no longer stored on this PC, so its reports can't be rebuilt."); refreshHistory(); return; }
      await doExport(kind, r);
    } catch (e) { setHistoryErr(`Could not read the saved scan: ${(e as Error).message}`); }
    finally { setHistoryBusy(null); }
  };
  const lastSaved = history.find((h) => savedIds.has(h.scan_id));
  const saveDoc = async (title: string, kind: DocKind, filename: string, bytes: Uint8Array) => {
    try {
      await download(filename, bytes, 'application/pdf');
      setMessage({ tone: 'good', text: `${title} (${kind.toUpperCase()}) saved — check your Downloads folder.` });
    } catch (e) {
      if (e instanceof SaveDeclined) setMessage({ tone: 'info', text: 'Save cancelled — no file was saved.' });
      else setMessage({ tone: 'bad', text: `Could not save the document: ${(e as Error).message}` });
    }
  };

  const go = (s: Screen) => { setScreen(s); if (s !== 'files') setFolderFilter(undefined); if (s === 'explorer') setTreeFocus(undefined); };
  const tables = useMemo(() => (result ? buildTables(result) : []), [result]);

  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><span className="logo">▦</span><div><strong>Inventory Analyzer</strong><small>Folder &amp; file inventory</small></div></div>
        <nav>
          {NAV.map((n) => {
            const disabled = (n.needsData && !result) || (!!running && n.id !== 'scan');
            return (
              <button key={n.id} className={`nav ${screen === n.id ? 'active' : ''}`} disabled={disabled} onClick={() => go(n.id)} title={disabled && n.needsData ? 'Run a scan first' : undefined}>
                <span className="ico">{n.icon}</span>{n.label}
                {n.id === 'errors' && result && result.errors.length > 0 && <span className="count">{result.errors.length}</span>}
                {n.id === 'duplicates' && result?.scan.configuration.detectDuplicates && result.duplicates.length > 0 && <span className="count">{result.duplicates.length}</span>}
              </button>
            );
          })}
        </nav>
        <div className="privacy">🔒 Runs entirely in your browser. Nothing is uploaded. Files are opened read-only.</div>
      </aside>

      <main>
        <header className="top">
          <div>
            <h1>{NAV.find((n) => n.id === screen)?.label}</h1>
            {result && screen !== 'scan' && screen !== 'settings' && screen !== 'history' && screen !== 'help' && (
              <div className="crumbs">
                <span className="root">📁 {result.scan.root_label}</span>
                <Badge tone={STATUS_TONE[result.scan.status]}>{STATUS_LABEL[result.scan.status]}</Badge>
                {meta?.sample && <Badge tone="info">Sample data</Badge>}
                {meta?.saved && <Badge tone="info">Saved scan</Badge>}
                <span className="muted">{result.scan.access_mode === 'file-system-access' ? 'Folder picker' : 'Folder upload'} · {result.scan.files_discovered.toLocaleString()} files · {formatBytes(result.scan.total_accessible_size_bytes)}</span>
              </div>
            )}
          </div>
          {result && !running && screen !== 'scan' && screen !== 'settings' && screen !== 'history' && screen !== 'help' && (
            <div className="exports">
              <button className="btn primary" disabled={!!exporting} onClick={() => doExport('xlsx')}>{exporting === 'xlsx' ? 'Building…' : '⬇ Excel (.xlsx)'}</button>
              <button className="btn" disabled={!!exporting} onClick={() => doExport('zip')}>{exporting === 'zip' ? 'Zipping…' : '⬇ All CSVs (.zip)'}</button>
              <select className="btn" value="" disabled={!!exporting} onChange={(e) => e.target.value && doExport(e.target.value)} aria-label="Download one CSV">
                <option value="">⬇ Single CSV…</option>
                {tables.map((t) => <option key={t.file} value={t.file}>{t.name} ({t.rows.length.toLocaleString()} rows)</option>)}
              </select>
            </div>
          )}
        </header>

        <div className="content">
          {message && <Callout tone={message.tone}>{message.text} <button className="link" onClick={() => setMessage(null)}>Dismiss</button></Callout>}
          {meta?.saved && result && screen === 'dashboard' && <Callout tone="info">Saved scan from {formatDate(result.scan.started_at)}, reopened from this PC's scan history. It shows the folder as it was then. Run a new scan to see changes since.</Callout>}
          {meta?.note && screen === 'dashboard' && !meta.sample && <Callout tone="info">Scanned on the main thread ({meta.note}). Results are identical; the page may feel less responsive on very large folders.</Callout>}

          {screen === 'scan' && (running
            ? <Progress root={runningRoot} p={progress} onCancel={() => running.cancel()} dup={config.detectDuplicates} />
            : <NewScan cap={cap} config={config} setConfig={(c) => { setConfig(c); storeSettings({ ...c, detectDuplicates: false }); }}
                onPick={pickFolder} onUpload={() => inputRef.current?.click()}
                onHelp={() => go('help')}
                onSample={() => begin({ mode: 'file-system-access', rootLabel: 'Shared Drive', handle: sampleFolder(), sample: true })}
                hasResult={!!result} onView={() => go('dashboard')}
                lastSaved={lastSaved && lastSaved.scan_id !== result?.scan.scan_id ? lastSaved : undefined} onOpenLast={() => lastSaved && openSaved(lastSaved.scan_id)} />)}
          {result && screen === 'dashboard' && <Dashboard r={result} onNav={(s) => go(s as Screen)} onOpenFolder={(id) => showInTree('folder', id)} />}
          {result && screen === 'explorer' && <FolderExplorer r={result} focus={treeFocus} />}
          {result && screen === 'files' && <FileInventory key={folderFilter ?? ''} r={result} initialFolder={folderFilter} onShowInTree={(id) => showInTree('file', id)} />}
          {result && screen === 'folders' && <FolderSummary r={result} onOpenFolder={(p) => { setFolderFilter(p); setScreen('files'); }} />}
          {result && screen === 'storage' && <StorageAnalysis r={result} />}
          {result && screen === 'duplicates' && <Duplicates r={result} onEnable={() => { setConfig({ ...config, detectDuplicates: true }); go('scan'); }} />}
          {result && screen === 'empty' && <EmptyFolders r={result} />}
          {result && screen === 'errors' && <Errors r={result} />}
          {screen === 'history' && <History rows={history} error={historyErr} currentId={result?.scan.scan_id} savedIds={savedIds} busy={historyBusy}
            onOpen={openSaved} onDownload={downloadSaved}
            onDelete={(id) => deleteScan(id).then(refreshHistory).catch((e) => setHistoryErr(e.message))}
            onClear={() => clearScans().then(refreshHistory).catch((e) => setHistoryErr(e.message))} />}
          {screen === 'help' && <HelpDocs onDownload={saveDoc} />}
          {screen === 'settings' && <Settings config={config} setConfig={(c) => { setConfig(c); storeSettings(c); }} cap={cap}
            onClear={() => clearScans().then(() => { refreshHistory(); setMessage({ tone: 'good', text: 'Local scan history cleared.' }); }).catch((e) => setMessage({ tone: 'bad', text: e.message }))} />}
        </div>
      </main>
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
type Caps = ReturnType<typeof caps>;

function Options({ config, setConfig, cap }: { config: ScanConfig; setConfig: (c: ScanConfig) => void; cap: Caps }) {
  return (
    <div className="options">
      <label className="check"><input type="checkbox" checked={config.includeDotItems} onChange={(e) => setConfig({ ...config, includeDotItems: e.target.checked })} />
        <span><strong>Include dot-prefixed items</strong><small>Names starting with “.” such as .git or .env. Browsers do not expose the Windows/macOS “hidden” attribute, so this is the only hidden-item control available.</small></span></label>
      <label className="check"><input type="checkbox" checked={config.detectDuplicates} disabled={!cap.subtle} onChange={(e) => setConfig({ ...config, detectDuplicates: e.target.checked })} />
        <span><strong>Detect duplicate files (SHA-256)</strong><small>Off by default. Reads the contents of same-size files locally to compare hashes — this can take a long time on large folders. Contents are never stored or uploaded.{!cap.subtle && ' Unavailable: Web Crypto requires a secure (https) context.'}</small></span></label>
      <div className="row">
        <label>Large-file threshold<span className="unit"><NumberField ariaLabel="Large-file threshold (MB)" value={config.largeFileThresholdBytes / 1048576} min={0} onChange={(n) => setConfig({ ...config, largeFileThresholdBytes: Math.round(n * 1048576) })} />MB</span></label>
        <label>Top-N report size<span className="unit"><NumberField ariaLabel="Top-N report size" value={config.topN} min={1} max={500} integer onChange={(n) => setConfig({ ...config, topN: n })} />items</span></label>
      </div>
    </div>
  );
}

function NewScan({ cap, config, setConfig, onPick, onUpload, onSample, hasResult, onView, lastSaved, onOpenLast, onHelp }: {
  cap: Caps; config: ScanConfig; setConfig: (c: ScanConfig) => void; onPick: () => void; onUpload: () => void; onSample: () => void; hasResult: boolean; onView: () => void; onHelp: () => void;
  lastSaved?: ScanRecord; onOpenLast: () => void;
}) {
  return (
    <div className="newscan">
      <div className="steps-row">
        <ol className="steps"><li className="on">1 · Choose a folder</li><li>2 · Scan &amp; review</li><li>3 · Download reports</li></ol>
        <button className="link" onClick={onHelp}>New here? Read the User Guide →</button>
      </div>
      {hasResult && <Callout>You have a scan open. <button className="link" onClick={onView}>Back to the dashboard →</button></Callout>}
      {lastSaved && (
        <Callout tone="good"><div className="saved-offer">
          <span>Your last scan of <strong>{lastSaved.root_label}</strong> ({formatDate(lastSaved.started_at)}, {lastSaved.files_discovered.toLocaleString()} file{lastSaved.files_discovered === 1 ? '' : 's'}) is saved on this PC.</span>
          <button className="btn primary sm" onClick={onOpenLast}>Open last scan</button>
        </div></Callout>
      )}
      <Panel title="Scan options"><Options config={config} setConfig={setConfig} cap={cap} /></Panel>
      <div className="grid2">
        <Panel title={<>Select a folder <Badge tone={cap.fsa ? 'good' : 'neutral'}>{cap.fsa ? 'Recommended' : 'Not supported in this browser'}</Badge></>}>
          <p>Uses the browser's folder picker (File System Access API) with <strong>read-only</strong> permission. Finds empty folders and reports unreadable items individually.</p>
          <ul className="small">
            <li>Supported in Chrome, Edge, Opera and other Chromium browsers.</li>
            <li>Only the folder you pick is accessible. Full disk paths are not exposed; paths are shown relative to that folder.</li>
            <li>Only the last-modified date is available. Created and accessed dates are not exposed by browsers.</li>
            {cap.embedded && <li className="warn-text">This page is embedded, so the browser may block the picker. If it does, use the upload option.</li>}
          </ul>
          <button className="btn primary lg" disabled={!cap.fsa} onClick={onPick}>📂 Choose folder…</button>
        </Panel>
        <Panel title={<>Upload a folder <Badge tone={cap.dirInput ? 'neutral' : 'bad'}>{cap.dirInput ? 'Fallback' : 'Not supported'}</Badge></>}>
          <p>Uses the browser's folder-upload control. Works in Firefox and Safari too. Despite the name, <strong>nothing leaves your computer</strong>.</p>
          <ul className="small">
            <li><strong>Empty folders are invisible</strong> in this mode, so empty-folder reports will be incomplete.</li>
            <li>The browser may ask you to confirm “upload”. This only grants the page local read access.</li>
            <li>The browser lists every file before scanning starts, so very large folders can take a moment to appear.</li>
          </ul>
          <button className="btn lg" disabled={!cap.dirInput} onClick={onUpload}>⇪ Upload a folder…</button>
        </Panel>
      </div>
      <Panel title="Just exploring?" actions={<button className="btn ghost" onClick={onSample}>▶ Try with sample data</button>}>
        <p className="small muted">Runs the real scanning engine on a synthetic “Shared Drive” (about 320 files with duplicates, empty folders and one access-denied folder) so you can see every report and export without picking a real folder.</p>
      </Panel>
      <details className="caps"><summary>Browser capability check</summary>
        <ul>
          {([['Folder picker (File System Access API)', cap.fsa], ['Folder upload (webkitdirectory)', cap.dirInput], ['Web Workers (background scanning)', cap.worker], ['IndexedDB (local scan history)', cap.idb], ['Web Crypto SHA-256 (duplicates)', cap.subtle], ['Secure context (https)', cap.secure]] as const).map(([k, v]) => (
            <li key={k}><Badge tone={v ? 'good' : 'bad'}>{v ? 'Available' : 'Unavailable'}</Badge> {k}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Progress({ root, p, onCancel, dup }: { root: string; p: ScanProgress | null; onCancel: () => void; dup: boolean }) {
  const [cancelling, setCancelling] = useState(false);
  const phase = p?.phase === 'hashing' ? 'Hashing files to confirm duplicates' : p?.phase === 'finalizing' ? 'Calculating totals' : 'Inventorying files and folders';
  return (
    <Panel title={<>Scanning <span className="root">📁 {root}</span></>}>
      <p className="phase">{phase}…{dup && p?.phase === 'enumerating' && <span className="muted"> (duplicate hashing runs next)</span>}</p>
      {p?.percent != null
        ? <div className="bar"><span style={{ width: `${Math.min(100, p.percent)}%` }} /><em>{p.percent.toFixed(0)}%</em></div>
        : <div className="bar indeterminate"><span /></div>}
      <div className="stats compact">
        <div className="stat"><div className="stat-label">Files</div><div className="stat-value">{(p?.files ?? 0).toLocaleString()}</div></div>
        <div className="stat"><div className="stat-label">Folders</div><div className="stat-value">{(p?.folders ?? 0).toLocaleString()}</div></div>
        <div className="stat"><div className="stat-label">Size found</div><div className="stat-value">{formatBytes(p?.bytes ?? 0)}</div></div>
        <div className="stat"><div className="stat-label">Errors</div><div className="stat-value">{p?.errors ?? 0}</div></div>
        <div className="stat"><div className="stat-label">Elapsed</div><div className="stat-value">{formatDuration(p?.elapsedMs ?? 0)}</div></div>
        <div className="stat"><div className="stat-label">Remaining</div><div className="stat-value">{p?.etaMs != null ? `~${formatDuration(p.etaMs)}` : '—'}</div></div>
      </div>
      <p className="current path" title={p?.currentPath}>{p?.currentPath || 'Starting…'}</p>
      {p?.percent == null && <p className="hint">A percentage isn't shown because the total number of files isn't known until the folder picker finishes walking the tree.</p>}
      <button className="btn danger" disabled={cancelling} onClick={() => { setCancelling(true); onCancel(); }}>{cancelling ? 'Cancelling… keeping results so far' : 'Cancel scan'}</button>
    </Panel>
  );
}

function Settings({ config, setConfig, cap, onClear }: { config: ScanConfig; setConfig: (c: ScanConfig) => void; cap: Caps; onClear: () => void }) {
  return (
    <>
      <Panel title="Default scan options" note="Saved in this browser. Duplicate detection always starts switched off for each new session.">
        <Options config={config} setConfig={setConfig} cap={cap} />
        <div className="row">
          <label>Hashing size limit (per file)<span className="unit"><NumberField ariaLabel="Hashing size limit (MB)" value={Math.round(config.maxHashBytes / 1048576)} min={1} integer onChange={(n) => setConfig({ ...config, maxHashBytes: n * 1048576 })} />MB</span></label>
        </div>
        <p className="hint">Files above the hashing limit are marked “unverified” rather than hashed, because each file is read into memory to compute its SHA-256.</p>
        <button className="btn ghost" onClick={() => setConfig({ ...DEFAULT_CONFIG })}>Restore defaults</button>
      </Panel>
      <Panel title="Local data" actions={<button className="btn danger sm" onClick={onClear}>Clear stored scan history</button>}>
        <label className="check"><input type="checkbox" checked={config.keepResults} onChange={(e) => setConfig({ ...config, keepResults: e.target.checked })} />
          <span><strong>Keep full results of past scans on this PC</strong><small>Lets you reopen a scan and download its reports later from Scan History. Stores file and folder names, paths, sizes and dates for the newest 20 scans in this browser only. File contents are never stored. Turn this off to keep only a summary of each scan.</small></span></label>
        <p className="hint">Everything stays in this browser's IndexedDB on this PC and is never uploaded. Browsers may clear it at any time, for example in private windows or when storage is low, so export reports you need to keep.</p>
      </Panel>
      <Panel title="Privacy & limitations">
        <ul className="small">
          <li>All processing happens in this browser tab. The app makes no network requests with your data and has no analytics or telemetry.</li>
          <li>Folders are opened read-only. The app never creates, modifies, moves, renames or deletes your files.</li>
          <li>Sizes are <em>logical</em> file sizes, not space used on disk (cluster size, compression and cloud placeholders are not reflected).</li>
          <li>Absolute paths, created and accessed dates, and the OS hidden attribute are not exposed by browsers and are never guessed.</li>
          <li>Cloud-sync placeholders (OneDrive, iCloud) may report their full size, or fail to read if not downloaded.</li>
          <li>The whole inventory is held in memory. Folders up to a few hundred thousand files work well on a typical laptop. Larger trees may exhaust browser memory.</li>
          <li>Excel worksheets hold at most 1,048,576 rows. Larger tables are split across numbered sheets (“File Inventory (2)”) and never truncated.</li>
          <li>CSV cells beginning with = + − @ are prefixed with ' to prevent spreadsheet formula injection. Excel cells are stored as plain text, so values are exact.</li>
        </ul>
      </Panel>
      <Panel title="About"><p className="small muted">Folder &amp; File Inventory Analyzer · v1.2 · React 18.3, TypeScript 5.6, ExcelJS 4.4, fflate 0.8, Recharts 2.15. Scan comparison is planned for a later release.</p></Panel>
    </>
  );
}
