import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { topLevelBreakdown, depthDistribution, EMPTY_LABEL, emptyFolders, extensionSummary, keyFindings, largestFiles, largestFolders, subfolderOnlyFolders } from '../core/analysis';
import { formatBytes, formatDate, formatDuration } from '../core/format';
import type { FileRecord, FolderRecord, ScanError, ScanRecord, ScanResult, ScanStatus } from '../core/types';
import { Badge, Callout, DataTable, NumberField, Panel, Path, Stat, type Column } from './components';

export const STATUS_TONE: Record<ScanStatus, 'good' | 'warn' | 'bad' | 'info'> = {
  completed: 'good', 'completed-with-errors': 'warn', cancelled: 'warn', failed: 'bad', running: 'info',
};
export const STATUS_LABEL: Record<ScanStatus, string> = {
  completed: 'Complete', 'completed-with-errors': 'Complete with errors', cancelled: 'Cancelled — partial', failed: 'Failed', running: 'Running',
};

const CHART = ['#2f6fdf', '#16a085', '#e67e22', '#8e44ad', '#c0392b', '#2c3e50', '#d4ac0d', '#1abc9c', '#7f8c8d', '#e84393'];

function ChartTip({ active, payload, label, fmt }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; fmt: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tip"><strong>{label}</strong><br />{fmt(payload[0].value)}</div>;
}

function HBar({ data, fmt, height = 280 }: { data: Array<{ name: string; value: number }>; fmt: (v: number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--grid)" />
        <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--muted)', fontSize: 11 }} stroke="var(--line)" />
        <YAxis type="category" dataKey="name" width={130} tick={{ fill: 'var(--text)', fontSize: 12 }} stroke="var(--line)" interval={0}
          tickFormatter={(v: string) => (v.length > 20 ? `…${v.slice(-19)}` : v)} />
        <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ fill: 'var(--hover)' }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
