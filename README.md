# Radar

![Radar cover](cover.png)

Radar is a teacher friendly focused status dashboard for tracking the health of digital resources and infrastructure in one place.

It provides:
- A live dashboard for service status visibility
- Role based administration for super admins and resource managers
- Multiple status check methods (API, scrape, heartbeat, ICMP)
- CSV import/export for bulk management
- Issue reporting and announcement workflows
- RSS feed output for integrations 

## Prerequisites

- Node.js 18+ (Node.js 20+ recommended)
- npm 9+
- Network access to resources you monitor
- OS-level `ping` utility available if you use `icmp` checks

## Installation

1. Clone the repository:

```bash
git clone https://github.com/kevinmuscara/radar.git
cd radar
```

2. Install dependencies:

```bash
npm install
```

3. (Optional) Configure environment variables in a `.env` file:

```dotenv
PORT=80
HOST=0.0.0.0
DB_PATH=./database.sqlite
NODE_ENV=production
```

4. Start the app:

```bash
npm start
```

The app runs on `http://HOST:PORT` (defaults to `http://0.0.0.0:80`).

## Docker Installation (Persistent SQLite)

This repository includes a Docker setup that keeps SQLite data persistent across container restarts and recreations.

### Start with Docker Compose

```bash
docker compose up -d --build
```

Radar will be available at `http://localhost:8080`.

### Why SQLite data persists

The compose file mounts a named Docker volume:

- `radar-data:/app/data`

And the app uses:

- `DB_PATH=/app/data/database.sqlite`

Because the database file lives in the volume, data survives:

- `docker compose restart`
- container crashes/restarts
- `docker compose up -d` after rebuilds

Data is only removed if you explicitly delete the volume (for example, `docker compose down -v`).

### Optional: use a host bind mount instead of a named volume

If you prefer seeing the SQLite file directly on disk, replace the volume mapping in `docker-compose.yml` with:

```yaml
volumes:
	- ./data:/app/data
```

Then your database will be stored at `./data/database.sqlite` on the host.

### Stop and start without data loss

```bash
docker compose stop
docker compose start
```

or

```bash
docker compose down
docker compose up -d
```

## Development

Build and watch styles:

```bash
npm run watch:css
```

Run the app in development mode:

```bash
npm run dev
```

Note: the `dev` script uses POSIX-style environment variable syntax. On Windows CMD/PowerShell, use one of these alternatives:

```bash
npm run build:css
node index.js
```

or

```powershell
$env:PORT=3000; $env:HOST="0.0.0.0"; node .
```

## Linux Deployment (systemd)

This project includes a systemd unit file at `radarboard.service` for Linux server installs.

### 1. Prepare the app on the server

```bash
cd /opt
git clone https://github.com/kevinmuscara/radar.git
cd radar
npm install
npm run build:css
```

If you use a custom database location, set `DB_PATH` in a `.env` file in the project root.

### 2. Create a service user (recommended)

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin radar
sudo chown -R radar:radar /opt/radar
```

### 3. Install and edit `radarboard.service`

Copy the unit file:

```bash
sudo cp radarboard.service /etc/systemd/system/radarboard.service
```

Edit the unit file so these fields match your server:
- `User` and `Group` (for example `radar`)
- `WorkingDirectory` (for example `/opt/radar`)
- `ExecStart` (Node path + app path, for example `/usr/bin/node /opt/radar/index.js`)

You can edit it directly:

```bash
sudo nano /etc/systemd/system/radarboard.service
```

### 4. Enable and start the service

```bash
sudo systemctl daemon-reload
sudo systemctl enable radarboard.service
sudo systemctl start radarboard.service
```

### 5. Verify service health

```bash
sudo systemctl status radarboard.service
sudo journalctl -u radarboard.service -f
```

### 6. Update workflow

When deploying updates:

```bash
cd /opt/radar
git pull
npm install
npm run build:css
sudo systemctl restart radarboard.service
```

### Optional: run behind Nginx

Set `PORT=3000` in your `.env`, bind Radar to localhost, and reverse proxy through Nginx with TLS (recommended for internet-facing deployments).

## CSV Format

Template header:

```csv
category,resource_name,status_page,favicon_url,check_type,scrape_keywords,api_config
```

Example:

```csv
K-12|Middle School,Google Workspace for Education,https://www.google.com/appsstatus/dashboard/,,scrape,No incidents,
"K-12,High School",GitHub Status,https://www.githubstatus.com/api/v2/status.json,https://www.github.com/favicon.ico,api,,status.indicator
Infrastructure,Core Router,10.0.0.1,,icmp,,
```

## Security Notes

- Change default credentials during setup (or immediately after migration).
- Configure secure session settings and HTTPS before internet exposure.
- Restrict access to admin routes behind your organization network when possible.
- Review [SECURITY.md](SECURITY.md) before deploying publicly.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening issues or pull requests.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
