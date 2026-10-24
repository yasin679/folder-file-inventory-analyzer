import { describe, expect, it } from 'vitest';
import { runScan, Scanner } from '../src/core/scanner';
import { DEFAULT_CONFIG, type ScanConfig } from '../src/core/types';
import { emptyFolders, extensionSummary, largestFiles, subfolderOnlyFolders, depthDistribution } from '../src/core/analysis';
import { fakeDir, fileListFrom, MAIN_TREE } from './fixtures';

const cfg = (o: Partial<ScanConfig> = {}): ScanConfig => ({ ...DEFAULT_CONFIG, ...o });
const scanHandle = (tree = MAIN_TREE, o: Partial<ScanConfig> = {}) => {
  const s = new Scanner('t', 'Root', 'file-system-access', cfg(o));
  return runScan({ kind: 'handle', handle: fakeDir('Root', tree) }, s);
};
const folder = (r: Awaited<ReturnType<typeof scanHandle>>, p: string) => r.folders.find((f) => f.relative_path === p)!;

describe('recursive traversal (File System Access mode)', () => {
  it('inventories nested files and folders with correct totals', async () => {
    const r = await scanHandle();
    expect(r.files).toHaveLength(10);
    expect(r.folders).toHaveLength(10);
    expect(r.scan.total_accessible_size_bytes).toBe(1145);
    expect(r.files.map((f) => f.relative_path)).toContain('Root/deep/l1/l2/big.bin');
    expect(r.files.map((f) => f.relative_path)).toContain('Root/docs/ünïcødé 文件.md');
    expect(r.files.map((f) => f.relative_path)).toContain('Root/docs/=evil,"name".csv');
  });

  it('computes direct and recursive counts and sizes', async () => {
    const r = await scanHandle();
    const root = folder(r, 'Root');
    expect(root).toMatchObject({ depth: 0, direct_file_count: 3, recursive_file_count: 10, direct_folder_count: 6, recursive_folder_count: 9, direct_size_bytes: 10, recursive_size_bytes: 1145 });
    expect(folder(r, 'Root/docs')).toMatchObject({ direct_file_count: 5, recursive_file_count: 5, direct_size_bytes: 132, recursive_size_bytes: 132, depth: 1 });
    expect(folder(r, 'Root/deep')).toMatchObject({ direct_file_count: 0, recursive_file_count: 1, direct_folder_count: 1, recursive_folder_count: 2, direct_size_bytes: 0, recursive_size_bytes: 1000 });
    expect(folder(r, 'Root/deep/l1/l2')).toMatchObject({ depth: 3, direct_size_bytes: 1000 });
    // every file is counted exactly once
    expect(r.folders.reduce((s, f) => s + f.direct_file_count, 0)).toBe(r.files.length);
    expect(r.folders.reduce((s, f) => s + f.direct_size_bytes, 0)).toBe(root.recursive_size_bytes);
  });

  it('classifies empty folders and subfolder-only folders', async () => {
    const r = await scanHandle();
    expect(folder(r, 'Root/empty').empty_status).toBe('empty');
    expect(folder(r, 'Root/shell').empty_status).toBe('no-files-only-subfolders');
    expect(folder(r, 'Root/shell/inner').empty_status).toBe('empty');
    expect(folder(r, 'Root/deep').empty_status).toBe('subfolders-only');
    expect(folder(r, 'Root/deep/l1/l2').empty_status).toBe('has-files');
    expect(emptyFolders(r.folders).map((f) => f.relative_path).sort()).toEqual(['Root/empty', 'Root/shell', 'Root/shell/inner'])
    expect(folder(r, 'Root/locked').empty_status).toBe('unknown');;
    expect(subfolderOnlyFolders(r.folders).map((f) => f.relative_path).sort()).toEqual(['Root/deep', 'Root/deep/l1']);
  });

  it('handles zero-byte files', async () => {
    const r = await scanHandle();
    const b = r.files.find((f) => f.file_name === 'b.log')!;
    expect(b.size_bytes).toBe(0);
    expect(b.scan_status).toBe('ok');
  });

  it('records permission and read errors, marks subtrees incomplete, and never claims completion', async () => {
    const r = await scanHandle();
    expect(r.errors.map((e) => [e.relative_path, e.error_category]).sort()).toEqual([
      ['Root/bad.dat', 'not-readable'], ['Root/locked', 'permission-denied'],
    ]);
    expect(folder(r, 'Root/locked').scan_completeness).toBe('incomplete');
    expect(folder(r, 'Root').scan_completeness).toBe('incomplete');
    expect(folder(r, 'Root/docs').scan_completeness).toBe('complete');
    expect(r.files.find((f) => f.file_name === 'bad.dat')!.scan_status).toBe('metadata-error');
    expect(r.scan.status).toBe('completed-with-errors');
  });

  it('can exclude dot-prefixed items and counts them as skipped', async () => {
    const r = await scanHandle(MAIN_TREE, { includeDotItems: false });
    expect(r.files).toHaveLength(9);
    expect(r.folders.find((f) => f.folder_name === '.hidden')).toBeUndefined();
    expect(r.scan.skipped_count).toBe(1);
    expect(r.scan.total_accessible_size_bytes).toBe(1142);
  });

  it('a clean tree reports status "completed"', async () => {
    const r = await scanHandle({ 'x.txt': 'x', sub: { dir: { 'y.txt': 'yy' } } });
    expect(r.scan.status).toBe('completed');
    expect(r.folders.every((f) => f.scan_completeness === 'complete')).toBe(true);
  });
});

