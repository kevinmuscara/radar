const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const resources = require('../config/ResourceManager');

// Simple in-memory request limiter to prevent abuse
const requestLimiter = new Map();
const MAX_REQUESTS_PER_MINUTE = 200;

function checkRateLimit(identifier) {
  const now = Date.now();
  const key = identifier || 'global';
  
  if (!requestLimiter.has(key)) {
    requestLimiter.set(key, []);
  }
  
  const times = requestLimiter.get(key);
  // Remove requests older than 1 minute
  const recentRequests = times.filter(t => now - t < 60000);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    return false; // Rate limit exceeded
  }
  
  recentRequests.push(now);
  requestLimiter.set(key, recentRequests);
  return true;
}

// Cleanup rate limiter every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of requestLimiter.entries()) {
    const recentRequests = times.filter(t => now - t < 60000);
    if (recentRequests.length === 0) {
      requestLimiter.delete(key);
    } else {
      requestLimiter.set(key, recentRequests);
    }
  }
}, 5 * 60 * 1000);


function normalizeStatus(statusText) {
  if (!statusText) return 'Unknown';
  const lower = statusText.toLowerCase();
  if (lower.includes('operational') || lower.includes('all systems operational') || lower.includes('no incidents') || lower.includes('up')) {
    return 'Operational';
  }
  if (lower.includes('maintenance')) {
    return 'Maintenance';
  }
  if (lower.includes('degraded') || lower.includes('partial') || lower.includes('minor')) {
    return 'Degraded';
  }
  if (lower.includes('outage') || lower.includes('major') || lower.includes('critical') || lower.includes('down')) {
    return 'Outage';
  }
  return 'Unknown';
}

async function checkStatus(resource) {
  let url = resource.status_page;
  const method = (resource.check_type || 'api').toLowerCase();
  const keywords = resource.scrape_keywords ? resource.scrape_keywords.split(',').map(k=>k.trim()).filter(Boolean) : [];

  if (!url || url.trim() === "") {
    return { status: 'Unknown', last_checked: new Date().toISOString() };
  }

  if (!url.startsWith('http')) {
    url = 'http://' + url;
  }

    try {
      const response = await axios.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36' }
    });

      // Handle based on selected method
      if (method === 'api') {
        // Try to parse JSON API responses (e.g., statuspage.io summary.json)
        if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
          const data = response.data;
          // Try common shapes
          if (data && data.status && data.status.description) {
            return { status: normalizeStatus(data.status.description), last_checked: new Date().toISOString(), status_url: url };
          }
          // If top-level status string exists
          if (data && data.status && typeof data.status === 'string') {
            return { status: normalizeStatus(data.status), last_checked: new Date().toISOString(), status_url: url };
          }
        }
        // As a fallback for api, also attempt to inspect body text like before
        const $api = cheerio.load(response.data);
        const pageTextApi = $api('body').text();
        if (pageTextApi) {
          for (const kw of ['All Systems Operational', 'No incidents reported', 'Operational', 'Services are healthy']) {
            if (pageTextApi.includes(kw)) return { status: 'Operational', last_checked: new Date().toISOString(), status_url: url };
          }
        }
        return { status: 'Unknown', last_checked: new Date().toISOString(), status_url: url };
      }

      if (method === 'scrape') {
        let pageText;
        
        try {
          // Use Puppeteer to render JavaScript-heavy sites
          const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
          const page = await browser.newPage();
          page.setDefaultTimeout(8000);
          page.setDefaultNavigationTimeout(8000);
          
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          pageText = await page.content();
          await browser.close();
          
          // Parse the fully rendered HTML
          const $ = cheerio.load(pageText);
          pageText = $('body').text();
        } catch (puppeteerError) {
          // Fallback to axios + cheerio if Puppeteer fails
          console.warn(`Puppeteer failed for ${url}, falling back to axios: ${puppeteerError.message}`);
          const response = await axios.get(url, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36' }
          });
          const $ = cheerio.load(response.data);
          pageText = $('body').text();
        }

        // If user provided keywords, look for them
        if (keywords.length > 0) {
          for (const kw of keywords) {
            if (pageText.toLowerCase().includes(kw.toLowerCase())) {
              return { status: normalizeStatus(kw), last_checked: new Date().toISOString(), status_url: url };
            } else {
              return { status: 'Outage', last_checked: new Date().toISOString(), status_url: url };
            }
          }
        }
        // default heuristics
        for (const kw of ['All Systems Operational', 'No incidents reported', 'Operational', 'Services are healthy']) {
          if (pageText.includes(kw)) return { status: 'Operational', last_checked: new Date().toISOString(), status_url: url };
        }
        return { status: 'Unknown', last_checked: new Date().toISOString(), status_url: url };
      }

      // heartbeat (simple HTTP 200 check)
      if (method === 'heartbeat') {
        if (response.status === 200) return { status: 'Operational', last_checked: new Date().toISOString(), status_url: url };
        return { status: 'Outage', last_checked: new Date().toISOString(), status_url: url };
      }

      // fallback
      return { status: 'Unknown', last_checked: new Date().toISOString(), status_url: url };

  } catch (error) {
    console.error(`Error checking ${resource.resource_name} (${url}): ${error.message}`);
    try {
      await resources.logCheckError(resource, error.message);
    } catch (e) {
      console.error('Failed to record check error:', e.message);
    }
    return { status: 'Unknown', last_checked: new Date().toISOString(), status_url: url };
  }
}

