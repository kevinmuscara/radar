const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const resources = require("../config/ResourceManager");
const statusChecker = require("../config/StatusChecker");
const dbManager = require("../config/DatabaseManager");

const importJobs = new Map();
const IMPORT_JOB_TTL_MS = 10 * 60 * 1000;

function createImportJob() {
  const jobId = crypto.randomUUID();
  const job = {
    id: jobId,
    status: 'queued',
    total: 0,
    processed: 0,
    remaining: 0,
    importedResources: 0,
    failedResources: 0,
    message: 'Queued',
    error: null,
    startedAt: Date.now(),
    completedAt: null
  };

  importJobs.set(jobId, job);
  return job;
}

function scheduleImportJobCleanup(jobId) {
  setTimeout(() => {
    importJobs.delete(jobId);
  }, IMPORT_JOB_TTL_MS);
}

async function processImportJob(job, rows) {
  job.status = 'running';
  job.message = 'Preparing import';

  const validRows = [];
  for (const row of rows) {
    const { category, resource_name, status_page, favicon_url, check_type, scrape_keywords, api_config } = row || {};
    const categories = parseCategories(category);
    const normalizedCheckType = String(check_type || '').trim().toLowerCase();

    if (!resource_name || !status_page || !normalizedCheckType || categories.length === 0) {
      continue;
    }

    if (!['api', 'scrape', 'heartbeat', 'icmp'].includes(normalizedCheckType)) {
      continue;
    }

    validRows.push({
      categories,
      resource_name,
      status_page,
      favicon_url: favicon_url || null,
      check_type: normalizedCheckType,
      scrape_keywords: scrape_keywords || '',
      api_config: api_config || null
    });
  }

  if (validRows.length === 0) {
    throw new Error('No valid import rows found');
  }

  job.total = validRows.length;
  job.processed = 0;
  job.remaining = validRows.length;
  job.message = 'Importing resources';

  const imported = { categories: new Set(), resources: 0, resourceNames: [] };
  const existingCategories = new Set(await resources.getCategories());

  for (const row of validRows) {
    try {
      for (const singleCategory of row.categories) {
        if (!existingCategories.has(singleCategory)) {
          await resources.addCategory(singleCategory);
          existingCategories.add(singleCategory);
          imported.categories.add(singleCategory);
        }

        await resources.addResource(singleCategory, {
          resource_name: row.resource_name,
          status_page: row.status_page,
          favicon_url: row.favicon_url,
          check_type: row.check_type,
          scrape_keywords: row.scrape_keywords,
          api_config: row.api_config
        });
      }

      imported.resources += 1;
      imported.resourceNames.push(row.resource_name);
      job.importedResources += 1;
    } catch (error) {
      job.failedResources += 1;
      console.error(`Failed to import ${row.resource_name}:`, error);
    } finally {
      job.processed += 1;
      job.remaining = Math.max(0, job.total - job.processed);
      job.message = `Importing resources (${job.remaining} remaining)`;
    }
  }

  const uniqueNames = [...new Set(imported.resourceNames)];

  job.status = 'completed';
  job.completedAt = Date.now();
  job.message = `Successfully imported ${job.importedResources} resource${job.importedResources === 1 ? '' : 's'}`;

  setImmediate(async () => {
    for (const resourceName of uniqueNames) {
      try {
        const resourceDef = await resources.getDefinition(resourceName);
        if (resourceDef) {
          const statusData = await statusChecker.checkResourceStatus(resourceDef);
          await dbManager.updateResourceStatus(
            resourceDef.id,
            resourceName,
            statusData.status,
            statusData.status_url || resourceDef.status_page,
            statusData.last_checked
          );
        }
      } catch (error) {
        console.error(`[Resources] Failed to check status for imported resource ${resourceName}:`, error.message);
      }
    }
  });
}

// Middleware to check authentication
const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const checkResourceManagerAccess = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const role = req.session.user.role || 'superadmin';
  if (role !== 'superadmin' && role !== 'resource_manager') {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

const checkSuperAdmin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if ((req.session.user.role || 'superadmin') !== 'superadmin') {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

function parseCategories(rawCategory) {
  const unique = (list) => [...new Set(list.map(c => String(c).trim()).filter(Boolean))];
  if (!rawCategory) return [];
  if (Array.isArray(rawCategory)) {
    return unique(rawCategory);
  }

  const text = String(rawCategory).trim();
  if (!text) return [];

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return unique(parsed);
      }
    } catch (_err) {
    }
  }

  if (text.includes('|')) {
    return unique(text.split('|'));
  }
  if (text.includes(';')) {
    return unique(text.split(';'));
  }
  if (text.includes(',')) {
    return unique(text.split(','));
  }

  return unique([text]);
}

function escapeCsvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// get all resources in every category
router.get("/", async (_request, response) => {

  const allResources = await resources.getResources();
  response.json({ status: 200, resources: allResources });
});

// get categories for a specific resource
router.get("/tags/:resourceName", async (request, response) => {
  const { resourceName } = request.params;
  const categories = await resources.getResourceCategories(resourceName);
  response.json({ status: 200, categories });
});

// get all categories
router.get("/categories", async (_request, response) => {

  const categories = await resources.getCategories();
  response.json({ status: 200, categories });
});

// get resources in category
router.get("/category/:category", async (request, response) => {

  const { category } = request.params;
  const resourcesInCategory = await resources.getCategory(category);
  response.json({ status: 200, [category]: resourcesInCategory });
});

// get specific resource in specific category
router.get("/category/:category/:resource", async (request, response) => {

  const { category, resource } = request.params;
  const resourceInCategory = await resources.getResource(category, resource);
  response.json({ status: 200, [resource]: resourceInCategory });
});

// get resource definition by name
router.get('/definition/:resourceName', async (request, response) => {
  const { resourceName } = request.params;
  const def = await resources.getDefinition ? await resources.getDefinition(resourceName) : null;
  if (def) response.json({ status: 200, definition: def });
  else response.json({ status: 404, definition: null });
});

// get recent check errors (admin)
router.get('/errors', checkSuperAdmin, async (_request, response) => {
  const errs = await resources.getCheckErrors ? await resources.getCheckErrors(200) : [];
  response.json({ status: 200, errors: errs });
});

// delete a single error
router.delete('/errors/:id', checkSuperAdmin, async (request, response) => {
  const { id } = request.params;
  if (!resources.deleteCheckError) return response.status(500).json({ status: 500, error: 'Not supported' });
  await resources.deleteCheckError(id);
  response.json({ status: 200 });
});

// clear all errors
router.delete('/errors', checkSuperAdmin, async (_request, response) => {
  if (!resources.clearCheckErrors) return response.status(500).json({ status: 500, error: 'Not supported' });
  await resources.clearCheckErrors();
  response.json({ status: 200 });
});

// create resource in category
router.post("/category/:category", checkResourceManagerAccess, async (request, response) => {

  const { category } = request.params;
  const {
    resource_name,
    status_page,
    grade_level,
  } = request.body;

  await resources.addResource(category, { 
    resource_name, 
    status_page, 
    favicon_url: request.body.favicon_url,
    check_type: request.body.check_type, 
    scrape_keywords: request.body.scrape_keywords,
    api_config: request.body.api_config 
  });

  // Immediately check the status of the newly created resource
  try {
    const resourceDef = await resources.getDefinition(resource_name);
    if (resourceDef) {
      const statusData = await statusChecker.checkResourceStatus(resourceDef);
      await dbManager.updateResourceStatus(
        resourceDef.id,
        resource_name,
        statusData.status,
        statusData.status_url || resourceDef.status_page,
        statusData.last_checked
      );
      console.log(`[Resources] Checked status for new resource: ${resource_name}`);
    }
  } catch (error) {
    console.error(`[Resources] Failed to check status for new resource ${resource_name}:`, error.message);
    // Don't fail the request if status check fails
  }

  response.json({ status: 200 });
});

// create category
router.post("/category", checkResourceManagerAccess, async (request, response) => {

  const { category } = request.body;

  await resources.addCategory(category);
  response.json({ status: 200 });
});

// Delete category
router.delete("/category/:category", checkResourceManagerAccess, async (request, response) => {

  const { category } = request.params;
  await resources.removeCategory(category);
  response.json({ status: 200 });
});

// Update category
router.put("/category/:category", checkResourceManagerAccess, async (request, response) => {

  const { category } = request.params;
  const { newCategory } = request.body;
  await resources.updateCategory(category, newCategory);
  response.json({ status: 200 });
});

// Delete resource in category
router.delete("/category/:category/:resource", checkResourceManagerAccess, async (request, response) => {

  const { category, resource } = request.params;
  await resources.removeResource(category, resource);
  response.json({ status: 200 });
});

