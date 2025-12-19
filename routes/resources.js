const express = require("express");
const router = express.Router();

const ResourceManager = require("../config/ResourceManager");
const resources = new ResourceManager("./config/resources.json");

router.get("/", (_request, response) => {
  resources.reloadResources();
  const allResources = resources.getResources();
  response.json({ status: 200, resources: allResources });
});

router.get("/category/:category", (request, response) => {
  resources.reloadResources();
  const { category } = request.params;
  const resourcesInCategory = resources.getCategory(category);
  response.json({ status: 200, [category]: resourcesInCategory });
});

router.get("/categories", (_request, response) => {
  resources.reloadResources();
  const categories = resources.getCategories();
  response.json({ status: 200, categories });
});

module.exports = router;