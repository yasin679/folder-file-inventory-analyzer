import { marked } from 'marked';
import { useMemo, useState } from 'react';
import { DOC_IMAGES, DOCS } from '../generated/docs';

export type DocKind = 'pdf';

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Guide headings start one level below the guide's own title (h2), which sits below the page title (h1).
const renderer = new marked.Renderer();
renderer.heading = (text, level) => `<h${Math.min(6, level + 1)}>${text}</h${Math.min(6, level + 1)}>`;
renderer.link = (href, title, text) => `<a href="${href}"${title ? ` title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text}</a>`;
// Screenshots are bundled into the app (DOC_IMAGES), so the guides work offline and from one file.
renderer.image = (href, _title, text) => {
  const src = DOC_IMAGES[href.replace(/^images\//, '')] ?? href;
  return `<img src="${src}" alt="${escapeAttr(text)}" loading="lazy">`;
};
// A paragraph holding only a screenshot becomes a figure with its caption, as in the PDFs.
renderer.paragraph = (text) => {
  const m = /^<img [^>]*alt="([^"]*)"[^>]*>$/.exec(text.trim());
  return m ? `<figure>${text}<figcaption>${m[1]}</figcaption></figure>` : `<p>${text}</p>\n`;
};
// GitHub alert blocks (> [!NOTE] …) become coloured callouts.
renderer.blockquote = (quote) => {
  const m = /^\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/.exec(quote);
  return m ? `<div class="doc-callout ${m[1].toLowerCase()}"><p>${quote.slice(m[0].length)}</div>` : `<blockquote>${quote}</blockquote>`;
};

export function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Help & Documents: the seven numbered guides (IA-UG-01 … IA-RN-07) bundled into the app
 * with their screenshots (no network), each downloadable as its formatted PDF.
 */
export function HelpDocs({ initial = 'user-guide', onDownload }: { initial?: string; onDownload: (title: string, kind: DocKind, filename: string, bytes: Uint8Array) => void }) {
  const [active, setActive] = useState(initial);
  const doc = DOCS.find((d) => d.slug === active) ?? DOCS[0];
  // Content is our own bundled Markdown, not user input.
  const html = useMemo(() => marked.parse(doc.markdown, { renderer, gfm: true, async: false }) as string, [doc]);
  return (
    <section className="panel help">
      <div className="help-bar">
        <div role="tablist" aria-label="Documents" className="help-tabs">
          {DOCS.map((d) => (
            <button key={d.slug} role="tab" id={`tab-${d.slug}`} aria-selected={d.slug === doc.slug} aria-controls="doc-panel"
              className={`help-tab${d.slug === doc.slug ? ' on' : ''}`} onClick={() => setActive(d.slug)}>{d.title}</button>
          ))}
        </div>
      </div>
      <div id="doc-panel" role="tabpanel" aria-labelledby={`tab-${doc.slug}`}>
        <header className="doc-head">
          <div>
            <span className="doc-id">{doc.id}</span>
            <h2>{doc.title}</h2>
            <p className="doc-sub">{doc.subtitle}</p>
            <p className="doc-aud"><strong>For:</strong> {doc.audience}</p>
          </div>
          <button className="btn sm" aria-label={`Download ${doc.title} as PDF`} onClick={() => onDownload(doc.title, 'pdf', doc.pdfName, decodeBase64(doc.pdf))}>⬇ PDF</button>
        </header>
        <article className="doc" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </section>
  );
}