// Update resource in category
router.put("/category/:category/:resource", checkResourceManagerAccess, async (request, response) => {

  const { category, resource } = request.params;
  const {
    resource_name,
    status_page,
    grade_level,
  } = request.body;
  await resources.updateResource(category, resource, { 
    resource_name, 
    status_page, 
    favicon_url: request.body.favicon_url,
    check_type: request.body.check_type, 
    scrape_keywords: request.body.scrape_keywords,
    api_config: request.body.api_config 
  });

  // Immediately check the status of the updated resource
  try {
    const resourceDef = await resources.getDefinition(resource_name);
    if (resourceDef) {
      const statusData = await statusChecker.checkResourceStatus(resourceDef);
      await dbManager.updateResourceStatus(
        resourceDef.id,
        resource_name,
        statusData.status,
        statusData.status_url || resourceDef.status_page,
        statusData.last_checked
      );
      console.log(`[Resources] Checked status for updated resource: ${resource_name}`);
    }
  } catch (error) {
    console.error(`[Resources] Failed to check status for updated resource ${resource_name}:`, error.message);
    // Don't fail the request if status check fails
  }

  response.json({ status: 200 });
});

// bulk import from CSV
router.post("/import", checkResourceManagerAccess, async (request, response) => {
  try {
    const { data } = request.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return response.status(400).json({ error: "Invalid data: must be a non-empty array" });
    }

    const job = createImportJob();
    response.status(202).json({ status: 202, jobId: job.id, message: 'Import started' });

    setImmediate(async () => {
      try {
        await processImportJob(job, data);
      } catch (error) {
        job.status = 'failed';
        job.completedAt = Date.now();
        job.error = error.message || 'Import failed';
        job.message = job.error;
        console.error('Import error:', error);
      } finally {
        scheduleImportJobCleanup(job.id);
      }
    });
  } catch (error) {
    console.error('Import error:', error);
    response.status(500).json({ error: "Failed to import CSV data" });
  }
});

router.get('/import/progress/:jobId', checkResourceManagerAccess, (request, response) => {
  const job = importJobs.get(request.params.jobId);
  if (!job) {
    return response.status(404).json({ error: 'Import job not found or expired' });
  }

  response.json({
    status: 200,
    job: {
      id: job.id,
      status: job.status,
      total: job.total,
      processed: job.processed,
      remaining: job.remaining,
      importedResources: job.importedResources,
      failedResources: job.failedResources,
      message: job.message,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt
    }
  });
});

// download CSV template
router.get("/template", (_request, response) => {
  const path = require('path');
  const filePath = path.join(__dirname, '../template.csv');
  response.download(filePath, 'resources_template.csv');
});

router.get('/export', checkResourceManagerAccess, async (_request, response) => {
  try {
    const allResources = await resources.getResources();
    const map = new Map();

    Object.entries(allResources).forEach(([category, list]) => {
      list.forEach(resource => {
        if (!resource || !resource.resource_name) return;
        const key = resource.resource_name;
        if (!map.has(key)) {
          map.set(key, {
            resource_name: resource.resource_name,
            status_page: resource.status_page || '',
            check_type: resource.check_type || 'api',
            scrape_keywords: resource.scrape_keywords || '',
            api_config: resource.api_config || '',
            favicon_url: resource.favicon_url || '',
            categories: []
          });
        }

        const existing = map.get(key);
        if (!existing.categories.includes(category)) {
          existing.categories.push(category);
        }
      });
    });

    const lines = ['category,resource_name,status_page,favicon_url,check_type,scrape_keywords,api_config'];
    for (const item of map.values()) {
      lines.push([
        escapeCsvCell(item.categories.join('|')),
        escapeCsvCell(item.resource_name),
        escapeCsvCell(item.status_page),
        escapeCsvCell(item.favicon_url),
        escapeCsvCell(item.check_type),
        escapeCsvCell(item.scrape_keywords),
        escapeCsvCell(item.api_config)
      ].join(','));
    }

    response.setHeader('Content-Type', 'text/csv');
    response.setHeader('Content-Disposition', `attachment; filename="radar-export-${Date.now()}.csv"`);
    response.send(lines.join('\n'));
  } catch (error) {
    console.error('Export error:', error);
    response.status(500).json({ error: 'Failed to export CSV data' });
  }
});

