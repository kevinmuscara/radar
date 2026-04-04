const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");
const { execFile } = require("child_process");
const { promisify } = require("util");
const resources = require("../config/ResourceManager");
const DatabaseManager = require("../config/DatabaseManager");
const statusChecker = require("../config/StatusChecker");

const execFileAsync = promisify(execFile);

const requestLimiter = new Map();
const MAX_REQUESTS_PER_MINUTE = 200;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_CLEANUP_MS = 60 * 1000;
const RATE_LIMIT_STALE_MS = 5 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 5000;

function checkRateLimit(identifier) {
  const now = Date.now();
  const key = identifier || "global";

  let entry = requestLimiter.get(key);
  if (!entry) {
    entry = {
      windowStart: now,
      count: 0,
      lastSeen: now,
    };
  }

  if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    entry.windowStart = now;
    entry.count = 0;
  }

  if (entry.count >= MAX_REQUESTS_PER_MINUTE) {
    entry.lastSeen = now;
    requestLimiter.set(key, entry);
    return false;
  }

  entry.count += 1;
  entry.lastSeen = now;
  requestLimiter.set(key, entry);

  if (requestLimiter.size > MAX_RATE_LIMIT_KEYS) {
    const cutoff = now - RATE_LIMIT_STALE_MS;
    for (const [entryKey, tracked] of requestLimiter.entries()) {
      if (tracked.lastSeen < cutoff) {
        requestLimiter.delete(entryKey);
      }
    }

    if (requestLimiter.size > MAX_RATE_LIMIT_KEYS) {
      const entriesByAge = Array.from(requestLimiter.entries()).sort(
        (a, b) => a[1].lastSeen - b[1].lastSeen,
      );
      const overflow = requestLimiter.size - MAX_RATE_LIMIT_KEYS;
      for (let i = 0; i < overflow; i++) {
        requestLimiter.delete(entriesByAge[i][0]);
      }
    }

    console.warn(
      `[API] Rate limiter key set exceeded limit; trimmed to ${requestLimiter.size} keys`,
    );
  }

  return true;
}

const rateLimiterCleanupInterval = setInterval(
  () => {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_STALE_MS;
    for (const [key, entry] of requestLimiter.entries()) {
      if (entry.lastSeen < cutoff) {
        requestLimiter.delete(key);
      }
    }

    if (requestLimiter.size > 0) {
      console.log(`[API] Rate limiter active key count: ${requestLimiter.size}`);
    }
  },
  RATE_LIMIT_CLEANUP_MS,
);
if (typeof rateLimiterCleanupInterval.unref === "function") {
  rateLimiterCleanupInterval.unref();
}

function normalizeStatus(statusText) {
  if (!statusText) return "Unknown";
  const lower = statusText.toLowerCase();
  if (
    lower.includes("operational") ||
    lower.includes("all systems operational") ||
    lower.includes("no incidents") ||
    lower.includes("up")
  ) {
    return "Operational";
  }
  if (lower.includes("maintenance")) {
    return "Maintenance";
  }
  if (
    lower.includes("degraded") ||
    lower.includes("partial") ||
    lower.includes("minor")
  ) {
    return "Degraded";
  }
  if (
    lower.includes("outage") ||
    lower.includes("major") ||
    lower.includes("critical") ||
    lower.includes("down")
  ) {
    return "Outage";
  }
  return "Unknown";
}

