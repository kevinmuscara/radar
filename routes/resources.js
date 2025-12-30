const express = require("express");
const router = express.Router();

const resources = require("../config/ResourceManager");

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

  await resources.addResource(category, { resource_name, status_page, check_type: request.body.check_type, scrape_keywords: request.body.scrape_keywords });
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
  await resources.updateResource(category, resource, { resource_name, status_page, check_type: request.body.check_type, scrape_keywords: request.body.scrape_keywords });
  response.json({ status: 200 });
});

module.exports = router;
