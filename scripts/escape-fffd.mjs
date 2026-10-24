// Bundled XML/UTF-8 libraries contain a literal U+FFFD inside string literals.
// Escape it so the single-file HTML is pure, unambiguous text (some hosts reject raw U+FFFD).
import { readFileSync, writeFileSync } from 'node:fs';
const p = process.argv[2] ?? 'dist-single/index.html';
const s = readFileSync(p, 'utf8');
writeFileSync(p, s.replaceAll('�', '\\uFFFD'));