function extractIcmpTarget(input) {
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

async function performIcmpCheck(resource) {
  const target = extractIcmpTarget(resource.status_page);

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

async function checkStatus(resource) {
  let url = resource.status_page;
  const method = (resource.check_type || "api").toLowerCase();
  const keywords = resource.scrape_keywords
    ? resource.scrape_keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : [];
  let apiConfig = null;

  if (resource.api_config) {
    try {
      apiConfig =
        typeof resource.api_config === "string"
          ? JSON.parse(resource.api_config)
          : resource.api_config;
    } catch (e) {
      console.error("Failed to parse api_config:", e);
    }
  }

  if (!url || url.trim() === "") {
    return { status: "Unknown", last_checked: new Date().toISOString() };
  }

  if (method === "icmp") {
    return performIcmpCheck(resource);
  }

  if (!url.startsWith("http")) {
    url = "http://" + url;
  }

  try {
    const response = await axios.get(url, {
      timeout: 5000,
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
                status: normalizeStatus(String(value)),
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
            status: normalizeStatus(data.status.description),
            last_checked: new Date().toISOString(),
            status_url: url,
          };
        }
        if (data && data.status && typeof data.status === "string") {
          return {
            status: normalizeStatus(data.status),
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
      const pageText = await statusChecker.fetchPageBodyText(url);

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
      `Error checking ${resource.resource_name} (${url}): ${error.message}`,
    );
    try {
      await resources.logCheckError(resource, error.message);
    } catch (e) {
      console.error("Failed to record check error:", e.message);
    }
    return {
      status: "Unknown",
      last_checked: new Date().toISOString(),
      status_url: url,
    };
  }
}

router.post("/analyze-api", async (request, response) => {
  const clientIp = request.ip || request.connection.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return response
      .status(429)
      .json({ error: "Too many requests. Please try again later." });
  }

  const { url } = request.body;

  if (!url) {
    return response.status(400).json({ error: "Missing url parameter" });
  }

  let fullUrl = url;
  if (!fullUrl.startsWith("http")) {
    fullUrl = "http://" + fullUrl;
  }

  try {
    const apiResponse = await axios.get(fullUrl, {
      timeout: 8000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
      },
    });

    if (
      !apiResponse.headers["content-type"] ||
      !apiResponse.headers["content-type"].includes("application/json")
    ) {
      return response
        .status(400)
        .json({
          error:
            "URL does not return JSON. Please use API (JSON) check type only for JSON APIs.",
        });
    }

    const data = apiResponse.data;

    function extractPaths(obj, prefix = "") {
      const paths = [];
      const arrayInfo = [];

      function traverse(current, currentPath) {
        if (current === null || current === undefined) {
          paths.push({
            path: currentPath,
            value: current,
            type: typeof current,
          });
          return;
        }

        if (Array.isArray(current)) {
          if (current.length > 0) {
            arrayInfo.push({
              path: currentPath,
              length: current.length,
              items: current.map((item, idx) => {
                let itemName = null;
                if (typeof item === "object" && item !== null) {
                  itemName =
                    item.name ||
                    item.title ||
                    item.label ||
                    item.id ||
                    `Item ${idx}`;
                }
                return { index: idx, name: itemName, preview: item };
              }),
            });

            current.forEach((item, idx) => {
              traverse(item, `${currentPath}[${idx}]`);
            });
          } else {
            paths.push({ path: currentPath, value: "[]", type: "array" });
          }
        } else if (typeof current === "object") {
          for (const key in current) {
            if (current.hasOwnProperty(key)) {
              const newPath = currentPath ? `${currentPath}.${key}` : key;
              traverse(current[key], newPath);
            }
          }
        } else {
          paths.push({
            path: currentPath,
            value: current,
            type: typeof current,
          });
        }
      }

      traverse(obj, prefix);
      return { paths, arrayInfo };
    }

    const { paths, arrayInfo } = extractPaths(data);

    response.json({
      success: true,
      apiData: data,
      paths: paths.filter(
        (pathEntry) =>
          pathEntry.type !== "object" && pathEntry.type !== "array",
      ), // Only return leaf nodes
      arrayInfo: arrayInfo, // Information about arrays for bulk creation
    });
  } catch (error) {
    console.error(`Error analyzing API ${fullUrl}:`, error.message);
    response.status(500).json({
      error: "Failed to fetch or analyze API",
      details: error.message,
    });
  }
});

router.post("/check-status-batch", async (request, response) => {
  const clientIp = request.ip || request.connection.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    return response
      .status(429)
      .json({ error: "Too many requests. Please try again later." });
  }

  const { resources: resourcesToCheck } = request.body;

  if (!Array.isArray(resourcesToCheck) || resourcesToCheck.length === 0) {
    return response
      .status(400)
      .json({ error: "Invalid request body. Expected { resources: [...] }" });
  }

  try {
    const concurrency = 10;
    const results = [];

    for (let i = 0; i < resourcesToCheck.length; i += concurrency) {
      const chunk = resourcesToCheck.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (res) => {
          try {
            const resource = {
              resource_name: res.name || "Unknown",
              status_page: res.url || "",
              check_type: res.check_type || "api",
              scrape_keywords: res.scrape_keywords || "",
              api_config: res.api_config || null,
            };
            const statusInfo = await checkStatus(resource);
            return { name: res.name, ...statusInfo };
          } catch (err) {
            return {
              name: res.name,
              status: "Unknown",
              last_checked: new Date().toISOString(),
              error: err.message,
            };
          }
        }),
      );
      results.push(...chunkResults);
    }

    response.json({ results });
  } catch (error) {
    response
      .status(500)
      .json({ error: "Batch check failed", details: error.message });
  }
});

