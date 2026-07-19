# Deploying
For deployment on linux (debian based) server - tested on Raspberry Pi OS Lite

## 1. Base OS setup

```bash
sudo apt update && sudo apt install -y postgresql ffmpeg avahi-daemon build-essential
```

Install Node (tested on v20.19.0)

## 2. Postgres

```bash
sudo -u postgres createuser --pwprompt mediaviewer
sudo -u postgres createdb --owner=mediaviewer media_viewer
```

## 3. Get the code and build it

```bash
cd media_viewer
npm install
```

```bash
npm run build --workspace server   # -> server/dist/server.js
npm run build --workspace web      # -> web/dist/, served by the server itself
```

## 4. Configure

Create `/etc/media_viewer/env` (referenced by the systemd unit as `EnvironmentFile`) — same shape as `server/.env.example`, but with real values:

```
DATABASE_URL="postgresql://mediaviewer:<password>@localhost:5432/media_viewer"
MEDIA_ROOT="/srv/media_viewer/data"
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
COOKIE_SECRET="replace-with-a-random-32+-char-secret"
PORT=8443
SESSION_TTL_DAYS=30
HTTPS_ENABLED=true
TLS_KEY_PATH="/etc/media_viewer/tls/key.pem"
TLS_CERT_PATH="/etc/media_viewer/tls/cert.pem"
```

## 5. TLS certificate

```bash
sudo mkdir -p /etc/media_viewer/tls
sudo openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout /etc/media_viewer/tls/key.pem -out /etc/media_viewer/tls/cert.pem -days 825 \
  -subj "/CN=medviewer.local" \
  -addext "subjectAltName=DNS:medviewer.local,IP:<pi-ip>"
sudo chmod 600 /etc/media_viewer/tls/key.pem
```

SANs are required — modern browsers ignore a bare CN. Each device will click through a one-time "connection not private" warning on first visit; the browser remembers the exception after that.
(`mkcert` avoids the warning but requires installing a CA on every device)

## 6. Database migrations + first admin account

```bash
cd server
npx prisma migrate deploy
npm run seed-admin -- --password <a real password>
cd ..
```

## 7. Install and start the systemd service

```bash
sudo ./deploy/install_service.sh
```

This creates an unprivileged `mediaviewer` system user (override with `SERVICE_USER=... sudo -E ./deploy/install_service.sh`), installs `deploy/media-viewer.service.template` to `/etc/systemd/system/media-viewer.service` with the real paths substituted in, and starts it. The script will remind you to `chown` `MEDIA_ROOT` and the TLS key to that user before it can actually start — do that first if it fails.

Check it's running: `sudo systemctl status media-viewer` / `journalctl -u media-viewer -f`.
