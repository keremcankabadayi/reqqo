#!/usr/bin/env node
// Every asset the extension loads is referenced by a plain string — script tags
// in app/index.html and paths in manifest.json. Nothing resolves them at build
// time, so a renamed or deleted file only breaks once Chrome loads the page.
// This asserts each referenced path exists on disk.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const missing = [];
let checked = 0;

function check(pathFromRoot, source) {
  checked++;
  if (!existsSync(join(root, pathFromRoot))) {
    missing.push(`${pathFromRoot}  (referenced by ${source})`);
  }
}

// --- app/index.html: <script src> and <link href> ---------------------------
const indexPath = join(root, 'app/index.html');
const html = readFileSync(indexPath, 'utf8');
const indexDir = dirname(indexPath);

const refRegex = /<(?:script[^>]*?\ssrc|link[^>]*?\shref)=["']([^"']+)["']/gi;
let match;

while ((match = refRegex.exec(html)) !== null) {
  const raw = match[1];

  // Remote assets are not ours to verify; a cache-busting query is not part of
  // the filename (e.g. lib/jsoneditor.min.css?v=2).
  if (/^(https?:)?\/\//.test(raw) || raw.startsWith('data:')) continue;

  const relPath = raw.split(/[?#]/)[0];
  const abs = resolve(indexDir, relPath);
  check(abs.slice(root.length), 'app/index.html');
}

// --- manifest.json: service worker and icon sets ----------------------------
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

if (manifest.background?.service_worker) {
  check(manifest.background.service_worker, 'manifest.json background.service_worker');
}

for (const [field, icons] of [
  ['icons', manifest.icons],
  ['action.default_icon', manifest.action?.default_icon]
]) {
  for (const path of Object.values(icons ?? {})) {
    check(path, `manifest.json ${field}`);
  }
}

// --- manifest sanity --------------------------------------------------------
const problems = [];

if (!/^\d+(\.\d+){0,3}$/.test(manifest.version ?? '')) {
  problems.push(`version "${manifest.version}" is not a Chrome-style dotted integer version`);
}

if (manifest.manifest_version !== 3) {
  problems.push(`manifest_version is ${manifest.manifest_version}, expected 3`);
}

if (missing.length || problems.length) {
  if (missing.length) {
    console.error(`missing ${missing.length} referenced file(s):\n  ${missing.join('\n  ')}`);
  }
  if (problems.length) {
    console.error(`manifest problems:\n  ${problems.join('\n  ')}`);
  }
  process.exit(1);
}

console.log(`references ok — ${checked} path(s), manifest v${manifest.version}`);