describe('duplicate detection (optional)', () => {
  it('is disabled by default and leaves files not-checked', async () => {
    const r = await scanHandle();
    expect(DEFAULT_CONFIG.detectDuplicates).toBe(false);
    expect(r.duplicates).toHaveLength(0);
    expect(r.files.every((f) => f.duplicate_status === 'not-checked' && !f.content_hash)).toBe(true);
  });

  it('finds same-content files with different names; same size different content is not a duplicate', async () => {
    const r = await scanHandle(MAIN_TREE, { detectDuplicates: true });
    expect(r.duplicates).toHaveLength(1);
    const g = r.duplicates[0];
    expect(g.copy_count).toBe(2);
    expect(g.redundant_bytes).toBe(10);
    expect(g.content_hash).toBe('84d89877f0d4041efb6bf91a16f0248f2fd573e6af05c19f96bedb9f882f7882'); // sha256("0123456789")
    expect(g.file_ids.map((id) => r.files[id].file_name).sort()).toEqual(['a.txt', 'copy-of-a.txt']);
    expect(r.files.find((f) => f.file_name === 'same-size.txt')!.duplicate_status).toBe('unique');
    expect(r.files.find((f) => f.file_name === 'report.pdf')!.duplicate_status).toBe('unique');
    expect(r.scan.redundant_bytes).toBe(10);
  });

  it('marks files unverified when hashing fails (file disappeared)', async () => {
    const s = new Scanner('t', 'R', 'file-system-access', cfg({ detectDuplicates: true }));
    const r = await runScan({ kind: 'handle', handle: fakeDir('R', { 'a.txt': 'same', 'b.txt': { readOnce: 'same' } }) }, s);
    expect(r.files.find((f) => f.file_name === 'b.txt')!.duplicate_status).toBe('unverified');
    expect(r.duplicates).toHaveLength(0);
    expect(r.errors.some((e) => e.error_category === 'hash-failed' && e.relative_path === 'R/b.txt')).toBe(true);
  });

  it('marks files above the hashing limit unverified', async () => {
    const r = await scanHandle({ 'a.bin': 'x'.repeat(50), 'b.bin': 'x'.repeat(50) }, { detectDuplicates: true, maxHashBytes: 10 });
    expect(r.files.every((f) => f.duplicate_status === 'unverified')).toBe(true);
    expect(r.errors.filter((e) => e.error_category === 'hash-skipped-too-large')).toHaveLength(2);
  });
});

