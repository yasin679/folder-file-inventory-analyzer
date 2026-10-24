import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runScan, Scanner } from '../src/core/scanner';
import { DEFAULT_CONFIG } from '../src/core/types';
import { buildTables } from '../src/export/tables';
import { csvBundle, tableToCsv } from '../src/export/csv';
import { buildWorkbook } from '../src/export/xlsx';
import { fakeDir, MAIN_TREE } from './fixtures';

// Generates the sample exports shipped in /sample-exports from the deterministic fixture.
describe('sample exports', () => {
  it('writes sample XLSX and CSV files from the test fixture', async () => {
    const s = new Scanner('scan-sample-fixture', 'Root', 'file-system-access', { ...DEFAULT_CONFIG, detectDuplicates: true });
    const r = await runScan({ kind: 'handle', handle: fakeDir('Root', MAIN_TREE) }, s);
    mkdirSync('sample-exports/csv', { recursive: true });
    const { buffer, reconciliation } = await buildWorkbook(r);
    writeFileSync('sample-exports/Root_inventory_fixture.xlsx', Buffer.from(buffer));
    const tables = buildTables(r);
    for (const t of tables) writeFileSync(`sample-exports/csv/Root_${t.file}`, tableToCsv(t), 'utf8');
    writeFileSync('sample-exports/Root_inventory_fixture_csv.zip', csvBundle(tables, 'Root'));
    expect(reconciliation.every((x) => x.written === x.records)).toBe(true);
  });
});
