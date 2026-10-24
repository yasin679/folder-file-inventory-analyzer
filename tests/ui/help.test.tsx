// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/worker/scan.worker?worker&inline', () => ({ default: class {} }));
import { saved } from './setup';
import { nav, renderApp, scanWithPicker, screen, user, within } from './harness';

const bytes = (b: Blob) => new Promise<Uint8Array>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.onerror = rej; r.readAsArrayBuffer(b);
});

describe('S44 Help & Documents inside the app', () => {
  it('is available before any scan and shows the User Guide first', async () => {
    renderApp();
    const u = user();
    expect(nav('Help & Documents')).toHaveProperty('disabled', false);
    await u.click(nav('Help & Documents'));
    expect(screen.getByRole('heading', { name: 'Help & Documents', level: 1 })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'User Guide' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Quick start' })).toBeTruthy();
    // tables in the guides render as real tables
    expect(screen.getAllByRole('table').length).toBeGreaterThan(3);
  });

  it('switches between the three documents', async () => {
    renderApp();
    const u = user();
    await u.click(nav('Help & Documents'));
    await u.click(screen.getByRole('tab', { name: 'Setup & Administration Guide' }));
    expect(screen.getByRole('heading', { name: 'Ways to run it' })).toBeTruthy();
    await u.click(screen.getByRole('tab', { name: 'Release Notes' }));
    expect(screen.getByRole('heading', { name: /What's new in v1\.2/ })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Quick start' })).toBeNull();
  });

  it('each document downloads as a real PDF and Word file', async () => {
    renderApp();
    const u = user();
    await u.click(nav('Help & Documents'));
    await u.click(screen.getByRole('button', { name: 'Download User Guide as PDF' }));
    await screen.findByText(/User Guide \(PDF\) saved/);
    expect(saved[0].filename).toBe('Inventory Analyzer - User Guide.pdf');
    expect(new TextDecoder().decode((await bytes(saved[0].data)).slice(0, 5))).toBe('%PDF-');
    await u.click(screen.getByRole('tab', { name: 'Release Notes' }));
    await u.click(screen.getByRole('button', { name: 'Download Release Notes as Word' }));
    await screen.findByText(/Release Notes \(Word\) saved/);
    expect(saved[1].filename).toBe('Inventory Analyzer - Release Notes.docx');
    expect(Array.from((await bytes(saved[1].data)).slice(0, 2))).toEqual([0x50, 0x4b]); // ZIP container = .docx
  });

  it('New Scan points first-time users to the guide', async () => {
    renderApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: /Read the User Guide/ }));
    expect(screen.getByRole('heading', { name: 'Help & Documents', level: 1 })).toBeTruthy();
    expect(within(screen.getByRole('tabpanel')).getByRole('heading', { name: 'Quick start' })).toBeTruthy();
  });
});

describe('S44b Help shows no scan toolbar', () => {
  it('the scan name and report buttons are hidden on the Help screen', async () => {
    const u = await scanWithPicker();
    expect(screen.getByRole('button', { name: /Excel \(\.xlsx\)/ })).toBeTruthy();
    await u.click(nav('Help & Documents'));
    expect(screen.queryByRole('button', { name: /Excel \(\.xlsx\)/ })).toBeNull();
    expect(screen.queryByText(/📁 Root/)).toBeNull();
  });
});
