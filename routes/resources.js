const express = require("express");
const router = express.Router();

const resources = require("../config/ResourceManager");
const statusChecker = require("../config/StatusChecker");
const dbManager = require("../config/DatabaseManager");

// Middleware to check authentication
const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

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
router.get('/errors', checkAuth, async (_request, response) => {
  const errs = await resources.getCheckErrors ? await resources.getCheckErrors(200) : [];
  response.json({ status: 200, errors: errs });
});

// delete a single error
router.delete('/errors/:id', checkAuth, async (request, response) => {
  const { id } = request.params;
  if (!resources.deleteCheckError) return response.status(500).json({ status: 500, error: 'Not supported' });
  await resources.deleteCheckError(id);
  response.json({ status: 200 });
});

// clear all errors
router.delete('/errors', checkAuth, async (_request, response) => {
  if (!resources.clearCheckErrors) return response.status(500).json({ status: 500, error: 'Not supported' });
  await resources.clearCheckErrors();
  response.json({ status: 200 });
});

// create resource in category
router.post("/category/:category", checkAuth, async (request, response) => {

  const { category } = request.params;
  const {
    resource_name,
    status_page,
    grade_level,
  } = request.body;

  await resources.addResource(category, { 
    resource_name, 
    status_page, 
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
router.post("/category", checkAuth, async (request, response) => {

  const { category } = request.body;

  await resources.addCategory(category);
  response.json({ status: 200 });
});

// Delete category
router.delete("/category/:category", checkAuth, async (request, response) => {

  const { category } = request.params;
  await resources.removeCategory(category);
  response.json({ status: 200 });
});

// Update category
router.put("/category/:category", checkAuth, async (request, response) => {

  const { category } = request.params;
  const { newCategory } = request.body;
  await resources.updateCategory(category, newCategory);
  response.json({ status: 200 });
});

// Delete resource in category
router.delete("/category/:category/:resource", checkAuth, async (request, response) => {

  const { category, resource } = request.params;
  await resources.removeResource(category, resource);
  response.json({ status: 200 });
});

// Update resource in category
router.put("/category/:category/:resource", checkAuth, async (request, response) => {

  const { category, resource } = request.params;
  const {
    resource_name,
    status_page,
    grade_level,
  } = request.body;
  await resources.updateResource(category, resource, { 
    resource_name, 
    status_page, 
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
router.post("/import", checkAuth, async (request, response) => {
  try {
    const { data } = request.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return response.status(400).json({ error: "Invalid data: must be a non-empty array" });
    }

    // Track categories and resources added/updated
    const imported = { categories: new Set(), resources: 0, resourceNames: [] };

    // Process each row
    for (const row of data) {
      const { category, resource_name, status_page, check_type, scrape_keywords, api_config } = row;

      if (!category || !resource_name || !status_page || !check_type) {
        return response.status(400).json({ error: "Invalid row: missing required fields" });
      }

      if (!['api', 'scrape', 'heartbeat'].includes(check_type)) {
        return response.status(400).json({ error: "Invalid check_type: must be 'api', 'scrape', or 'heartbeat'" });
      }

      try {
        // Check if category exists, create if not
        const existingCategories = await resources.getCategories();
        if (!existingCategories.includes(category)) {
          await resources.addCategory(category);
          imported.categories.add(category);
        }

        // Add resource to category
        await resources.addResource(category, {
          resource_name,
          status_page,
          check_type,
          scrape_keywords: scrape_keywords || '',
          api_config: api_config || null
        });

        imported.resources++;
        imported.resourceNames.push(resource_name);
      } catch (err) {
        console.error(`Failed to import ${category} > ${resource_name}:`, err);
        // Continue with next row instead of failing entire import
      }
    }

    // Check status of all imported resources
    console.log(`[Resources] Checking status for ${imported.resourceNames.length} imported resources...`);
    let checkedCount = 0;
    for (const resourceName of imported.resourceNames) {
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
          checkedCount++;
        }
      } catch (error) {
        console.error(`[Resources] Failed to check status for imported resource ${resourceName}:`, error.message);
        // Continue checking other resources even if one fails
      }
    }
    console.log(`[Resources] Successfully checked ${checkedCount}/${imported.resourceNames.length} imported resources`);

    response.json({ 
      status: 200, 
      message: `Successfully imported ${imported.resources} resources in ${imported.categories.size} categories`,
      imported
    });
  } catch (error) {
    console.error('Import error:', error);
    response.status(500).json({ error: "Failed to import CSV data" });
  }
});

// download CSV template
router.get("/template", (_request, response) => {
  const path = require('path');
  const filePath = path.join(__dirname, '../template.csv');
  response.download(filePath, 'resources_template.csv');
});

module.exports = router;