/**
 * Log rotation script builder.
 */
export function buildRotateLogsScript(): string {
  return `#!/usr/bin/env bash
# AI OS log rotation — Agent #112
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
LOGS="$ROOT/SOS/07_LOGS/saios"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$LOGS/archive/$STAMP"
mkdir -p "$ARCHIVE"
find "$LOGS" -maxdepth 2 -type f \\( -name "*.log" -o -name "pm2-*.log" \\) -print0 2>/dev/null \\
  | while IFS= read -r -d '' f; do
      mv "$f" "$ARCHIVE/" || true
    done
echo "[AI OS] rotated logs to $ARCHIVE"
`;
}
