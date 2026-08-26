#!/usr/bin/env bash
# Install SOS Commander as a systemd user or system service.
# Does NOT enable or start the service automatically — prints manual steps.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${RUNTIME_DIR}/../.." && pwd)"
LOGS_DIR="${REPO_ROOT}/SOS/07_LOGS"
NODE_BIN="$(command -v node)"
NPM_CLI="$(command -v npm)"
HOME_DIR="${HOME}"
PATH_ENV="${PATH}"
SERVICE_USER="${USER}"
GENERATED_UNIT="${SCRIPT_DIR}/sos-commander.service"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"

echo "SOS Commander — systemd install (generate only)"
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
  -e "s|__SERVICE_USER__|${SERVICE_USER}|g" \
  "${SCRIPT_DIR}/sos-commander.service.template" > "${GENERATED_UNIT}"

mkdir -p "${LOGS_DIR}/commander" "${SYSTEMD_USER_DIR}"

echo "Generated: ${GENERATED_UNIT}"
echo ""
echo "User service install (recommended — manual steps):"
echo ""
echo "  cp \"${GENERATED_UNIT}\" \"${SYSTEMD_USER_DIR}/sos-commander.service\""
echo "  systemctl --user daemon-reload"
echo "  systemctl --user enable sos-commander.service"
echo "  systemctl --user start sos-commander.service"
echo "  loginctl enable-linger ${SERVICE_USER}   # survive logout / reboot"
echo ""
echo "Verify:"
echo "  cd \"${RUNTIME_DIR}\" && npm run commander:status"
echo "  systemctl --user status sos-commander.service"
echo ""
echo "System-wide install (requires sudo):"
echo "  sudo cp \"${GENERATED_UNIT}\" /etc/systemd/system/sos-commander.service"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable sos-commander.service"
echo "  sudo systemctl start sos-commander.service"
