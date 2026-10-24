// Test environment for UI scenario tests (jsdom).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';


// jsdom does not implement the directory-upload attribute that real browsers expose.
if (!('webkitdirectory' in HTMLInputElement.prototype)) {
  Object.defineProperty(HTMLInputElement.prototype, 'webkitdirectory', {
    get() { return this.hasAttribute('webkitdirectory'); },
    set(v: boolean) { if (v) this.setAttribute('webkitdirectory', ''); else this.removeAttribute('webkitdirectory'); },
  });
}

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

/** Every file the app tries to save is captured here (via the host "downloads" channel). */
export const saved: Array<{ filename: string; data: Blob }> = [];
export const downloadControl = { fail: null as null | { code: string; message: string } };
(window as unknown as { claude: unknown }).claude = {
  use: async (name: string) => name === 'downloads' ? {
    save: async (r: { filename: string; data: Blob }) => {
      if (downloadControl.fail) throw downloadControl.fail;
      saved.push(r); return { status: 'saved' };
    },
  } : null,
};

/** Network spy: privacy scenarios assert these are never called. */
export const network = { fetch: vi.fn(), beacon: vi.fn(), xhr: vi.fn() };
beforeEach(() => {
  saved.length = 0;
  downloadControl.fail = null;
  globalThis.fetch = network.fetch as unknown as typeof fetch;
  (navigator as unknown as { sendBeacon: unknown }).sendBeacon = network.beacon;
  (XMLHttpRequest.prototype as unknown as { open: unknown }).open = network.xhr;
  Object.values(network).forEach((m) => m.mockClear());
  localStorage.clear();
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
});
afterEach(async () => {
  cleanup();
  // fresh IndexedDB per test
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});