export function Dashboard({ r, onNav, onOpenFolder }: { r: ScanResult; onNav: (s: string) => void; onOpenFolder: (folderId: number) => void }) {
  const s = r.scan;
  const ext = useMemo(() => extensionSummary(r.files), [r]);
  const lf = useMemo(() => largestFiles(r.files, 10), [r]);
  const lfo = useMemo(() => largestFolders(r.folders, 10), [r]);
  const findings = useMemo(() => keyFindings(r), [r]);
  const where = useMemo(() => topLevelBreakdown(r), [r]);
  const dur = s.completed_at ? s.completed_at - s.started_at : 0;
  return (
    <>
      {s.status !== 'completed' && (
        <Callout tone={s.status === 'failed' ? 'bad' : 'warn'}>
          <strong>{STATUS_LABEL[s.status]}.</strong>{' '}
          {s.status === 'cancelled' ? 'The scan was stopped before it finished; totals below cover only what was inventoried.' : `${s.error_count} item(s) could not be fully read, so some folder totals are incomplete.`}{' '}
          <button className="link" onClick={() => onNav('errors')}>Review scan errors →</button>
        </Callout>
      )}
      <div className="stats">
        <Stat label="Files" value={s.files_discovered.toLocaleString()} />
        <Stat label="Folders" value={s.folders_discovered.toLocaleString()} sub="including the selected root" />
        <Stat label="Accessible logical size" value={formatBytes(s.total_accessible_size_bytes)} sub={`${s.total_accessible_size_bytes.toLocaleString()} bytes`} />
        <Stat label="Average file size" value={formatBytes(s.files_discovered ? s.total_accessible_size_bytes / s.files_discovered : 0)} />
        <Stat label="Largest file" value={lf[0] ? formatBytes(lf[0].size_bytes) : '—'} sub={lf[0] && <Path p={lf[0].relative_path} />} />
        <Stat label="Largest subfolder" value={lfo[0] ? formatBytes(lfo[0].recursive_size_bytes) : '—'} sub={lfo[0] && <Path p={lfo[0].relative_path} />} />
        <Stat label="Scan duration" value={formatDuration(dur)} sub={formatDate(s.started_at)} />
        <Stat label="Status" value={<Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>} sub={`${s.error_count} error(s) · ${s.skipped_count} skipped`} tone={s.error_count ? 'warn' : undefined} />
        {s.configuration.detectDuplicates && <Stat label="Duplicate copies" value={formatBytes(s.redundant_bytes)} sub={`${s.duplicate_groups} group(s) confirmed by SHA-256`} />}
      </div>

      {findings.length > 0 && (
        <Panel title="Key findings">
          <ul className="findings">{findings.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </Panel>
      )}

      {where.length > 0 && (
        <Panel title="Where your files are" note={`Files inside each top-level folder of ${s.root_label}, including everything in its subfolders. Click a folder to open it in the Folder Explorer.`}
          actions={<button className="btn ghost sm" onClick={() => onNav('explorer')}>Open Folder Explorer →</button>}>
          <div className="table-wrap"><div className="table-scroll">
            <table className="where">
              <thead><tr><th>Folder</th><th style={{ textAlign: 'right' }}>Files</th><th style={{ textAlign: 'right' }}>Size</th><th style={{ width: '35%' }}>Share of files</th></tr></thead>
              <tbody>
                {where.slice(0, 15).map((w) => (
                  <tr key={`${w.kind}-${w.id}`}>
                    <td>{w.kind === 'folder' ? <button className="link strong" onClick={() => onOpenFolder(w.id)}>{w.name}</button> : <span className="muted">{w.name}</span>}</td>
                    <td style={{ textAlign: 'right' }}>{w.unknown ? 'unknown' : w.files.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{w.unknown ? '—' : formatBytes(w.size)}</td>
                    <td><span className="pctbar left"><span style={{ width: `${s.files_discovered ? (w.files / s.files_discovered) * 100 : 0}%` }} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
          {where.length > 15 && <p className="hint">…and {where.length - 15} more top-level folders. <button className="link" onClick={() => onNav('explorer')}>See them all in the Folder Explorer</button></p>}
        </Panel>
      )}

      <div className="grid2">
        <Panel title="Storage by extension" note="Top 10 file types by total logical size">
          <HBar data={ext.slice(0, 10).map((e) => ({ name: e.extension === '(none)' ? '(none)' : `.${e.extension}`, value: e.total_size_bytes }))} fmt={formatBytes} />
        </Panel>
        <Panel title="File count by extension" note="Top 10 file types by number of files">
          <HBar data={[...ext].sort((a, b) => b.file_count - a.file_count).slice(0, 10).map((e) => ({ name: e.extension === '(none)' ? '(none)' : `.${e.extension}`, value: e.file_count }))} fmt={(v) => v.toLocaleString()} />
        </Panel>
        <Panel title="Largest folders" note="Recursive size, excluding the selected root">
          <HBar data={lfo.map((f) => ({ name: f.relative_path.split('/').slice(1).join('/') || f.folder_name, value: f.recursive_size_bytes }))} fmt={formatBytes} />
        </Panel>
        <Panel title="Largest files">
          <HBar data={lf.map((f) => ({ name: f.file_name, value: f.size_bytes }))} fmt={formatBytes} />
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
const dupTone = { duplicate: 'warn', unique: 'good', unverified: 'bad', 'not-checked': 'neutral' } as const;

export function FileInventory({ r, initialFolder, onShowInTree }: { r: ScanResult; initialFolder?: string; onShowInTree?: (fileId: number) => void }) {
  const [q, setQ] = useState('');
  const [ext, setExt] = useState('');
  const [folder, setFolder] = useState('');
  const [subtree, setSubtree] = useState(initialFolder ?? '');
  const [minMb, setMin] = useState('');
  const [maxMb, setMax] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dup, setDup] = useState('');
  const exts = useMemo(() => extensionSummary(r.files).map((e) => e.extension).sort(), [r]);
  const hasDates = useMemo(() => r.files.some((f) => f.modified_at != null), [r]);
  const dupOn = r.scan.configuration.detectDuplicates;

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const fl = folder.trim().toLowerCase();
    const min = minMb ? Number(minMb) * 1048576 : -1;
    const max = maxMb ? Number(maxMb) * 1048576 : Infinity;
    const df = from ? new Date(from).getTime() : -Infinity;
    const dt = to ? new Date(to).getTime() + 86400000 : Infinity;
    return r.files.filter((f) =>
      (!ql || f.relative_path.toLowerCase().includes(ql)) &&
      (!ext || (f.extension || '(none)') === ext) &&
      (!fl || f.parent_path.toLowerCase().includes(fl)) &&
      (!subtree || f.parent_path === subtree || f.parent_path.startsWith(`${subtree}/`)) &&
      f.size_bytes >= min && f.size_bytes <= max &&
      ((!from && !to) || (f.modified_at != null && f.modified_at >= df && f.modified_at < dt)) &&
      (!dup || f.duplicate_status === dup));
  }, [r, q, ext, folder, subtree, minMb, maxMb, from, to, dup]);

  const cols: Column<FileRecord>[] = [
    { key: 'name', header: 'File name', render: (f) => <span className="strong">{f.file_name}</span>, sort: (f) => f.file_name.toLowerCase(), width: '16%', title: (f) => f.file_name },
    { key: 'rel', header: 'Relative path', render: (f) => <span className="pathcell"><Path p={f.relative_path} />{onShowInTree && <button className="link small" aria-label={`Show ${f.file_name} in folder tree`} title="Show in folder tree" onClick={() => onShowInTree(f.file_id)}>📍</button>}</span>, sort: (f) => f.relative_path.toLowerCase(), title: (f) => f.relative_path, width: '28%' },
    { key: 'path', header: 'Parent folder', render: (f) => <Path p={f.parent_path} />, sort: (f) => f.parent_path.toLowerCase(), title: (f) => f.parent_path },
    { key: 'ext', header: 'Ext', render: (f) => f.extension ? <code>.{f.extension}</code> : <span className="muted">—</span>, sort: (f) => f.extension, width: '70px' },
    { key: 'size', header: 'Size', render: (f) => formatBytes(f.size_bytes), sort: (f) => f.size_bytes, align: 'right', width: '90px', title: (f) => `${f.size_bytes.toLocaleString()} bytes` },
    { key: 'mod', header: 'Modified', render: (f) => f.modified_at != null ? formatDate(f.modified_at) : <span className="muted">n/a</span>, sort: (f) => f.modified_at ?? 0, width: '130px' },
    { key: 'dot', header: 'Dot-prefixed', render: (f) => (f.dot_prefixed ? 'Yes' : <span className="muted">No</span>), sort: (f) => (f.dot_prefixed ? 1 : 0), width: '95px' },
    { key: 'status', header: 'Status', render: (f) => f.scan_status === 'ok' ? <span className="muted">ok</span> : <Badge tone="bad">metadata error</Badge>, sort: (f) => f.scan_status, width: '90px' },
    ...(dupOn ? [{ key: 'dup', header: 'Duplicate', render: (f: FileRecord) => <Badge tone={dupTone[f.duplicate_status]}>{f.duplicate_status}{f.duplicate_group ? ` #${f.duplicate_group}` : ''}</Badge>, sort: (f: FileRecord) => f.duplicate_status, width: '120px' }] : []),
  ];
  const reset = () => { setQ(''); setExt(''); setFolder(''); setSubtree(''); setMin(''); setMax(''); setFrom(''); setTo(''); setDup(''); };
  const totalSize = rows.reduce((s, f) => s + f.size_bytes, 0);
  return (
    <Panel title="File inventory" note={`${rows.length.toLocaleString()} of ${r.files.length.toLocaleString()} files · ${formatBytes(totalSize)} shown`}>
      {subtree && <div className="chip-row"><span className="chip">In folder: <Path p={subtree} /> <button className="link" aria-label="Clear folder" onClick={() => setSubtree('')}>✕</button></span></div>}
      <div className="filters">
        <input className="grow" placeholder="Search file name or path…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={ext} onChange={(e) => setExt(e.target.value)}><option value="">All extensions</option>{exts.map((x) => <option key={x} value={x}>{x === '(none)' ? '(no extension)' : `.${x}`}</option>)}</select>
        <input placeholder="Folder path contains…" value={folder} onChange={(e) => setFolder(e.target.value)} />
        <input type="number" min="0" step="any" placeholder="Min MB" value={minMb} onChange={(e) => setMin(e.target.value)} className="num" />
        <input type="number" min="0" step="any" placeholder="Max MB" value={maxMb} onChange={(e) => setMax(e.target.value)} className="num" />
        {hasDates && <><label className="inline">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="inline">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></>}
        {dupOn && <select value={dup} onChange={(e) => setDup(e.target.value)}><option value="">Any duplicate status</option>{['duplicate', 'unique', 'unverified', 'not-checked'].map((d) => <option key={d}>{d}</option>)}</select>}
        <button className="btn ghost sm" onClick={reset}>Reset</button>
      </div>
      <DataTable rows={rows} columns={cols} rowKey={(f) => f.file_id} initialSort={{ key: 'size', dir: 'desc' }} />
    </Panel>
  );
}

const SHORT = { empty: 'empty', 'no-files-only-subfolders': 'empty tree', 'subfolders-only': 'subfolders only', 'has-files': 'files', unknown: 'unknown' } as const;

// ---------------------------------------------------------------------------
export function FolderSummary({ r, onOpenFolder }: { r: ScanResult; onOpenFolder: (p: string) => void }) {
  const [q, setQ] = useState('');
  const [empty, setEmpty] = useState('');
  const [comp, setComp] = useState('');
  const [depth, setDepth] = useState('');
  const maxDepth = useMemo(() => r.folders.reduce((m, f) => Math.max(m, f.depth), 0), [r]);
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return r.folders.filter((f) => (!ql || f.relative_path.toLowerCase().includes(ql)) && (!empty || f.empty_status === empty) && (!comp || f.scan_completeness === comp) && (depth === '' || f.depth === Number(depth)));
  }, [r, q, empty, comp, depth]);
  const cols: Column<FolderRecord>[] = [
    { key: 'path', header: 'Folder', render: (f) => <div className="cell2"><button className="link strong" title={f.relative_path} onClick={() => onOpenFolder(f.relative_path)}>{f.folder_name}</button><span className="path muted">{f.parent_path ?? '(selected root)'}</span></div>, sort: (f) => f.relative_path.toLowerCase(), width: '26%', title: (f) => f.relative_path },
    { key: 'depth', header: 'Depth', render: (f) => f.depth, sort: (f) => f.depth, align: 'right' },
    { key: 'df', header: 'Files (direct)', render: (f) => f.direct_file_count.toLocaleString(), sort: (f) => f.direct_file_count, align: 'right' },
    { key: 'rf', header: 'Files (recursive)', render: (f) => f.recursive_file_count.toLocaleString(), sort: (f) => f.recursive_file_count, align: 'right' },
    { key: 'dd', header: 'Folders (direct)', render: (f) => f.direct_folder_count.toLocaleString(), sort: (f) => f.direct_folder_count, align: 'right' },
    { key: 'rd', header: 'Folders (recursive)', render: (f) => f.recursive_folder_count.toLocaleString(), sort: (f) => f.recursive_folder_count, align: 'right' },
    { key: 'ds', header: 'Size (direct)', render: (f) => formatBytes(f.direct_size_bytes), sort: (f) => f.direct_size_bytes, align: 'right' },
    { key: 'rs', header: 'Size (recursive)', render: (f) => <span className="strong">{formatBytes(f.recursive_size_bytes)}</span>, sort: (f) => f.recursive_size_bytes, align: 'right' },
    { key: 'empty', header: 'Contents', render: (f) => f.empty_status === 'has-files' ? <span className="muted">files</span> : <Badge tone={f.empty_status === 'unknown' ? 'bad' : f.empty_status === 'subfolders-only' ? 'info' : 'warn'}>{SHORT[f.empty_status]}</Badge>, sort: (f) => f.empty_status, title: (f) => EMPTY_LABEL[f.empty_status], width: '120px' },
    { key: 'comp', header: 'Completeness', render: (f) => <Badge tone={f.scan_completeness === 'complete' ? 'good' : 'warn'}>{f.scan_completeness}</Badge>, sort: (f) => f.scan_completeness },
  ];
  return (
    <Panel title="Folder summary" note="Direct = immediate children only. Recursive = all included descendants. Click a folder to see its files.">
      <div className="filters">
        <input className="grow" placeholder="Search folder path…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={empty} onChange={(e) => setEmpty(e.target.value)}><option value="">Any contents</option>{Object.entries(EMPTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={comp} onChange={(e) => setComp(e.target.value)}><option value="">Any completeness</option><option value="complete">Complete</option><option value="incomplete">Incomplete</option></select>
        <select value={depth} onChange={(e) => setDepth(e.target.value)}><option value="">Any depth</option>{Array.from({ length: maxDepth + 1 }, (_, i) => <option key={i} value={i}>Depth {i}</option>)}</select>
      </div>
      <DataTable rows={rows} columns={cols} rowKey={(f) => f.folder_id} initialSort={{ key: 'rs', dir: 'desc' }} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
export function StorageAnalysis({ r }: { r: ScanResult }) {
  const cfg = r.scan.configuration;
  const [thMbNum, setThNum] = useState(cfg.largeFileThresholdBytes / 1048576);
  const thMb = String(thMbNum);
  const [n, setN] = useState(cfg.topN);
  const ext = useMemo(() => extensionSummary(r.files), [r]);
  const depth = useMemo(() => depthDistribution(r), [r]);
  const th = thMbNum * 1048576;
  const large = useMemo(() => r.files.filter((f) => f.size_bytes >= th), [r, th]);
  const lf = useMemo(() => largestFiles(r.files, n), [r, n]);
  const lfo = useMemo(() => largestFolders(r.folders, n), [r, n]);
  const subOnly = useMemo(() => subfolderOnlyFolders(r.folders), [r]);
  const fileCols: Column<FileRecord>[] = [
    { key: 'p', header: 'File', render: (f) => <Path p={f.relative_path} />, sort: (f) => f.relative_path },
    { key: 'e', header: 'Ext', render: (f) => f.extension ? `.${f.extension}` : '—', sort: (f) => f.extension, width: '70px' },
    { key: 'm', header: 'Modified', render: (f) => formatDate(f.modified_at) || 'n/a', sort: (f) => f.modified_at ?? 0, width: '130px' },
    { key: 's', header: 'Size', render: (f) => formatBytes(f.size_bytes), sort: (f) => f.size_bytes, align: 'right', width: '90px' },
  ];
  return (
    <>
      <div className="filters bar">
        <label className="inline">Top N <NumberField ariaLabel="Top N" value={n} min={1} max={500} integer onChange={setN} className="num" /></label>
        <label className="inline">Large-file threshold (MB) <NumberField ariaLabel="Large-file threshold (MB)" value={thMbNum} min={0} onChange={setThNum} className="num" /></label>
      </div>
      <div className="grid2">
        <Panel title={`Top ${n} largest files`}><DataTable rows={lf} columns={fileCols} rowKey={(f) => f.file_id} pageSize={25} /></Panel>
        <Panel title={`Top ${n} largest folders`} note="By recursive size; root excluded">
          <DataTable rows={lfo} rowKey={(f) => f.folder_id} pageSize={25} columns={[
            { key: 'p', header: 'Folder', render: (f) => <Path p={f.relative_path} />, sort: (f) => f.relative_path },
            { key: 'f', header: 'Files', render: (f) => f.recursive_file_count.toLocaleString(), sort: (f) => f.recursive_file_count, align: 'right' },
            { key: 'd', header: 'Direct', render: (f) => formatBytes(f.direct_size_bytes), sort: (f) => f.direct_size_bytes, align: 'right' },
            { key: 's', header: 'Recursive', render: (f) => formatBytes(f.recursive_size_bytes), sort: (f) => f.recursive_size_bytes, align: 'right' },
          ]} />
        </Panel>
      </div>
      <Panel title="Extension summary" note="Percentages are of total accessible logical size">
        <DataTable rows={ext} rowKey={(e) => e.extension} pageSize={25} columns={[
          { key: 'e', header: 'Extension', render: (e) => e.extension === '(none)' ? <span className="muted">(none)</span> : <code>.{e.extension}</code>, sort: (e) => e.extension },
          { key: 'c', header: 'Files', render: (e) => e.file_count.toLocaleString(), sort: (e) => e.file_count, align: 'right' },
          { key: 's', header: 'Total size', render: (e) => formatBytes(e.total_size_bytes), sort: (e) => e.total_size_bytes, align: 'right' },
          { key: 'p', header: '% of size', render: (e) => <span className="pctbar"><span style={{ width: `${Math.min(100, e.pct_of_total)}%` }} />{e.pct_of_total.toFixed(1)}%</span>, sort: (e) => e.pct_of_total, align: 'right', width: '160px' },
          { key: 'a', header: 'Average', render: (e) => formatBytes(e.average_size_bytes), sort: (e) => e.average_size_bytes, align: 'right' },
          { key: 'l', header: 'Largest', render: (e) => formatBytes(e.largest_file_bytes), sort: (e) => e.largest_file_bytes, align: 'right' },
        ]} />
      </Panel>
      <div className="grid2">
        <Panel title={`Large files (≥ ${thMb || 0} MB)`} note={`${large.length.toLocaleString()} file(s) · ${formatBytes(large.reduce((s, f) => s + f.size_bytes, 0))}`}>
          <DataTable rows={large} columns={fileCols} rowKey={(f) => f.file_id} pageSize={25} initialSort={{ key: 's', dir: 'desc' }} empty="No files at or above this threshold." />
        </Panel>
        <Panel title="Distribution by depth" note="Depth 0 is the selected root. A file's depth is its folder's depth + 1.">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={depth.map((d) => ({ name: `Depth ${d.depth}`, value: d.size_bytes }))} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} stroke="var(--line)" />
              <YAxis tickFormatter={formatBytes} tick={{ fill: 'var(--muted)', fontSize: 11 }} stroke="var(--line)" width={70} />
              <Tooltip content={<ChartTip fmt={formatBytes} />} cursor={{ fill: 'var(--hover)' }} />
              <Bar dataKey="value" fill="#2f6fdf" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="mini"><thead><tr><th>Depth</th><th>Folders</th><th>Files</th><th>Size</th></tr></thead>
            <tbody>{depth.map((d) => <tr key={d.depth}><td>{d.depth}</td><td>{d.folders.toLocaleString()}</td><td>{d.files.toLocaleString()}</td><td>{formatBytes(d.size_bytes)}</td></tr>)}</tbody></table>
        </Panel>
      </div>
      <Panel title="Folders containing only subfolders" note="No files directly inside, but files exist deeper in the tree">
        <DataTable rows={subOnly} rowKey={(f) => f.folder_id} pageSize={25} empty="None." columns={[
          { key: 'p', header: 'Folder', render: (f) => <Path p={f.relative_path} />, sort: (f) => f.relative_path },
          { key: 'sd', header: 'Subfolders', render: (f) => f.direct_folder_count, sort: (f) => f.direct_folder_count, align: 'right' },
          { key: 'rf', header: 'Files below', render: (f) => f.recursive_file_count.toLocaleString(), sort: (f) => f.recursive_file_count, align: 'right' },
          { key: 'rs', header: 'Size below', render: (f) => formatBytes(f.recursive_size_bytes), sort: (f) => f.recursive_size_bytes, align: 'right' },
        ]} />
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
export function Duplicates({ r, onEnable }: { r: ScanResult; onEnable: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!r.scan.configuration.detectDuplicates) {
    return (
      <Panel title="Duplicate files">
        <Callout>Duplicate detection was <strong>off</strong> for this scan (it is off by default). Turn it on in New Scan and re-select the folder. It reads file contents locally to compute SHA-256 hashes, which can take a while on large folders. Nothing is uploaded.</Callout>
        <button className="btn primary" onClick={onEnable}>Set up a scan with duplicate detection</button>
      </Panel>
    );
  }
  const unverified = r.files.filter((f) => f.duplicate_status === 'unverified').length;
  return (
    <>
      <div className="stats">
        <Stat label="Duplicate groups" value={r.duplicates.length.toLocaleString()} />
        <Stat label="Files in groups" value={r.duplicates.reduce((s, g) => s + g.copy_count, 0).toLocaleString()} />
        <Stat label="Redundant-copy storage" value={formatBytes(r.scan.redundant_bytes)} sub="size × (copies − 1)" />
        <Stat label="Unverified" value={unverified.toLocaleString()} sub="hash failed or file over hashing limit" tone={unverified ? 'warn' : undefined} />
      </div>
      <Panel title="Duplicate groups" note="Grouped by identical size, then confirmed by identical SHA-256 content hash. Matching names alone are never treated as duplicates. This app never deletes or changes files.">
        {r.duplicates.length === 0 ? <p className="muted">No duplicate content found.</p> : (
          <div className="dups">
            {r.duplicates.map((g) => (
              <div key={g.group_id} className="dup">
                <button className="dup-head" onClick={() => setOpen(open === g.group_id ? null : g.group_id)} aria-expanded={open === g.group_id}>
                  <span className="strong">Group {g.group_id}</span>
                  <span>{g.copy_count} copies × {formatBytes(g.size_bytes)}</span>
                  <Badge tone="warn">{formatBytes(g.redundant_bytes)} redundant</Badge>
                  <code className="hash" title={g.content_hash}>{g.content_hash.slice(0, 16)}…</code>
                </button>
                {open === g.group_id && <ul>{g.file_ids.map((id) => <li key={id}><Path p={r.files[id].relative_path} /></li>)}</ul>}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
export function EmptyFolders({ r }: { r: ScanResult }) {
  const rows = useMemo(() => emptyFolders(r.folders), [r]);
  const unknown = r.folders.filter((f) => f.empty_status === 'unknown').length;
  return (
    <Panel title="Empty folders" note="Folders with no files anywhere inside them. Folders that could not be listed are marked unknown, never empty.">
      {r.scan.access_mode === 'directory-input' && <Callout tone="warn">This scan used the folder-upload fallback. Browsers do not expose empty folders in that mode, so this list may be missing some. Use a Chromium-based browser for full empty-folder detection.</Callout>}
      {unknown > 0 && <Callout tone="warn">{unknown} folder(s) could not be listed; their contents are unknown. See Scan Errors.</Callout>}
      <DataTable rows={rows} rowKey={(f) => f.folder_id} empty="No empty folders found." columns={[
        { key: 'p', header: 'Folder', render: (f) => <Path p={f.relative_path} />, sort: (f) => f.relative_path },
        { key: 'd', header: 'Depth', render: (f) => f.depth, sort: (f) => f.depth, align: 'right', width: '80px' },
        { key: 's', header: 'Empty subfolders', render: (f) => f.recursive_folder_count, sort: (f) => f.recursive_folder_count, align: 'right', width: '140px' },
        { key: 'c', header: 'Classification', render: (f) => <Badge tone={f.empty_status === 'empty' ? 'warn' : 'info'}>{EMPTY_LABEL[f.empty_status]}</Badge>, sort: (f) => f.empty_status },
      ]} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
export function Errors({ r }: { r: ScanResult }) {
  const [cat, setCat] = useState('');
  const cats = useMemo(() => [...new Set(r.errors.map((e) => e.error_category))], [r]);
  const rows = r.errors.filter((e) => !cat || e.error_category === cat);
  const hint: Record<string, string> = {
    'permission-denied': 'The browser or operating system refused access. Check folder permissions, or select that folder directly.',
    'not-found': 'The item disappeared or was renamed during the scan. Re-scan to refresh.',
    'not-readable': 'The file is locked by another program or unreadable. Close it and re-scan.',
    'enumeration-failed': 'The folder could not be listed. Its subtree is marked incomplete.',
    'hash-failed': 'Content could not be read for hashing; duplicate status is unverified.',
    'hash-skipped-too-large': 'Raise the hashing size limit in Settings to include very large files.',
    'cancelled': 'You stopped the scan. Results cover only what was inventoried before cancelling.',
  };
  return (
    <Panel title="Scan errors" note={`${r.errors.length} issue(s). Items with errors are kept in the inventory where possible and their folders are marked incomplete.`}>
      {cats.length > 1 && <div className="filters"><select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>}
      {cats.map((c) => hint[c] && <p key={c} className="hint"><Badge tone="bad">{c}</Badge> {hint[c]}</p>)}
      <DataTable<ScanError> rows={rows} rowKey={(e) => e.error_id} empty="No errors — every accessible item was read successfully." columns={[
        { key: 'p', header: 'Path', render: (e) => e.relative_path ? <Path p={e.relative_path} /> : <span className="muted">(whole scan)</span>, sort: (e) => e.relative_path },
        { key: 't', header: 'Type', render: (e) => e.item_type, sort: (e) => e.item_type, width: '70px' },
        { key: 'c', header: 'Category', render: (e) => <Badge tone="bad">{e.error_category}</Badge>, sort: (e) => e.error_category, width: '170px' },
        { key: 'm', header: 'Message', render: (e) => e.message },
        { key: 'ts', header: 'Time', render: (e) => formatDate(e.timestamp), sort: (e) => e.timestamp, width: '130px' },
      ]} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
export function History({ rows, error, onDelete, onClear, currentId, savedIds, onOpen, onDownload, busy }: {
  rows: ScanRecord[]; error: string | null; onDelete: (id: string) => void; onClear: () => void; currentId?: string;
  savedIds: Set<string>; onOpen: (id: string) => void; onDownload: (id: string, kind: 'xlsx' | 'zip') => void; busy: string | null;
}) {
  const time = (ms: number) => formatDate(ms).slice(11);
  return (
    <Panel title="Scan history" note="Scans made on this PC. Open a saved scan to see all its screens again, or download its reports straight from here. Everything is stored only in this browser, and browsers may clear it."
      actions={rows.length > 0 && <button className="btn ghost sm danger" onClick={onClear}>Clear all history</button>}>
      {error && <Callout tone="warn">{error}</Callout>}
      <DataTable<ScanRecord> rows={rows} rowKey={(s) => s.scan_id} empty="No saved scans yet." columns={[
        { key: 'scan', header: 'Scan', wrap: true, width: '26%', sort: (s) => s.root_label.toLowerCase(), render: (s) => (
          <div><span className="hist-name">{s.root_label}</span>{s.scan_id === currentId && <> <Badge tone="info">open now</Badge></>}<code className="hist-id">{s.scan_id}</code></div>
        ) },
        { key: 'when', header: 'When', wrap: true, sort: (s) => s.started_at, render: (s) => (
          <div className="hist-when">{formatDate(s.started_at).slice(0, 10)}<br />{time(s.started_at)} → {s.completed_at ? time(s.completed_at) : '—'}<span className="muted"> · {s.completed_at ? formatDuration(s.completed_at - s.started_at) : '—'}</span></div>
        ) },
        { key: 'st', header: 'Status', wrap: true, sort: (s) => s.status, render: (s) => (
          <div><Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>{!savedIds.has(s.scan_id) && <span className="hist-id" title="Only the summary of this scan was kept, so it can't be reopened. Scans made before v1.2, or with 'Keep full results' turned off, and scans older than the newest 20 are summary only.">Summary only</span>}</div>
        ) },
        { key: 'f', header: 'Files', render: (s) => s.files_discovered.toLocaleString(), sort: (s) => s.files_discovered, align: 'right', wrap: true },
        { key: 'd', header: 'Folders', render: (s) => s.folders_discovered.toLocaleString(), sort: (s) => s.folders_discovered, align: 'right', wrap: true },
        { key: 'sz', header: 'Size', render: (s) => formatBytes(s.total_accessible_size_bytes), sort: (s) => s.total_accessible_size_bytes, align: 'right', wrap: true },
        { key: 'e', header: 'Errors', render: (s) => s.error_count, sort: (s) => s.error_count, align: 'right', wrap: true },
        { key: 'x', header: 'Actions', wrap: true, width: '30%', align: 'right', render: (s) => {
          const has = savedIds.has(s.scan_id);
          const tip = has ? undefined : "Only the summary of this scan was kept, so there's nothing to open or download.";
          return (
            <div className="hist-actions">
              <button className="btn primary" disabled={!has || !!busy} title={tip} aria-label={`Open scan of ${s.root_label}`} onClick={() => onOpen(s.scan_id)}>Open</button>
              <button className="btn" disabled={!has || !!busy} title={tip} aria-label={`Download Excel for ${s.root_label}`} onClick={() => onDownload(s.scan_id, 'xlsx')}>{busy === `${s.scan_id}:xlsx` ? 'Building…' : '⬇ Excel'}</button>
              <button className="btn" disabled={!has || !!busy} title={tip} aria-label={`Download CSV ZIP for ${s.root_label}`} onClick={() => onDownload(s.scan_id, 'zip')}>{busy === `${s.scan_id}:zip` ? 'Zipping…' : '⬇ CSVs'}</button>
              <button className="btn ghost danger" disabled={!!busy} aria-label={`Delete scan of ${s.root_label}`} onClick={() => onDelete(s.scan_id)}>Delete</button>
            </div>
          );
        } },
      ]} />
      <p className="hint">Full results are kept for the newest 20 scans. Older scans keep their summary only. Comparing two scans is planned for a future release.</p>
    </Panel>
  );
}
