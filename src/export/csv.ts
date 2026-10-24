import { zipSync, strToU8 } from 'fflate';
import { neutralize } from './sanitize';
import type { Cell, ReportTable } from './tables';

const BOM = '﻿';

export function csvField(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const s = neutralize(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV, UTF-8 with BOM (so Excel detects UTF-8), CRLF line endings. */
export function tableToCsv(t: ReportTable): string {
  if (t.rows.length !== t.expectedRows) throw new Error(`${t.name}: row count mismatch (${t.rows.length} vs ${t.expectedRows}).`);
  const lines = [t.columns.map((c) => csvField(c.header)).join(',')];
  t.rows.forEach((row, i) => {
    const lvl = t.indent?.[i] ?? 0;
    lines.push(row.map((c, ci) => (ci === 0 && lvl > 0 && typeof c === 'string' ? csvField('  '.repeat(lvl) + c) : csvField(c))).join(','));
  });
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvBundle(tables: ReportTable[], prefix: string): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const t of tables) files[`${prefix}_${t.file}`] = new Uint8Array(strToU8(tableToCsv(t))); // normalise realm so fflate sees a file, not a folder
  return zipSync(files, { level: 6 });
}
