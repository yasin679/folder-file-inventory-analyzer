// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/worker/scan.worker?worker&inline', () => ({ default: class {} }));
import { saved } from './setup';
import { nav, renderApp, scanWithPicker, screen, user, within } from './harness';

const bytes = (b: Blob) => new Promise<Uint8Array>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.onerror = rej; r.readAsArrayBuffer(b);
});

const GUIDES = [
  ['User Guide', 'IA-UG-01', '1 About this guide'],
  ['Installation and Administration Guide', 'IA-IG-02', '3 Installation'],
  ['Quick Start', 'IA-QS-03', '1.2 The five steps'],
  ['FAQ and Troubleshooting', 'IA-FAQ-04', '1 Frequently asked questions'],
  ['Technical Design', 'IA-TD-05', '3 Data model'],
  ['UAT Test Cases', 'IA-UAT-06', '16 Sign-off'],
  ['Release Notes v1.2', 'IA-RN-07', '2 New in v1.2'],
] as const;

describe('S44 Help & Documents inside the app', () => {
  it('is available before any scan and shows the User Guide first, with its screenshots', async () => {
    renderApp();
    const u = user();
    expect(nav('Help & Documents')).toHaveProperty('disabled', false);
    await u.click(nav('Help & Documents'));
    expect(screen.getByRole('heading', { name: 'Help & Documents', level: 1 })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'User Guide' }).getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('IA-UG-01')).toBeTruthy();
    expect(within(panel).getByRole('heading', { name: '1 About this guide' })).toBeTruthy();
    // tables in the guides render as real tables
    expect(within(panel).getAllByRole('table').length).toBeGreaterThan(10);
    // screenshots are bundled into the app, not fetched
    const fig = within(panel).getByRole('img', { name: 'Figure 2: New Scan' }) as HTMLImageElement;
    expect(fig.getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/);
    expect(within(panel).getAllByRole('img').length).toBeGreaterThanOrEqual(20);
  });

  it('carries all seven numbered guides and switches between them', async () => {
    renderApp();
    const u = user();
    await u.click(nav('Help & Documents'));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(GUIDES.map((g) => g[0]));
    for (const [title, id, heading] of GUIDES) {
      await u.click(screen.getByRole('tab', { name: title }));
      const panel = screen.getByRole('tabpanel');
      expect(within(panel).getByRole('heading', { name: title, level: 2 })).toBeTruthy();
      expect(panel.querySelector('.doc-id')?.textContent).toBe(id);
      expect(within(panel).getByRole('heading', { name: heading })).toBeTruthy();
    }
    expect(screen.queryByRole('heading', { name: '1 About this guide' })).toBeNull();
  });

  it('each guide downloads as its numbered PDF', async () => {
    renderApp();
    const u = user();
    await u.click(nav('Help & Documents'));
    await u.click(screen.getByRole('button', { name: 'Download User Guide as PDF' }));
    await screen.findByText(/User Guide \(PDF\) saved/);
    expect(saved[0].filename).toBe('IA-UG-01_User_Guide.pdf');
    expect(new TextDecoder().decode((await bytes(saved[0].data)).slice(0, 5))).toBe('%PDF-');
    await u.click(screen.getByRole('tab', { name: 'UAT Test Cases' }));
    await u.click(screen.getByRole('button', { name: 'Download UAT Test Cases as PDF' }));
    await screen.findByText(/UAT Test Cases \(PDF\) saved/);
    expect(saved[1].filename).toBe('IA-UAT-06_UAT_Test_Cases.pdf');
    expect(screen.queryByRole('button', { name: /as Word$/ })).toBeNull();
  });

  it('New Scan points first-time users to the guide', async () => {
    renderApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: /Read the User Guide/ }));
    expect(screen.getByRole('heading', { name: 'Help & Documents', level: 1 })).toBeTruthy();
    expect(within(screen.getByRole('tabpanel')).getByRole('heading', { name: '3 New Scan' })).toBeTruthy();
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
