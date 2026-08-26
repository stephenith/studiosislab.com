/**
 * Install script builder — host prep only, does not deploy LIVE.
 */
export function buildInstallScript(): string {
  return `#!/usr/bin/env bash
# AI OS install — Agent #112
# Assumptions: Ubuntu 24.04 · Node 22 · PM2 · Nginx · Git
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

echo "[AI OS] checking Node..."
node -v
echo "[AI OS] installing deps..."
npm install

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[AI OS] installing PM2 globally (optional)..."
  npm install -g pm2 || true
fi

if [[ ! -f "$ROOT/SOS/runtime/.env" ]]; then
  echo "[AI OS] creating SOS/runtime/.env from template..."
  cp "$ROOT/SOS/07_LOGS/saios/deployment-package/.env.example" "$ROOT/SOS/runtime/.env"
  echo "[AI OS] fill secrets in SOS/runtime/.env before LIVE"
fi

chmod +x "$ROOT/SOS/07_LOGS/saios/deployment-package/"*.sh || true
npm run deployment-package:verify
echo "[AI OS] install complete — default mode remains VERIFY/DRY_RUN"
`;
}
