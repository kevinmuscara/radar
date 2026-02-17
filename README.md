<p align="center">
  <a href="#">
    <img alt="Radar Logo" height="128" src="./public/branding/logo.png">
    <h1 align="center">Radar</h1>
  </a>
</p>

<p align="center">
  <a aria-label="radar documentation" href="https://kevinmuscara.github.io/radar">Documentation</a> | 
  <a aria-label="radar documentation" href="#-screenshots">Screenshots</a> | 
  <a aria-label="radar documentation" href="#-key-capabilities">Features</a>
</p>

## Introduction
Radar is an open-source application designed for educational institutions. It provides a unified interface to track the operational status of software services and digital resources including LMS, communication tools, authentication services, and other vital digital infrastructure.

Built with a **server-side status checking architecture** for optimal performance and scalability. Radar checks all resources at configurable intervals (30 minutes default) and serves cached results to unlimited users instantly.

This repository includes the full Radar application, documentation, and various other supporting tools.

### ⚡ Key Capabilities

- **Server-Side Status Monitoring**: Efficient server-side checking eliminates client-side overhead
- **Instant Dashboard Loads**: Pre-computed cached data serves all users in milliseconds
- **Multiple Check Methods**: Supports API-based checks, web scraping, heartbeat monitoring, and ICMP echo (ping) checks for server/infrastructure resources
- **Configurable Intervals**: Set check frequency from 1-60 minutes (30 min default)
- **Smart Retry Logic**: Automatic retry for failed checks before logging errors
- **Responsive Dashboard**: Clean, intuitive interface that works on desktop and mobile devices
- **Category Organization**: Group related services into logical categories for better organization
- **Status Indicators**: Color-coded status badges showing operational, degraded, maintenance, and outage states
- **Current Issues Section**: Highlighted section showing all services that are not fully operational
- **Search & Filter**: Quickly find services with built-in search functionality and category filters
- **Progress Tracking**: Real-time progress bar during status checks (admin dashboard)
- **Error Logging**: Database-backed error logs for persistent failures
- **RSS Feed**: Automated status feed for integration with other systems
- **Admin Panel**: Manage resources, categories, and monitoring settings with live progress indicators
- **User Authentication**: Secure login system to protect administrative functions
- **Unlimited Scalability**: 1 user or 10,000 users = same server load

### 🚀 Performance Features

- **Zero Client-Side Checks**: All status checks performed server-side only
- **Database Caching**: Fast SQLite-backed status cache with indexed lookups
- **Auto-Updates**: Dashboard refreshes every 5 minutes with latest cached data
- **Rate Limiting**: Built-in protection against abuse (60s cooldown on manual refresh)
- **Efficient Architecture**: 99.98% reduction in external API requests vs client-side checking

## Table of Contents
- [📚 Documentation](#-documentation)
- [👏 Contributing](#-contributing)
- [❓ FAQ](#-faq)
- [🏛️ License](#license)
- [📷 Screenshots](#screenshots)

## 📚 Documentation
<p>Learn more about deploying Radar for your team <a aria-label="expo documentation" href="https://kevinmuscara.github.io/radar">in the official docs.</a></p>

## 👏 Contributing
If you like Radar and want to help make it better then check out the [Contributing Guide](./CONTRIBUTING.md)!

## ❓ FAQ
If you have any questions about Radar and want answers, then check out the [Frequently Asked Questions](/docs/faq.md)!

## 🏛️ License
The Radar source code is made available under the [MIT License](./LICENSE). Some of the dependencies used by Radar are licensed differently.

## 📷 Screenshots

![Radar](./docs/images/example_home.png)
![Radar](./docs/images/example_admin.png)
![Radar](./docs/images/example_resource.png)