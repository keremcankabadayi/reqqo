#!/usr/bin/env node
// app/lib holds vendored third-party code that no package manager tracks. A
// silent edit there ships straight to users, so pin the bytes: CI fails if a
// vendored file changes without its lock entry being updated deliberately.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// Kept at the repo root, not in app/lib: package.sh zips app/ wholesale, and a
// lock file has no business shipping to users.
const lockPath = 'vendor.lock.json';
const lock = JSON.parse(readFileSync(join(root, lockPath), 'utf8'));

const problems = [];

for (const [name, entry] of Object.entries(lock.files)) {
  const filePath = join(root, 'app/lib', name);

  let actual;
  try {
    actual = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  } catch {
    problems.push(`${name}: listed in ${lockPath} but missing from app/lib`);
    continue;
  }

  if (actual !== entry.sha256) {
    problems.push(
      `${name}: sha256 mismatch\n    expected ${entry.sha256}\n    actual   ${actual}\n` +
      `    If this change is intentional, update ${lockPath}.`
    );
  }
}

if (problems.length) {
  console.error(`vendored file check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

console.log(`vendor ok — ${Object.keys(lock.files).length} pinned file(s)`);
