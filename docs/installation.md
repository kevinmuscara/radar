# Installation Guide

This installation guide is assuming and recommends that Radar be installed on VM with Ubuntu server .

### Prerequisites

- Ubuntu Server (18.04 LTS or newer)
- Node.js and npm installed
- Root or sudo access

### Installation Steps
   1. Clone the repo and install dependencies
      ```bash
      git clone https://github.com/kevinmuscara/radar
      cd radar
      npm install
      ```

   2. Create env variables for production
      ```
      cp .env.example .env
      ```

   3. Modify systemd service for your ubuntu user
      ```bash
      WorkingDirectory=/home/<insert_user>/radar
      ExecStart=/usr/bin/node /home/<insert_user>/radar/index.js
      ```

   4. Start the systemd service
      ```bash
      # Move the service file to systemd
      sudo mv radarboard.service /etc/systemd/system

      # Reload systemd daemon
      sudo systemctl daemon-reload

      # Enable the service to start on boot
      sudo systemctl enable radarboard

      # Start the service
      sudo systemctl start radarboard

      # Check status
      sudo systemctl status radarboard
      ```

### Useful Commands

#### Check Application Status
```bash
sudo systemctl status radarboard.service
```

#### View Application Logs
```bash
sudo journalctl -u radarboard.service -f
```

#### Restart the Application
```bash
sudo systemctl restart radarboard.service
```

#### Stop the Application
```bash
sudo systemctl stop radarboard.service
```

#### Start the Application
```bash
sudo systemctl start radarboard.service
```

#### View Last 50 Log Lines
```bash
sudo journalctl -u radarboard.service -n 50
```

### Configuration

#### Environment Variables
The application uses a `.env` file for configuration. Copy `.env.example` to `.env` and customize:

**Available Settings:**
- `PORT` - Server port (default: 80)
- `HOST` - Server host/IP address (default: 0.0.0.0)
- `NODE_ENV` - Environment mode: `development` or `production` (default: production)

#### Database
- The application uses SQLite for data persistence
- Database file is created automatically on first run
- Located in the project root as `database.db`