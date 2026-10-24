import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { unzipSync, strFromU8 } from 'fflate';
import { runScan, Scanner } from '../src/core/scanner';
import { DEFAULT_CONFIG } from '../src/core/types';
import { buildTables } from '../src/export/tables';
import { csvBundle, csvField, tableToCsv } from '../src/export/csv';
import { buildWorkbook, planSheets } from '../src/export/xlsx';
import { neutralize } from '../src/export/sanitize';
import { fakeDir, MAIN_TREE } from './fixtures';

async function scan(dups = true) {
  const s = new Scanner('scan-test', 'Root', 'file-system-access', { ...DEFAULT_CONFIG, detectDuplicates: dups });
  return runScan({ kind: 'handle', handle: fakeDir('Root', MAIN_TREE) }, s);
}

/** Minimal RFC-4180 parser for verifying our own output. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  return rows;
}

describe('formula-injection protection', () => {
  it('prefixes dangerous leading characters', () => {
    for (const v of ['=SUM(A1)', '+1', '-1', '@cmd', '\tx', '\rx']) expect(neutralize(v)).toBe(`'${v}`);
    expect(neutralize('normal.txt')).toBe('normal.txt');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField(42)).toBe('42');
    expect(csvField(null)).toBe('');
  });
});

describe('CSV export', () => {
  it('is UTF-8 with BOM, escapes quotes/commas, preserves unicode and full paths, and row counts match', async () => {
    const r = await scan();
    const tables = buildTables(r);
    const inv = tables.find((t) => t.name === 'File Inventory')!;
    const csv = tableToCsv(inv);
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = parseCsv(csv.slice(1));
    expect(rows).toHaveLength(r.files.length + 1);
    const paths = rows.slice(1).map((x) => x[2]);
    expect(paths).toContain('Root/docs/ünïcødé 文件.md');
    expect(paths).toContain('Root/docs/=evil,"name".csv'); // path doesn't start with '=', kept verbatim
    const names = rows.slice(1).map((x) => x[1]);
    expect(names).toContain(`'=evil,"name".csv`); // file name starts with '=', neutralized
    // UTF-8 bytes round-trip
    const bytes = new TextEncoder().encode(csv);
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(csv);
  });

  it('includes every expected table and a ZIP bundle with all CSVs', async () => {
    const r = await scan();
    const tables = buildTables(r);
    expect(tables.map((t) => t.name)).toEqual(['Folder Tree', 'File Inventory', 'Folder Summary', 'Extension Summary', 'Largest Files', 'Largest Folders', 'Duplicate Files', 'Empty Folders', 'Scan Errors']);
    const zip = unzipSync(csvBundle(tables, 'Root'));
    expect(Object.keys(zip).sort()).toEqual(tables.map((t) => `Root_${t.file}`).sort());
    for (const t of tables) expect(parseCsv(strFromU8(zip[`Root_${t.file}`]).slice(1))).toHaveLength(t.expectedRows + 1);
  });

  it('omits the duplicates table when detection is disabled', async () => {
    const r = await scan(false);
    expect(buildTables(r).some((t) => t.name === 'Duplicate Files')).toBe(false);
  });
});

describe('XLSX export', () => {
  it('contains the expected worksheets and row counts reconcile with the scan', async () => {
    const r = await scan();
    const { buffer, reconciliation } = await buildWorkbook(r);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Executive Summary', 'Folder Tree', 'File Inventory', 'Folder Summary', 'Extension Summary', 'Largest Files', 'Largest Folders', 'Duplicate Files', 'Empty Folders', 'Scan Errors']);
    expect(wb.getWorksheet('File Inventory')!.rowCount - 1).toBe(r.files.length);
    expect(wb.getWorksheet('Folder Summary')!.rowCount - 1).toBe(r.folders.length);
    expect(wb.getWorksheet('Scan Errors')!.rowCount - 1).toBe(r.errors.length);
    expect(wb.getWorksheet('Duplicate Files')!.rowCount - 1).toBe(2);
    expect(wb.getWorksheet('Extension Summary')!.rowCount - 2).toBe(new Set(r.files.map((f) => f.extension || '(none)')).size); // + totals row
    for (const rec of reconciliation) expect(rec.written).toBe(rec.records);
    const inv = wb.getWorksheet('File Inventory')!;
    expect(inv.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(inv.autoFilter).toBeTruthy();
    // strings that look like formulas are stored as plain strings, never formulas
    const evil = inv.getColumn(2).values.find((v) => typeof v === 'string' && v.includes('evil'));
    expect(evil).toBe('=evil,"name".csv');
    // full relative path preserved
    expect(inv.getColumn(3).values).toContain('Root/deep/l1/l2/big.bin');
    // executive summary carries root label and status
    const sum = wb.getWorksheet('Executive Summary')!;
    const vals = sum.getColumn(2).values.map(String);
    expect(vals).toContain('Root');
    expect(vals).toContain('completed-with-errors');
  });

  it('splits oversized tables across sheets instead of dropping records', async () => {
    const r = await scan();
    const inv = buildTables(r).find((t) => t.name === 'File Inventory')!;
    const plan = planSheets(inv, 4);
    expect(plan.map((p) => p.sheet)).toEqual(['File Inventory (1)', 'File Inventory (2)', 'File Inventory (3)']);
    expect(plan.reduce((s, p) => s + (p.to - p.from), 0)).toBe(r.files.length);
    const { buffer } = await buildWorkbook(r, 4);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const total = wb.worksheets.filter((w) => w.name.startsWith('File Inventory')).reduce((s, w) => s + w.rowCount - 1, 0);
    expect(total).toBe(r.files.length);
  });

  it('Excel and CSV agree on the same underlying data', async () => {
    const r = await scan();
    const { buffer } = await buildWorkbook(r);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const t = buildTables(r).find((x) => x.name === 'Folder Summary')!;
    const csvRows = parseCsv(tableToCsv(t).slice(1)).slice(1);
    const ws = wb.getWorksheet('Folder Summary')!;
    csvRows.forEach((row, i) => {
      const x = ws.getRow(i + 2);
      expect(String(x.getCell(3).value)).toBe(row[2]);
      expect(String(x.getCell(11).value)).toBe(row[10]);
    });
  });
});
