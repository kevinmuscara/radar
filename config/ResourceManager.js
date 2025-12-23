const DatabaseManager = require("./DatabaseManager");
const { readFileSync, existsSync } = require("fs");
const path = require("path");

class ResourceManager {
  constructor() {
    this.dbManager = DatabaseManager;
  }

  async migrateIfNeeded() {
    const db = await this.dbManager.getDb();
    const row = await db.get("SELECT count(*) as count FROM resources");
    if (row.count > 0) return;

    const jsonPath = path.resolve(__dirname, "resources.json");
    if (existsSync(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
        // data is { "Category": [ {resource...} ] }
        for (const [category, resources] of Object.entries(data)) {
          for (const resource of resources) {
            await db.run(
              "INSERT INTO resources (category, resource_name, status_page, grade_level) VALUES (?, ?, ?, ?)",
              [category, resource.resource_name, resource.status_page, resource.grade_level]
            );
          }
        }
        console.log("Migrated resources.json to SQLite");
      } catch (e) {
        console.error("Failed to migrate resources.json", e);
      }
    }
  }

  async reloadResources() {
    await this.migrateIfNeeded();
    await this.dbManager.getDb();
  }

  async getResources() {
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT * FROM resources");

    const resources = {};
    rows.forEach(row => {
      if (!resources[row.category]) {
        resources[row.category] = [];
      }
      resources[row.category].push({
        resource_name: row.resource_name,
        status_page: row.status_page,
        grade_level: row.grade_level
      });
    });
    return resources;
  }

  async addCategory(category) {
    const db = await this.dbManager.getDb();
    await db.run("INSERT INTO resources (category) VALUES (?)", [category]);
  }

  async addResource(category, resource) {
    const db = await this.dbManager.getDb();
    await db.run(
      "INSERT INTO resources (category, resource_name, status_page, grade_level) VALUES (?, ?, ?, ?)",
      [category, resource.resource_name, resource.status_page, resource.grade_level]
    );
  }

  async getCategories() {
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT DISTINCT category FROM resources");
    return rows.map(row => row.category);
  }

  async getCategory(category) {
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT * FROM resources WHERE category = ?", [category]);
    return rows.map(row => ({
      resource_name: row.resource_name,
      status_page: row.status_page,
      grade_level: row.grade_level
    }));
  }

  async removeCategory(category) {
    const db = await this.dbManager.getDb();
    await db.run("DELETE FROM resources WHERE category = ?", [category]);
  }

  async removeResource(category, resource) {
    const db = await this.dbManager.getDb();
    await db.run("DELETE FROM resources WHERE category = ? AND resource_name = ?", [category, resource]);
  }

  async updateResource(category, resource, { resource_name, status_page, grade_level }) {
    const db = await this.dbManager.getDb();
    await db.run(
      "UPDATE resources SET resource_name = ?, status_page = ?, grade_level = ? WHERE category = ? AND resource_name = ?",
      [resource_name, status_page, grade_level, category, resource]
    );
  }
}

module.exports = ResourceManager;

