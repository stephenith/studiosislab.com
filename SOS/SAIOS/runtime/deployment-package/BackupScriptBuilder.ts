/**
 * Backup script builder — metadata/logs only, no secrets.
 */
export function buildBackupScript(): string {
  return `#!/usr/bin/env bash
# AI OS backup — Agent #112
# Backs up SOS logs + project-state. Does NOT copy .env secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/SOS/07_LOGS/saios/backups/aios-$STAMP"
mkdir -p "$OUT"
cp -a "$ROOT/SOS/project-state.json" "$OUT/" 2>/dev/null || true
cp -a "$ROOT/SOS/07_LOGS/saios/runtime-loop" "$OUT/" 2>/dev/null || true
cp -a "$ROOT/SOS/07_LOGS/saios/runtime-supervisor" "$OUT/" 2>/dev/null || true
cp -a "$ROOT/SOS/07_LOGS/saios/live-runtime" "$OUT/" 2>/dev/null || true
cp -a "$ROOT/SOS/07_LOGS/saios/founder-control-center" "$OUT/" 2>/dev/null || true
cp -a "$ROOT/SOS/07_LOGS/saios/security-department" "$OUT/" 2>/dev/null || true
echo "[AI OS] backup written to $OUT"
echo "$OUT"
`;
}
