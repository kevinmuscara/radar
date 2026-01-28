# Radar

Radar is an open-source application designed for educational institutions. It provides a unified interface to track the operational status of software services and digital resources including LMS, communication tools, authentication services, and other vital digital infrastructure.

## ⚡ Key Capabilities

- **Server-Side Status Monitoring**: Efficient server-side checking at configurable intervals (30 minutes default)
- **Instant Dashboard Loads**: All users see pre-computed cached status data
- **Multiple Check Methods**: Supports API-based checks, web scraping, and simple heartbeat monitoring
- **Responsive Dashboard**: Clean, intuitive interface that works on desktop and mobile devices
- **Category Organization**: Group related services into logical categories for better organization
- **Status Indicators**: Color-coded status badges showing operational, degraded, maintenance, and outage states
- **Current Issues Section**: Highlighted section showing all services that are not fully operational
- **Search & Filter**: Quickly find services with built-in search functionality and category filters
- **Smart Retry Logic**: Automatic retry for failed checks before logging errors
- **Progress Tracking**: Real-time progress bar during status checks (admin dashboard)
- **Error Logging**: Persistent failures logged in database for admin review
- **RSS Feed**: Automated status feed for integration with other systems
- **Admin Panel**: Manage resources, categories, and monitoring settings
- **User Authentication**: Secure login system to protect administrative functions
- **Auto-Updates**: Dashboard refreshes every 5 minutes with latest cached data
- **Unlimited Scalability**: Same server load for 1 user or 10,000 users

## Performance Highlights

- **Zero Client-Side Overhead**: Status checks performed server-side only
- **Configurable Intervals**: 1-60 minute check intervals (30 min default)
- **Database Caching**: Fast SQLite-backed status cache
- **Rate Limiting**: Protection against abuse and server overload
- **Efficient Retries**: Failed checks automatically retried once

## Table of Contents

- [Installation Guide](installation.md) - Follow this guide to learn how to setup Radar for your institution.
- [Usage Guide](usage.md) - Follow this guide once you have installed Radar and are ready to setup your dashboard.
- [Frequently Asked Questions](faq.md) - Reference this if you have any questions after setting up Radar.
- [Performance Optimization Guide](performance.md) - Learn about Radar's server-side architecture and optimization features.