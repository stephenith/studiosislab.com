/**
 * Update script builder — git pull + verify, no LIVE.
 */
export function buildUpdateScript(): string {
  return `#!/usr/bin/env bash
# AI OS update — Agent #112
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
echo "[AI OS] pulling latest..."
git pull --ff-only
npm install
echo "[AI OS] verifying core runtime..."
npm run live-runtime:verify
npm run runtime-supervisor:verify
npm run deployment-package:verify
echo "[AI OS] update complete (LIVE not enabled)"
`;
}
