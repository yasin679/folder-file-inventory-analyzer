/// <reference lib="webworker" />
import { runScan, Scanner, type DirHandleLike, type FileLike } from '../core/scanner';
import type { AccessMode, ScanConfig } from '../core/types';

export type WorkerIn =
  | { cmd: 'start'; id: string; rootLabel: string; mode: AccessMode; config: ScanConfig; handle?: DirHandleLike; files?: FileLike[] }
  | { cmd: 'cancel'; id: string };

let current: Scanner | null = null;

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.cmd === 'cancel') { if (current?.scanId === m.id) current.cancel(); return; }
  const s = new Scanner(m.id, m.rootLabel, m.mode, m.config, (p) => self.postMessage({ type: 'progress', id: m.id, progress: p }));
  current = s;
  self.postMessage({ type: 'started', id: m.id });
  const source = m.handle ? { kind: 'handle' as const, handle: m.handle } : { kind: 'files' as const, files: m.files ?? [], rootLabel: m.rootLabel };
  const result = await runScan(source, s);
  current = null;
  self.postMessage({ type: 'done', id: m.id, result });
};