router.get("/rss", async (_request, response) => {
  try {
    const allResources = await resources.getResources();
    const items = [];
    Object.entries(allResources).forEach(([category, list]) => {
      list.forEach((r) => {
        items.push({
          category,
          resource_name: r.resource_name,
          status_page: r.status_page,
          check_type: r.check_type || "api",
          scrape_keywords: r.scrape_keywords || "",
          api_config: r.api_config || null,
        });
      });
    });

    const concurrency = 10;
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (it) => {
          try {
            const status = await checkStatus(it);
            return { item: it, status };
          } catch (e) {
            return {
              item: it,
              status: {
                status: "Unknown",
                last_checked: new Date().toISOString(),
                status_url: it.status_page,
              },
            };
          }
        }),
      );
      results.push(...chunkResults);
    }

    const feedItems = results
      .map((r) => {
        const title = `${r.item.resource_name} — ${r.item.category} — ${r.status.status}`;
        const link = r.status.status_url || r.item.status_page || "";
        const pubDate = new Date(r.status.last_checked).toUTCString();
        const description = `Status: ${r.status.status}. Checked: ${r.status.last_checked}. URL: ${link}`;
        const guid = Buffer.from(`${r.item.resource_name}|${link}`).toString(
          "base64",
        );
        return `    <item>\n      <title>${escapeXml(title)}</title>\n      <link>${escapeXml(link)}</link>\n      <guid isPermaLink="false">${guid}</guid>\n      <pubDate>${pubDate}</pubDate>\n      <description>${escapeXml(description)}</description>\n    </item>`;
      })
      .join("\n");

    const feedTitle = "Radar - Resource Statuses";
    const feedLink =
      _request && _request.protocol && _request.get
        ? `${_request.protocol}://${_request.get("host")}`
        : "";
    const buildDate = new Date().toUTCString();

    const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>${escapeXml(feedTitle)}</title>\n    <link>${escapeXml(feedLink)}</link>\n    <description>Current statuses for all monitored resources</description>\n    <lastBuildDate>${buildDate}</lastBuildDate>\n${feedItems}\n  </channel>\n</rss>`;

    response.set("Content-Type", "application/rss+xml");
    response.send(rss);
  } catch (error) {
    console.error("Failed to build RSS feed:", error);
    response.status(500).send("Failed to build RSS feed");
  }
});

function escapeXml(unsafe) {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&"']/g, function (c) {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
    }
  });
}

router.get("/cached-statuses", async (_request, response) => {
  try {
    const statuses = await DatabaseManager.getAllResourceStatuses();
    response.json({ statuses });
  } catch (error) {
    console.error("Error fetching cached statuses:", error);
    response.status(500).json({ error: "Failed to fetch statuses" });
  }
});

router.get("/cached-status/:resourceName", async (request, response) => {
  try {
    const { resourceName } = request.params;
    const status = await DatabaseManager.getResourceStatusByName(resourceName);

    if (!status) {
      return response.status(404).json({ error: "Status not found" });
    }

    response.json(status);
  } catch (error) {
    console.error("Error fetching cached status:", error);
    response.status(500).json({ error: "Failed to fetch status" });
  }
});

let lastForceRefresh = 0;
const forceRefreshCooldown = 60 * 1000;

router.post("/force-refresh", async (request, response) => {
  if (!request.session.user) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  if ((request.session.user.role || "superadmin") !== "superadmin") {
    return response.status(403).json({ error: "Forbidden" });
  }

  try {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastForceRefresh;

    if (timeSinceLastRefresh < forceRefreshCooldown) {
      const secondsRemaining = Math.ceil(
        (forceRefreshCooldown - timeSinceLastRefresh) / 1000,
      );
      return response.status(429).json({
        error: "Rate limit exceeded",
        message: `Please wait ${secondsRemaining} seconds before refreshing again`,
        secondsRemaining,
      });
    }

    lastForceRefresh = now;

    statusChecker.forceCheck();
    response.json({ success: true, message: "Status refresh initiated" });
  } catch (error) {
    console.error("Error forcing refresh:", error);
    response.status(500).json({ error: "Failed to force refresh" });
  }
});

router.get("/check-progress", async (_request, response) => {
  try {
    const progress = statusChecker.getProgress();
    response.json(progress);
  } catch (error) {
    console.error("Error getting progress:", error);
    response.status(500).json({ error: "Failed to get progress" });
  }
});

module.exports = router;
