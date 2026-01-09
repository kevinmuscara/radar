const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

class DatabaseManager {
  constructor() {
    this.dbPromise = this.init();
  }

  async init() {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON;');

    await db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS resource_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
              status_page TEXT NOT NULL,
              check_type TEXT DEFAULT 'api',
              scrape_keywords TEXT DEFAULT '',
              api_config TEXT DEFAULT NULL,
              UNIQUE(name, status_page)
            );

            CREATE TABLE IF NOT EXISTS resource_category_mapping (
                resource_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                PRIMARY KEY (resource_id, category_id),
                FOREIGN KEY (resource_id) REFERENCES resource_definitions(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS status_check_errors (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              resource_id INTEGER,
              resource_name TEXT,
              status_page TEXT,
              check_type TEXT,
              error_message TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (resource_id) REFERENCES resource_definitions(id) ON DELETE SET NULL
            );
        `);

    // Check for potential migration
    const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='resources'");
    if (tableExists) {
      const oldResources = await db.all("SELECT * FROM resources");

      for (const row of oldResources) {
        // 1. Ensure category exists
        await db.run("INSERT OR IGNORE INTO categories (name) VALUES (?)", [row.category]);
        const category = await db.get("SELECT id FROM categories WHERE name = ?", [row.category]);

        // 2. Ensure resource definition exists
        // We use name and status_page as the unique key for valid resources.
        // If status_page is null/empty for some reason, we handle it.
        const rName = row.resource_name || "";
        const rUrl = row.status_page || "";

        // Allow blank resources (categories sometimes initialized with blanks)? 
        // Original code allowed blank resource_name for just creating a category.
        // If resource_name is empty, we don't create a resource definition, we just ensured the category exists above.
        if (rName.trim() !== "") {
          await db.run("INSERT OR IGNORE INTO resource_definitions (name, status_page) VALUES (?, ?)", [rName, rUrl]);
          const resource = await db.get("SELECT id FROM resource_definitions WHERE name = ? AND status_page = ?", [rName, rUrl]);

          // 3. Create Mapping
          if (resource && category) {
            await db.run("INSERT OR IGNORE INTO resource_category_mapping (resource_id, category_id) VALUES (?, ?)", [resource.id, category.id]);
          }
        }
      }

      await db.exec("ALTER TABLE resources RENAME TO resources_backup_" + Date.now());
    }

    // Ensure new columns exist on resource_definitions for existing DBs
    try {
      const cols = await db.all("PRAGMA table_info('resource_definitions')");
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('check_type')) {
        await db.exec("ALTER TABLE resource_definitions ADD COLUMN check_type TEXT DEFAULT 'api';");
      }
      if (!colNames.includes('scrape_keywords')) {
        await db.exec("ALTER TABLE resource_definitions ADD COLUMN scrape_keywords TEXT DEFAULT '';");
      }
    } catch (e) {
      console.error('Error ensuring resource_definitions columns:', e.message);
    }

    return db;
  }

  async getDb() {
    return this.dbPromise;
  }
}

// Singleton instance
const instance = new DatabaseManager();
module.exports = instance;
