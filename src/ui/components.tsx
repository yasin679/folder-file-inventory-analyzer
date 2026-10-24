import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  align?: 'right' | 'left';
  width?: string;
  title?: (row: T) => string;
  /** Let this column's cells wrap instead of truncating. */
  wrap?: boolean;
}

/** Sortable, paginated table. Pagination keeps the DOM small for large inventories. */
export function DataTable<T>({ rows, columns, pageSize = 50, initialSort, empty = 'No rows match.', rowKey }: {
  rows: T[]; columns: Column<T>[]; pageSize?: number; initialSort?: { key: string; dir: 'asc' | 'desc' }; empty?: ReactNode; rowKey: (r: T) => string | number;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    const m = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * m;
    });
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const p = Math.min(page, pages - 1);
  const view = sorted.slice(p * size, p * size + size);

  return (
    <div className="table-wrap">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width, textAlign: c.align ?? 'left' }}
                  className={c.sort ? 'sortable' : ''}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  onClick={() => c.sort && setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.align === 'right' ? 'desc' : 'asc' }))}>
                  {c.header}{sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.length === 0 ? (
              <tr><td colSpan={columns.length} className="empty-cell">{empty}</td></tr>
            ) : view.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => <td key={c.key} className={c.wrap ? 'wrap' : undefined} style={{ textAlign: c.align ?? 'left' }} title={c.title?.(r)}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>{sorted.length.toLocaleString()} row{sorted.length === 1 ? '' : 's'}</span>
        <span className="spacer" />
        <label>Rows <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
          {[25, 50, 100, 250].map((n) => <option key={n}>{n}</option>)}
        </select></label>
        <button className="btn ghost sm" disabled={p === 0} onClick={() => setPage(0)} aria-label="First page">«</button>
        <button className="btn ghost sm" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Previous page">‹</button>
        <span>Page {p + 1} / {pages}</span>
        <button className="btn ghost sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Next page">›</button>
        <button className="btn ghost sm" disabled={p >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Last page">»</button>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'bad' | 'good' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Panel({ title, actions, children, note }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="panel">
      {(title || actions) && <header className="panel-head"><h3>{title}</h3><div className="panel-actions">{actions}</div></header>}
      {note && <p className="panel-note">{note}</p>}
      {children}
    </section>
  );
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'good'; children: ReactNode }) {
  return <div className={`callout ${tone}`}>{children}</div>;
}

export const Path = ({ p }: { p: string }) => <span className="path" title={p}>{p}</span>;

/**
 * Numeric input that lets the user clear and retype freely. Valid values are committed as you
 * type (clamped to range); an empty or invalid draft is not committed and is restored on blur.
 */
export function NumberField({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step, integer, className, ariaLabel, id }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number | 'any'; integer?: boolean; className?: string; ariaLabel?: string; id?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  return (
    <input type="number" id={id} aria-label={ariaLabel} className={className} min={min} max={max} step={step ?? (integer ? 1 : 'any')} value={draft}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setDraft(String(value)); }}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        if (v.trim() === '') return;
        let n = Number(v);
        if (!Number.isFinite(n)) return;
        if (integer) n = Math.round(n);
        onChange(Math.min(max, Math.max(min, n)));
      }} />
  );
}
