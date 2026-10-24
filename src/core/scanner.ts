import { extensionOf } from './format';
import type {
  AccessMode, DuplicateGroup, ErrorCategory, FileRecord, FolderRecord, ScanConfig,
  ScanError, ScanProgress, ScanRecord, ScanResult, ScanStatus,
} from './types';

/** Something that can hand us the file's bytes later (only used for optional hashing). */
export type BlobGetter = () => Promise<Blob>;

/** Read a Blob's bytes; falls back to FileReader where Blob.arrayBuffer() is missing (Safari < 14). */
export function readBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof (blob as Blob & { arrayBuffer?: unknown }).arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsArrayBuffer(blob);
  });
}

export function categorize(e: unknown): ErrorCategory {
  const name = (e as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'permission-denied';
    case 'NotFoundError':
      return 'not-found';
    case 'NotReadableError':
      return 'not-readable';
    case 'TypeMismatchError':
    case 'InvalidStateError':
      return 'metadata-unavailable';
    default:
      return 'unknown';
  }
}

export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  return String(e);
}

interface FolderInternal extends FolderRecord {
  enumerated: boolean; // own entries fully listed
  selfIncomplete: boolean;
}

/**
 * Accumulates entries reported by a source walker, then computes direct/recursive
 * aggregates. Sources call addFolder / addFile / addError; the Scanner never touches
 * the filesystem itself, which keeps the calculation rules testable with fixtures.
 */
export class Scanner {
  readonly files: FileRecord[] = [];
  readonly folders: FolderInternal[] = [];
  readonly errors: ScanError[] = [];
  readonly getters = new Map<number, BlobGetter>();
  skipped = 0;
  bytes = 0;
  knownTotalFiles: number | null = null;
  private cancelFlag = false;
  private lastEmit = 0;
  private lastYield = 0;
  readonly startedAt = Date.now();
  currentPath = '';
  phase: ScanProgress['phase'] = 'enumerating';
  private hashDone = 0;
  private hashTotal = 0;

  constructor(
    readonly scanId: string,
    readonly rootLabel: string,
    readonly mode: AccessMode,
    readonly config: ScanConfig,
    private onProgress?: (p: ScanProgress) => void,
    private now: () => number = Date.now,
  ) {}

  cancel() { this.cancelFlag = true; }
  get cancelled() { return this.cancelFlag; }

  /** Should an entry with this name be included under the current configuration? */
  include(name: string): boolean {
    if (!this.config.includeDotItems && name.startsWith('.')) { this.skipped++; return false; }
    return true;
  }

  addFolder(name: string, relPath: string, parentId: number | null): number {
    const parent = parentId == null ? null : this.folders[parentId];
    const id = this.folders.length;
    this.folders.push({
      folder_id: id, parent_folder_id: parentId, folder_name: name, relative_path: relPath,
      parent_path: parent ? parent.relative_path : null, depth: parent ? parent.depth + 1 : 0,
      direct_file_count: 0, recursive_file_count: 0, direct_folder_count: 0, recursive_folder_count: 0,
      direct_size_bytes: 0, recursive_size_bytes: 0, empty_status: 'empty', scan_completeness: 'complete',
      enumerated: false, selfIncomplete: false,
    });
    if (parent) parent.direct_folder_count++;
    this.currentPath = relPath;
    this.tick();
    return id;
  }

  folderEnumerated(id: number) { this.folders[id].enumerated = true; }
  markIncomplete(id: number) { this.folders[id].selfIncomplete = true; }

  addFile(folderId: number, name: string, size: number, modified: number | null, getter?: BlobGetter, metadataError = false): number {
    const folder = this.folders[folderId];
    const id = this.files.length;
    const relPath = `${folder.relative_path}/${name}`;
    this.files.push({
      file_id: id, folder_id: folderId, file_name: name, relative_path: relPath,
      parent_path: folder.relative_path, extension: extensionOf(name), size_bytes: size,
      modified_at: modified, dot_prefixed: name.startsWith('.'),
      scan_status: metadataError ? 'metadata-error' : 'ok',
      duplicate_status: 'not-checked',
    });
    folder.direct_file_count++;
    folder.direct_size_bytes += size;
    this.bytes += size;
    if (metadataError) folder.selfIncomplete = true;
    if (getter && this.config.detectDuplicates) this.getters.set(id, getter);
    this.currentPath = relPath;
    this.tick();
    return id;
  }

