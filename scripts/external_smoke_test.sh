#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/releaseguard-external-smoke-XXXXXX")"
PACK_DIR="$TMP_DIR/pack"
TARGET_DIR="$TMP_DIR/target"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$PACK_DIR" "$TARGET_DIR"

echo "== Building ReleaseGuard package =="
npm run build --workspace releaseguard --prefix "$REPO_ROOT"

echo "== Packing ReleaseGuard package =="
(
  cd "$REPO_ROOT/packages/releaseguard"
  npm pack --pack-destination "$PACK_DIR" >/tmp/releaseguard-pack-output.txt
)
PACK_FILE="$PACK_DIR/$(tail -n 1 /tmp/releaseguard-pack-output.txt)"
echo "Packed: $PACK_FILE"

echo "== Creating external smoke repo =="
cat > "$TARGET_DIR/package.json" <<'JSON'
{
  "name": "releaseguard-external-smoke",
  "private": true,
  "version": "0.0.0"
}
JSON
mkdir -p "$TARGET_DIR/src"
cat > "$TARGET_DIR/src/index.ts" <<'TS'
export function add(a: number, b: number): number {
  return a + b;
}
TS
cat > "$TARGET_DIR/README.md" <<'MD'
# External Smoke Repo
MD

echo "== Installing packed ReleaseGuard =="
npm install --prefix "$TARGET_DIR" --save-dev "$PACK_FILE" --no-audit --no-fund

echo "== Running scanner eval through npx =="
(
  cd "$TARGET_DIR"
  npx releaseguard scanner eval --repo-root .
)

echo "== External smoke test passed =="

