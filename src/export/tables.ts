import { folderTree, depthDistribution, EMPTY_LABEL, emptyFolders, extensionSummary, keyFindings, largestFiles, largestFolders } from '../core/analysis';
import { formatBytes, formatDate, formatDuration } from '../core/format';
import type { ScanResult } from '../core/types';

// Report tables are defined once here and rendered by both the XLSX and CSV exporters,
// guaranteeing the two formats agree with each other and with the scan data.

export type ColKind = 'text' | 'int' | 'bytes' | 'date' | 'pct';
export interface Col { header: string; kind: ColKind; width?: number }
export type Cell = string | number | null;
export interface ReportTable {
  name: string; file: string; columns: Col[]; rows: Cell[][]; expectedRows: number;
  /** Optional per-row presentation for tree-shaped tables: indent level of column 1 and bold rows. */
  indent?: number[]; bold?: boolean[];
}

const date = (ms: number | null) => (ms == null ? null : formatDate(ms));

export function buildTables(r: ScanResult): ReportTable[] {
  const cfg = r.scan.configuration;
  const folderPath = (id: number) => r.folders[id]?.relative_path ?? '';
  const tables: ReportTable[] = [];

  const tree = folderTree(r);
  tables.push({
    name: 'Folder Tree', file: 'folder_tree.csv',
    columns: [
      { header: 'Item', kind: 'text', width: 48 }, { header: 'Type', kind: 'text', width: 10 },
      { header: 'Files here', kind: 'int', width: 11 }, { header: 'Files in total (incl. subfolders)', kind: 'int', width: 16 },
      { header: 'Size (bytes)', kind: 'int', width: 15 }, { header: 'Size', kind: 'text', width: 11 },
      { header: 'Relative path', kind: 'text', width: 70 },
    ],
    rows: tree.map((t) => t.kind === 'folder'
      ? [t.name, t.status === 'unknown' ? "Folder (couldn't be opened)" : 'Folder', t.filesHere!, t.filesTotal!, t.sizeBytes, formatBytes(t.sizeBytes), t.path]
      : [t.name, 'File', null, null, t.sizeBytes, formatBytes(t.sizeBytes), t.path]),
    indent: tree.map((t) => t.level),
    bold: tree.map((t) => t.kind === 'folder'),
    expectedRows: r.files.length + r.folders.length,
  });

  tables.push({
    name: 'File Inventory', file: 'file_inventory.csv',
    columns: [
      { header: 'File ID', kind: 'int', width: 9 }, { header: 'File Name', kind: 'text', width: 34 },
      { header: 'Relative Path', kind: 'text', width: 70 }, { header: 'Parent Folder', kind: 'text', width: 50 },
      { header: 'Extension', kind: 'text', width: 11 }, { header: 'Size (bytes)', kind: 'int', width: 15 },
      { header: 'Size (formatted)', kind: 'text', width: 13 }, { header: 'Modified (local time)', kind: 'date', width: 18 },
      { header: 'Dot-prefixed', kind: 'text', width: 12 }, { header: 'Scan Status', kind: 'text', width: 15 },
      ...(cfg.detectDuplicates ? [
        { header: 'Duplicate Status', kind: 'text' as const, width: 15 }, { header: 'Duplicate Group', kind: 'int' as const, width: 15 },
        { header: 'SHA-256', kind: 'text' as const, width: 66 },
      ] : []),
    ],
    rows: r.files.map((f) => [
      f.file_id, f.file_name, f.relative_path, f.parent_path, f.extension, f.size_bytes, formatBytes(f.size_bytes),
      date(f.modified_at), f.dot_prefixed ? 'Yes' : 'No', f.scan_status,
      ...(cfg.detectDuplicates ? [f.duplicate_status, f.duplicate_group ?? null, f.content_hash ?? null] : []),
    ]),
    expectedRows: r.files.length,
  });

  tables.push({
    name: 'Folder Summary', file: 'folder_summary.csv',
    columns: [
      { header: 'Folder ID', kind: 'int', width: 10 }, { header: 'Folder Name', kind: 'text', width: 30 },
      { header: 'Relative Path', kind: 'text', width: 60 }, { header: 'Parent Folder', kind: 'text', width: 50 },
      { header: 'Depth', kind: 'int', width: 7 },
      { header: 'Direct Files', kind: 'int', width: 12 }, { header: 'Recursive Files', kind: 'int', width: 15 },
      { header: 'Direct Subfolders', kind: 'int', width: 16 }, { header: 'Recursive Subfolders', kind: 'int', width: 19 },
      { header: 'Direct Size (bytes)', kind: 'int', width: 18 }, { header: 'Recursive Size (bytes)', kind: 'int', width: 21 },
      { header: 'Recursive Size (formatted)', kind: 'text', width: 14 },
      { header: 'Empty Status', kind: 'text', width: 34 }, { header: 'Scan Completeness', kind: 'text', width: 17 },
    ],
    rows: r.folders.map((f) => [
      f.folder_id, f.folder_name, f.relative_path, f.parent_path ?? '(selected root)', f.depth,
      f.direct_file_count, f.recursive_file_count, f.direct_folder_count, f.recursive_folder_count,
      f.direct_size_bytes, f.recursive_size_bytes, formatBytes(f.recursive_size_bytes), EMPTY_LABEL[f.empty_status], f.scan_completeness,
    ]),
    expectedRows: r.folders.length,
  });

  const ext = extensionSummary(r.files);
  tables.push({
    name: 'Extension Summary', file: 'extension_summary.csv',
    columns: [
      { header: 'Extension', kind: 'text', width: 14 }, { header: 'File Count', kind: 'int', width: 12 },
      { header: 'Total Size (bytes)', kind: 'int', width: 18 }, { header: 'Total Size (formatted)', kind: 'text', width: 14 },
      { header: '% of Accessible Size', kind: 'pct', width: 18 }, { header: 'Average Size (bytes)', kind: 'int', width: 18 },
      { header: 'Largest File (bytes)', kind: 'int', width: 18 },
    ],
    rows: ext.map((e) => [e.extension, e.file_count, e.total_size_bytes, formatBytes(e.total_size_bytes), Number(e.pct_of_total.toFixed(4)), e.average_size_bytes, e.largest_file_bytes]),
    expectedRows: ext.length,
  });

  const lf = largestFiles(r.files, cfg.topN);
  tables.push({
    name: 'Largest Files', file: 'largest_files.csv',
    columns: [
      { header: 'Rank', kind: 'int', width: 6 }, { header: 'File Name', kind: 'text', width: 34 },
      { header: 'Relative Path', kind: 'text', width: 70 }, { header: 'Extension', kind: 'text', width: 11 },
      { header: 'Size (bytes)', kind: 'int', width: 15 }, { header: 'Size (formatted)', kind: 'text', width: 13 },
      { header: 'Modified (local time)', kind: 'date', width: 18 },
    ],
    rows: lf.map((f, i) => [i + 1, f.file_name, f.relative_path, f.extension, f.size_bytes, formatBytes(f.size_bytes), date(f.modified_at)]),
    expectedRows: lf.length,
  });

  const lfo = largestFolders(r.folders, cfg.topN);
  tables.push({
    name: 'Largest Folders', file: 'largest_folders.csv',
    columns: [
      { header: 'Rank', kind: 'int', width: 6 }, { header: 'Relative Path', kind: 'text', width: 60 }, { header: 'Depth', kind: 'int', width: 7 },
      { header: 'Direct Size (bytes)', kind: 'int', width: 18 }, { header: 'Recursive Size (bytes)', kind: 'int', width: 21 },
      { header: 'Recursive Size (formatted)', kind: 'text', width: 14 },
      { header: 'Direct Files', kind: 'int', width: 12 }, { header: 'Recursive Files', kind: 'int', width: 15 },
      { header: 'Scan Completeness', kind: 'text', width: 17 },
    ],
    rows: lfo.map((f, i) => [i + 1, f.relative_path, f.depth, f.direct_size_bytes, f.recursive_size_bytes, formatBytes(f.recursive_size_bytes), f.direct_file_count, f.recursive_file_count, f.scan_completeness]),
    expectedRows: lfo.length,
  });

  if (cfg.detectDuplicates) {
    const rows: Cell[][] = [];
    for (const g of r.duplicates) for (const id of g.file_ids) {
      const f = r.files[id];
      rows.push([g.group_id, g.content_hash, f.relative_path, f.size_bytes, formatBytes(f.size_bytes), g.copy_count, g.redundant_bytes]);
    }
    tables.push({
      name: 'Duplicate Files', file: 'duplicate_files.csv',
      columns: [
        { header: 'Group ID', kind: 'int', width: 9 }, { header: 'SHA-256', kind: 'text', width: 66 }, { header: 'Relative Path', kind: 'text', width: 70 },
        { header: 'File Size (bytes)', kind: 'int', width: 16 }, { header: 'File Size (formatted)', kind: 'text', width: 13 },
        { header: 'Copies in Group', kind: 'int', width: 15 }, { header: 'Group Redundant Bytes', kind: 'int', width: 20 },
      ],
      rows, expectedRows: r.duplicates.reduce((s, g) => s + g.copy_count, 0),
    });
  }

  const ef = emptyFolders(r.folders);
  tables.push({
    name: 'Empty Folders', file: 'empty_folders.csv',
    columns: [{ header: 'Relative Path', kind: 'text', width: 70 }, { header: 'Depth', kind: 'int', width: 7 }, { header: 'Subfolders (recursive)', kind: 'int', width: 20 }, { header: 'Classification', kind: 'text', width: 44 }],
    rows: ef.map((f) => [f.relative_path, f.depth, f.recursive_folder_count, EMPTY_LABEL[f.empty_status]]),
    expectedRows: ef.length,
  });

  tables.push({
    name: 'Scan Errors', file: 'scan_errors.csv',
    columns: [
      { header: 'Error ID', kind: 'int', width: 9 }, { header: 'Relative Path', kind: 'text', width: 60 }, { header: 'Item Type', kind: 'text', width: 10 },
      { header: 'Error Category', kind: 'text', width: 22 }, { header: 'Message', kind: 'text', width: 80 }, { header: 'Timestamp (local time)', kind: 'date', width: 18 },
    ],
    rows: r.errors.map((e) => [e.error_id, e.relative_path, e.item_type, e.error_category, e.message, formatDate(e.timestamp)]),
    expectedRows: r.errors.length,
  });

  return tables;
}

