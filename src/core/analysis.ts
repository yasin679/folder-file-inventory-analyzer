import type { FileRecord, FolderRecord, ScanResult } from './types';

// Single source of truth for derived reports — used by the dashboard, tables and both exports,
// so every surface shows the same numbers.

export interface ExtensionRow {
  extension: string; // "(none)" when the file has no extension
  file_count: number;
  total_size_bytes: number;
  pct_of_total: number;
  average_size_bytes: number;
  largest_file_bytes: number;
}

export function extensionSummary(files: FileRecord[]): ExtensionRow[] {
  const total = files.reduce((s, f) => s + f.size_bytes, 0);
  const m = new Map<string, { c: number; s: number; max: number }>();
  for (const f of files) {
    const k = f.extension || '(none)';
    const e = m.get(k) ?? { c: 0, s: 0, max: 0 };
    e.c++; e.s += f.size_bytes; e.max = Math.max(e.max, f.size_bytes);
    m.set(k, e);
  }
  return [...m.entries()]
    .map(([extension, e]) => ({
      extension, file_count: e.c, total_size_bytes: e.s,
      pct_of_total: total > 0 ? (e.s / total) * 100 : 0,
      average_size_bytes: e.c ? Math.round(e.s / e.c) : 0, largest_file_bytes: e.max,
    }))
    .sort((a, b) => b.total_size_bytes - a.total_size_bytes || b.file_count - a.file_count || a.extension.localeCompare(b.extension));
}

export function largestFiles(files: FileRecord[], n: number): FileRecord[] {
  return [...files].sort((a, b) => b.size_bytes - a.size_bytes || a.relative_path.localeCompare(b.relative_path)).slice(0, n);
}

/** Largest folders by recursive size, excluding the root (which is always the largest). */
export function largestFolders(folders: FolderRecord[], n: number): FolderRecord[] {
  return folders.filter((f) => f.depth > 0)
    .sort((a, b) => b.recursive_size_bytes - a.recursive_size_bytes || a.relative_path.localeCompare(b.relative_path)).slice(0, n);
}

export const EMPTY_LABEL: Record<FolderRecord['empty_status'], string> = {
  'empty': 'Empty (no files, no subfolders)',
  'no-files-only-subfolders': 'No files anywhere — only empty subfolders',
  'subfolders-only': 'Subfolders only (files exist deeper)',
  'has-files': 'Contains files',
  'unknown': 'Unknown — folder could not be fully listed',
};

export function emptyFolders(folders: FolderRecord[]): FolderRecord[] {
  return folders.filter((f) => f.empty_status === 'empty' || f.empty_status === 'no-files-only-subfolders');
}

export function subfolderOnlyFolders(folders: FolderRecord[]): FolderRecord[] {
  return folders.filter((f) => f.empty_status === 'subfolders-only');
}

export interface DepthRow { depth: number; folders: number; files: number; size_bytes: number }

export function depthDistribution(r: ScanResult): DepthRow[] {
  const rows = new Map<number, DepthRow>();
  const get = (d: number) => {
    let x = rows.get(d);
    if (!x) { x = { depth: d, folders: 0, files: 0, size_bytes: 0 }; rows.set(d, x); }
    return x;
  };
  for (const f of r.folders) { get(f.depth).folders++; }
  for (const f of r.files) {
    const d = r.folders[f.folder_id].depth + 1; // file depth = parent depth + 1
    const row = get(d); row.files++; row.size_bytes += f.size_bytes;
  }
  return [...rows.values()].sort((a, b) => a.depth - b.depth);
}

export function keyFindings(r: ScanResult): string[] {
  const out: string[] = [];
  const ext = extensionSummary(r.files);
  if (ext[0]) out.push(`.${ext[0].extension} files use the most space (${ext[0].pct_of_total.toFixed(1)}% of accessible size, ${ext[0].file_count} files).`);
  const lf = largestFolders(r.folders, 1)[0];
  if (lf && r.scan.total_accessible_size_bytes > 0) out.push(`Largest subfolder is "${lf.relative_path}" holding ${((lf.recursive_size_bytes / r.scan.total_accessible_size_bytes) * 100).toFixed(1)}% of accessible size.`);
  const big = r.files.filter((f) => f.size_bytes >= r.scan.configuration.largeFileThresholdBytes).length;
  if (big) out.push(`${big} file(s) are at or above the large-file threshold.`);
  const empty = emptyFolders(r.folders).length;
  if (empty) out.push(`${empty} folder(s) contain no files at all.`);
  if (r.scan.configuration.detectDuplicates) out.push(r.duplicates.length ? `${r.duplicates.length} duplicate group(s) confirmed by SHA-256 hash.` : 'No duplicate content found among hashed files.');
  if (r.scan.status !== 'completed') out.push(`Scan status is "${r.scan.status}" — some results may be partial. See Scan Errors.`);
  return out;
}

