import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type ScanProgress } from '../src/core/types';
import { fakeDir } from './fixtures';

// Each test installs its own Worker double through this hook.
const hook: { impl: () => unknown } = { impl: () => { throw new Error('no worker'); } };
vi.mock('../src/worker/scan.worker?worker&inline', () => ({ default: function W() { return hook.impl(); } }));
const { startScan } = await import('../src/core/controller');
const tree = { 'a.txt': 'aaaa', sub: { dir: { 'b.txt': 'bb' } } };
const g = globalThis as unknown as { Worker?: unknown };
afterEach(() => { delete g.Worker; });

describe('S30 worker fallback', () => {
  it('runs on the main thread when the worker cannot start, and says so', async () => {
    g.Worker = function () {};
    hook.impl = () => { throw new Error('CSP blocked blob: worker'); };
    const run = startScan({ mode: 'file-system-access', rootLabel: 'R', handle: fakeDir('R', tree) }, DEFAULT_CONFIG, () => {});
    const { result, engine, workerNote } = await run.promise;
    expect(engine).toBe('main-thread');
    expect(workerNote).toMatch(/CSP blocked/);
    expect(result.scan.files_discovered).toBe(2);
    expect(result.scan.total_accessible_size_bytes).toBe(6);
  });
  it('falls back when the folder cannot be handed to the worker (DataCloneError)', async () => {
    g.Worker = function () {};
    hook.impl = () => ({ postMessage() { const e = new Error('could not be cloned'); e.name = 'DataCloneError'; throw e; }, terminate() {} });
    const { engine, result } = await startScan({ mode: 'file-system-access', rootLabel: 'R', handle: fakeDir('R', tree) }, DEFAULT_CONFIG, () => {}).promise;
    expect(engine).toBe('main-thread');
    expect(result.scan.status).toBe('completed');
  });
  it('falls back when the worker errors before starting', async () => {
    g.Worker = function () {};
    hook.impl = () => {
      const w: { onerror?: (e: unknown) => void; postMessage: () => void; terminate: () => void } = {
        postMessage() { setTimeout(() => w.onerror?.({ message: 'boom', preventDefault() {} })); }, terminate() {},
      };
      return w;
    };
    const { engine } = await startScan({ mode: 'file-system-access', rootLabel: 'R', handle: fakeDir('R', tree) }, DEFAULT_CONFIG, () => {}).promise;
    expect(engine).toBe('main-thread');
  });
  it('reports a crash after the worker started as an error instead of hanging', async () => {
    g.Worker = function () {};
    hook.impl = () => {
      const w: { onmessage?: (e: unknown) => void; onerror?: (e: unknown) => void; postMessage: (m: { id: string }) => void; terminate: () => void } = {
        postMessage(m) { setTimeout(() => { w.onmessage?.({ data: { type: 'started', id: m.id } }); w.onerror?.({ message: 'out of memory', preventDefault() {} }); }); }, terminate() {},
      };
      return w;
    };
    await expect(startScan({ mode: 'file-system-access', rootLabel: 'R', handle: fakeDir('R', tree) }, DEFAULT_CONFIG, () => {}).promise).rejects.toThrow(/out of memory/);
  });
});

describe('S31 stale progress guard', () => {
  it('ignores messages that belong to a different scan id', async () => {
    g.Worker = function () {};
    const seen: ScanProgress[] = [];
    hook.impl = () => {
      const w: { onmessage?: (e: unknown) => void; postMessage: (m: { cmd: string; id: string }) => void; terminate: () => void } = {
        postMessage(m) {
          if (m.cmd !== 'start') return;
          setTimeout(() => {
            const p = (files: number) => ({ phase: 'enumerating', files, folders: 1, errors: 0, bytes: 0, elapsedMs: 1, percent: null, etaMs: null, currentPath: '' });
            w.onmessage?.({ data: { type: 'progress', id: 'scan-OLD', progress: p(999) } });
            w.onmessage?.({ data: { type: 'started', id: m.id } });
            w.onmessage?.({ data: { type: 'progress', id: m.id, progress: p(1) } });
            w.onmessage?.({ data: { type: 'done', id: 'scan-OLD', result: { stale: true } } });
            w.onmessage?.({ data: { type: 'done', id: m.id, result: { scan: { files_discovered: 1 } } } });
          });
        }, terminate() {},
      };
      return w;
    };
    const run = startScan({ mode: 'file-system-access', rootLabel: 'R', handle: fakeDir('R', tree) }, DEFAULT_CONFIG, (_id, p) => seen.push(p));
    const { result, engine } = await run.promise;
    expect(engine).toBe('web-worker');
    expect(seen.map((p) => p.files)).toEqual([1]);
    expect((result as unknown as { stale?: boolean }).stale).toBeUndefined();
  });
  it('cancel is forwarded to the worker with the scan id', async () => {
    g.Worker = function () {};
    const sent: Array<{ cmd: string; id: string }> = [];
    hook.impl = () => ({ postMessage(m: { cmd: string; id: string }) { sent.push(m); }, terminate() {} });
    const run = startScan({ mode: 'file-system-access', rootLabel: 'R', handle: fakeDir('R', tree) }, DEFAULT_CONFIG, () => {});
    run.cancel();
    expect(sent.map((m) => m.cmd)).toEqual(['start', 'cancel']);
    expect(sent[1].id).toBe(run.id);
  });
});
