const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");

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

    if (url.includes('summary.json')) {
      if (response.data && response.data.status && response.data.status.description) {
        return {
          status: normalizeStatus(response.data.status.description),
          last_checked: new Date().toISOString(),
          status_url: url
        };
      }
    }

    const $ = cheerio.load(response.data);
    const pageText = $('body').text();

    if (pageText.includes('All Systems Operational') || pageText.includes('No incidents reported') || pageText.includes('Operational') || pageText.includes('Services are healthy')) {
      return { status: 'Operational', last_checked: new Date().toISOString(), status_url: url };
    }

    if (response.status === 200) {
      return { status: 'Operational', last_checked: new Date().toISOString(), status_url: url };
    }

    return { status: 'Unknown', last_checked: new Date().toISOString(), status_url: url };

  } catch (error) {
    console.error(`Error checking ${resource.resource_name} (${url}): ${error.message}`);
    return { status: 'Unknown', last_checked: new Date().toISOString(), status_url: url };
  }
}

router.get("/check-status", async (request, response) => {
  const { url, name } = request.query;

  if (!url && !name) {
    return response.status(400).json({ error: 'Missing url or name parameter' });
  }

  const resource = {
    resource_name: name || 'Unknown',
    status_page: url || ''
  };

  try {
    const statusInfo = await checkStatus(resource);
    response.json(statusInfo);
  } catch (error) {
    response.status(500).json({ error: 'Failed to check status', details: error.message });
  }
});

module.exports = router;