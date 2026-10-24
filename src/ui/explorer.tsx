import { useEffect, useMemo, useRef, useState } from 'react';
import { fileRow, folderRow, treeIndex, type TreeRow } from '../core/analysis';
import { formatBytes, formatDate } from '../core/format';
import type { ScanResult } from '../core/types';
import { Panel } from './components';

export interface TreeFocus { kind: 'file' | 'folder'; id: number; token: number }

const FILE_CAP = 200; // files shown per folder before "Show all"

/**
 * Folder Explorer: the scan as an expandable tree. Each folder shows how many files sit
 * directly in it and how many in total; expanding it lists its subfolders, then its files.
 */
export function FolderExplorer({ r, focus }: { r: ScanResult; focus?: TreeFocus }) {
  const idx = useMemo(() => treeIndex(r), [r]);
  const root = r.folders.find((f) => f.parent_folder_id == null);
  const rootSize = root?.recursive_size_bytes || 1;

  const ancestorsOf = (folderId: number) => {
    const ids: number[] = [];
    for (let f: number | null = folderId; f != null; f = r.folders[f].parent_folder_id) ids.push(f);
    return ids;
  };
  const initialExpanded = () => {
    const s = new Set<number>(root ? [root.folder_id] : []);
    if (focus) ancestorsOf(focus.kind === 'file' ? r.files[focus.id].folder_id : focus.id).forEach((id) => s.add(id));
    return s;
  };
  const [expanded, setExpanded] = useState<Set<number>>(initialExpanded);
  const [showAll, setShowAll] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setExpanded(initialExpanded()); setQuery(''); }, [focus?.token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { selectedRef.current?.scrollIntoView?.({ block: 'center' }); }, [focus?.token]);

  const q = query.trim().toLowerCase();
  const search = useMemo(() => {
    if (!q) return null;
    const files = new Set<number>(); const folders = new Set<number>(); const keep = new Set<number>();
    for (const f of r.files) if (f.file_name.toLowerCase().includes(q)) { files.add(f.file_id); ancestorsOf(f.folder_id).forEach((id) => keep.add(id)); }
    for (const f of r.folders) if (f.folder_name.toLowerCase().includes(q)) { folders.add(f.folder_id); ancestorsOf(f.folder_id).forEach((id) => keep.add(id)); }
    return { files, folders, keep, count: files.size + folders.size };
  }, [q, r]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: Array<TreeRow & { match?: boolean; more?: number }> = [];
  if (root) {
    const stack: Array<{ folderId: number } | { row: TreeRow & { match?: boolean; more?: number } }> = [{ folderId: root.folder_id }];
    while (stack.length) {
      const it = stack.pop()!;
      if ('row' in it) { rows.push(it.row); continue; }
      const f = r.folders[it.folderId];
      if (search && !search.keep.has(f.folder_id)) continue;
      rows.push({ ...folderRow(f), match: search?.folders.has(f.folder_id) });
      const open = search ? true : expanded.has(f.folder_id);
      if (!open) continue;
      const subs = (idx.subfolders.get(f.folder_id) ?? []).filter((s) => !search || search.keep.has(s.folder_id));
      let files = idx.files.get(f.folder_id) ?? [];
      if (search) files = files.filter((x) => search.files.has(x.file_id));
      const cap = search || showAll.has(f.folder_id) ? files.length : FILE_CAP;
      const kids: typeof stack = [
        ...subs.map((s) => ({ folderId: s.folder_id })),
        ...files.slice(0, cap).map((x) => ({ row: { ...fileRow(x, f.depth + 1), match: search?.files.has(x.file_id) } })),
      ];
      if (files.length > cap) kids.push({ row: { kind: 'file', level: f.depth + 1, name: '', path: '', id: -1, parentFolderId: f.folder_id, sizeBytes: 0, more: files.length - cap } });
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    }
  }

  const toggle = (id: number) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const filesHere = (n: number) => `${n.toLocaleString()} file${n === 1 ? '' : 's'} here`;
  const plural = (n: number, w: string) => `${n.toLocaleString()} ${w}${n === 1 ? '' : 'es'}`;

  return (
    <Panel title="Folder tree" note="Every folder with the number of files directly in it and in total (including subfolders). Open a folder to see its subfolders, then its files.">
      <div className="filters">
        <input className="grow" placeholder="Find a file or folder by name…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a file or folder" />
        {search && <span className="muted small">{plural(search.count, 'match')}</span>}
        <button className="btn ghost sm" onClick={() => { setQuery(''); setExpanded(new Set(r.folders.map((f) => f.folder_id))); }}>Expand all</button>
        <button className="btn ghost sm" onClick={() => { setQuery(''); setExpanded(new Set()); }}>Collapse all</button>
      </div>
      {search && search.count === 0 && <p className="muted">No file or folder name contains “{query}”.</p>}
      <div className="tree" role="tree" aria-label="Folder tree">
        {rows.map((row) => {
          if (row.more) {
            return (
              <div key={`more-${row.parentFolderId}`} className="tree-row more" style={{ paddingLeft: 12 + row.level * 22 }}>
                <button className="link" onClick={() => setShowAll((s) => new Set(s).add(row.parentFolderId!))}>Show all files ({row.more.toLocaleString()} more)</button>
              </div>
            );
          }
          const selected = focus && focus.kind === row.kind && focus.id === row.id;
          if (row.kind === 'folder') {
            const hasKids = (row.filesHere ?? 0) > 0 || (row.subfolders ?? 0) > 0;
            const open = search ? true : expanded.has(row.id);
            const label = `${row.name} — ${row.status === 'unknown' ? "couldn't be opened" : `${filesHere(row.filesHere!)}, ${row.filesTotal} in total`}, ${formatBytes(row.sizeBytes)}`;
            return (
              <div key={`d${row.id}`} ref={selected ? selectedRef : undefined} role="treeitem" aria-level={row.level + 1} aria-expanded={hasKids ? open : undefined}
                aria-selected={selected || undefined} aria-label={label} data-match={row.match || undefined}
                className={`tree-row folder${selected ? ' selected' : ''}${row.match ? ' match' : ''}`} style={{ paddingLeft: 12 + row.level * 22 }}>
                {hasKids
                  ? <button className="twisty" aria-label={`${open ? 'Collapse' : 'Expand'} ${row.name}`} onClick={() => toggle(row.id)} disabled={!!search}>{open ? '▾' : '▸'}</button>
                  : <span className="twisty" />}
                <span className="ico" aria-hidden>📁</span>
                <span className="tname strong" title={row.path}>{row.name}</span>
                <span className="tmeta">
                  {row.status === 'unknown' ? <span className="badge bad">couldn't be opened</span>
                    : row.status === 'empty' ? <span className="badge warn">empty</span>
                    : row.status === 'no-files-only-subfolders' ? <span className="badge warn">no files (only empty subfolders)</span>
                    : <><span className="count-chip">{filesHere(row.filesHere!)}</span><span className="count-chip total">{`${row.filesTotal!.toLocaleString()} in total`}</span></>}
                </span>
                <span className="tsize">{formatBytes(row.sizeBytes)}</span>
                <span className="tbar" aria-hidden><span style={{ width: `${Math.max(1, (row.sizeBytes / rootSize) * 100)}%` }} /></span>
              </div>
            );
          }
          return (
            <div key={`f${row.id}`} ref={selected ? selectedRef : undefined} role="treeitem" aria-level={row.level + 1} aria-selected={selected || undefined}
              aria-label={`${row.name} — ${formatBytes(row.sizeBytes)}`} data-match={row.match || undefined}
              className={`tree-row file${selected ? ' selected' : ''}${row.match ? ' match' : ''}`} style={{ paddingLeft: 12 + row.level * 22 }}>
              <span className="twisty" />
              <span className="ico" aria-hidden>📄</span>
              <span className="tname" title={row.path}>{row.name}</span>
              <span className="tmeta muted small">{row.modifiedAt != null ? formatDate(row.modifiedAt) : ''}</span>
              <span className="tsize">{formatBytes(row.sizeBytes)}</span>
              <span className="tbar" aria-hidden />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
