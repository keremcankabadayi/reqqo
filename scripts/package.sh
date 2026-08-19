#!/usr/bin/env bash
# Build a Chrome Web Store upload zip containing only the files the
# extension actually ships. Run from anywhere: ./scripts/package.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -1)"
if [ -z "$VERSION" ]; then
  echo "error: could not read version from manifest.json" >&2
  exit 1
fi

OUT="dist/reqqo-${VERSION}.zip"
mkdir -p dist
rm -f "$OUT"

# Ship list: everything Chrome loads, nothing else.
zip -r -q "$OUT" \
  manifest.json \
  background.js \
  app \
  icons \
  -x '*.DS_Store' \
  -x '__MACOSX/*' \
  -x '*/.*'

echo "built $OUT ($(du -h "$OUT" | cut -f1))"
echo
echo "contents (top level):"
unzip -Z1 "$OUT" | awk -F/ '{print $1}' | sort -u
echo
echo "sanity check — these must be empty:"
unzip -Z1 "$OUT" | grep -E '(\.DS_Store|\.git|\.idea|node_modules)' || echo "  clean"
