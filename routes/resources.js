const express = require("express");
const router = express.Router();

const resources = require("../config/ResourceManager");

// get all resources in every category
router.get("/", async (_request, response) => {

  const allResources = await resources.getResources();
  response.json({ status: 200, resources: allResources });
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

// create resource in category
router.post("/category/:category", async (request, response) => {

  const { category } = request.params;
  const {
    resource_name,
    status_page,
    grade_level,
  } = request.body;

  const currentResources = await resources.getCategory(category);
  const hasBlankResource = currentResources.some(r => r.resource_name === "");

  if (hasBlankResource) {
    await resources.removeResource(category, "");
  }

  await resources.addResource(category, { resource_name, status_page, grade_level });
  response.json({ status: 200 });
});

// create category
router.post("/category", async (request, response) => {

  const { category } = request.body;

  await resources.addResource(category, { resource_name: "", status_page: "", grade_level: "" });
  response.json({ status: 200 });
});

// Delete category
router.delete("/category/:category", async (request, response) => {

  const { category } = request.params;
  await resources.removeCategory(category);
  response.json({ status: 200 });
});

// Delete resource in category
router.delete("/category/:category/:resource", async (request, response) => {

  const { category, resource } = request.params;
  await resources.removeResource(category, resource);
  response.json({ status: 200 });
});

// Update resource in category
router.put("/category/:category/:resource", async (request, response) => {

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
