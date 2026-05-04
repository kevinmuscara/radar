const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const { execFile } = require("child_process");
const { promisify } = require("util");
const DatabaseManager = require("./DatabaseManager");
const ResourceManager = require("./ResourceManager");
const SetupManager = require("./SetupManager");

const execFileAsync = promisify(execFile);

class StatusChecker {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
    this.CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes by default
    const configuredConcurrency = Number(process.env.STATUS_CHECK_CONCURRENCY);
    this.maxConcurrentChecks =
      Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
        ? Math.min(Math.floor(configuredConcurrency), 20)
        : 4;
    this.isChecking = false;
    this.cancelCurrentCheck = false;
    this.currentProgress = 0;
    this.totalResources = 0;
    this.currentResourceName = "";
    this.mailTransporter = null;
    this.mailTransporterCacheKey = "";
  }

  normalizeStatusToken(value) {
    const normalized = this.toCanonicalStatus(value);
    if (!normalized) return "Unknown";
    return normalized;
  }

  isNotifiableStatus(status) {
    const normalized = this.normalizeStatusToken(status);
    return (
      normalized === "Outage" ||
      normalized === "Degraded" ||
      normalized === "Maintenance"
    );
  }

  getRecipientList(rawRecipients) {
    return String(rawRecipients || "")
      .split(/[\n,;]+/)
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }

  shouldSendStatusAlert(previousStatus, currentStatus) {
    const previous = this.normalizeStatusToken(previousStatus);
    const current = this.normalizeStatusToken(currentStatus);

    if (!this.isNotifiableStatus(current)) {
      return false;
    }

    return previous !== current;
  }

  getTransporterCacheKey(settings) {
    return [
      settings.smtpHost,
      settings.smtpPort,
      settings.smtpSecure ? "secure" : "insecure",
      settings.smtpUsername,
      settings.smtpPassword,
    ].join("|");
  }

  getOrCreateTransporter(settings) {
    const cacheKey = this.getTransporterCacheKey(settings);
    if (this.mailTransporter && this.mailTransporterCacheKey === cacheKey) {
      return this.mailTransporter;
    }

    this.mailTransporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: settings.smtpUsername
        ? {
            user: settings.smtpUsername,
            pass: settings.smtpPassword,
          }
        : undefined,
    });
    this.mailTransporterCacheKey = cacheKey;
    return this.mailTransporter;
  }

  isTlsModeMismatchError(error) {
    const message = String((error && error.message) || "").toLowerCase();
    if (!message) return false;

    return (
      message.includes("wrong version number") ||
      message.includes("tls_validate_record_header") ||
      message.includes("ssl routines")
    );
  }

  async notifyOnStatusChange(resource, previousStatus, currentStatus, statusUrl) {
    try {
      const resourceName = String(resource.resource_name || "Unknown Resource");
      const normalizedCurrentStatus = this.normalizeStatusToken(currentStatus);
      const normalizedPreviousStatus = this.normalizeStatusToken(previousStatus);

      if (this.isNotifiableStatus(normalizedCurrentStatus)) {
        console.log(
          `[StatusChecker] Notification evaluation for ${resourceName}: previous=${normalizedPreviousStatus}, current=${normalizedCurrentStatus}`,
        );
      }

      if (!this.isNotifiableStatus(normalizedCurrentStatus)) {
        return;
      }

      if (normalizedPreviousStatus === normalizedCurrentStatus) {
        console.log(
          `[StatusChecker] Email alert skipped for ${resourceName}: status unchanged (${normalizedCurrentStatus})`,
        );
        return;
      }

      const settings = await SetupManager.getEmailNotificationSettings({
        includePassword: true,
      });

      if (!settings.enabled) {
        console.log(
          `[StatusChecker] Email alert skipped for ${resourceName}: notifications are disabled`,
        );
        return;
      }

      const recipients = this.getRecipientList(settings.toEmails);
      if (
        !settings.smtpHost ||
        !settings.smtpPort ||
        !settings.fromEmail ||
        recipients.length === 0
      ) {
        console.warn(
          `[StatusChecker] Email alert skipped for ${resource.resource_name}: notification settings are incomplete`,
        );
        return;
      }

      console.log(
        `[StatusChecker] Email alert preparing for ${resourceName}: smtpHost=${settings.smtpHost}, smtpPort=${settings.smtpPort}, secure=${settings.smtpSecure ? "yes" : "no"}, recipients=${recipients.length}`,
      );

      const transporter = this.getOrCreateTransporter(settings);
      const timestamp = new Date().toISOString();
      const subjectPrefix = settings.subjectPrefix || "Radar Alert";

      const subject = `${subjectPrefix}: ${resourceName} is ${normalizedCurrentStatus}`;
      const text = [
        `${resourceName} changed status.`,
        `Previous status: ${normalizedPreviousStatus}`,
        `Current status: ${normalizedCurrentStatus}`,
        `Status URL: ${statusUrl || resource.status_page || "N/A"}`,
        `Detected at: ${timestamp}`,
      ].join("\n");

      const html = `
        <p><strong>${resourceName}</strong> changed status.</p>
        <p><strong>Previous status:</strong> ${normalizedPreviousStatus}<br>
        <strong>Current status:</strong> ${normalizedCurrentStatus}<br>
        <strong>Status URL:</strong> ${statusUrl || resource.status_page || "N/A"}<br>
        <strong>Detected at:</strong> ${timestamp}</p>
      `;

      console.log(
        `[StatusChecker] Attempting email alert send for ${resourceName} to ${recipients.join(", ")}`,
      );

      const mailPayload = {
        from: settings.fromEmail,
        to: recipients.join(", "),
        subject,
        text,
        html,
      };

      let info;
      try {
        info = await transporter.sendMail(mailPayload);
      } catch (sendError) {
        const canRetryWithStartTls =
          settings.smtpSecure === true &&
          Number(settings.smtpPort) === 587 &&
          this.isTlsModeMismatchError(sendError);

        if (!canRetryWithStartTls) {
          throw sendError;
        }

        console.warn(
          `[StatusChecker] SMTP secure mode mismatch detected for ${resourceName} on port 587; retrying with STARTTLS (secure=false)`,
        );

        const fallbackTransporter = nodemailer.createTransport({
          host: settings.smtpHost,
          port: settings.smtpPort,
          secure: false,
          auth: settings.smtpUsername
            ? {
                user: settings.smtpUsername,
                pass: settings.smtpPassword,
              }
            : undefined,
        });

        info = await fallbackTransporter.sendMail(mailPayload);

        console.log(
          `[StatusChecker] SMTP retry with STARTTLS succeeded for ${resourceName}`,
        );
      }

      const previewUrl = nodemailer.getTestMessageUrl(info);

      console.log(
        `[StatusChecker] Email alert sent for ${resourceName} (${normalizedCurrentStatus}) messageId=${info && info.messageId ? info.messageId : "unknown"}`,
      );
      if (previewUrl) {
        console.log(
          `[StatusChecker] Email preview URL for ${resourceName}: ${previewUrl}`,
        );
      }
    } catch (notifyError) {
      console.error(
        `[StatusChecker] Failed to send email alert for ${resource.resource_name}: ${notifyError.message}`,
      );
    }
  }

  async fetchPageBodyText(url) {
    let browser = null;

    try {
      browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage();
      page.setDefaultTimeout(8000);
      page.setDefaultNavigationTimeout(8000);

      await page.goto(url, { waitUntil: "domcontentloaded" });
      const html = await page.content();
      const $ = cheerio.load(html);
      return $("body").text();
    } catch (puppeteerError) {
      console.warn(
        `[StatusChecker] Puppeteer failed for ${url}, falling back to axios: ${puppeteerError.message}`,
      );

      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        },
      });
      const $ = cheerio.load(response.data);
      return $("body").text();
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.warn(
            `[StatusChecker] Failed to close browser for ${url}: ${closeError.message}`,
          );
        }
      }
    }
  }

  hasMappedApiField(resource) {
    if (!resource || !resource.api_config) return false;
    const parsed = this.parseApiConfig(resource.api_config);
    return Boolean(parsed && parsed.fieldPath && String(parsed.fieldPath).trim());
  }

  parseApiConfig(rawApiConfig) {
    if (!rawApiConfig) return null;

    if (typeof rawApiConfig === "object" && !Array.isArray(rawApiConfig)) {
      const fieldPath = String(rawApiConfig.fieldPath || "").trim();
      return fieldPath ? { ...rawApiConfig, fieldPath } : rawApiConfig;
    }

    const text = String(rawApiConfig).trim();
    if (!text) return null;

    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      const fieldPath = String(parsed.fieldPath || "").trim();
      return fieldPath ? { ...parsed, fieldPath } : parsed;
    } catch (_error) {
      if (text.startsWith("{") || text.startsWith("[")) {
        return null;
      }
      return { fieldPath: text };
    }
  }

  scoreResourceDefinition(resource) {
    if (!resource) return 0;
    let score = 0;
    if (resource.status_page) score += 1;
    if ((resource.check_type || "api").toLowerCase() === "api") score += 1;
    if (this.hasMappedApiField(resource)) score += 2;
    return score;
  }

  toCanonicalStatus(statusValue) {
    const value = String(statusValue || "")
      .trim()
      .toLowerCase();
    if (!value) return "Unknown";

    if (["operational", "ok", "healthy", "up"].includes(value))
      return "Operational";
    if (["degraded", "partial", "minor", "warning"].includes(value))
      return "Degraded";
    if (["outage", "down", "critical", "major"].includes(value))
      return "Outage";
    if (["maintenance", "scheduled maintenance"].includes(value))
      return "Maintenance";

    return this.normalizeStatus(value);
  }

  getCustomStatusMap(apiConfig) {
    if (!apiConfig || typeof apiConfig !== "object") return null;

    if (
      apiConfig.statusMap &&
      typeof apiConfig.statusMap === "object" &&
      !Array.isArray(apiConfig.statusMap)
    ) {
      return Object.entries(apiConfig.statusMap)
        .filter(([key]) => String(key || "").trim())
        .map(([key, value]) => ({
          match: String(key).trim().toLowerCase(),
          status: this.toCanonicalStatus(value),
        }))
        .filter((entry) => entry.status !== "Unknown");
    }

    if (Array.isArray(apiConfig.statusMappings)) {
      return apiConfig.statusMappings
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const match = String(entry.match || "")
            .trim()
            .toLowerCase();
          const status = this.toCanonicalStatus(entry.status);
          if (!match || status === "Unknown") return null;
          return { match, status };
        })
        .filter(Boolean);
    }

    return null;
  }

  normalizeStatus(statusText, apiConfig = null) {
    if (!statusText) return "Unknown";

    const raw = String(statusText).trim();
    if (!raw) return "Unknown";

    const lower = raw.toLowerCase();
    const customMap = this.getCustomStatusMap(apiConfig);
    if (Array.isArray(customMap) && customMap.length > 0) {
      for (const entry of customMap) {
        if (lower.includes(entry.match)) {
          return entry.status;
        }
      }
    }

    const rules = [
      {
        status: "Outage",
        patterns: [
          /\bmajor outage\b/i,
          /\bcomplete outage\b/i,
          /\boutage\b/i,
          /\bcritical\b/i,
          /\bdown\b/i,
          /\bunavailable\b/i,
          /\bsevere\b/i,
        ],
      },
      {
        status: "Degraded",
        patterns: [
          /\bpartial\b/i,
          /\bdegraded\b/i,
          /\bminor\b/i,
          /\bdisruption\b/i,
          /\bperformance issues?\b/i,
          /\bintermittent\b/i,
          /\bslowness\b/i,
        ],
      },
      {
        status: "Maintenance",
        patterns: [
          /\bmaintenance\b/i,
          /\bscheduled maintenance\b/i,
          /\bund(er|going) maintenance\b/i,
        ],
      },
      {
        status: "Operational",
        patterns: [
          /\ball systems operational\b/i,
          /\bno incidents reported\b/i,
          /\boperational\b/i,
          /\bhealthy\b/i,
          /\bavailable\b/i,
          /\bup\b/i,
        ],
      },
    ];

    for (const rule of rules) {
      if (rule.patterns.some((pattern) => pattern.test(lower))) {
        return rule.status;
      }
    }

    return "Unknown";
  }

  extractIcmpTarget(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";

    try {
      if (/^[a-z]+:\/\//i.test(raw)) {
        return new URL(raw).hostname;
      }

      const parsed = new URL(`http://${raw}`);
      if (parsed.hostname) {
        return parsed.hostname;
      }
    } catch (_error) {}

    return raw.replace(/^\[|\]$/g, "");
  }

  async performIcmpCheck(resource) {
    const target = this.extractIcmpTarget(resource.status_page);

    if (!target) {
      return { status: "Unknown", last_checked: new Date().toISOString() };
    }

    const argsByPlatform = {
      win32: ["-n", "1", "-w", "3000", target],
      darwin: ["-c", "1", "-W", "3000", target],
      linux: ["-c", "1", "-W", "3", target],
    };

    const args = argsByPlatform[process.platform] || ["-c", "1", target];

    try {
      await execFileAsync("ping", args, { timeout: 5000, windowsHide: true });
      return {
        status: "Operational",
        last_checked: new Date().toISOString(),
        status_url: target,
      };
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw new Error(
          "ICMP check failed: ping command is not available on this host",
        );
      }

      return {
        status: "Outage",
        last_checked: new Date().toISOString(),
        status_url: target,
      };
    }
  }

  async checkResourceStatus(resource) {
    let url = resource.status_page;
    const method = (resource.check_type || "api").toLowerCase();
    const keywords = resource.scrape_keywords
      ? resource.scrape_keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : [];
    const apiConfig = this.parseApiConfig(resource.api_config);

    if (!url || url.trim() === "") {
      return { status: "Unknown", last_checked: new Date().toISOString() };
    }

    if (method === "icmp") {
      return this.performIcmpCheck(resource);
    }

    if (!url.startsWith("http")) {
      url = "http://" + url;
    }

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        },
      });

      if (method === "api") {
        if (
          response.headers["content-type"] &&
          response.headers["content-type"].includes("application/json")
        ) {
          const data = response.data;

          if (apiConfig && apiConfig.fieldPath) {
            try {
              const pathParts = apiConfig.fieldPath
                .split(/\.|\[|\]/)
                .filter(Boolean);
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
                  status: this.normalizeStatus(String(value), apiConfig),
                  last_checked: new Date().toISOString(),
                  status_url: url,
                };
              }
            } catch (e) {
              console.error("Failed to extract configured API field:", e);
            }
          }

          if (data && data.status && data.status.description) {
            return {
              status: this.normalizeStatus(data.status.description, apiConfig),
              last_checked: new Date().toISOString(),
              status_url: url,
            };
          }
          if (data && data.status && typeof data.status === "string") {
            return {
              status: this.normalizeStatus(data.status, apiConfig),
              last_checked: new Date().toISOString(),
              status_url: url,
            };
          }
        }

        const $api = cheerio.load(response.data);
        const pageTextApi = $api("body").text();
        if (pageTextApi) {
          for (const kw of [
            "All Systems Operational",
            "No incidents reported",
            "Operational",
            "Services are healthy",
          ]) {
            if (pageTextApi.includes(kw))
              return {
                status: "Operational",
                last_checked: new Date().toISOString(),
                status_url: url,
              };
          }
        }
        return {
          status: "Unknown",
          last_checked: new Date().toISOString(),
          status_url: url,
        };
      }

      if (method === "scrape") {
        const pageText = await this.fetchPageBodyText(url);

        if (keywords.length > 0) {
          const lowerPageText = pageText.toLowerCase();
          const hasKeywordMatch = keywords.some((kw) =>
            lowerPageText.includes(kw.toLowerCase()),
          );

          return {
            status: hasKeywordMatch ? "Operational" : "Outage",
            last_checked: new Date().toISOString(),
            status_url: url,
          };
        }

        for (const kw of [
          "All Systems Operational",
          "No incidents reported",
          "Operational",
          "Services are healthy",
        ]) {
          if (pageText.includes(kw))
            return {
              status: "Operational",
              last_checked: new Date().toISOString(),
              status_url: url,
            };
        }
        return {
          status: "Unknown",
          last_checked: new Date().toISOString(),
          status_url: url,
        };
      }

      if (method === "heartbeat") {
        if (response.status === 200)
          return {
            status: "Operational",
            last_checked: new Date().toISOString(),
            status_url: url,
          };
        return {
          status: "Outage",
          last_checked: new Date().toISOString(),
          status_url: url,
        };
      }

      return {
        status: "Unknown",
        last_checked: new Date().toISOString(),
        status_url: url,
      };
    } catch (error) {
      console.error(
        `Error checking status for ${resource.resource_name}:`,
        error.message,
      );
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
    this.currentResourceName = "";
    const startedAt = Date.now();
    console.log(
      `[StatusChecker] Starting status check (concurrency=${this.maxConcurrentChecks})...`,
    );

    try {
      const resources = await ResourceManager.getResources();
      const allResources = [];

      for (const category in resources) {
        if (Array.isArray(resources[category])) {
          allResources.push(...resources[category]);
        }
      }

      const dedupedByName = new Map();
      for (const resource of allResources) {
        const key = String(
          resource && resource.resource_name ? resource.resource_name : "",
        )
          .trim()
          .toLowerCase();
        if (!key) continue;

        if (!dedupedByName.has(key)) {
          dedupedByName.set(key, resource);
          continue;
        }

        const current = dedupedByName.get(key);
        if (
          this.scoreResourceDefinition(resource) >=
          this.scoreResourceDefinition(current)
        ) {
          dedupedByName.set(key, resource);
        }
      }

      const uniqueResources = Array.from(dedupedByName.values());
      this.totalResources = uniqueResources.length;
      const failedResources = [];
      console.log(`[StatusChecker] Checking ${this.totalResources} resources`);

      const processResources = async (resourcesToProcess, isRetry = false) => {
        let nextIndex = 0;
        const workerCount = Math.max(
          1,
          Math.min(this.maxConcurrentChecks, resourcesToProcess.length),
        );

        const workers = Array.from({ length: workerCount }, async () => {
          while (!this.cancelCurrentCheck) {
            const index = nextIndex;
            nextIndex += 1;

            if (index >= resourcesToProcess.length) {
              return;
            }

            const resource = resourcesToProcess[index];
            if (!resource || !resource.resource_name) {
              this.currentProgress += 1;
              continue;
            }

            this.currentProgress += 1;
            this.currentResourceName = isRetry
              ? `${resource.resource_name} (retry)`
              : resource.resource_name;

            try {
              const previousStatusRecord =
                await DatabaseManager.getResourceStatusByName(
                  resource.resource_name,
                );
              const previousStatus = previousStatusRecord
                ? previousStatusRecord.status
                : "Unknown";
              const statusData = await this.checkResourceStatus(resource);

              await DatabaseManager.updateResourceStatus(
                resource.id || null,
                resource.resource_name,
                statusData.status,
                statusData.status_url,
                statusData.last_checked,
              );

              await this.notifyOnStatusChange(
                resource,
                previousStatus,
                statusData.status,
                statusData.status_url,
              );

              if (isRetry) {
                console.log(
                  `[StatusChecker] Retry successful: ${resource.resource_name}`,
                );
              }
            } catch (error) {
              try {
                await DatabaseManager.updateResourceStatus(
                  resource.id || null,
                  resource.resource_name,
                  "Unknown",
                  resource.status_page || null,
                  new Date().toISOString(),
                );
              } catch (cacheError) {
                const label = isRetry
                  ? "after retry"
                  : "for initial attempt";
                console.error(
                  `[StatusChecker] Failed to update Unknown status ${label} for ${resource.resource_name}: ${cacheError.message}`,
                );
              }

              if (!isRetry) {
                try {
                  await DatabaseManager.logStatusCheckError(
                    resource.id || null,
                    resource.resource_name,
                    resource.status_page,
                    resource.check_type || "api",
                    error.message || "Unknown error",
                  );
                } catch (logError) {
                  console.error(
                    `[StatusChecker] Failed to log error for ${resource.resource_name}: ${logError.message}`,
                  );
                }

                failedResources.push({
                  resource,
                  error: error.message || "Unknown error",
                });
              } else {
                console.error(
                  `[StatusChecker] Retry failed: ${resource.resource_name} - ${error.message}`,
                );
              }
            }
          }
        });

        await Promise.all(workers);
      };

      await processResources(uniqueResources, false);

      if (failedResources.length > 0 && !this.cancelCurrentCheck) {
        console.log(
          `[StatusChecker] Retrying ${failedResources.length} failed resources`,
        );
        this.totalResources = uniqueResources.length + failedResources.length; // Update total for progress

        await processResources(
          failedResources.map((entry) => entry.resource),
          true,
        );
      }

      if (!this.cancelCurrentCheck) {
        console.log(
          `[StatusChecker] Check complete in ${Date.now() - startedAt}ms`,
        );
      }
    } catch (error) {
      console.error("[StatusChecker] Error:", error);
    } finally {
      console.log(
        `[StatusChecker] Cycle finished in ${Date.now() - startedAt}ms`,
      );
      this.isChecking = false;
      this.cancelCurrentCheck = false;
      this.currentProgress = 0;
      this.totalResources = 0;
      this.currentResourceName = "";
    }
  }

  start(intervalMs = null) {
    const newInterval = intervalMs || this.CHECK_INTERVAL_MS;

    if (this.isRunning && newInterval !== this.CHECK_INTERVAL_MS) {
      this.stop();
    }

    if (this.isRunning) {
      return;
    }

    this.CHECK_INTERVAL_MS = newInterval;
    this.isRunning = true;
    console.log(
      `[StatusChecker] Started (${this.CHECK_INTERVAL_MS / 60000} min interval)`,
    );

    this.checkAllResources();

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
    if (this.isChecking) {
      this.cancelCurrentCheck = true;

      const maxWait = 5000;
      const startTime = Date.now();
      while (this.isChecking && Date.now() - startTime < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

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
      percentage:
        this.totalResources > 0
          ? Math.round((this.currentProgress / this.totalResources) * 100)
          : 0,
    };
  }
}

const instance = new StatusChecker();
module.exports = instance;
