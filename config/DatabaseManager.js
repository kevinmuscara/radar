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
              favicon_url TEXT DEFAULT NULL,
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

            CREATE TABLE IF NOT EXISTS resource_issue_reports (
              resource_name TEXT PRIMARY KEY,
              report_count INTEGER NOT NULL DEFAULT 1,
              first_reported_at DATETIME NOT NULL,
              expires_at DATETIME NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS resource_issue_report_submissions (
              resource_name TEXT NOT NULL,
              reporter_key TEXT NOT NULL,
              reported_at DATETIME NOT NULL,
              PRIMARY KEY (resource_name, reporter_key)
            );

            CREATE TABLE IF NOT EXISTS announcements (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              message TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'informative',
              expires_at DATETIME NOT NULL,
              created_by TEXT,
              created_by_role TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_resource_status_cache_resource_id 
            ON resource_status_cache(resource_id);
            
            CREATE INDEX IF NOT EXISTS idx_resource_status_cache_resource_name 
            ON resource_status_cache(resource_name);

            CREATE INDEX IF NOT EXISTS idx_resource_issue_reports_expires_at
            ON resource_issue_reports(expires_at);

            CREATE INDEX IF NOT EXISTS idx_resource_issue_report_submissions_reported_at
            ON resource_issue_report_submissions(reported_at);

            CREATE INDEX IF NOT EXISTS idx_announcements_expires_at
            ON announcements(expires_at);
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
      if (!colNames.includes('favicon_url')) {
        await db.exec("ALTER TABLE resource_definitions ADD COLUMN favicon_url TEXT DEFAULT NULL;");
      }
    } catch (e) {
      console.error('Error ensuring resource_definitions columns:', e.message);
    }

    await this.ensureAnnouncementsSchema(db);

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

    // Ensure report_count exists on resource_issue_reports for existing DBs
    try {
      const issueCols = await db.all("PRAGMA table_info('resource_issue_reports')");
      const issueColNames = issueCols.map(c => c.name);
      if (!issueColNames.includes('report_count')) {
        await db.exec("ALTER TABLE resource_issue_reports ADD COLUMN report_count INTEGER NOT NULL DEFAULT 1;");
      }
      await db.exec("UPDATE resource_issue_reports SET report_count = 1 WHERE report_count IS NULL OR report_count < 1;");
    } catch (e) {
      console.error('Error ensuring resource_issue_reports columns:', e.message);
    }

    // Ensure resource_issue_report_submissions exists for existing DBs
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS resource_issue_report_submissions (
          resource_name TEXT NOT NULL,
          reporter_key TEXT NOT NULL,
          reported_at DATETIME NOT NULL,
          PRIMARY KEY (resource_name, reporter_key)
        );
      `);

      const submissionCols = await db.all("PRAGMA table_info('resource_issue_report_submissions')");
      const submissionColNames = submissionCols.map(c => c.name);
      if (!submissionColNames.includes('resource_name')) {
        await db.exec("ALTER TABLE resource_issue_report_submissions ADD COLUMN resource_name TEXT;");
      }
      if (!submissionColNames.includes('reporter_key')) {
        await db.exec("ALTER TABLE resource_issue_report_submissions ADD COLUMN reporter_key TEXT;");
      }
      if (!submissionColNames.includes('reported_at')) {
        await db.exec("ALTER TABLE resource_issue_report_submissions ADD COLUMN reported_at DATETIME;");
      }

      await db.exec("CREATE INDEX IF NOT EXISTS idx_resource_issue_report_submissions_reported_at ON resource_issue_report_submissions(reported_at);");
      await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_issue_report_submissions_resource_reporter ON resource_issue_report_submissions(resource_name, reporter_key);");
      await db.exec("DELETE FROM resource_issue_report_submissions WHERE resource_name IS NULL OR reporter_key IS NULL OR reported_at IS NULL;");
    } catch (e) {
      console.error('Error ensuring resource_issue_report_submissions schema:', e.message);
    }

    return db;
  }

  async getDb() {
    return this.dbPromise;
  }

  normalizeAnnouncementType(type) {
    const normalized = String(type || '').trim().toLowerCase();
    const allowedTypes = new Set(['informative', 'warning', 'danger', 'success']);
    return allowedTypes.has(normalized) ? normalized : 'informative';
  }

  async ensureAnnouncementsSchema(db) {
    const database = db || await this.getDb();

    try {
      const announcementCols = await database.all("PRAGMA table_info('announcements')");
      const announcementColNames = announcementCols.map((c) => c.name);
      const hasTypeColumn = announcementColNames.includes('type');

      if (!hasTypeColumn) {
        await database.exec("ALTER TABLE announcements ADD COLUMN type TEXT DEFAULT 'informative';");
      }

      await database.exec(`
        UPDATE announcements
        SET type = 'informative'
        WHERE type IS NULL
          OR trim(type) = ''
          OR lower(type) NOT IN ('informative', 'warning', 'danger', 'success');
      `);
    } catch (e) {
      console.error('Error ensuring announcements schema:', e.message);
    }
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

  async clearExpiredIssueReports() {
    const db = await this.getDb();
    await db.run("DELETE FROM resource_issue_reports WHERE expires_at <= datetime('now')");
  }

  async clearExpiredIssueReportSubmissions() {
    const db = await this.getDb();
    await db.run("DELETE FROM resource_issue_report_submissions WHERE reported_at <= datetime('now', '-1 hour')");
  }

  async reportIssue(resourceName, reporterKey) {
    const db = await this.getDb();
    await this.clearExpiredIssueReports();
    await this.clearExpiredIssueReportSubmissions();

    const normalizedReporterKey = String(reporterKey || '').trim();
    if (!normalizedReporterKey) {
      throw new Error('reporterKey is required');
    }

    const recentSubmission = await db.get(
      "SELECT reported_at FROM resource_issue_report_submissions WHERE resource_name = ? AND reporter_key = ? AND reported_at > datetime('now', '-1 hour')",
      [resourceName, normalizedReporterKey]
    );

    if (recentSubmission) {
      const existingReport = await db.get(
        "SELECT resource_name, report_count, first_reported_at, expires_at FROM resource_issue_reports WHERE resource_name = ?",
        [resourceName]
      );

      const retryAfterSecondsRow = await db.get(
        "SELECT CAST((julianday(reported_at, '+1 hour') - julianday('now')) * 86400 AS INTEGER) AS retry_after_seconds FROM resource_issue_report_submissions WHERE resource_name = ? AND reporter_key = ?",
        [resourceName, normalizedReporterKey]
      );

      return {
        limited: true,
        report: existingReport || null,
        retryAfterSeconds: Math.max((retryAfterSecondsRow && retryAfterSecondsRow.retry_after_seconds) || 0, 0)
      };
    }

    const updateSubmission = await db.run(
      "UPDATE resource_issue_report_submissions SET reported_at = datetime('now') WHERE resource_name = ? AND reporter_key = ?",
      [resourceName, normalizedReporterKey]
    );

    if (!updateSubmission || !updateSubmission.changes) {
      await db.run(
        "INSERT INTO resource_issue_report_submissions (resource_name, reporter_key, reported_at) VALUES (?, ?, datetime('now'))",
        [resourceName, normalizedReporterKey]
      );
    }

    const existing = await db.get(
      "SELECT resource_name, report_count, first_reported_at, expires_at FROM resource_issue_reports WHERE resource_name = ?",
      [resourceName]
    );

    if (existing) {
      await db.run(
        "UPDATE resource_issue_reports SET report_count = report_count + 1 WHERE resource_name = ?",
        [resourceName]
      );
      return db.get(
        "SELECT resource_name, report_count, first_reported_at, expires_at FROM resource_issue_reports WHERE resource_name = ?",
        [resourceName]
      );
    }

    await db.run(
      "INSERT INTO resource_issue_reports (resource_name, report_count, first_reported_at, expires_at) VALUES (?, 1, datetime('now'), datetime('now', '+1 hour'))",
      [resourceName]
    );

    const report = await db.get(
      "SELECT resource_name, report_count, first_reported_at, expires_at FROM resource_issue_reports WHERE resource_name = ?",
      [resourceName]
    );

    return {
      limited: false,
      report
    };
  }

  async getActiveIssueReports() {
    const db = await this.getDb();
    await this.clearExpiredIssueReports();
    return db.all(
      "SELECT resource_name, report_count, first_reported_at, expires_at FROM resource_issue_reports WHERE expires_at > datetime('now')"
    );
  }

  async deleteIssueReportsByResourceName(resourceName) {
    const db = await this.getDb();
    await db.run('DELETE FROM resource_issue_reports WHERE resource_name = ?', [resourceName]);
    await db.run('DELETE FROM resource_issue_report_submissions WHERE resource_name = ?', [resourceName]);
  }

  async clearIssueReportStateByResourceName(resourceName) {
    const db = await this.getDb();
    const reportResult = await db.run('DELETE FROM resource_issue_reports WHERE resource_name = ?', [resourceName]);
    const submissionResult = await db.run('DELETE FROM resource_issue_report_submissions WHERE resource_name = ?', [resourceName]);

    return {
      cleared: (reportResult?.changes || 0) > 0 || (submissionResult?.changes || 0) > 0,
      reportRows: reportResult?.changes || 0,
      submissionRows: submissionResult?.changes || 0
    };
  }

  async clearExpiredAnnouncements() {
    const db = await this.getDb();
    await this.ensureAnnouncementsSchema(db);
    await db.run("DELETE FROM announcements WHERE expires_at <= datetime('now', 'localtime')");
  }

  async createAnnouncement(message, expiresAt, createdBy, createdByRole, type = 'informative') {
    const db = await this.getDb();
    await this.ensureAnnouncementsSchema(db);
    await this.clearExpiredAnnouncements();
    const normalizedType = this.normalizeAnnouncementType(type);

    try {
      const result = await db.run(
        'INSERT INTO announcements (message, type, expires_at, created_by, created_by_role) VALUES (?, ?, ?, ?, ?)',
        [message, normalizedType, expiresAt, createdBy || null, createdByRole || null]
      );

      return db.get(
        'SELECT id, message, type, expires_at, created_by, created_by_role, created_at FROM announcements WHERE id = ?',
        [result.lastID]
      );
    } catch (error) {
      if (!String(error?.message || '').includes('type')) throw error;

      const result = await db.run(
        'INSERT INTO announcements (message, expires_at, created_by, created_by_role) VALUES (?, ?, ?, ?)',
        [message, expiresAt, createdBy || null, createdByRole || null]
      );

      const announcement = await db.get(
        'SELECT id, message, expires_at, created_by, created_by_role, created_at FROM announcements WHERE id = ?',
        [result.lastID]
      );

      return {
        ...announcement,
        type: 'informative'
      };
    }
  }

  async getActiveAnnouncements() {
    const db = await this.getDb();
    await this.ensureAnnouncementsSchema(db);
    await this.clearExpiredAnnouncements();
    try {
      return db.all(
        "SELECT id, message, type, expires_at, created_by, created_by_role, created_at FROM announcements WHERE expires_at > datetime('now', 'localtime') ORDER BY created_at DESC"
      );
    } catch (error) {
      if (!String(error?.message || '').includes('type')) throw error;

      const rows = await db.all(
        "SELECT id, message, expires_at, created_by, created_by_role, created_at FROM announcements WHERE expires_at > datetime('now', 'localtime') ORDER BY created_at DESC"
      );

      return rows.map((row) => ({ ...row, type: 'informative' }));
    }
  }

  async revokeAnnouncement(id) {
    const db = await this.getDb();
    const result = await db.run('DELETE FROM announcements WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async logStatusCheckError(resourceId, resourceName, statusPage, checkType, errorMessage) {
    const db = await this.getDb();
    await db.run(
      'INSERT INTO status_check_errors (resource_id, resource_name, status_page, check_type, error_message) VALUES (?, ?, ?, ?, ?)',
      [resourceId || null, resourceName, statusPage, checkType, errorMessage]
    );
  }
}

// Singleton instance
const instance = new DatabaseManager();
module.exports = instance;
