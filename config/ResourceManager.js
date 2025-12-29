const DatabaseManager = require("./DatabaseManager");

class ResourceManager {
  constructor() {
    this.dbManager = DatabaseManager;
    this.ready = this.initDefaults();
  }

  async initDefaults() {
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT * FROM categories");

    if (rows.length <= 0) {
      // Init default resources
      const defaults = {
        "K-12": [{ resource_name: "Clever", status_page: "https://status.clever.com/api/v2/summary.json" }, { resource_name: "Fake Example Outage Data", status_page: "http://localhost/fake-summary.json" }],
        "6-8": [{ resource_name: "PowerSchool", status_page: "https://status.powerschool.com/api/v2/summary.json" }, { resource_name: "Fake Example Outage Data", status_page: "http://localhost/fake-summary.json" }]
      };

      for (const [categoryName, resources] of Object.entries(defaults)) {
        await db.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [categoryName]);
        const catRow = await db.get("SELECT id FROM categories WHERE name = ?", [categoryName]);

        for (const resource of resources) {
          await db.run("INSERT OR IGNORE INTO resource_definitions (name, status_page) VALUES (?, ?)", [resource.resource_name, resource.status_page]);
          const resRow = await db.get("SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?", [resource.resource_name, resource.status_page]);

          if (catRow && resRow) {
            await db.run("INSERT OR IGNORE INTO resource_category_mapping (resource_id, category_id) VALUES (?, ?)", [resRow.id, catRow.id]);
          }
        }
      }
    }
  }

  async getResources() {
    await this.ready;
    const db = await this.dbManager.getDb();
    // Get all categories first to ensure even empty ones are returned
    const categories = await db.all("SELECT * FROM categories");

    // Get all resources mapped to categories
    const rows = await db.all(`
        SELECT c.name as category, r.name as resource_name, r.status_page 
        FROM resource_category_mapping m
        JOIN categories c ON m.category_id = c.id
        JOIN resource_definitions r ON m.resource_id = r.id
    `);

    const resources = {};
    // Initialize all categories
    categories.forEach(c => { resources[c.name] = []; });

    rows.forEach(row => {
      // Logic for grade_level: equal to category name per new request
      resources[row.category].push({
        resource_name: row.resource_name,
        status_page: row.status_page,
        grade_level: row.category
      });
    });
    return resources;
  }

  async addCategory(category) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run("INSERT INTO categories (name) VALUES (?)", [category]);
  }

  async addResource(category, resource) {
    await this.ready;
    if (!resource.resource_name) return; // Skip empty additions (used to create category only)

    const db = await this.dbManager.getDb();

    // 1. Ensure/Get Category ID
    const catRow = await db.get("SELECT id FROM categories WHERE name = ?", [category]);
    if (!catRow) return; // Should not happen if category exists

    // 2. Ensure/Get Resource Definition ID
    await db.run("INSERT OR IGNORE INTO resource_definitions (name, status_page) VALUES (?, ?)", [resource.resource_name, resource.status_page]);
    const resRow = await db.get("SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?", [resource.resource_name, resource.status_page]);

    // 3. Create Mapping
    await db.run("INSERT OR IGNORE INTO resource_category_mapping (resource_id, category_id) VALUES (?, ?)", [resRow.id, catRow.id]);
  }

  async getResource(category, resourceName) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const row = await db.get(`
        SELECT c.name as category, r.name as resource_name, r.status_page 
        FROM resource_category_mapping m
        JOIN categories c ON m.category_id = c.id
        JOIN resource_definitions r ON m.resource_id = r.id
        WHERE c.name = ? AND r.name = ?
    `, [category, resourceName]);

    if (row) {
      return {
        category: row.category,
        resource_name: row.resource_name,
        status_page: row.status_page,
        grade_level: row.category
      };
    }
    return null;
  }

  async getCategories() {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT name FROM categories");
    return rows.map(row => row.name);
  }

  async getCategory(category) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all(`
        SELECT r.name as resource_name, r.status_page 
        FROM resource_category_mapping m
        JOIN categories c ON m.category_id = c.id
        JOIN resource_definitions r ON m.resource_id = r.id
        WHERE c.name = ?
    `, [category]);

    return rows.map(row => ({
      resource_name: row.resource_name,
      status_page: row.status_page,
      grade_level: category
    }));
  }

  async getResourceCategories(resourceName) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all(`
        SELECT c.name 
        FROM resource_category_mapping m
        JOIN categories c ON m.category_id = c.id
        JOIN resource_definitions r ON m.resource_id = r.id
        WHERE r.name = ?
    `, [resourceName]);
    return rows.map(r => r.name);
  }

  async removeCategory(category) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run("DELETE FROM categories WHERE name = ?", [category]);
    // Cascade delete handles mappings
  }

  async removeResource(category, resourceName) {
    await this.ready;
    const db = await this.dbManager.getDb();

    // Only remove the MAPPING for this specific category
    const catRow = await db.get("SELECT id FROM categories WHERE name = ?", [category]);
    const resRow = await db.get("SELECT id FROM resource_definitions WHERE name = ?", [resourceName]);

    if (catRow && resRow) {
      await db.run("DELETE FROM resource_category_mapping WHERE resource_id = ? AND category_id = ?", [resRow.id, catRow.id]);
    }

    // Optional: Clean up orphaned resource definitions?
    // For now, keep them to allow easy re-adding or if they exist in other categories (which we don't check yet here)
  }

  async updateResource(category, oldResourceName, { resource_name, status_page, grade_level }) {
    await this.ready;
    const db = await this.dbManager.getDb();

    // 1. Get the definition of the OLD resource
    const oldResRow = await db.get("SELECT id FROM resource_definitions WHERE name = ?", [oldResourceName]);
    if (!oldResRow) return;

    // 2. Update the definition itself directly?
    // Updating the definition affects ALL categories this resource is in. This matches the "Tag" philosophy.
    // If the user changes the URL for "Google" in one category, it should update everywhere using "Google".
    await db.run("UPDATE resource_definitions SET name = ?, status_page = ? WHERE id = ?", [resource_name, status_page, oldResRow.id]);
  }

  async updateCategory(oldCategory, newCategory) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run("UPDATE categories SET name = ? WHERE name = ?", [newCategory, oldCategory]);
  }
}

module.exports = new ResourceManager();