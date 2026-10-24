// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/worker/scan.worker?worker&inline', () => ({ default: class {} }));
import './setup';
import { dir, installPicker, nav, renderApp, scanWithPicker, screen, within } from './harness';

const items = () => screen.queryAllByRole('treeitem');
const item = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} —`) });
const names = () => items().map((i) => i.getAttribute('aria-label')!.split(' —')[0]);

describe('S35 folder explorer', () => {
  it('shows each folder with its file counts and the files inside it', async () => {
    installPicker(dir('Root', {}));
    renderApp();
    expect(nav('Folder Explorer')).toHaveProperty('disabled', true);
    screen.getByRole('heading', { name: 'New Scan' });
  });

  it('opens with the root expanded: folders first, then files, each with counts', async () => {
    const u = await scanWithPicker();
    await u.click(nav('Folder Explorer'));
    expect(screen.getByRole('heading', { name: 'Folder Explorer' })).toBeTruthy();
    const root = item('Root');
    expect(root.getAttribute('aria-expanded')).toBe('true');
    expect(within(root).getByText('4 files here')).toBeTruthy();
    expect(within(root).getByText('11 in total')).toBeTruthy();
    expect(names()).toEqual(['Root', 'docs', 'docs-archive', 'empty', 'locked', 'media', 'shell', '.env', 'a.txt', 'bad.dat', 'notes.md']);
    expect(item('docs').getAttribute('aria-level')).toBe('2');
    expect(item('a.txt').getAttribute('aria-level')).toBe('2');
    expect(within(item('locked')).getByText(/couldn't be opened/)).toBeTruthy();
    expect(within(item('empty')).getByText('empty', { selector: '.badge' })).toBeTruthy();
  });

  it('expanding a folder lists exactly its files; expand/collapse all work', async () => {
    const u = await scanWithPicker();
    await u.click(nav('Folder Explorer'));
    expect(screen.queryByText('copy-of-a.txt')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Expand docs' }));
    const docsKids = items().filter((i) => i.getAttribute('aria-level') === '3').map((i) => i.getAttribute('aria-label')!.split(' —')[0]);
    expect(docsKids).toEqual(['=SUM(1).csv', 'a.txt', 'copy-of-a.txt', 'résumé 文件.pdf', 'same-size.txt']);
    expect(within(item('docs')).getByText('5 files here')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Collapse docs' }));
    expect(screen.queryByText('copy-of-a.txt')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(item('inner')).toBeTruthy();
    expect(item('video.mp4')).toBeTruthy();
    expect(items()).toHaveLength(19); // 8 folders + 11 files
    await u.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(names()).toEqual(['Root']);
  });
});

describe('S36 find where a file is', () => {
  it('search shows only matches with their folders opened, and counts them', async () => {
    const u = await scanWithPicker();
    await u.click(nav('Folder Explorer'));
    await u.type(screen.getByPlaceholderText(/Find a file or folder/), 'video');
    expect(names()).toEqual(['Root', 'media', 'video.mp4']);
    expect(item('video.mp4').getAttribute('data-match')).toBe('true');
    expect(screen.getByText('1 match')).toBeTruthy();
    await u.clear(screen.getByPlaceholderText(/Find a file or folder/));
    await u.type(screen.getByPlaceholderText(/Find a file or folder/), 'a.txt');
    expect(screen.getByText('3 matches')).toBeTruthy();
    expect(names()).toEqual(['Root', 'docs', 'a.txt', 'copy-of-a.txt', 'a.txt']);
  });
});

describe('S37 dashboard: where your files are', () => {
  it('lists top-level folders by file count and opens one in the explorer', async () => {
    const u = await scanWithPicker();
    const panel = screen.getByRole('heading', { name: 'Where your files are' }).closest('.panel') as HTMLElement;
    const rows = within(panel).getAllByRole('row').slice(1).map((r) => [...r.querySelectorAll('td')].slice(0, 2).map((c) => c.textContent));
    expect(rows).toEqual([
      ['docs', '5'], ['Files directly in Root', '4'], ['docs-archive', '1'], ['media', '1'], ['empty', '0'], ['shell', '0'], ['locked', 'unknown'],
    ]);
    await u.click(within(panel).getByRole('button', { name: 'docs' }));
    expect(screen.getByRole('heading', { name: 'Folder Explorer' })).toBeTruthy();
    expect(item('docs').getAttribute('aria-expanded')).toBe('true');
    expect(item('copy-of-a.txt')).toBeTruthy();
  });
});

describe('S38 show a file in the folder tree', () => {
  it('jumps from the inventory to the file, opened and selected in its folder', async () => {
    const u = await scanWithPicker();
    await u.click(nav('File Inventory'));
    await u.click(screen.getByRole('button', { name: 'Show copy-of-a.txt in folder tree' }));
    expect(screen.getByRole('heading', { name: 'Folder Explorer' })).toBeTruthy();
    const f = item('copy-of-a.txt');
    expect(f.getAttribute('aria-selected')).toBe('true');
    expect(f.getAttribute('aria-level')).toBe('3');
    expect(item('docs').getAttribute('aria-expanded')).toBe('true');
  });
});
