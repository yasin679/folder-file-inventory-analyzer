import ExcelJS from 'exceljs';
import type { ScanResult } from '../core/types';
import { buildTables, keyFindings, summaryRows, type ReportTable } from './tables';

export const EXCEL_MAX_ROWS = 1_048_576;
export const MAX_DATA_ROWS = EXCEL_MAX_ROWS - 1; // minus header row

export interface SheetPlan { table: string; sheet: string; from: number; to: number }

/** Split a table into as many worksheets as needed so no records are silently dropped. */
export function planSheets(t: ReportTable, maxRows = MAX_DATA_ROWS): SheetPlan[] {
  if (t.rows.length <= maxRows) return [{ table: t.name, sheet: t.name, from: 0, to: t.rows.length }];
  const parts: SheetPlan[] = [];
  for (let i = 0, n = 1; i < t.rows.length; i += maxRows, n++) parts.push({ table: t.name, sheet: `${t.name} (${n})`.slice(0, 31), from: i, to: Math.min(i + maxRows, t.rows.length) });
  return parts;
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };

export async function buildWorkbook(r: ScanResult, maxRows = MAX_DATA_ROWS): Promise<{ buffer: ArrayBuffer; reconciliation: Array<{ table: string; records: number; written: number; sheets: string }> }> {
  const tables = buildTables(r);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Folder & File Inventory Analyzer';
  wb.created = new Date(r.scan.completed_at ?? Date.now());

  const plans = tables.map((t) => ({ t, parts: planSheets(t, maxRows) }));
  const reconciliation = plans.map(({ t, parts }) => ({ table: t.name, records: t.expectedRows, written: 0, sheets: parts.map((p) => p.sheet).join(', ') }));

  // Executive Summary first.
  const ws0 = wb.addWorksheet('Executive Summary', { views: [{ showGridLines: false }] });
  ws0.columns = [{ width: 40 }, { width: 90 }];
  const title = ws0.addRow(['Folder & File Inventory Report']);
  title.font = { bold: true, size: 16, color: { argb: 'FF1F3A5F' } };
  ws0.addRow([]);
  for (const [k, v] of summaryRows(r)) {
    const row = ws0.addRow([k, v]);
    row.getCell(1).font = { bold: true };
    if (typeof v === 'number') row.getCell(2).numFmt = '#,##0';
    row.getCell(2).alignment = { horizontal: 'left', wrapText: true };
  }
  ws0.addRow([]);
  ws0.addRow(['Key findings']).font = { bold: true, size: 13 };
  for (const f of keyFindings(r)) ws0.addRow(['', f]).getCell(2).alignment = { wrapText: true };
  ws0.addRow([]);
  ws0.addRow(['Export reconciliation']).font = { bold: true, size: 13 };
  const recStart = ws0.rowCount + 1;
  const hdr = ws0.addRow(['Report table', 'Records in scan → worksheet(s)']);
  hdr.font = { bold: true };

  for (const { t, parts } of plans) {
    for (const p of parts) {
      const ws = wb.addWorksheet(p.sheet, { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = t.columns.map((c) => ({ header: c.header, width: c.width ?? 14 }));
      const h = ws.getRow(1);
      h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      h.fill = HEADER_FILL;
      h.alignment = { vertical: 'middle', wrapText: true };
      h.height = 30;
      for (let i = p.from; i < p.to; i++) {
        const row = ws.addRow(t.rows[i]); // strings are written as string cells — never evaluated as formulas
        if (t.indent?.[i]) row.getCell(1).alignment = { indent: Math.min(15, t.indent[i]) };
        if (t.bold?.[i]) row.font = { bold: true };
      }
      t.columns.forEach((c, ci) => {
        const col = ws.getColumn(ci + 1);
        if (c.kind === 'int') col.numFmt = '#,##0';
        if (c.kind === 'pct') col.numFmt = '0.00"%"';
      });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ws.rowCount), column: t.columns.length } };
      const written = ws.rowCount - 1;
      reconciliation.find((x) => x.table === t.name)!.written += Math.max(0, written);
    }
    // Totals row on summary tables where it is meaningful.
  }

  for (const rec of reconciliation) {
    if (rec.written !== rec.records) throw new Error(`Export validation failed for "${rec.table}": ${rec.records} records but ${rec.written} rows written.`);
    ws0.addRow([rec.table, `${rec.records.toLocaleString('en-US')} records → ${rec.sheets}`]);
  }
  void recStart;

  // Extension Summary totals row
  const ext = wb.getWorksheet('Extension Summary');
  if (ext && ext.rowCount > 1) {
    const last = ext.rowCount;
    const tr = ext.addRow(['TOTAL', { formula: `SUM(B2:B${last})` }, { formula: `SUM(C2:C${last})` }, '', { formula: `SUM(E2:E${last})` }, '', '']);
    tr.font = { bold: true };
  }

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return { buffer, reconciliation };
}

