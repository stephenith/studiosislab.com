#!/usr/bin/env bash
# Nightly publication: plan + verify. Apply only when SOS_AIOS_PUBLICATION_AUTO_APPLY=1.
set -euo pipefail

REPO_ROOT="${AIOS_REPO_ROOT:-/root/studiosislab.com}"
cd "${REPO_ROOT}"

export SOS_AIOS_LIVE="${SOS_AIOS_LIVE:-0}"
LOG_DIR="${REPO_ROOT}/SOS/07_LOGS/saios/publication/nightly"
mkdir -p "${LOG_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="${LOG_DIR}/run-${STAMP}.log"

{
  echo "=== aios-publication-nightly ${STAMP} LIVE=${SOS_AIOS_LIVE} AUTO_APPLY=${SOS_AIOS_PUBLICATION_AUTO_APPLY:-0} ==="
  npm run aios:publication:status || true
  # Plan + multi-verify stay non-destructive
  npm run aios:publication:plan || true
  npm run aios:publication:verify || true

  if [[ "${SOS_AIOS_PUBLICATION_AUTO_APPLY:-0}" == "1" ]]; then
    echo "AUTO_APPLY=1 — refusing silent apply without plan confirm phrase; run apply manually or extend runner."
    echo "STOP: auto-apply requires explicit plan id + confirm — see aios:publication:apply"
  else
    echo "AUTO_APPLY off — dry/plan/verify only (expected MVP default)"
  fi
} 2>&1 | tee "${LOG}"

echo "aios-publication-nightly: wrote ${LOG}"
