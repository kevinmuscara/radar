const express = require("express");
const router = express.Router();

const ResourceManager = require("../config/ResourceManager");
const resources = new ResourceManager();

// get all resources in every category
router.get("/", async (_request, response) => {
  await resources.reloadResources();
  const allResources = await resources.getResources();
  response.json({ status: 200, resources: allResources });
});

// get all categories
router.get("/categories", async (_request, response) => {
  await resources.reloadResources();
  const categories = await resources.getCategories();
  response.json({ status: 200, categories });
});

// get resources in category
router.get("/category/:category", async (request, response) => {
  await resources.reloadResources();
  const { category } = request.params;
  const resourcesInCategory = await resources.getCategory(category);
  response.json({ status: 200, [category]: resourcesInCategory });
});

// create resource in category
router.post("/category/:category", async (request, response) => {
  await resources.reloadResources();
  const { category } = request.params;
  const {
    resource_name,
    status_page,
    grade_level,
  } = request.body;
  await resources.addResource(category, { resource_name, status_page, grade_level });
  response.json({ status: 200 });
});

// create category
router.post("/category", async (request, response) => {
  await resources.reloadResources();
  const { category } = request.body;

  await resources.addResource(category, { resource_name: "", status_page: "", grade_level: "" });
  response.json({ status: 200 });
});

// Delete category
router.delete("/category/:category", async (request, response) => {
  await resources.reloadResources();
  const { category } = request.params;
  await resources.removeCategory(category);
  response.json({ status: 200 });
});

// Delete resource in category
router.delete("/category/:category/:resource", async (request, response) => {
  await resources.reloadResources();
  const { category, resource } = request.params;
  await resources.removeResource(category, resource);
  response.json({ status: 200 });
});

// Update resource in category
router.put("/category/:category/:resource", async (request, response) => {
  await resources.reloadResources();
  const { category, resource } = request.params;
  const {
    resource_name,
    status_page,
    grade_level,
  } = request.body;
  await resources.updateResource(category, resource, { resource_name, status_page, grade_level });
  response.json({ status: 200 });
});

module.exports = router;