router.get("/check-status", async (request, response) => {
  // Rate limiting to prevent server overload
  const clientIp = request.ip || request.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return response.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { url, name } = request.query;

  if (!url && !name) {
    return response.status(400).json({ error: 'Missing url or name parameter' });
  }

  const resource = {
    resource_name: name || 'Unknown',
    status_page: url || '',
    check_type: request.query.check_type || 'api',
    scrape_keywords: request.query.scrape_keywords || ''
  };

  try {
    const statusInfo = await checkStatus(resource);
    response.json(statusInfo);
  } catch (error) {
    response.status(500).json({ error: 'Failed to check status', details: error.message });
  }
});

// Batch endpoint for checking multiple resources efficiently
// Prevents thundering herd of requests
router.post("/check-status-batch", async (request, response) => {
  // Rate limiting to prevent server overload
  const clientIp = request.ip || request.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return response.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { resources: resourcesToCheck } = request.body;

  if (!Array.isArray(resourcesToCheck) || resourcesToCheck.length === 0) {
    return response.status(400).json({ error: 'Invalid request body. Expected { resources: [...] }' });
  }

  try {
    // Process requests with concurrency limiting (max 10 concurrent)
    const concurrency = 10;
    const results = [];
    
    for (let i = 0; i < resourcesToCheck.length; i += concurrency) {
      const chunk = resourcesToCheck.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (res) => {
          try {
            const resource = {
              resource_name: res.name || 'Unknown',
              status_page: res.url || '',
              check_type: res.check_type || 'api',
              scrape_keywords: res.scrape_keywords || ''
            };
            const statusInfo = await checkStatus(resource);
            return { name: res.name, ...statusInfo };
          } catch (err) {
            return {
              name: res.name,
              status: 'Unknown',
              last_checked: new Date().toISOString(),
              error: err.message
            };
          }
        })
      );
      results.push(...chunkResults);
    }

    response.json({ results });
  } catch (error) {
    response.status(500).json({ error: 'Batch check failed', details: error.message });
  }
});

// RSS feed of all resources' current statuses
router.get('/rss', async (_request, response) => {
  try {
    const allResources = await resources.getResources();
    const items = [];
    Object.entries(allResources).forEach(([category, list]) => {
      list.forEach(r => {
        items.push({
          category,
          resource_name: r.resource_name,
          status_page: r.status_page,
          check_type: r.check_type || 'api',
          scrape_keywords: r.scrape_keywords || ''
        });
      });
    });

    // Check statuses (limit parallelism to avoid overload)
    const concurrency = 10;
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(async (it) => {
        try {
          const status = await checkStatus(it);
          return { item: it, status };
        } catch (e) {
          return { item: it, status: { status: 'Unknown', last_checked: new Date().toISOString(), status_url: it.status_page } };
        }
      }));
      results.push(...chunkResults);
    }

    // Build RSS XML
    const feedItems = results.map(r => {
      const title = `${r.item.resource_name} — ${r.item.category} — ${r.status.status}`;
      const link = r.status.status_url || r.item.status_page || '';
      const pubDate = new Date(r.status.last_checked).toUTCString();
      const description = `Status: ${r.status.status}. Checked: ${r.status.last_checked}. URL: ${link}`;
      const guid = Buffer.from(`${r.item.resource_name}|${link}`).toString('base64');
      return `    <item>\n      <title>${escapeXml(title)}</title>\n      <link>${escapeXml(link)}</link>\n      <guid isPermaLink="false">${guid}</guid>\n      <pubDate>${pubDate}</pubDate>\n      <description>${escapeXml(description)}</description>\n    </item>`;
    }).join('\n');

    const feedTitle = 'Radar - Resource Statuses';
    const feedLink = (_request && _request.protocol && _request.get) ? `${_request.protocol}://${_request.get('host')}` : '';
    const buildDate = new Date().toUTCString();

    const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>${escapeXml(feedTitle)}</title>\n    <link>${escapeXml(feedLink)}</link>\n    <description>Current statuses for all monitored resources</description>\n    <lastBuildDate>${buildDate}</lastBuildDate>\n${feedItems}\n  </channel>\n</rss>`;

    response.set('Content-Type', 'application/rss+xml');
    response.send(rss);
  } catch (error) {
    console.error('Failed to build RSS feed:', error);
    response.status(500).send('Failed to build RSS feed');
  }
});

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&"']/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
    }
  });
}

module.exports = router;