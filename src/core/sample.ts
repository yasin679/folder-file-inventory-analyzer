import type { DirHandleLike, FileHandleLike } from './scanner';

// Deterministic synthetic folder used for the "Try with sample data" demo.
// Nothing here touches the real filesystem.

function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

type Spec = { size: number; seed: number; mod: number } | { dir: Record<string, Spec> } | { denied: true };

function fileHandle(name: string, spec: { size: number; seed: number; mod: number }): FileHandleLike {
  const blobLike = {
    size: spec.size, lastModified: spec.mod, name,
    async arrayBuffer() {
      const b = new Uint8Array(spec.size); let x = spec.seed || 1;
      for (let i = 0; i < b.length; i++) { x = (x * 1103515245 + 12345) >>> 0; b[i] = x >>> 24; }
      return b.buffer;
    },
  };
  return { kind: 'file', name, getFile: async () => blobLike as unknown as File };
}

function dirHandle(name: string, tree: Record<string, Spec>): DirHandleLike {
  return {
    kind: 'directory', name,
    async *entries() {
      for (const [k, v] of Object.entries(tree)) {
        if ('dir' in v) yield [k, dirHandle(k, v.dir)];
        else if ('denied' in v) {
          yield [k, { kind: 'directory', name: k, entries: () => ({ [Symbol.asyncIterator]: () => ({ next: () => { const e = new Error('The request is not allowed by the user agent or the platform in the current context.'); e.name = 'NotAllowedError'; return Promise.reject(e); } }) }) } as DirHandleLike];
        } else yield [k, fileHandle(k, v)];
      }
    },
  };
}

export function sampleFolder(): DirHandleLike {
  const r = rng(42);
  const base = Date.UTC(2025, 0, 1);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const f = (min: number, max: number) => ({ size: Math.floor(min + r() * (max - min)), seed: Math.floor(r() * 1e9), mod: base + Math.floor(r() * 600) * 86400000 });
  const many = (n: number, exts: string[], prefix: string, min: number, max: number) => {
    const o: Record<string, Spec> = {};
    for (let i = 1; i <= n; i++) o[`${prefix}_${String(i).padStart(3, '0')}.${pick(exts)}`] = f(min, max);
    return o;
  };
  const logo = f(40_000, 90_000);
  const contract = f(300_000, 900_000);
  const tree: Record<string, Spec> = {
    'README.md': f(2_000, 6_000),
    '.gitignore': f(100, 400),
    Finance: { dir: {
      '2024': { dir: { ...many(24, ['xlsx', 'pdf'], 'invoice', 30_000, 400_000), 'Vendor Contract.pdf': contract } },
      '2025': { dir: { ...many(30, ['xlsx', 'pdf', 'csv'], 'invoice', 30_000, 500_000), Q4: { dir: {} } } },
      'Audit (restricted)': { denied: true },
    } },
    Marketing: { dir: {
      Brand: { dir: { 'logo.png': logo, 'logo-final.png': { ...logo }, 'logo-final-v2.svg': f(5_000, 20_000), Fonts: { dir: many(6, ['otf', 'ttf'], 'font', 60_000, 250_000) } } },
      Campaigns: { dir: {
        'Launch 2025': { dir: { ...many(18, ['jpg', 'png'], 'asset', 400_000, 6_000_000), 'teaser.mp4': f(80_000_000, 140_000_000), 'teaser-copy.mp4': f(80_000_000, 140_000_000) } },
        'Old campaigns': { dir: { Archive: { dir: { '2019': { dir: {} }, '2020': { dir: {} } } } } },
      } },
      'Vendor Contract (copy).pdf': { ...contract },
    } },
    Engineering: { dir: {
      src: { dir: { ...many(60, ['ts', 'tsx', 'json', 'css'], 'module', 800, 40_000), components: { dir: many(40, ['tsx', 'css'], 'component', 600, 20_000) } } },
      builds: { dir: { 'app-1.2.0.zip': f(150_000_000, 220_000_000), 'app-1.3.0.zip': f(150_000_000, 230_000_000) } },
      logs: { dir: many(25, ['log'], 'server', 200_000, 9_000_000) },
      '.cache': { dir: many(12, ['bin'], 'cache', 100_000, 2_000_000) },
    } },
    HR: { dir: { Policies: { dir: many(14, ['docx', 'pdf'], 'policy', 40_000, 600_000) }, Onboarding: { dir: { Templates: { dir: {} }, ...many(8, ['docx', 'pptx'], 'deck', 200_000, 5_000_000) } } } },
    Photos: { dir: many(70, ['jpg', 'heic', 'png'], 'IMG', 1_500_000, 7_000_000) },
    'Empty project': { dir: {} },
  };
  return dirHandle('Shared Drive', tree);
}
