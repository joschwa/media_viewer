#!/usr/bin/env bash
set -euo pipefail

# Installs media_viewer as a systemd service on the Pi. Run as root (sudo ./deploy/install_service.sh)
# from a checkout of this repo, after:
#   - npm run build --workspace server   (produces server/dist/server.js)
#   - npm run build --workspace web      (produces web/dist/, served by the server itself)
#   - prisma migrate deploy              (server/, applies migrations)
#   - npm run seed-admin -- --password <...>
#   - /etc/media_viewer/env populated (see deploy/README.md)
# No hardcoded paths/user — APP_DIR is derived from this script's own location, SERVICE_USER is
# overridable via env var (e.g. `SERVICE_USER=myuser ./install_service.sh`).

SERVICE_USER="${SERVICE_USER:-mediaviewer}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
UNIT_NAME="media-viewer.service"
UNIT_DEST="/etc/systemd/system/${UNIT_NAME}"

if [[ $EUID -ne 0 ]]; then
  echo "Run this as root (sudo)." >&2
  exit 1
fi

if ! id "$SERVICE_USER" &>/dev/null; then
  echo "Creating unprivileged system user: $SERVICE_USER"
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "Installing $UNIT_DEST"
sed \
  -e "s|__SERVICE_USER__|${SERVICE_USER}|g" \
  -e "s|__APP_DIR__|${APP_DIR}|g" \
  "${SCRIPT_DIR}/media-viewer.service.template" > "$UNIT_DEST"

cat <<EOF

Unit installed. Before starting the service, make sure:
  - ${SERVICE_USER} can read MEDIA_ROOT (from /etc/media_viewer/env) and TLS_KEY_PATH/TLS_CERT_PATH
    e.g.: chown -R ${SERVICE_USER}:${SERVICE_USER} <MEDIA_ROOT>
          chown ${SERVICE_USER}:${SERVICE_USER} <TLS_KEY_PATH> <TLS_CERT_PATH> && chmod 600 <TLS_KEY_PATH>
  - /etc/media_viewer/env exists and is populated (see deploy/README.md)
EOF

systemctl daemon-reload
systemctl enable "$UNIT_NAME"
systemctl restart "$UNIT_NAME"
systemctl status "$UNIT_NAME" --no-pager
