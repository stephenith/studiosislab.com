#!/usr/bin/env bash
# Phase 5V — revision-module deploy checklist (operational safeguard).
# Usage (on VPS after ff-only merge + verifiers):
#   bash SOS/SAIOS/scripts/aios-revision-deploy-checklist.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

echo "=== AIOS revision deploy checklist ==="
echo "1) git HEAD: $(git rev-parse HEAD)"
echo "2) origin/main: $(git rev-parse origin/main)"
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "FAIL: HEAD != origin/main"
  exit 1
fi

echo "3) Run changed-path revision verifiers before restart"
echo "4) systemctl restart aios-founder-dashboard"
echo "5) npx --yes tsx SOS/SAIOS/core/founder-revision/verify-revision-runtime-code-current.ts"
echo "6) curl -fsS http://127.0.0.1:8787/api/health (or configured port)"
echo "7) Only then: one fresh Founder Request Changes (manual)"
echo "OPERATIONAL_RULE=ff merge → verifiers → restart dashboard → health → fresh RC"
