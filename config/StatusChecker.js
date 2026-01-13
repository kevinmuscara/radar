const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const DatabaseManager = require('./DatabaseManager');
const ResourceManager = require('./ResourceManager');

class StatusChecker {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
    this.CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes by default
    this.isChecking = false;
    this.cancelCurrentCheck = false;
    this.currentProgress = 0;
    this.totalResources = 0;
    this.currentResourceName = '';
  }

  normalizeStatus(statusText) {
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

  async checkResourceStatus(resource) {
    let url = resource.status_page;
    const method = (resource.check_type || 'api').toLowerCase();
    const keywords = resource.scrape_keywords ? resource.scrape_keywords.split(',').map(k => k.trim()).filter(Boolean) : [];
    let apiConfig = null;

    // Parse API config if exists
    if (resource.api_config) {
      try {
        apiConfig = typeof resource.api_config === 'string' ? JSON.parse(resource.api_config) : resource.api_config;
      } catch (e) {
        console.error('Failed to parse api_config:', e);
      }
    }

    if (!url || url.trim() === "") {
      return { status: 'Unknown', last_checked: new Date().toISOString() };
    }

    if (!url.startsWith('http')) {
      url = 'http://' + url;
    }

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36' }
      });

      // Handle based on selected method
      if (method === 'api') {
        // Try to parse JSON API responses (e.g., statuspage.io summary.json)
        if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
          const data = response.data;

          // If user configured specific API field, use it
          if (apiConfig && apiConfig.fieldPath) {
            try {
              const pathParts = apiConfig.fieldPath.split(/\.|\[|\]/).filter(Boolean);
              let value = data;

              for (const part of pathParts) {
                if (value === null || value === undefined) break;
                const index = parseInt(part, 10);
                if (!isNaN(index) && Array.isArray(value)) {
                  value = value[index];
                } else {
                  value = value[part];
                }
              }

              if (value !== null && value !== undefined) {
                return {
                  status: this.normalizeStatus(String(value)),
                  last_checked: new Date().toISOString(),
                  status_url: url
                };
              }
            } catch (e) {
              console.error('Failed to extract configured API field:', e);
            }
          }

          // Fallback to common API patterns
          if (data && data.status && data.status.description) {
            return { status: this.normalizeStatus(data.status.description), last_checked: new Date().toISOString(), status_url: url };
          }
          if (data && data.status && typeof data.status === 'string') {
            return { status: this.normalizeStatus(data.status), last_checked: new Date().toISOString(), status_url: url };
          }
        }

        // Fallback for api: inspect body text
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
          const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
          const page = await browser.newPage();
          page.setDefaultTimeout(8000);
          page.setDefaultNavigationTimeout(8000);

          await page.goto(url, { waitUntil: 'domcontentloaded' });
          pageText = await page.content();
          await browser.close();

          const $ = cheerio.load(pageText);
          pageText = $('body').text();
        } catch (puppeteerError) {
          console.warn(`Puppeteer failed for ${url}, falling back to axios: ${puppeteerError.message}`);
          const response = await axios.get(url, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36' }
          });
          const $ = cheerio.load(response.data);
          pageText = $('body').text();
        }

        if (keywords.length > 0) {
          for (const kw of keywords) {
            if (pageText.toLowerCase().includes(kw.toLowerCase())) {
              return { status: this.normalizeStatus(kw), last_checked: new Date().toISOString(), status_url: url };
            } else {
              return { status: 'Outage', last_checked: new Date().toISOString(), status_url: url };
            }
          }
        }

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

      return { status: 'Unknown', last_checked: new Date().toISOString(), status_url: url };

    } catch (error) {
      console.error(`Error checking status for ${resource.resource_name}:`, error.message);
      // Throw the error so it can be caught and retried
      throw new Error(`Failed to check status: ${error.message}`);
    }
  }

  async checkAllResources() {
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;
    this.cancelCurrentCheck = false;
    this.currentProgress = 0;
    this.currentResourceName = '';
    console.log('[StatusChecker] Starting status check...');
    
    try {
      const resources = await ResourceManager.getResources();
      const allResources = [];

      // Flatten resources by category
      for (const category in resources) {
        if (Array.isArray(resources[category])) {
          allResources.push(...resources[category]);
        }
      }

      this.totalResources = allResources.length;
      const failedResources = [];
      console.log(`[StatusChecker] Checking ${this.totalResources} resources`);

      // Check resources sequentially to avoid overloading
      for (let i = 0; i < allResources.length; i++) {
        const resource = allResources[i];
        
        // Check if cancellation was requested
        if (this.cancelCurrentCheck) {
          console.log('[StatusChecker] Check cancelled');
          break;
        }

        try {
          if (!resource.resource_name) {
            continue;
          }

          this.currentProgress = i + 1;
          this.currentResourceName = resource.resource_name;

          const statusData = await this.checkResourceStatus(resource);
          
          // Store in database
          await DatabaseManager.updateResourceStatus(
            resource.id || null,
            resource.resource_name,
            statusData.status,
            statusData.status_url,
            statusData.last_checked
          );
        } catch (error) {
          // Track failed resource for retry
          failedResources.push({
            resource,
            error: error.message || 'Unknown error'
          });
        }

        // Small delay between checks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Retry failed resources once
      if (failedResources.length > 0 && !this.cancelCurrentCheck) {
        console.log(`[StatusChecker] Retrying ${failedResources.length} failed resources`);
        this.totalResources = allResources.length + failedResources.length; // Update total for progress
        
        for (let i = 0; i < failedResources.length; i++) {
          const { resource, error: firstError } = failedResources[i];
          
          if (this.cancelCurrentCheck) {
            break;
          }

          this.currentProgress = allResources.length + i + 1;
          this.currentResourceName = `${resource.resource_name} (retry)`;

          try {
            const statusData = await this.checkResourceStatus(resource);
            
            // Store in database
            await DatabaseManager.updateResourceStatus(
              resource.id || null,
              resource.resource_name,
              statusData.status,
              statusData.status_url,
              statusData.last_checked
            );

            console.log(`[StatusChecker] Retry successful: ${resource.resource_name}`);
          } catch (retryError) {
            console.error(`[StatusChecker] Failed: ${resource.resource_name} - ${retryError.message}`);
            
            // Log to error table after retry failure
            await DatabaseManager.logStatusCheckError(
              resource.id || null,
              resource.resource_name,
              resource.status_page,
              resource.check_type || 'api',
              retryError.message || 'Unknown error'
            );
          }

          // Small delay between retries
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!this.cancelCurrentCheck) {
        console.log('[StatusChecker] Check complete');
      }
    } catch (error) {
      console.error('[StatusChecker] Error:', error);
    } finally {
      this.isChecking = false;
      this.cancelCurrentCheck = false;
      this.currentProgress = 0;
      this.totalResources = 0;
      this.currentResourceName = '';
    }
  }

  start(intervalMs = null) {
    const newInterval = intervalMs || this.CHECK_INTERVAL_MS;
    
    // If already running and interval changed, restart
    if (this.isRunning && newInterval !== this.CHECK_INTERVAL_MS) {
      this.stop();
    }

    if (this.isRunning) {
      return;
    }

    this.CHECK_INTERVAL_MS = newInterval;
    this.isRunning = true;
    console.log(`[StatusChecker] Started (${this.CHECK_INTERVAL_MS / 60000} min interval)`);

    // Check immediately on start
    this.checkAllResources();

    // Then check at intervals
    this.checkInterval = setInterval(() => {
      this.checkAllResources();
    }, this.CHECK_INTERVAL_MS);
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async forceCheck() {
    // Cancel any in-progress check
    if (this.isChecking) {
      this.cancelCurrentCheck = true;
      
      // Wait for current check to stop (max 5 seconds)
      const maxWait = 5000;
      const startTime = Date.now();
      while (this.isChecking && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Start new check
    await this.checkAllResources();
  }

  updateInterval(intervalMs) {
    if (this.isRunning) {
      this.start(intervalMs);
    } else {
      this.CHECK_INTERVAL_MS = intervalMs;
    }
  }

  getProgress() {
    return {
      isChecking: this.isChecking,
      currentProgress: this.currentProgress,
      totalResources: this.totalResources,
      currentResourceName: this.currentResourceName,
      percentage: this.totalResources > 0 ? Math.round((this.currentProgress / this.totalResources) * 100) : 0
    };
  }
}

// Singleton instance
const instance = new StatusChecker();
module.exports = instance;
