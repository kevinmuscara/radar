const DatabaseManager = require("./DatabaseManager");
const fs = require("fs").promises;
const path = require("path");

class ResourceManager {
  constructor() {
    this.dbManager = DatabaseManager;
    this.ready = this.initDefaults();
  }

  async initDefaults() {
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT * FROM categories");

    if (rows.length <= 0) {
      try {
        const csvPath = path.join(__dirname, "..", "default_import.csv");
        const contents = await fs.readFile(csvPath, "utf8");
        const lines = contents
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length > 0) {
          const header = lines[0]
            .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
            .map((h) => h.trim());
          const idx = {};
          header.forEach((h, i) => (idx[h] = i));

          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i]
              .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
              .map((p) => p.trim().replace(/^"|"$/g, ""));
            const categoryName = parts[idx["category"]] || "Uncategorized";
            const resource_name = parts[idx["resource_name"]] || "";
            const status_page = parts[idx["status_page"]] || "";
            const check_type = (
              parts[idx["check_type"]] || "api"
            ).toLowerCase();
            const scrape_keywords = parts[idx["scrape_keywords"]] || "";
            const favicon_url = parts[idx["favicon_url"]] || "";

            if (!resource_name) continue;

            await db.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [
              categoryName,
            ]);
            const catRow = await db.get(
              "SELECT id FROM categories WHERE name = ?",
              [categoryName],
            );

            await db.run(
              "INSERT OR IGNORE INTO resource_definitions (name, status_page, favicon_url, check_type, scrape_keywords, api_config) VALUES (?, ?, ?, ?, ?, ?)",
              [
                resource_name,
                status_page,
                favicon_url || null,
                check_type,
                scrape_keywords,
                null,
              ],
            );
            const resRow = await db.get(
              "SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?",
              [resource_name, status_page],
            );

            if (catRow && resRow) {
              await db.run(
                "INSERT OR IGNORE INTO resource_category_mapping (resource_id, category_id) VALUES (?, ?)",
                [resRow.id, catRow.id],
              );
            }
          }
        }
      } catch (e) {
        console.error("Error initializing defaults:", e);
      }
    }
  }

  async getResources() {
    await this.ready;
    const db = await this.dbManager.getDb();
    const categories = await db.all("SELECT * FROM categories");

    const rows = await db.all(`
      SELECT c.name as category, r.id, r.name as resource_name, r.status_page, r.favicon_url, r.check_type, r.scrape_keywords, r.api_config 
        FROM resource_category_mapping m
        JOIN categories c ON m.category_id = c.id
        JOIN resource_definitions r ON m.resource_id = r.id
    `);

    const resources = {};
    categories.forEach((c) => {
      resources[c.name] = [];
    });

    rows.forEach((row) => {
      resources[row.category].push({
        id: row.id,
        resource_name: row.resource_name,
        status_page: row.status_page,
        favicon_url: row.favicon_url || "",
        check_type: row.check_type || "api",
        scrape_keywords: row.scrape_keywords || "",
        api_config: row.api_config || null,
        grade_level: row.category,
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

    const catRow = await db.get("SELECT id FROM categories WHERE name = ?", [
      category,
    ]);
    if (!catRow) return; // Should not happen if category exists

    await db.run(
      "INSERT OR IGNORE INTO resource_definitions (name, status_page, favicon_url, check_type, scrape_keywords, api_config) VALUES (?, ?, ?, ?, ?, ?)",
      [
        resource.resource_name,
        resource.status_page,
        resource.favicon_url || null,
        resource.check_type || "api",
        resource.scrape_keywords || "",
        resource.api_config || null,
      ],
    );

    await db.run(
      "UPDATE resource_definitions SET favicon_url = COALESCE(?, favicon_url), check_type = COALESCE(?, check_type), scrape_keywords = COALESCE(?, scrape_keywords), api_config = ? WHERE name = ? AND status_page = ?",
      [
        resource.favicon_url || null,
        resource.check_type || "api",
        resource.scrape_keywords !== undefined ? resource.scrape_keywords : "",
        resource.api_config !== undefined ? resource.api_config : null,
        resource.resource_name,
        resource.status_page,
      ],
    );
    const resRow = await db.get(
      "SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?",
      [resource.resource_name, resource.status_page],
    );

    await db.run(
      "INSERT OR IGNORE INTO resource_category_mapping (resource_id, category_id) VALUES (?, ?)",
      [resRow.id, catRow.id],
    );
  }

  async getResource(category, resourceName) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const row = await db.get(
      `
      SELECT c.name as category, r.name as resource_name, r.status_page, r.favicon_url, r.check_type, r.scrape_keywords, r.api_config 
        FROM resource_category_mapping m
        JOIN categories c ON m.category_id = c.id
        JOIN resource_definitions r ON m.resource_id = r.id
        WHERE c.name = ? AND r.name = ?
    `,
      [category, resourceName],
    );

    if (row) {
      return {
        category: row.category,
        resource_name: row.resource_name,
        status_page: row.status_page,
        favicon_url: row.favicon_url || "",
        check_type: row.check_type || "api",
        scrape_keywords: row.scrape_keywords || "",
        api_config: row.api_config || null,
        grade_level: row.category,
      };
    }
    return null;
  }

  async getCategories() {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all("SELECT name FROM categories");
    return rows.map((row) => row.name);
  }

  async getCategory(category) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all(
      `
      SELECT r.name as resource_name, r.status_page, r.favicon_url, r.check_type, r.scrape_keywords, r.api_config 
        FROM resource_category_mapping m
        JOIN categories c ON m.category_id = c.id
        JOIN resource_definitions r ON m.resource_id = r.id
        WHERE c.name = ?
    `,
      [category],
    );

    return rows.map((row) => ({
      resource_name: row.resource_name,
      status_page: row.status_page,
      favicon_url: row.favicon_url || "",
      check_type: row.check_type || "api",
      scrape_keywords: row.scrape_keywords || "",
      api_config: row.api_config || null,
      grade_level: category,
    }));
  }

  async getResourceCategories(resourceName) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all(
      `
        SELECT c.name 
        FROM resource_category_mapping m
        JOIN categories c ON m.category_id = c.id
        JOIN resource_definitions r ON m.resource_id = r.id
        WHERE r.name = ?
    `,
      [resourceName],
    );
    return rows.map((r) => r.name);
  }

  async getDefinition(resourceName) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const row = await db.get(
      "SELECT id, name as resource_name, status_page, favicon_url, check_type, scrape_keywords, api_config FROM resource_definitions WHERE name = ?",
      [resourceName],
    );
    if (!row) return null;
    return {
      id: row.id,
      resource_name: row.resource_name,
      status_page: row.status_page,
      favicon_url: row.favicon_url || "",
      check_type: row.check_type || "api",
      scrape_keywords: row.scrape_keywords || "",
      api_config: row.api_config || null,
    };
  }

  async logCheckError(resource, errorMessage) {
    await this.ready;
    const db = await this.dbManager.getDb();

    let resRow = null;
    try {
      resRow = await db.get(
        "SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?",
        [resource.resource_name, resource.status_page],
      );
    } catch (e) {}

    const resourceId = resRow ? resRow.id : null;

    await db.run(
      `INSERT INTO status_check_errors (resource_id, resource_name, status_page, check_type, error_message) VALUES (?, ?, ?, ?, ?)`,
      [
        resourceId,
        resource.resource_name || null,
        resource.status_page || null,
        resource.check_type || null,
        errorMessage || "",
      ],
    );
  }

  async getCheckErrors(limit = 200) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all(
      `
      SELECT
        id,
        resource_id,
        resource_name,
        status_page,
        check_type,
        error_message,
        datetime(created_at, 'localtime') as created_at
      FROM status_check_errors
      ORDER BY id DESC
      LIMIT ?
    `,
      [limit],
    );
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

    const affectedResources = await db.all(
      `
      SELECT DISTINCT r.name as resource_name
      FROM resource_category_mapping m
      JOIN categories c ON m.category_id = c.id
      JOIN resource_definitions r ON m.resource_id = r.id
      WHERE c.name = ?
    `,
      [category],
    );

    await db.run("DELETE FROM categories WHERE name = ?", [category]);

    for (const entry of affectedResources) {
      const remaining = await db.get(
        `
        SELECT COUNT(*) as count
        FROM resource_category_mapping m
        JOIN resource_definitions r ON m.resource_id = r.id
        WHERE r.name = ?
      `,
        [entry.resource_name],
      );

      if (!remaining || remaining.count === 0) {
        await this.dbManager.deleteIssueReportsByResourceName(
          entry.resource_name,
        );
      }
    }
  }

  async removeResource(category, resourceName) {
    await this.ready;
    const db = await this.dbManager.getDb();

    const catRow = await db.get("SELECT id FROM categories WHERE name = ?", [
      category,
    ]);
    const resRow = await db.get(
      "SELECT id FROM resource_definitions WHERE name = ?",
      [resourceName],
    );

    if (catRow && resRow) {
      await db.run(
        "DELETE FROM resource_category_mapping WHERE resource_id = ? AND category_id = ?",
        [resRow.id, catRow.id],
      );

      const remainingMappings = await db.get(
        "SELECT COUNT(*) as count FROM resource_category_mapping WHERE resource_id = ?",
        [resRow.id],
      );
      if (!remainingMappings || remainingMappings.count === 0) {
        await this.dbManager.deleteIssueReportsByResourceName(resourceName);
      }
    }
  }

  async getResourceCategoriesById(resourceId) {
    await this.ready;
    const db = await this.dbManager.getDb();
    const rows = await db.all(
      `SELECT c.name
         FROM resource_category_mapping m
         JOIN categories c ON m.category_id = c.id
         WHERE m.resource_id = ?`,
      [resourceId],
    );
    return rows.map((r) => r.name);
  }

  async removeResourceById(resourceId) {
    await this.ready;
    const db = await this.dbManager.getDb();

    const resRow = await db.get(
      "SELECT name FROM resource_definitions WHERE id = ?",
      [resourceId],
    );
    if (!resRow) return;

    await db.run(
      "DELETE FROM resource_category_mapping WHERE resource_id = ?",
      [resourceId],
    );
    await db.run(
      "DELETE FROM resource_definitions WHERE id = ?",
      [resourceId],
    );
    await this.dbManager.deleteIssueReportsByResourceName(resRow.name);
  }

  async updateResource(
    category,
    oldResourceName,
    {
      resource_name,
      status_page,
      favicon_url,
      check_type,
      scrape_keywords,
      api_config,
    },
  ) {
    await this.ready;
    const db = await this.dbManager.getDb();

    const oldResRow = await db.get(
      "SELECT id, favicon_url, check_type, scrape_keywords, api_config FROM resource_definitions WHERE name = ?",
      [oldResourceName],
    );
    if (!oldResRow) return;

    const nextFaviconUrl =
      favicon_url !== undefined ? favicon_url || null : oldResRow.favicon_url;
    await db.run(
      "UPDATE resource_definitions SET name = ?, status_page = ?, favicon_url = ?, check_type = ?, scrape_keywords = ?, api_config = ? WHERE id = ?",
      [
        resource_name,
        status_page,
        nextFaviconUrl,
        check_type || oldResRow.check_type,
        scrape_keywords || oldResRow.scrape_keywords,
        api_config !== undefined ? api_config : oldResRow.api_config,
        oldResRow.id,
      ],
    );
  }

  async updateCategory(oldCategory, newCategory) {
    await this.ready;
    const db = await this.dbManager.getDb();
    await db.run("UPDATE categories SET name = ? WHERE name = ?", [
      newCategory,
      oldCategory,
    ]);
  }
}

module.exports = new ResourceManager();
