const DatabaseManager = require("./DatabaseManager");

class ResourceManager {
  constructor() {
    this.dbManager = DatabaseManager;
    this.ready = this.initDefaults();
  }

  async initDefaults() {
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT DISTINCT category FROM resources");

    if (rows.length <= 0) {
      // Init default resources
      const defaults = {
        "Category 1": [{ resource_name: "Clever", status_page: "https://status.clever.com/api/v2/summary.json", grade_level: "K-12" }],
        "Category 2": [{ resource_name: "PowerSchool", status_page: "https://status.powerschool.com/api/v2/summary.json", grade_level: "K-12" }]
      };

      for (const [category, resources] of Object.entries(defaults)) {
        for (const resource of resources) {
          db.run(
            "INSERT OR IGNORE INTO resources (category, resource_name, status_page, grade_level) VALUES (?, ?, ?, ?)",
            [category, resource.resource_name, resource.status_page, resource.grade_level]
          );
        }
      }
    }
  }

  async getResources() {
    await this.ready;
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
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run("INSERT INTO resources (category) VALUES (?)", [category]);
  }

  async addResource(category, resource) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run(
      "INSERT INTO resources (category, resource_name, status_page, grade_level) VALUES (?, ?, ?, ?)",
      [category, resource.resource_name, resource.status_page, resource.grade_level]
    );
  }

  async getResource(category, resource) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const row = await db.get("SELECT * FROM resources WHERE category = ? AND resource_name = ?", [category, resource]);
    return row;
  }

  async getCategories() {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT DISTINCT category FROM resources");
    return rows.map(row => row.category);
  }

  async getCategory(category) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT * FROM resources WHERE category = ?", [category]);
    return rows.map(row => ({
      resource_name: row.resource_name,
      status_page: row.status_page,
      grade_level: row.grade_level
    }));
  }

  async removeCategory(category) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run("DELETE FROM resources WHERE category = ?", [category]);
  }

  async removeResource(category, resource) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run("DELETE FROM resources WHERE category = ? AND resource_name = ?", [category, resource]);
  }

  async updateResource(category, resource, { resource_name, status_page, grade_level }) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run(
      "UPDATE resources SET resource_name = ?, status_page = ?, grade_level = ? WHERE category = ? AND resource_name = ?",
      [resource_name, status_page, grade_level, category, resource]
    );
  }
}

module.exports = new ResourceManager();