import { marked } from 'marked';
import { useMemo, useState } from 'react';
import { DOCS } from '../generated/docs';

export type DocKind = 'pdf' | 'docx';

// Headings inside a guide start one level below the page title (h1 = "Help & Documents").
const renderer = new marked.Renderer();
renderer.heading = (text, level) => `<h${Math.min(6, level + 1)}>${text}</h${Math.min(6, level + 1)}>`;
renderer.link = (href, title, text) => `<a href="${href}"${title ? ` title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text}</a>`;

export function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Help & Documents: the User Guide, Setup & Administration Guide and Release Notes,
 * bundled into the app (no network) and downloadable as PDF or Word.
 */
export function HelpDocs({ initial = 'user', onDownload }: { initial?: string; onDownload: (title: string, kind: DocKind, filename: string, bytes: Uint8Array) => void }) {
  const [active, setActive] = useState(initial);
  const doc = DOCS.find((d) => d.id === active) ?? DOCS[0];
  // Content is our own bundled Markdown, not user input.
  const html = useMemo(() => marked.parse(doc.markdown, { renderer, gfm: true, async: false }) as string, [doc]);
  return (
    <section className="panel help">
      <div className="help-bar">
        <div role="tablist" aria-label="Documents" className="help-tabs">
          {DOCS.map((d) => (
            <button key={d.id} role="tab" id={`tab-${d.id}`} aria-selected={d.id === doc.id} aria-controls="doc-panel"
              className={`help-tab${d.id === doc.id ? ' on' : ''}`} onClick={() => setActive(d.id)}>{d.title}</button>
          ))}
        </div>
        <div className="help-dl">
          <button className="btn sm" aria-label={`Download ${doc.title} as PDF`} onClick={() => onDownload(doc.title, 'pdf', `${doc.fileBase}.pdf`, decodeBase64(doc.pdf))}>⬇ PDF</button>
          <button className="btn sm" aria-label={`Download ${doc.title} as Word`} onClick={() => onDownload(doc.title, 'docx', `${doc.fileBase}.docx`, decodeBase64(doc.docx))}>⬇ Word</button>
        </div>
      </div>
      <article id="doc-panel" role="tabpanel" aria-labelledby={`tab-${doc.id}`} className="doc" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
