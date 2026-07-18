// Copies monaco-editor's prebuilt AMD bundle from node_modules into public/monaco,
// so the code editor loads it from our own origin instead of a CDN.
// Runs on `npm install` (postinstall) - public/monaco is gitignored, not committed.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const dest = path.join(root, '..', 'public', 'monaco', 'vs');

if (!existsSync(src)) {
  console.warn('[copy-monaco-assets] monaco-editor not found in node_modules, skipping.');
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log('[copy-monaco-assets] copied monaco-editor assets to public/monaco/vs');