// ---------------------------------------------------------------------------
// Folder tree: every folder and file in Explorer order (subfolders first, then files,
// each sorted by name), so people can see which folder holds what and where each file is.

export interface TreeRow {
  kind: 'folder' | 'file';
  level: number;            // 0 = selected root
  name: string;
  path: string;             // full relative path
  id: number;               // folder_id or file_id
  parentFolderId: number | null;
  sizeBytes: number;        // folder: recursive size
  filesHere?: number;       // folder: files directly inside
  filesTotal?: number;      // folder: files including all subfolders
  subfolders?: number;      // folder: direct subfolders
  status?: FolderRecord['empty_status'];
  modifiedAt?: number | null;
}

const byName = (a: { name: string }, b: { name: string }) => {
  const x = a.name.toLowerCase(), y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
};

export interface TreeIndex { subfolders: Map<number, FolderRecord[]>; files: Map<number, FileRecord[]> }

/** Children of each folder, sorted the way the tree shows them. */
export function treeIndex(r: ScanResult): TreeIndex {
  const subfolders = new Map<number, FolderRecord[]>();
  const files = new Map<number, FileRecord[]>();
  for (const f of r.folders) if (f.parent_folder_id != null) {
    const a = subfolders.get(f.parent_folder_id); if (a) a.push(f); else subfolders.set(f.parent_folder_id, [f]);
  }
  for (const f of r.files) { const a = files.get(f.folder_id); if (a) a.push(f); else files.set(f.folder_id, [f]); }
  const nameOfFolder = (f: FolderRecord) => ({ name: f.folder_name });
  const nameOfFile = (f: FileRecord) => ({ name: f.file_name });
  for (const a of subfolders.values()) a.sort((p, q) => byName(nameOfFolder(p), nameOfFolder(q)));
  for (const a of files.values()) a.sort((p, q) => byName(nameOfFile(p), nameOfFile(q)));
  return { subfolders, files };
}

export const folderRow = (f: FolderRecord): TreeRow => ({
  kind: 'folder', level: f.depth, name: f.folder_name, path: f.relative_path, id: f.folder_id, parentFolderId: f.parent_folder_id,
  sizeBytes: f.recursive_size_bytes, filesHere: f.direct_file_count, filesTotal: f.recursive_file_count, subfolders: f.direct_folder_count, status: f.empty_status,
});
export const fileRow = (f: FileRecord, level: number): TreeRow => ({
  kind: 'file', level, name: f.file_name, path: f.relative_path, id: f.file_id, parentFolderId: f.folder_id, sizeBytes: f.size_bytes, modifiedAt: f.modified_at,
});

/** The whole tree, depth-first (iterative, so very deep trees can't overflow the stack). */
export function folderTree(r: ScanResult, idx: TreeIndex = treeIndex(r)): TreeRow[] {
  const out: TreeRow[] = [];
  const root = r.folders.find((f) => f.parent_folder_id == null);
  if (!root) return out;
  const stack: Array<{ folder: FolderRecord } | { file: FileRecord; level: number }> = [{ folder: root }];
  while (stack.length) {
    const it = stack.pop()!;
    if ('file' in it) { out.push(fileRow(it.file, it.level)); continue; }
    const f = it.folder;
    out.push(folderRow(f));
    const kids: typeof stack = [
      ...(idx.subfolders.get(f.folder_id) ?? []).map((folder) => ({ folder })),
      ...(idx.files.get(f.folder_id) ?? []).map((file) => ({ file, level: f.depth + 1 })),
    ];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return out;
}

export interface BreakdownRow { kind: 'folder' | 'root-files'; id: number; name: string; files: number; size: number; unknown: boolean }

/** Top-level breakdown for the dashboard: each first-level folder plus the root's own files. */
export function topLevelBreakdown(r: ScanResult): BreakdownRow[] {
  const root = r.folders.find((f) => f.parent_folder_id == null);
  if (!root) return [];
  const rows: BreakdownRow[] = r.folders.filter((f) => f.parent_folder_id === root.folder_id).map((f) => ({
    kind: 'folder' as const, id: f.folder_id, name: f.folder_name, files: f.recursive_file_count, size: f.recursive_size_bytes, unknown: f.empty_status === 'unknown',
  }));
  if (root.direct_file_count > 0) rows.push({ kind: 'root-files' as const, id: root.folder_id, name: `Files directly in ${root.folder_name}`, files: root.direct_file_count, size: root.direct_size_bytes, unknown: false });
  return rows.sort((a, b) => Number(a.unknown) - Number(b.unknown) || b.files - a.files || byName(a, b));
}
