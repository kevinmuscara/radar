const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

class DatabaseManager {
  constructor() {
    this.dbPromise = this.init();
  }

  async init() {
    const dbPath = path.join(__dirname, '../database.sqlite');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await db.exec(`
            CREATE TABLE IF NOT EXISTS resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                resource_name TEXT NOT NULL,
                status_page TEXT,
                grade_level TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);

    return db;
  }

  async getDb() {
    return this.dbPromise;
  }
}

// Singleton instance
const instance = new DatabaseManager();
module.exports = instance;
