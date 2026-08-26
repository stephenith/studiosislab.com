/**
 * Restore script builder.
 */
export function buildRestoreScript(): string {
  return `#!/usr/bin/env bash
# AI OS restore — Agent #112
# Usage: ./restore.sh /path/to/aios-backup-dir
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SRC="\${1:-}"
if [[ -z "$SRC" || ! -d "$SRC" ]]; then
  echo "Usage: $0 <backup-dir>" >&2
  exit 1
fi
if [[ -f "$SRC/project-state.json" ]]; then
  cp -a "$SRC/project-state.json" "$ROOT/SOS/project-state.json"
fi
for d in runtime-loop runtime-supervisor live-runtime founder-control-center security-department; do
  if [[ -d "$SRC/$d" ]]; then
    mkdir -p "$ROOT/SOS/07_LOGS/saios"
    rm -rf "$ROOT/SOS/07_LOGS/saios/$d"
    cp -a "$SRC/$d" "$ROOT/SOS/07_LOGS/saios/$d"
  fi
done
echo "[AI OS] restore complete from $SRC"
`;
}