describe('cancellation', () => {
  it('stops early, keeps partial results, and labels the scan cancelled', async () => {
    let s!: Scanner;
    let n = 0;
    const handle = fakeDir('Root', MAIN_TREE, { onFile: () => { if (++n === 3) s.cancel(); } });
    s = new Scanner('t', 'Root', 'file-system-access', cfg());
    const r = await runScan({ kind: 'handle', handle }, s);
    expect(r.scan.status).toBe('cancelled');
    expect(r.files.length).toBeGreaterThan(0);
    expect(r.files.length).toBeLessThan(10);
    expect(folder(r, 'Root').scan_completeness).toBe('incomplete');
    expect(r.errors.some((e) => e.error_category === 'cancelled')).toBe(true);
    // partial results remain internally consistent
    expect(folder(r, 'Root').recursive_file_count).toBe(r.files.length);
  });
});

describe('directory-input fallback mode', () => {
  it('reconstructs the tree from relative paths and matches FSA totals (minus invisible empty folders)', async () => {
    const files = fileListFrom('Root', MAIN_TREE);
    const s = new Scanner('t', 'Root', 'directory-input', cfg({ detectDuplicates: true }));
    const r = await runScan({ kind: 'files', files, rootLabel: 'Root' }, s);
    expect(r.files).toHaveLength(9); // bad.dat is a FSA-only fixture
    expect(r.scan.total_accessible_size_bytes).toBe(1145);
    expect(r.folders.map((f) => f.relative_path).sort()).toEqual(['Root', 'Root/.hidden', 'Root/deep', 'Root/deep/l1', 'Root/deep/l1/l2', 'Root/docs']);
    expect(folder(r, 'Root')).toMatchObject({ direct_file_count: 2, recursive_file_count: 9, recursive_folder_count: 5 });
    expect(r.duplicates).toHaveLength(1);
    expect(r.scan.status).toBe('completed');
    expect(r.files[0].modified_at).toBe(Date.UTC(2026, 0, 15, 10, 30));
  });

  it('excludes dot-folders and their files in fallback mode', async () => {
    const files = fileListFrom('Root', MAIN_TREE);
    const s = new Scanner('t', 'Root', 'directory-input', cfg({ includeDotItems: false }));
    const r = await runScan({ kind: 'files', files, rootLabel: 'Root' }, s);
    expect(r.files).toHaveLength(8);
    expect(r.scan.skipped_count).toBe(2); // the folder + its one file
  });

  it('reports a meaningful percentage because the total is known up-front', async () => {
    const files = fileListFrom('Root', MAIN_TREE);
    const seen: Array<number | null> = [];
    const s = new Scanner('t', 'Root', 'directory-input', cfg(), (p) => seen.push(p.percent));
    await runScan({ kind: 'files', files, rootLabel: 'Root' }, s);
    expect(seen.at(-1)).toBe(100);
  });
});

describe('analysis', () => {
  it('extension summary percentages add to 100 and agree with totals', async () => {
    const r = await scanHandle();
    const ext = extensionSummary(r.files);
    expect(ext.reduce((s, e) => s + e.file_count, 0)).toBe(r.files.length);
    expect(ext.reduce((s, e) => s + e.total_size_bytes, 0)).toBe(1145);
    expect(ext.reduce((s, e) => s + e.pct_of_total, 0)).toBeCloseTo(100, 6);
    expect(ext[0]).toMatchObject({ extension: 'bin', file_count: 1, total_size_bytes: 1000 });
    expect(largestFiles(r.files, 2).map((f) => f.file_name)).toEqual(['big.bin', 'report.pdf']);
  });
  it('depth distribution accounts for every file', async () => {
    const r = await scanHandle();
    const d = depthDistribution(r);
    expect(d.reduce((s, x) => s + x.files, 0)).toBe(10);
    expect(d.find((x) => x.depth === 4)!.size_bytes).toBe(1000);
  });
});
