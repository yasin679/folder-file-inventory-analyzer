// Data model — mirrors PRD §10 (ScanRecord, FileRecord, FolderRecord, ScanError).

export type AccessMode = 'file-system-access' | 'directory-input';
export type ScanStatus = 'running' | 'completed' | 'completed-with-errors' | 'cancelled' | 'failed';
export type EmptyStatus = 'empty' | 'no-files-only-subfolders' | 'subfolders-only' | 'has-files' | 'unknown';
export type Completeness = 'complete' | 'incomplete';
export type FileScanStatus = 'ok' | 'metadata-error';
export type DuplicateStatus = 'not-checked' | 'unique' | 'duplicate' | 'unverified';

export type ErrorCategory =
  | 'permission-denied'
  | 'not-found'
  | 'not-readable'
  | 'enumeration-failed'
  | 'metadata-unavailable'
  | 'hash-failed'
  | 'hash-skipped-too-large'
  | 'cancelled'
  | 'unknown';

export interface ScanConfig {
  includeDotItems: boolean;      // dot-prefixed names (".git", ".env"); OS "hidden" attribute is not exposed by browsers
  detectDuplicates: boolean;     // disabled by default (FR-08)
  largeFileThresholdBytes: number;
  topN: number;
  maxHashBytes: number;          // files larger than this are not hashed -> "unverified"
  keepResults: boolean;          // keep full results in local history so the scan can be reopened
}

export const DEFAULT_CONFIG: ScanConfig = {
  includeDotItems: true,
  detectDuplicates: false,
  largeFileThresholdBytes: 100 * 1024 * 1024,
  topN: 25,
  maxHashBytes: 1024 * 1024 * 1024,
  keepResults: true,
};

export interface FileRecord {
  file_id: number;
  folder_id: number;
  file_name: string;
  relative_path: string;
  parent_path: string;
  extension: string;           // lower-case, without dot; "" when none
  size_bytes: number;
  modified_at: number | null;  // ms epoch, only when the browser exposes it
  dot_prefixed: boolean;
  scan_status: FileScanStatus;
  content_hash?: string;
  duplicate_status: DuplicateStatus;
  duplicate_group?: number;
}

export interface FolderRecord {
  folder_id: number;
  parent_folder_id: number | null;
  folder_name: string;
  relative_path: string;
  parent_path: string | null;
  depth: number;
  direct_file_count: number;
  recursive_file_count: number;
  direct_folder_count: number;
  recursive_folder_count: number;
  direct_size_bytes: number;
  recursive_size_bytes: number;
  empty_status: EmptyStatus;
  scan_completeness: Completeness;
}

export interface ScanError {
  error_id: number;
  relative_path: string;
  item_type: 'file' | 'folder' | 'scan';
  error_category: ErrorCategory;
  message: string;
  timestamp: number;
}

export interface DuplicateGroup {
  group_id: number;
  content_hash: string;
  size_bytes: number;
  copy_count: number;
  redundant_bytes: number;     // size * (copies - 1)
  file_ids: number[];
}

export interface ScanRecord {
  scan_id: string;
  root_label: string;
  access_mode: AccessMode;
  started_at: number;
  completed_at: number | null;
  status: ScanStatus;
  configuration: ScanConfig;
  files_discovered: number;
  folders_discovered: number;
  total_accessible_size_bytes: number;
  error_count: number;
  skipped_count: number;
  duplicate_groups: number;
  redundant_bytes: number;
}

export interface ScanResult {
  scan: ScanRecord;
  files: FileRecord[];
  folders: FolderRecord[];
  errors: ScanError[];
  duplicates: DuplicateGroup[];
}

export interface ScanProgress {
  phase: 'enumerating' | 'hashing' | 'finalizing' | 'done';
  files: number;
  folders: number;
  errors: number;
  bytes: number;
  elapsedMs: number;
  /** Only set when a meaningful denominator exists. */
  percent: number | null;
  /** Only set when an estimate is reliable (stable rate, >10% done). */
  etaMs: number | null;
  currentPath: string;
}
