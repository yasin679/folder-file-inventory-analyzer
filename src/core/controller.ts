import { newScanId, runScan, Scanner, type DirHandleLike, type FileLike } from './scanner';
import type { AccessMode, ScanConfig, ScanProgress, ScanResult } from './types';
import ScanWorker from '../worker/scan.worker?worker&inline';

export interface ScanSource { mode: AccessMode; rootLabel: string; handle?: DirHandleLike; files?: FileLike[]; forceMainThread?: boolean }
export interface RunningScan { id: string; promise: Promise<{ result: ScanResult; engine: 'web-worker' | 'main-thread'; workerNote?: string }>; cancel: () => void }

/**
 * Runs a scan in a Web Worker when possible. If the worker cannot be created or fails
 * before starting (e.g. CSP-restricted embeds, or handles that can't be transferred),
 * the same engine runs on the main thread with cooperative yielding.
 */
export function startScan(src: ScanSource, config: ScanConfig, onProgress: (id: string, p: ScanProgress) => void): RunningScan {
  const id = newScanId();
  let cancelMain: (() => void) | null = null;
  let worker: Worker | null = null;
  let cancelled = false;

  const runMain = async (note?: string) => {
    const s = new Scanner(id, src.rootLabel, src.mode, config, (p) => onProgress(id, p));
    cancelMain = () => s.cancel();
    if (cancelled) s.cancel();
    const result = await runScan(src.handle ? { kind: 'handle', handle: src.handle } : { kind: 'files', files: src.files ?? [], rootLabel: src.rootLabel }, s);
    return { result, engine: 'main-thread' as const, workerNote: note };
  };

  const promise = new Promise<{ result: ScanResult; engine: 'web-worker' | 'main-thread'; workerNote?: string }>((resolve, reject) => {
    if (src.forceMainThread || typeof Worker === 'undefined') { runMain(typeof Worker === 'undefined' ? 'Web Workers unavailable' : undefined).then(resolve, reject); return; }
    let started = false;
    const fallback = (why: string) => { worker?.terminate(); worker = null; runMain(why).then(resolve, reject); };
    try { worker = new ScanWorker(); } catch (e) { fallback(`Worker could not start: ${(e as Error).message}`); return; }
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.id !== id) return; // stale message guard
      if (m.type === 'started') started = true;
      else if (m.type === 'progress') onProgress(id, m.progress);
      else if (m.type === 'done') { worker?.terminate(); worker = null; resolve({ result: m.result, engine: 'web-worker' }); }
    };
    worker.onerror = (ev) => {
      ev.preventDefault?.();
      if (!started) fallback(`Worker failed: ${ev.message || 'unknown error'}`);
      else { worker?.terminate(); reject(new Error(`Background scan worker crashed: ${ev.message || 'unknown error'}. Please retry.`)); }
    };
    try {
      worker.postMessage({ cmd: 'start', id, rootLabel: src.rootLabel, mode: src.mode, config, handle: src.handle, files: src.files });
    } catch (e) {
      // e.g. DataCloneError for objects that can't be sent to a worker
      fallback(`Could not hand folder to worker: ${(e as Error).message}`);
    }
  });

  return {
    id, promise,
    cancel: () => { cancelled = true; worker?.postMessage({ cmd: 'cancel', id }); cancelMain?.(); },
  };
}
