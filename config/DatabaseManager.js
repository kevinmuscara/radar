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

            CREATE TABLE IF NOT EXISTS resource_status_cache (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              resource_id INTEGER,
              resource_name TEXT NOT NULL UNIQUE,
              status TEXT NOT NULL,
              status_url TEXT,
              last_checked DATETIME NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (resource_id) REFERENCES resource_definitions(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_resource_status_cache_resource_id 
            ON resource_status_cache(resource_id);
            
            CREATE INDEX IF NOT EXISTS idx_resource_status_cache_resource_name 
            ON resource_status_cache(resource_name);
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

    // Fix resource_status_cache table if it has the wrong schema
    try {
      const cacheTableInfo = await db.all("PRAGMA table_info('resource_status_cache')");
      if (cacheTableInfo.length > 0) {
        // Check if resource_id is NOT NULL
        const resourceIdCol = cacheTableInfo.find(c => c.name === 'resource_id');
        const resourceNameCol = cacheTableInfo.find(c => c.name === 'resource_name');
        
        // Check if we need to migrate (resource_id is NOT NULL or resource_name is not UNIQUE)
        if (resourceIdCol && resourceIdCol.notnull === 1) {
          console.log('[DatabaseManager] Migrating resource_status_cache table to new schema...');
          
          // Save existing data
          const existingData = await db.all('SELECT * FROM resource_status_cache');
          
          // Drop old table
          await db.exec('DROP TABLE IF EXISTS resource_status_cache');
          
          // Create new table with correct schema
          await db.exec(`
            CREATE TABLE resource_status_cache (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              resource_id INTEGER,
              resource_name TEXT NOT NULL UNIQUE,
              status TEXT NOT NULL,
              status_url TEXT,
              last_checked DATETIME NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (resource_id) REFERENCES resource_definitions(id) ON DELETE CASCADE
            );

            CREATE INDEX idx_resource_status_cache_resource_id 
            ON resource_status_cache(resource_id);
            
            CREATE INDEX idx_resource_status_cache_resource_name 
            ON resource_status_cache(resource_name);
          `);
          
          // Restore data
          for (const row of existingData) {
            try {
              await db.run(
                'INSERT INTO resource_status_cache (resource_id, resource_name, status, status_url, last_checked, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [row.resource_id || null, row.resource_name, row.status, row.status_url, row.last_checked, row.created_at]
              );
            } catch (insertError) {
              console.warn(`[DatabaseManager] Could not restore status for ${row.resource_name}:`, insertError.message);
            }
          }
          
          console.log('[DatabaseManager] Migration complete');
        }
      }
    } catch (e) {
      console.error('Error migrating resource_status_cache table:', e.message);
    }

    return db;
  }

  async getDb() {
    return this.dbPromise;
  }

  // Methods for resource_status_cache
  async updateResourceStatus(resourceId, resourceName, status, statusUrl, lastChecked) {
    const db = await this.getDb();
    // Delete old status for this resource by name (more reliable)
    await db.run('DELETE FROM resource_status_cache WHERE resource_name = ?', [resourceName]);
    // Insert new status
    await db.run(
      'INSERT INTO resource_status_cache (resource_id, resource_name, status, status_url, last_checked) VALUES (?, ?, ?, ?, ?)',
      [resourceId || null, resourceName, status, statusUrl, lastChecked]
    );
  }

  async getResourceStatus(resourceId) {
    const db = await this.getDb();
    return db.get('SELECT * FROM resource_status_cache WHERE resource_id = ?', [resourceId]);
  }

  async getAllResourceStatuses() {
    const db = await this.getDb();
    return db.all('SELECT * FROM resource_status_cache ORDER BY resource_name');
  }

  async getResourceStatusByName(resourceName) {
    const db = await this.getDb();
    return db.get('SELECT * FROM resource_status_cache WHERE resource_name = ?', [resourceName]);
  }
}

// Singleton instance
const instance = new DatabaseManager();
module.exports = instance;