export function summaryRows(r: ScanResult): Array<[string, Cell]> {
  const s = r.scan;
  const c = s.configuration;
  const lf = largestFiles(r.files, 1)[0];
  const lfo = largestFolders(r.folders, 1)[0];
  return [
    ['Selected root', s.root_label],
    ['Scan ID', s.scan_id],
    ['Access mode', s.access_mode === 'file-system-access' ? 'File System Access API (directory picker)' : 'Directory upload input (fallback)'],
    ['Status', s.status],
    ['Started', formatDate(s.started_at)],
    ['Completed', formatDate(s.completed_at)],
    ['Duration', s.completed_at ? formatDuration(s.completed_at - s.started_at) : ''],
    ['Files', s.files_discovered],
    ['Folders (including root)', s.folders_discovered],
    ['Accessible logical size (bytes)', s.total_accessible_size_bytes],
    ['Accessible logical size', formatBytes(s.total_accessible_size_bytes)],
    ['Average file size (bytes)', s.files_discovered ? Math.round(s.total_accessible_size_bytes / s.files_discovered) : 0],
    ['Largest file', lf ? `${lf.relative_path} (${formatBytes(lf.size_bytes)})` : ''],
    ['Largest subfolder', lfo ? `${lfo.relative_path} (${formatBytes(lfo.recursive_size_bytes)})` : ''],
    ['Errors', s.error_count],
    ['Skipped by configuration', s.skipped_count],
    ['Max folder depth', depthDistribution(r).reduce((m, d) => Math.max(m, d.depth), 0)],
    ['Setting: include dot-prefixed items', c.includeDotItems ? 'Yes' : 'No'],
    ['Setting: duplicate detection', c.detectDuplicates ? 'Enabled (SHA-256)' : 'Disabled'],
    ['Setting: large-file threshold (bytes)', c.largeFileThresholdBytes],
    ['Setting: top-N', c.topN],
    ...(c.detectDuplicates ? [['Duplicate groups', s.duplicate_groups], ['Redundant copy storage (bytes)', s.redundant_bytes]] as Array<[string, Cell]> : []),
    ['Note', 'Sizes are logical file sizes as reported by the browser, not physical disk allocation.'],
  ];
}

export { keyFindings };
