import type { DirHandleLike, FileHandleLike } from '../src/core/scanner';

// Deterministic in-memory fakes of File System Access API handles.
type Node = string | Uint8Array | { dir: Record<string, Node> } | { throwOnList: string } | { throwOnRead: string } | { readOnce: string };

export const enc = (s: string) => new TextEncoder().encode(s);
const MOD = Date.UTC(2026, 0, 15, 10, 30);

function err(name: string) { const e = new Error(`${name} (simulated)`); e.name = name; return e; }

export function fakeDir(name: string, tree: Record<string, Node>, hooks?: { onFile?: (n: string) => void }): DirHandleLike {
  return {
    kind: 'directory', name,
    async *entries() {
      for (const [k, v] of Object.entries(tree)) {
        if (typeof v === 'object' && 'dir' in v) yield [k, fakeDir(k, v.dir, hooks)];
        else if (typeof v === 'object' && 'throwOnList' in v) yield [k, { kind: 'directory', name: k, entries: () => ({ [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(err(v.throwOnList)) }) }) } as DirHandleLike];
        else yield [k, fakeFile(k, v, hooks)];
      }
    },
  };
}

function fakeFile(name: string, v: Node, hooks?: { onFile?: (n: string) => void }): FileHandleLike {
  let reads = 0;
  return {
    kind: 'file', name,
    async getFile() {
      hooks?.onFile?.(name);
      reads++;
      if (typeof v === 'object' && 'throwOnRead' in v) throw err(v.throwOnRead);
      if (typeof v === 'object' && 'readOnce' in v) {
        if (reads > 1) throw err('NotFoundError');
        return new File([enc(v.readOnce)], name, { lastModified: MOD });
      }
      const data = typeof v === 'string' ? enc(v) : (v as Uint8Array);
      return new File([data], name, { lastModified: MOD });
    },
  };
}

/** The main fixture. Expected values are hard-coded in scanner.test.ts. */
export const MAIN_TREE: Record<string, Node> = {
  'a.txt': '0123456789',                       // 10 B
  'b.log': '',                                 // 0 B
  docs: { dir: {
    'report.pdf': 'x'.repeat(100),             // 100 B
    'copy-of-a.txt': '0123456789',             // 10 B, same content as a.txt -> duplicate
    'same-size.txt': 'abcdefghij',             // 10 B, different content -> not duplicate
    '=evil,"name".csv': 'hello',               // 5 B, formula injection + quotes + comma
    'ünïcødé 文件.md': 'unicode',               // 7 B
  } },
  empty: { dir: {} },
  shell: { dir: { inner: { dir: {} } } },
  deep: { dir: { l1: { dir: { l2: { dir: { 'big.bin': new Uint8Array(1000) } } } } } },
  '.hidden': { dir: { 'secret.txt': 'abc' } }, // 3 B
  locked: { throwOnList: 'NotAllowedError' },
  'bad.dat': { throwOnRead: 'NotReadableError' },
};

export function fileListFrom(root: string, tree: Record<string, Node>, prefix = root): File[] {
  const out: File[] = [];
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'object' && 'dir' in v) out.push(...fileListFrom(root, v.dir, `${prefix}/${k}`));
    else if (typeof v === 'string' || v instanceof Uint8Array) {
      const f = new File([typeof v === 'string' ? enc(v) : v], k, { lastModified: MOD });
      Object.defineProperty(f, 'webkitRelativePath', { value: `${prefix}/${k}` });
      out.push(f);
    }
  }
  return out;
}
