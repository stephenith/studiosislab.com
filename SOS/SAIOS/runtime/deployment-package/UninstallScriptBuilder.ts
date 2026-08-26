/**
 * Uninstall script builder — stops local process managers only.
 */
export function buildUninstallScript(): string {
  return `#!/usr/bin/env bash
# AI OS uninstall helpers — Agent #112
# Does not delete the repository. Stops PM2/systemd unit if present.
set -euo pipefail
echo "[AI OS] stopping PM2 apps (if any)..."
pm2 delete aios-live-runtime aios-supervisor 2>/dev/null || true
echo "[AI OS] disabling systemd unit (if installed)..."
sudo systemctl disable --now aios 2>/dev/null || true
echo "[AI OS] uninstall helpers complete (repo retained)"
`;
}
