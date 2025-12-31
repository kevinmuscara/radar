# Radar - School Resource Status Dashboard

A web application designed for schools (primarily tech teams) to efficiently monitor and display the status of their software services and resources in a centralized dashboard.

## Table of Contents

- [Project Description](#project-description)
- [Purpose & Use Cases](#purpose--use-cases)
- [Features](#features)
- [Installation & Setup](#installation--setup)
- [Usage Instructions](#usage-instructions)
- [Technical Breakdown](#technical-breakdown)
- [Project Structure](#project-structure)
- [License](#license)

---

## Project Description

Radar is a real-time status monitoring dashboard built specifically for educational institutions. It provides a unified interface to track the operational status of critical school software services including learning management systems, communication tools, authentication services, and other vital digital infrastructure.

### Key Capabilities

- **Real-time Status Monitoring**: Automatically checks the status of configured services at regular intervals
- **Multiple Check Methods**: Supports API-based checks, web scraping, and simple heartbeat monitoring
- **Responsive Dashboard**: Clean, intuitive interface that works on desktop and mobile devices
- **Category Organization**: Group related services into logical categories for better organization
- **Status Indicators**: Color-coded status badges showing operational, degraded, maintenance, and outage states
- **Current Issues Section**: Highlighted section showing all services that are not fully operational
- **Search & Filter**: Quickly find services with built-in search functionality and category filters
- **RSS Feed**: Automated status feed for integration with other systems
- **Admin Panel**: Manage resources, categories, and monitoring settings
- **User Authentication**: Secure login system to protect administrative functions

---

## Purpose & Use Cases

### Primary Purpose

Radar solves the critical problem of service visibility in schools. Tech teams and end-users need to know instantly which services are available and which have issues. Rather than checking multiple status pages or waiting for notifications, Radar provides a single source of truth.

### Typical Use Cases

1. **IT Department Communication**: Display current status to help desk staff when troubleshooting user issues
2. **Staff & Student Self-Service**: Allow users to check service status without contacting IT
3. **Incident Response**: Quickly see the scope of outages across all monitored services
4. **Maintenance Planning**: Schedule maintenance during lower-impact times
5. **SLA Monitoring**: Track uptime and service quality over time
6. **External Stakeholder Updates**: Share status page with parents, staff, and students
7. **Integration Hub**: Use RSS feed to feed status data into other monitoring systems

---

## Features

### Dashboard Features
- ✅ Real-time service status checks
- ✅ Color-coded status indicators (Operational, Degraded, Maintenance, Outage)
- ✅ Category-based organization
- ✅ Search functionality
- ✅ Current Issues section highlighting problems
- ✅ Last updated timestamp
- ✅ Responsive mobile-friendly design
- ✅ Service favicon display for quick recognition

### Admin Features
- ✅ Add/edit/delete services
- ✅ Create and manage categories
- ✅ Configure check methods (API, scrape, heartbeat)
- ✅ Import resources from CSV
- ✅ View monitoring history
- ✅ User management and authentication

### Monitoring Features
- ✅ Multiple check types:
  - **API**: Parse JSON status endpoints (e.g., StatusPage.io)
  - **Scrape**: Use web scraping for HTML-based status pages
  - **Heartbeat**: Simple HTTP 200 checks
- ✅ Custom keyword matching for scraped content
- ✅ Intelligent error handling and fallbacks
- ✅ Configurable check intervals
- ✅ Performance-optimized with caching

---

## Installation & Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- SQLite3

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/kevinmuscara/radar.git
   cd radar
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to customize:
   ```
   PORT=80
   HOST=0.0.0.0
   NODE_ENV=production
   ```

4. **Start the Application**
   ```bash
   npm start
   ```
   
   The application will start on the configured HOST:PORT (default: http://localhost:80)

## Installation on Ubuntu Server

### Prerequisites

- Ubuntu Server (18.04 LTS or newer)
- Node.js and npm installed
- Root or sudo access

### Installation Steps

   1. Clone/Copy the application to the server
      ```bash
      git clone https://github.com/kevinmuscara/radar
      cd radar
      npm install
      ```

   2. Create env variables for production
      ```
      cp .env.example .env
      ```

   3. Modify radarboard.service
      ```bash
      WorkingDirectory=/home/<insert_user>/radar
      ExecStart=/usr/bin/node /home/<insert_user>/radar/index.js
      ```

   4. Set up the systemd service
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

---

## Usage Instructions

### For Users (Dashboard)

1. **View Dashboard**: Open the application home page to see all service statuses
2. **Search Services**: Use the search bar to quickly find a specific service
3. **Filter by Category**: Click category buttons to view only services in that category
4. **Check Status**: View color-coded status indicators:
   - 🟢 **Green (Operational)**: Service is fully functional
   - 🟡 **Yellow (Degraded)**: Service has partial functionality
   - 🔵 **Blue (Maintenance)**: Service is undergoing maintenance
   - 🔴 **Red (Outage)**: Service is unavailable
5. **View Details**: Click on a service to access its status page
6. **Refresh**: Click the refresh button to manually check for updates
7. **RSS Feed**: Subscribe to `/api/rss` for automated status updates

### For Administrators

1. **Access Admin Panel**: Navigate to `http://localhost/admin`
2. **Login**: Use your credentials to access admin functions
3. **Add Resources**:
   - Go to Resources section
   - Enter service name, status page URL, and check type
   - Set check parameters (keywords, check type)
4. **Import CSV**:
   - Prepare CSV with columns: `category`, `resource_name`, `status_page`, `check_type`, `scrape_keywords`
   - Upload file through admin panel
5. **Manage Categories**: Create and organize service categories
6. **View Logs**: Check monitoring history and error logs

### CSV Import Format

Create a `template.csv` file with the following structure:

```csv
category,resource_name,status_page,check_type,scrape_keywords
K-12,Service Name,https://status.example.com/api/v2/summary.json,api,
K-12,Another Service,https://status.another.com,scrape,Operational;Fully Functional
```

---

## Technical Breakdown

### Architecture Overview

Radar is built with a client-server architecture designed for performance and reliability:

- **Frontend**: Vanilla JavaScript with responsive CSS/Tailwind
- **Backend**: Express.js for HTTP routing and business logic
- **Database**: SQLite for lightweight, serverless data persistence
- **Monitoring**: Axios for API calls, Cheerio for HTML scraping, Puppeteer for JavaScript-heavy sites

### Performance Optimizations

Radar includes sophisticated load optimization to handle high concurrency and prevent server overload. See [LOAD_OPTIMIZATION.md](LOAD_OPTIMIZATION.md) for detailed documentation.

#### 1. Client-Side Request Throttling
- **Max Concurrent Requests**: 3 simultaneous requests per user
- **Request Delay**: 200ms between starting new requests
- **Benefit**: Prevents thundering herd of simultaneous requests

#### 2. Browser Caching Strategy
- **Cache Duration**: 10 minutes per resource status
- **Implementation**: localStorage-based caching
- **Behavior**: Checks cache before making any API request
- **Result**: Dramatically reduces server load (90%+ cache hit rate)

#### 3. Intelligent Auto-Refresh
- **Interval**: 5 minutes between refresh cycles
- **Smart Check**: Only refreshes when cache has expired
- **Benefit**: Creates predictable, steady server load instead of spikes

#### 4. Server-Side Rate Limiting
- **Limit**: 200 requests per minute per IP address
- **Purpose**: Prevents abuse and DoS attacks
- **Response**: Returns HTTP 429 when limit exceeded
- **Cleanup**: Automatic memory management every 5 minutes

#### 5. Batch Status Endpoint
- **Endpoint**: `POST /api/check-status-batch`
- **Purpose**: Check multiple resources in single request
- **Concurrency**: Limited to 10 parallel checks
- **Benefit**: Reduces HTTP overhead and network traffic

### Performance Metrics

**Load Reduction Example** (20 resources, 10 concurrent users):

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Initial page load requests | 200 | 60 | **70%** |
| Server requests per 10 min | 1800 | ~60 | **95%** |
| Peak concurrent requests | 200 | 30 | **85%** |
| Cache hit rate | 0% | 90%+ | **Significant** |

### Key Technical Features

#### Multiple Check Methods

**API Check**
- Parses JSON from status endpoints
- Looks for common status indicators
- Supports StatusPage.io and similar services

**Scrape Check**
- Uses Puppeteer for JavaScript-heavy sites
- Falls back to Cheerio for static HTML
- Supports custom keyword matching

**Heartbeat Check**
- Simple HTTP 200 status verification
- Lightweight and fast
- Ideal for simple uptime checking

#### Error Handling
- Graceful fallback when status checks fail
- Error logging for troubleshooting
- User-friendly error messages
- Automatic retry logic

#### Session Management
- Secure cookie-based sessions
- Configurable session timeout
- Password hashing with bcrypt
- CSRF protection


## Configuration & Customization

### Adjust Cache Duration

Edit `public/script.js`:
```javascript
const CACHE_DURATION = 10 * 60 * 1000;  // Change 10 to desired minutes
```

### Adjust Request Throttling

Edit `public/script.js`:
```javascript
const REQUEST_THROTTLE_CONFIG = {
  maxConcurrentRequests: 3,   // Adjust concurrent limit
  requestDelay: 200           // Adjust delay in ms
};
```

### Adjust Auto-Refresh Interval

Edit `public/script.js`:
```javascript
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;  // Change 5 to desired minutes
```

### Adjust Server Rate Limit

Edit `routes/api.js`:
```javascript
const MAX_REQUESTS_PER_MINUTE = 100;  // Adjust per your capacity
```

---

## Troubleshooting

### Services show "Unknown" status

- **Cause**: Status check failed or URL is incorrect
- **Solution**: Verify the status page URL is correct and accessible
- **Check logs**: Review error logs in admin panel

### Server is slow or unresponsive

- **Cause**: Too many concurrent requests or resource checks taking too long
- **Solution**: Check rate limiting in logs, increase cache duration, or reduce concurrent requests
- **Monitor**: Use browser DevTools Network tab to see request patterns

---

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests to improve Radar.

## License

MIT License - See LICENSE file for details

---

## Support

For issues, questions, or feature requests, please visit the [GitHub Issues](https://github.com/kevinmuscara/radar/issues) page.