  addError(relPath: string, itemType: ScanError['item_type'], category: ErrorCategory, message: string) {
    this.errors.push({ error_id: this.errors.length, relative_path: relPath, item_type: itemType, error_category: category, message, timestamp: this.now() });
    this.tick();
  }

  /** Cooperative yield so cancel messages / UI events are processed during long loops. */
  async maybeYield() {
    const t = this.now();
    if (t - this.lastYield > 40) {
      this.lastYield = t;
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  progress(): ScanProgress {
    const elapsed = this.now() - this.startedAt;
    let percent: number | null = null;
    if (this.phase === 'enumerating' && this.knownTotalFiles) percent = (this.files.length / this.knownTotalFiles) * 100;
    if (this.phase === 'hashing' && this.hashTotal > 0) percent = (this.hashDone / this.hashTotal) * 100;
    if (this.phase === 'done') percent = 100;
    let etaMs: number | null = null;
    if (percent != null && percent >= 10 && percent < 100 && elapsed > 2000) etaMs = (elapsed / percent) * (100 - percent);
    return {
      phase: this.phase, files: this.files.length, folders: this.folders.length, errors: this.errors.length,
      bytes: this.bytes, elapsedMs: elapsed, percent, etaMs, currentPath: this.currentPath,
    };
  }

  tick(force = false) {
    if (!this.onProgress) return;
    const t = this.now();
    if (force || t - this.lastEmit > 120) { this.lastEmit = t; this.onProgress(this.progress()); }
  }

  /** Optional SHA-256 duplicate detection: group by size first, then confirm by content hash. */
  async detectDuplicates(): Promise<DuplicateGroup[]> {
    this.phase = 'hashing';
    const bySize = new Map<number, FileRecord[]>();
    for (const f of this.files) {
      if (f.scan_status !== 'ok' || f.size_bytes === 0) continue; // zero-byte files are not compared
      const arr = bySize.get(f.size_bytes);
      if (arr) arr.push(f); else bySize.set(f.size_bytes, [f]);
    }
    const candidates: FileRecord[] = [];
    for (const [, arr] of bySize) {
      if (arr.length < 2) arr[0].duplicate_status = 'unique'; // a unique size cannot have a duplicate
      else candidates.push(...arr);
    }
    this.hashTotal = candidates.reduce((s, f) => s + f.size_bytes, 0);
    this.hashDone = 0;
    for (const f of candidates) {
      if (this.cancelFlag) { f.duplicate_status = 'unverified'; continue; }
      this.currentPath = f.relative_path;
      if (f.size_bytes > this.config.maxHashBytes) {
        f.duplicate_status = 'unverified';
        this.addError(f.relative_path, 'file', 'hash-skipped-too-large', `File is larger than the hashing limit (${this.config.maxHashBytes} bytes); duplicate status unverified.`);
        this.hashDone += f.size_bytes;
        continue;
      }
      const getter = this.getters.get(f.file_id);
      try {
        if (!getter) throw new Error('File contents are no longer accessible.');
        const blob = await getter();
        const buf = await readBytes(blob);
        const digest = await crypto.subtle.digest('SHA-256', buf);
        f.content_hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        f.duplicate_status = 'unverified';
        this.addError(f.relative_path, 'file', 'hash-failed', `Could not hash file: ${errMessage(e)}`);
      }
      this.hashDone += f.size_bytes;
      this.tick();
      await this.maybeYield();
    }
    const byHash = new Map<string, FileRecord[]>();
    for (const f of candidates) {
      if (!f.content_hash) continue;
      const key = `${f.size_bytes}:${f.content_hash}`;
      const arr = byHash.get(key);
      if (arr) arr.push(f); else byHash.set(key, [f]);
    }
    const groups: DuplicateGroup[] = [];
    for (const [, arr] of byHash) {
      if (arr.length < 2) { arr[0].duplicate_status = 'unique'; continue; }
      const gid = groups.length + 1;
      arr.forEach((f) => { f.duplicate_status = 'duplicate'; f.duplicate_group = gid; });
      groups.push({
        group_id: gid, content_hash: arr[0].content_hash!, size_bytes: arr[0].size_bytes, copy_count: arr.length,
        redundant_bytes: arr[0].size_bytes * (arr.length - 1), file_ids: arr.map((f) => f.file_id),
      });
    }
    groups.sort((a, b) => b.redundant_bytes - a.redundant_bytes);
    groups.forEach((g, i) => { g.group_id = i + 1; g.file_ids.forEach((id) => (this.files[id].duplicate_group = i + 1)); });
    this.getters.clear();
    return groups;
  }

  /** Compute recursive aggregates, completeness and empty classification. */
  finalize(duplicates: DuplicateGroup[] = [], failed = false): ScanResult {
    this.phase = 'finalizing';
    const order = [...this.folders].sort((a, b) => b.depth - a.depth);
    for (const f of this.folders) {
      f.recursive_file_count = f.direct_file_count;
      f.recursive_size_bytes = f.direct_size_bytes;
      f.recursive_folder_count = f.direct_folder_count;
      f.scan_completeness = f.enumerated && !f.selfIncomplete ? 'complete' : 'incomplete';
    }
    for (const f of order) {
      if (f.parent_folder_id == null) continue;
      const p = this.folders[f.parent_folder_id];
      p.recursive_file_count += f.recursive_file_count;
      p.recursive_size_bytes += f.recursive_size_bytes;
      p.recursive_folder_count += f.recursive_folder_count;
      if (f.scan_completeness === 'incomplete') p.scan_completeness = 'incomplete';
    }
    for (const f of this.folders) {
      if (f.direct_file_count > 0) f.empty_status = 'has-files';
      else if (!f.enumerated) f.empty_status = 'unknown'; // could not list it — never call it empty
      else if (f.direct_folder_count === 0) f.empty_status = 'empty';
      else if (f.recursive_file_count === 0) f.empty_status = 'no-files-only-subfolders';
      else f.empty_status = 'subfolders-only';
    }
    const folders: FolderRecord[] = this.folders.map(({ enumerated: _e, selfIncomplete: _s, ...rest }) => rest);
    let status: ScanStatus = failed ? 'failed' : this.cancelFlag ? 'cancelled' : this.errors.length ? 'completed-with-errors' : 'completed';
    if (!failed && !this.cancelFlag && folders.some((f) => f.scan_completeness === 'incomplete') && status === 'completed') status = 'completed-with-errors';
    const scan: ScanRecord = {
      scan_id: this.scanId, root_label: this.rootLabel, access_mode: this.mode, started_at: this.startedAt,
      completed_at: this.now(), status, configuration: this.config,
      files_discovered: this.files.length, folders_discovered: folders.length,
      total_accessible_size_bytes: this.bytes, error_count: this.errors.length, skipped_count: this.skipped,
      duplicate_groups: duplicates.length, redundant_bytes: duplicates.reduce((s, g) => s + g.redundant_bytes, 0),
    };
    this.phase = 'done';
    this.tick(true);
    return { scan, files: this.files, folders, errors: this.errors, duplicates };
  }
}

// ---------------------------------------------------------------------------
// Source 1: File System Access API (showDirectoryPicker) — read-only walk.
// ---------------------------------------------------------------------------

/** Minimal structural types so the walker works with real handles and test fakes. */
export interface DirHandleLike {
  kind: 'directory';
  name: string;
  entries(): AsyncIterable<[string, DirHandleLike | FileHandleLike]>;
}
export interface FileHandleLike {
  kind: 'file';
  name: string;
  getFile(): Promise<File | Blob & { lastModified?: number }>;
}

export async function walkDirectoryHandle(root: DirHandleLike, s: Scanner): Promise<void> {
  const rootId = s.addFolder(root.name, root.name, null);
  const stack: Array<{ handle: DirHandleLike; id: number }> = [{ handle: root, id: rootId }];
  while (stack.length) {
    if (s.cancelled) return; // remaining folders stay "not enumerated" -> incomplete
    const { handle, id } = stack.pop()!;
    const relPath = s.folders[id].relative_path;
    const children: Array<{ handle: DirHandleLike; id: number }> = [];
    try {
      for await (const [name, entry] of handle.entries()) {
        if (s.cancelled) break;
        if (!s.include(name)) continue;
        if (entry.kind === 'directory') {
          const cid = s.addFolder(name, `${relPath}/${name}`, id);
          children.push({ handle: entry, id: cid });
        } else {
          try {
            const file = await entry.getFile();
            const lm = (file as File).lastModified;
            s.addFile(id, name, file.size, typeof lm === 'number' ? lm : null, () => entry.getFile());
          } catch (e) {
            s.addFile(id, name, 0, null, undefined, true);
            s.addError(`${relPath}/${name}`, 'file', categorize(e), `Could not read file metadata: ${errMessage(e)}`);
          }
        }
        await s.maybeYield();
      }
      if (!s.cancelled) s.folderEnumerated(id);
    } catch (e) {
      s.markIncomplete(id);
      const cat = categorize(e);
      s.addError(relPath, 'folder', cat === 'unknown' ? 'enumeration-failed' : cat, `Could not list folder contents: ${errMessage(e)}`);
    }
    // push in reverse so traversal is in listing order
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
}

// ---------------------------------------------------------------------------
// Source 2: <input webkitdirectory> fallback — reconstruct tree from relative paths.
// Empty folders are NOT exposed by browsers in this mode.
// ---------------------------------------------------------------------------

export interface FileLike { name: string; size: number; lastModified?: number; webkitRelativePath?: string }

export async function walkFileList(list: ArrayLike<FileLike>, s: Scanner): Promise<void> {
  const files = Array.from(list);
  s.knownTotalFiles = files.length;
  const folderIds = new Map<string, number>();
  const rootName = s.rootLabel;
  const rootId = s.addFolder(rootName, rootName, null);
  folderIds.set(rootName, rootId);

  const ensureFolder = (segments: string[]): number | null => {
    // segments excludes the root; returns null if an excluded (dot) folder is on the path
    let path = rootName;
    let parent = rootId;
    for (const seg of segments) {
      const next = `${path}/${seg}`;
      let id = folderIds.get(next);
      if (id === undefined) {
        if (!s.config.includeDotItems && seg.startsWith('.')) return null;
        id = s.addFolder(seg, next, parent);
        folderIds.set(next, id);
      }
      path = next;
      parent = id;
    }
    return parent;
  };

  const skippedDirs = new Set<string>();
  for (const f of files) {
    if (s.cancelled) break;
    const rel = f.webkitRelativePath || `${rootName}/${f.name}`;
    const parts = rel.split('/').filter(Boolean);
    const dirSegs = parts.slice(1, -1);
    const name = parts[parts.length - 1] ?? f.name;
    const folderId = ensureFolder(dirSegs);
    if (folderId === null) {
      // count each excluded dot-folder once, plus every file beneath it
      const firstDot = dirSegs.findIndex((x) => x.startsWith('.'));
      const key = dirSegs.slice(0, firstDot + 1).join('/');
      if (!skippedDirs.has(key)) { skippedDirs.add(key); s.skipped++; }
      s.skipped++;
      continue;
    }
    if (!s.include(name)) continue;
    const modified = typeof f.lastModified === 'number' ? f.lastModified : null;
    s.addFile(folderId, name, f.size, modified, async () => f as unknown as Blob);
    await s.maybeYield();
  }
  // In this mode the browser hands us a complete snapshot; folders are enumerated unless cancelled.
  if (!s.cancelled) for (const id of folderIds.values()) s.folderEnumerated(id);
  else {
    // only folders whose files were all processed can be considered complete; we can't know, so mark all incomplete
  }
}

export async function runScan(
  source: { kind: 'handle'; handle: DirHandleLike } | { kind: 'files'; files: ArrayLike<FileLike>; rootLabel: string },
  scanner: Scanner,
): Promise<ScanResult> {
  try {
    if (source.kind === 'handle') await walkDirectoryHandle(source.handle, scanner);
    else await walkFileList(source.files, scanner);
    let dups: DuplicateGroup[] = [];
    if (scanner.config.detectDuplicates && !scanner.cancelled) dups = await scanner.detectDuplicates();
    if (scanner.cancelled) scanner.addError('', 'scan', 'cancelled', 'Scan was cancelled by the user. Results are partial.');
    return scanner.finalize(dups);
  } catch (e) {
    scanner.addError('', 'scan', categorize(e), `Scan failed: ${errMessage(e)}`);
    return scanner.finalize([], true);
  }
}

export function newScanId(): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(16).slice(2, 10);
  return `scan-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${r}`;
}
