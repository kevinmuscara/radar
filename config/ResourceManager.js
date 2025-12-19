const { readFileSync, writeFileSync } = require("fs");

class ResourceManager {
  constructor(pathToResources) {
    this.pathToResources = pathToResources;
    this.resources = JSON.parse(readFileSync(pathToResources, "utf-8"));

    this.reloadResources();
  }

  #updateResourcesFile() {
    try {
      writeFileSync(this.pathToResources, JSON.stringify(this.resources));
    } catch (error) {
      console.log(error);
    }
  }

  reloadResources() {
    this.resources = JSON.parse(readFileSync(this.pathToResources, "utf-8"));
  }

  getResources() {
    return this.resources;
  }

  addCategory(category) {
    this.resources[category] = [];
    this.#updateResourcesFile();
  }

  addResource(category, resource) {
    this.resources[category].push(resource);
    this.#updateResourcesFile();
  }

  getCategories() {
    return Object.keys(this.resources);
  }

  getCategory(category) {
    return this.resources[category];
  }
}

module.exports = ResourceManager;
