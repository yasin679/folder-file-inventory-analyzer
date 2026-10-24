import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { unzipSync } from 'fflate';
import { folderTree } from '../src/core/analysis';
import { runScan, Scanner } from '../src/core/scanner';
import { DEFAULT_CONFIG } from '../src/core/types';
import { buildTables } from '../src/export/tables';
import { csvBundle } from '../src/export/csv';
import { buildWorkbook } from '../src/export/xlsx';
import { fakeDir, MAIN_TREE } from './fixtures';

const scan = () => runScan({ kind: 'handle', handle: fakeDir('Root', MAIN_TREE) }, new Scanner('t', 'Root', 'file-system-access', DEFAULT_CONFIG));

describe('S35 folder tree model', () => {
  it('lists every folder and file exactly once, each file under its own folder', async () => {
    const r = await scan();
    const rows = folderTree(r);
    expect(rows).toHaveLength(r.files.length + r.folders.length);
    expect(rows[0]).toMatchObject({ kind: 'folder', level: 0, name: 'Root', path: 'Root' });
    expect(new Set(rows.filter((x) => x.kind === 'file').map((x) => x.path)).size).toBe(r.files.length);
    rows.forEach((row, i) => {
      if (i === 0) return;
      const parentPath = row.path.slice(0, row.path.lastIndexOf('/'));
      const parentIdx = rows.findIndex((x) => x.kind === 'folder' && x.path === parentPath);
      expect(parentIdx, row.path).toBeGreaterThanOrEqual(0);
      expect(parentIdx).toBeLessThan(i);
      expect(row.level).toBe(rows[parentIdx].level + 1);
    });
  });
  it('shows subfolders before files, each sorted by name, with folder counts', async () => {
    const r = await scan();
    const rows = folderTree(r);
    const rootKids = rows.filter((x) => x.level === 1);
    const firstFile = rootKids.findIndex((x) => x.kind === 'file');
    expect(rootKids.slice(0, firstFile).every((x) => x.kind === 'folder')).toBe(true);
    expect(rootKids.slice(firstFile).every((x) => x.kind === 'file')).toBe(true);
    expect(rootKids.filter((x) => x.kind === 'folder').map((x) => x.name)).toEqual(['.hidden', 'deep', 'docs', 'empty', 'locked', 'shell']);
    expect(rootKids.filter((x) => x.kind === 'file').map((x) => x.name)).toEqual(['a.txt', 'b.log', 'bad.dat']);
    const docs = rows.find((x) => x.path === 'Root/docs')!;
    expect(docs).toMatchObject({ filesHere: 5, filesTotal: 5, sizeBytes: 132 });
    expect(rows[0]).toMatchObject({ filesHere: 3, filesTotal: 10, sizeBytes: 1145 });
  });
});

describe('S35 folder tree export', () => {
  it('Excel has an indented Folder Tree sheet right after the summary', async () => {
    const r = await scan();
    const { buffer } = await buildWorkbook(r);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets[1].name).toBe('Folder Tree');
    const ws = wb.getWorksheet('Folder Tree')!;
    expect(ws.rowCount - 1).toBe(r.files.length + r.folders.length);
    expect(ws.getRow(1).values).toEqual([undefined, 'Item', 'Type', 'Files here', 'Files in total (incl. subfolders)', 'Size (bytes)', 'Size', 'Relative path']);
    const big = ws.getColumn(7).values.findIndex((v) => v === 'Root/deep/l1/l2/big.bin');
    expect(ws.getRow(big).getCell(1).value).toBe('big.bin');
    expect(ws.getRow(big).getCell(1).alignment?.indent).toBe(4);
    expect(ws.getRow(2).getCell(1).value).toBe('Root');
    expect(ws.getRow(2).font?.bold).toBe(true);
  });
  it('CSV bundle includes folder_tree.csv', async () => {
    const r = await scan();
    const zip = unzipSync(csvBundle(buildTables(r), 'Root'));
    expect(Object.keys(zip)).toContain('Root_folder_tree.csv');
  });
});
