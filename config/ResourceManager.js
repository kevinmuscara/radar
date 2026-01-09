const DatabaseManager = require("./DatabaseManager");
const fs = require('fs').promises;
const path = require('path');

class ResourceManager {
  constructor() {
    this.dbManager = DatabaseManager;
    this.ready = this.initDefaults();
  }

  async initDefaults() {
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT * FROM categories");

    if (rows.length <= 0) {
      // Try to load initial resources from example_import.csv (project root)
      try {
        const csvPath = path.join(__dirname, '..', 'default_import.csv');
        const contents = await fs.readFile(csvPath, 'utf8');
        const lines = contents.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const header = lines[0].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(h => h.trim());
          const idx = {}; header.forEach((h,i) => idx[h] = i);

          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
            const categoryName = parts[idx['category']] || 'Uncategorized';
            const resource_name = parts[idx['resource_name']] || '';
            const status_page = parts[idx['status_page']] || '';
            const check_type = (parts[idx['check_type']] || 'api').toLowerCase();
            const scrape_keywords = parts[idx['scrape_keywords']] || '';

            if (!resource_name) continue;

            await db.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [categoryName]);
            const catRow = await db.get("SELECT id FROM categories WHERE name = ?", [categoryName]);

            await db.run("INSERT OR IGNORE INTO resource_definitions (name, status_page, check_type, scrape_keywords, api_config) VALUES (?, ?, ?, ?, ?)", [resource_name, status_page, check_type, scrape_keywords, null]);
            const resRow = await db.get("SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?", [resource_name, status_page]);

            if (catRow && resRow) {
              await db.run("INSERT OR IGNORE INTO resource_category_mapping (resource_id, category_id) VALUES (?, ?)", [resRow.id, catRow.id]);
            }
          }
        }
      } catch (e) {
        console.error("Error initializing defaults:", e);
        // Fallback to a small default set if CSV not available
        // const defaults = {"K-12": [{ resource_name: "Clever", status_page: "https://status.clever.com/api/v2/summary.json", check_type: 'api' }]};
        // for (const [categoryName, resources] of Object.entries(defaults)) {
        //   await db.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [categoryName]);
        //   const catRow = await db.get("SELECT id FROM categories WHERE name = ?", [categoryName]);

        //   for (const resource of resources) {
        //     await db.run("INSERT OR IGNORE INTO resource_definitions (name, status_page, check_type, scrape_keywords) VALUES (?, ?, ?, ?)", [resource.resource_name, resource.status_page, resource.check_type || 'api', resource.scrape_keywords || '']);
        //     const resRow = await db.get("SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?", [resource.resource_name, resource.status_page]);

        //     if (catRow && resRow) {
        //       await db.run("INSERT OR IGNORE INTO resource_category_mapping (resource_id, category_id) VALUES (?, ?)", [resRow.id, catRow.id]);
        //     }
        //   }
        // }
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
      SELECT c.name as category, r.name as resource_name, r.status_page, r.check_type, r.scrape_keywords, r.api_config 
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
        check_type: row.check_type || 'api',
        scrape_keywords: row.scrape_keywords || '',
        api_config: row.api_config || null,
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
    await db.run("INSERT OR IGNORE INTO resource_definitions (name, status_page, check_type, scrape_keywords, api_config) VALUES (?, ?, ?, ?, ?)", [resource.resource_name, resource.status_page, resource.check_type || 'api', resource.scrape_keywords || '', resource.api_config || null]);
    const resRow = await db.get("SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?", [resource.resource_name, resource.status_page]);

    // 3. Create Mapping
    await db.run("INSERT OR IGNORE INTO resource_category_mapping (resource_id, category_id) VALUES (?, ?)", [resRow.id, catRow.id]);
  }

  async getResource(category, resourceName) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const row = await db.get(`
      SELECT c.name as category, r.name as resource_name, r.status_page, r.check_type, r.scrape_keywords, r.api_config 
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
        check_type: row.check_type || 'api',
        scrape_keywords: row.scrape_keywords || '',
        api_config: row.api_config || null,
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
      SELECT r.name as resource_name, r.status_page, r.check_type, r.scrape_keywords, r.api_config 
        FROM resource_category_mapping m
        JOIN categories c ON m.category_id = c.id
        JOIN resource_definitions r ON m.resource_id = r.id
        WHERE c.name = ?
    `, [category]);

    return rows.map(row => ({
      resource_name: row.resource_name,
      status_page: row.status_page,
      check_type: row.check_type || 'api',
      scrape_keywords: row.scrape_keywords || '',
      api_config: row.api_config || null,
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

  async getDefinition(resourceName) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const row = await db.get("SELECT id, name as resource_name, status_page, check_type, scrape_keywords, api_config FROM resource_definitions WHERE name = ?", [resourceName]);
    if (!row) return null;
    return {
      id: row.id,
      resource_name: row.resource_name,
      status_page: row.status_page,
      check_type: row.check_type || 'api',
      scrape_keywords: row.scrape_keywords || '',
      api_config: row.api_config || null
    };
  }

  async logCheckError(resource, errorMessage) {
    await this.ready;
    const db = await this.dbManager.getDb();

    // Try to find resource definition id
    let resRow = null;
    try {
      resRow = await db.get("SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?", [resource.resource_name, resource.status_page]);
    } catch (e) {
      // ignore
    }

    const resourceId = resRow ? resRow.id : null;

    await db.run(`INSERT INTO status_check_errors (resource_id, resource_name, status_page, check_type, error_message) VALUES (?, ?, ?, ?, ?)`, [
      resourceId,
      resource.resource_name || null,
      resource.status_page || null,
      resource.check_type || null,
      errorMessage || ''
    ]);
  }

  async getCheckErrors(limit = 200) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all(`SELECT id, resource_id, resource_name, status_page, check_type, error_message, created_at FROM status_check_errors ORDER BY created_at DESC LIMIT ?`, [limit]);
    return rows;
  }

  async deleteCheckError(id) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run(`DELETE FROM status_check_errors WHERE id = ?`, [id]);
  }

  async clearCheckErrors() {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run(`DELETE FROM status_check_errors`);
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

  async updateResource(category, oldResourceName, { resource_name, status_page, check_type, scrape_keywords, api_config }) {
    await this.ready;
    const db = await this.dbManager.getDb();

    // 1. Get the definition of the OLD resource
    const oldResRow = await db.get("SELECT id, check_type, scrape_keywords, api_config FROM resource_definitions WHERE name = ?", [oldResourceName]);
    if (!oldResRow) return;

    // 2. Update the definition itself directly?
    // Updating the definition affects ALL categories this resource is in. This matches the "Tag" philosophy.
    // If the user changes the URL for "Google" in one category, it should update everywhere using "Google".
    await db.run("UPDATE resource_definitions SET name = ?, status_page = ?, check_type = ?, scrape_keywords = ?, api_config = ? WHERE id = ?", [resource_name, status_page, check_type || oldResRow.check_type, scrape_keywords || oldResRow.scrape_keywords, api_config !== undefined ? api_config : oldResRow.api_config, oldResRow.id]);
  }

  async updateCategory(oldCategory, newCategory) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run("UPDATE categories SET name = ? WHERE name = ?", [newCategory, oldCategory]);
  }
}

module.exports = new ResourceManager();