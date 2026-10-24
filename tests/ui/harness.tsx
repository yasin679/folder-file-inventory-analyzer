import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/ui/App';
import type { DirHandleLike } from '../../src/core/scanner';

export const user = () => userEvent.setup();

/** Records any attempt to use a write/move/delete API on a handle (S25). */
export const writeAttempts: string[] = [];

/** Fake FSA handles built from a tree spec. Values: string = file content, {dir}, {deny}, {unreadable}, {gate}. */
export type Spec = string | { dir: Record<string, Spec> } | { deny: true } | { unreadable: true } | { gate: Promise<void>; content: string };

const MOD = Date.UTC(2026, 0, 15, 10, 30);
function domErr(name: string) { const e = new Error(`${name} (simulated)`); e.name = name; return e; }
const trap = (what: string) => async () => { writeAttempts.push(what); throw domErr('NotAllowedError'); };

export function dir(name: string, tree: Record<string, Spec>): DirHandleLike {
  return Object.assign({
    kind: 'directory' as const, name,
    async *entries(): AsyncGenerator<[string, never]> {
      for (const [k, v] of Object.entries(tree)) {
        if (typeof v === 'object' && 'dir' in v) yield [k, dir(k, v.dir) as never];
        else if (typeof v === 'object' && 'deny' in v) yield [k, { kind: 'directory', name: k, entries: () => ({ [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(domErr('NotAllowedError')) }) }) } as never];
        else yield [k, file(k, v) as never];
      }
    },
    removeEntry: trap('removeEntry'), getFileHandle: trap('getFileHandle'), getDirectoryHandle: trap('getDirectoryHandle'),
    move: trap('move'), requestPermission: trap('requestPermission'),
  });
}
function file(name: string, v: Spec) {
  return {
    kind: 'file' as const, name,
    async getFile() {
      if (typeof v === 'object' && 'unreadable' in v) throw domErr('NotReadableError');
      if (typeof v === 'object' && 'gate' in v) { await v.gate; return new File([v.content], name, { lastModified: MOD }); }
      return new File([v as string], name, { lastModified: MOD });
    },
    createWritable: trap('createWritable'), move: trap('move'), remove: trap('remove'), createSyncAccessHandle: trap('createSyncAccessHandle'),
  };
}

/** The standard UI fixture. Sizes are chosen so totals are easy to verify by hand. */
export const TREE: Record<string, Spec> = {
  'a.txt': '0123456789',                          // 10
  'notes.md': 'x'.repeat(2048),                   // 2048
  '.env': 'SECRET=1',                             // 8 (dot-prefixed)
  docs: { dir: {
    'copy-of-a.txt': '0123456789',                // 10 (duplicate of a.txt)
    'same-size.txt': 'abcdefghij',                // 10 (same size, different content)
    'a.txt': 'different!!',                       // 11 (same NAME as root a.txt, different content)
    '=SUM(1).csv': 'q',                           // 1 (formula-looking name)
    'résumé 文件.pdf': 'y'.repeat(500),             // 500 (unicode)
  } },
  'docs-archive': { dir: { 'old.txt': 'old' } },   // 3 — same-prefix sibling of docs
  media: { dir: { 'video.mp4': 'v'.repeat(5000) } }, // 5000 — largest file
  empty: { dir: {} },
  shell: { dir: { inner: { dir: {} } } },
  locked: { deny: true },
  'bad.dat': { unreadable: true },
};
// files (dot items included): a, notes, .env, copy, same, docs/a, =SUM, résumé, old, video, bad = 11
// bytes: 10+2048+8+10+10+11+1+500+3+5000+0 = 7601
export const TREE_FILES = 11;
export const TREE_BYTES = 7601;
export const TREE_FOLDERS = 8; // Root, docs, docs-archive, media, empty, shell, inner, locked

export function installPicker(handle: DirHandleLike | (() => Promise<DirHandleLike>)) {
  const calls: unknown[] = [];
  (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = async (opts: unknown) => {
    calls.push(opts);
    return typeof handle === 'function' ? handle() : handle;
  };
  return calls;
}

export function renderApp() { return render(<App />); }

export const nav = (label: string) => within(document.querySelector('nav') as HTMLElement).getByRole('button', { name: new RegExp(`^\\S*\\s*${label}`) });

export async function scanWithPicker(tree = TREE, opts: { dup?: boolean; dots?: boolean } = {}) {
  const u = user();
  installPicker(dir('Root', tree));
  renderApp();
  if (opts.dup) await u.click(screen.getByLabelText(/Detect duplicate files/));
  if (opts.dots === false) await u.click(screen.getByLabelText(/Include dot-prefixed items/));
  await u.click(screen.getByRole('button', { name: /Choose folder/ }));
  await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 5000 });
  return u;
}

export function stat(label: string) {
  const el = screen.getAllByText(label, { selector: '.stat-label' })[0].closest('.stat') as HTMLElement;
  return within(el);
}

export function uploadFiles(input: HTMLInputElement, files: Array<[string, string]>) {
  const list = files.map(([path, content]) => {
    const f = new File([content], path.split('/').pop()!, { lastModified: MOD });
    Object.defineProperty(f, 'webkitRelativePath', { value: path });
    return f;
  });
  return list;
}

export { screen, waitFor, within };
