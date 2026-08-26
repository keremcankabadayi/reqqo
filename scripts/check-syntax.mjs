#!/usr/bin/env node
// Parses every shipped .js file. The extension has no build step, so a syntax
// error would otherwise surface only when Chrome loads the page.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const roots = ['app/js', 'scripts', 'test'];
const files = ['background.js'];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.(js|mjs|cjs)$/.test(entry)) {
      files.push(relative(root, full));
    }
  }
}

for (const dir of roots) {
  try {
    walk(join(root, dir));
  } catch {
    // Directory not present in this checkout; nothing to parse.
  }
}

const failures = [];

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'pipe' });
  } catch (error) {
    failures.push(`${file}\n${error.stderr?.toString().trim() ?? error.message}`);
  }
}

if (failures.length) {
  console.error(`syntax errors in ${failures.length} file(s):\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`syntax ok — ${files.length} file(s)`);