router.post('/report-issue/:resourceName', async (request, response) => {
  try {
    const { resourceName } = request.params;
    if (!resourceName || !resourceName.trim()) {
      return response.status(400).json({ error: 'resourceName is required' });
    }

    const reporterKey = request.sessionID
      ? `sid:${request.sessionID}`
      : `ip:${request.ip || request.socket?.remoteAddress || 'unknown'}|ua:${request.get('user-agent') || 'unknown'}`;

    const result = await dbManager.reportIssue(resourceName.trim(), reporterKey);
    if (result && result.limited) {
      return response.status(429).json({
        error: 'You can only report the same resource once per hour.',
        retry_after_seconds: result.retryAfterSeconds || 0,
        report: result.report || null
      });
    }

    response.json({ status: 200, report: result.report });
  } catch (error) {
    console.error('Issue report error:', error);
    response.status(500).json({ error: 'Failed to report issue' });
  }
});

router.get('/issue-reports', async (_request, response) => {
  try {
    const reports = await dbManager.getActiveIssueReports();
    response.json({ status: 200, reports });
  } catch (error) {
    console.error('Issue reports fetch error:', error);
    response.status(500).json({ error: 'Failed to fetch issue reports' });
  }
});

router.delete('/issue-reports/:resourceName', checkResourceManagerAccess, async (request, response) => {
  try {
    const resourceName = String(request.params.resourceName || '').trim();
    if (!resourceName) {
      return response.status(400).json({ error: 'resourceName is required' });
    }

    const result = await dbManager.clearIssueReportStateByResourceName(resourceName);
    response.json({ status: 200, ...result });
  } catch (error) {
    console.error('Issue report clear error:', error);
    response.status(500).json({ error: 'Failed to clear issue report state' });
  }
});

router.get('/announcements/active', async (_request, response) => {
  try {
    const announcements = await dbManager.getActiveAnnouncements();
    response.json({ status: 200, announcements });
  } catch (error) {
    console.error('Active announcements fetch error:', error);
    response.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.get('/announcements', checkResourceManagerAccess, async (_request, response) => {
  try {
    const announcements = await dbManager.getActiveAnnouncements();
    response.json({ status: 200, announcements });
  } catch (error) {
    console.error('Announcements fetch error:', error);
    response.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/announcements', checkResourceManagerAccess, async (request, response) => {
  try {
    const { message, expires_at, type } = request.body;
    const cleanMessage = String(message || '').trim();
    const allowedTypes = new Set(['informative', 'warning', 'danger', 'success']);
    const normalizedType = String(type || 'informative').trim().toLowerCase();

    if (!cleanMessage) {
      return response.status(400).json({ error: 'Announcement message is required' });
    }

    if (!allowedTypes.has(normalizedType)) {
      return response.status(400).json({ error: 'Announcement type is invalid' });
    }

    const expiresAtRaw = String(expires_at || '').trim();
    const localPattern = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
    const match = expiresAtRaw.match(localPattern);

    if (!match) {
      return response.status(400).json({ error: 'A valid expiration date is required' });
    }

    const [, datePart, hourPart, minutePart, secondPart] = match;
    const sec = secondPart || '00';
    const expiresDate = new Date(`${datePart}T${hourPart}:${minutePart}:${sec}`);

    if (Number.isNaN(expiresDate.getTime())) {
      return response.status(400).json({ error: 'A valid expiration date is required' });
    }

    if (expiresDate.getTime() <= Date.now()) {
      return response.status(400).json({ error: 'Expiration date must be in the future' });
    }

    const sqliteExpiresAt = `${datePart} ${hourPart}:${minutePart}:${sec}`;
    const createdBy = request.session.user?.username || null;
    const createdByRole = request.session.user?.role || 'superadmin';

    const created = await dbManager.createAnnouncement(
      cleanMessage,
      sqliteExpiresAt,
      createdBy,
      createdByRole,
      normalizedType
    );

    response.json({ status: 200, announcement: created });
  } catch (error) {
    console.error('Announcement create error:', error);
    response.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.delete('/announcements/:id', checkResourceManagerAccess, async (request, response) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({ error: 'Invalid announcement id' });
    }

    const removed = await dbManager.revokeAnnouncement(id);
    if (!removed) {
      return response.status(404).json({ error: 'Announcement not found' });
    }

    response.json({ status: 200 });
  } catch (error) {
    console.error('Announcement revoke error:', error);
    response.status(500).json({ error: 'Failed to revoke announcement' });
  }
});

module.exports = router;