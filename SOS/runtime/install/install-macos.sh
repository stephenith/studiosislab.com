#!/usr/bin/env bash
# Install SOS Commander as a macOS launchd user agent.
# Does NOT load the service automatically — prints manual steps.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${RUNTIME_DIR}/../.." && pwd)"
LOGS_DIR="${REPO_ROOT}/SOS/07_LOGS"
NODE_BIN="$(command -v node)"
NPM_CLI="$(command -v npm)"
HOME_DIR="${HOME}"
PATH_ENV="${PATH}"
PLIST_LABEL="com.studiosis.sos-commander"
GENERATED_PLIST="${SCRIPT_DIR}/com.studiosis.sos-commander.plist"
LAUNCH_AGENTS="${HOME}/Library/LaunchAgents"

echo "SOS Commander — macOS launchd install (generate only)"
echo "  Runtime:  ${RUNTIME_DIR}"
echo "  Repo:     ${REPO_ROOT}"
echo "  Node:     ${NODE_BIN}"
echo ""

if [[ ! -f "${RUNTIME_DIR}/.env" ]]; then
  echo "WARNING: ${RUNTIME_DIR}/.env not found. Copy .env.example before starting."
fi

sed \
  -e "s|__NODE_BIN__|${NODE_BIN}|g" \
  -e "s|__NPM_CLI__|${NPM_CLI}|g" \
  -e "s|__RUNTIME_DIR__|${RUNTIME_DIR}|g" \
  -e "s|__LOGS_DIR__|${LOGS_DIR}|g" \
  -e "s|__HOME_DIR__|${HOME_DIR}|g" \
  -e "s|__PATH_ENV__|${PATH_ENV}|g" \
  "${SCRIPT_DIR}/com.studiosis.sos-commander.plist.template" > "${GENERATED_PLIST}"

mkdir -p "${LOGS_DIR}/commander" "${LAUNCH_AGENTS}"

echo "Generated: ${GENERATED_PLIST}"
echo ""
echo "Manual install steps (not run automatically):"
echo ""
echo "  cp \"${GENERATED_PLIST}\" \"${LAUNCH_AGENTS}/${PLIST_LABEL}.plist\""
echo "  launchctl bootout gui/\$(id -u)/${PLIST_LABEL} 2>/dev/null || true"
echo "  launchctl bootstrap gui/\$(id -u) \"${LAUNCH_AGENTS}/${PLIST_LABEL}.plist\""
echo "  launchctl enable gui/\$(id -u)/${PLIST_LABEL}"
echo "  launchctl kickstart -k gui/\$(id -u)/${PLIST_LABEL}"
echo ""
echo "Verify:"
echo "  cd \"${RUNTIME_DIR}\" && npm run commander:status"
echo ""
echo "Uninstall:"
echo "  launchctl bootout gui/\$(id -u)/${PLIST_LABEL}"
echo "  rm \"${LAUNCH_AGENTS}/${PLIST_LABEL}.plist\""
