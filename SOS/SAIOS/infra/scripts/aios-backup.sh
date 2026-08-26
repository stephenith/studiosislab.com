#!/usr/bin/env bash
# AIOS critical persistent-data backup (Resume Template department).
# Never prints secrets. Safe to run via systemd oneshot.
set -euo pipefail

REPO_ROOT="${AIOS_REPO_ROOT:-/root/studiosislab.com}"
BACKUP_ROOT="${AIOS_BACKUP_ROOT:-/root/aios-backups}"
SAIOS_LOGS="${REPO_ROOT}/SOS/07_LOGS/saios"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_ROOT}/daily/${STAMP}"
OFFBOX="${AIOS_BACKUP_OFFBOX:-}"

mkdir -p "${DEST}"

copy_tree() {
  local rel="$1"
  local src="${SAIOS_LOGS}/${rel}"
  if [[ -e "${src}" ]]; then
    mkdir -p "${DEST}/$(dirname "${rel}")"
    cp -a "${src}" "${DEST}/${rel}"
  fi
}

# Critical stores only (plan §5)
copy_tree "founder-decisions"
copy_tree "founder-revision/tasks"
copy_tree "founder-revision/evidence"
copy_tree "knowledge/founder-memory"
copy_tree "first-production-cycle/candidates"
copy_tree "publication/plans"
copy_tree "publication/executions"
copy_tree "cost"

# Manifest
{
  echo "schema_version=aios-backup-1.0.0"
  echo "created_at=${STAMP}"
  echo "repo_root=${REPO_ROOT}"
  echo "paths=founder-decisions,founder-revision,founder-memory,candidates,publication,cost"
} > "${DEST}/MANIFEST.txt"

# Compress
tar -C "${BACKUP_ROOT}/daily" -czf "${BACKUP_ROOT}/daily/${STAMP}.tar.gz" "${STAMP}"
rm -rf "${DEST}"

# Retention: 7 daily tarballs
ls -1t "${BACKUP_ROOT}/daily"/*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

# Optional off-box (Founder configures AIOS_BACKUP_OFFBOX=user@host:/path)
if [[ -n "${OFFBOX}" ]]; then
  rsync -a "${BACKUP_ROOT}/daily/${STAMP}.tar.gz" "${OFFBOX}/" || {
    echo "aios-backup: off-box rsync failed (on-box archive retained)" >&2
    exit 0
  }
fi

echo "aios-backup: ok ${BACKUP_ROOT}/daily/${STAMP}.tar.gz"
