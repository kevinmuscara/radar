const DatabaseManager = require("./DatabaseManager");
const { readFileSync, existsSync } = require("fs");
const path = require("path");

class SetupManager {
  constructor() {
    this.dbManager = DatabaseManager;
    this.config = {
      branding: { logo: "", schoolName: "" },
      adminUser: {
        username: "admin",
        password: "password"
      },
      setupComplete: false
    };
    this.logo = "";
    this.schoolName = "";
    this.adminUser = {
      username: "admin",
      password: "password"
    };
    this.setupComplete = false;
  }

  async #getSetting(key) {
    const db = await this.dbManager.getDb();
    const result = await db.get("SELECT value FROM settings WHERE key = ?", [key]);
    return result ? result.value : null;
  }

  async #setSetting(key, value) {
    const db = await this.dbManager.getDb();
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  }

  async migrateIfNeeded() {
    const db = await this.dbManager.getDb();
    const row = await db.get("SELECT count(*) as count FROM settings");
    if (row.count > 0) return;

    // DB is empty, try to load from JSON
    const jsonPath = path.resolve(__dirname, "config.json");
    if (existsSync(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
        await this.#setSetting("branding_logo", data.branding.logo);
        await this.#setSetting("branding_schoolName", data.branding.schoolName);
        await this.#setSetting("admin_user", JSON.stringify(data.adminUser));
        await this.#setSetting("setup_complete", String(data.setupComplete));
        console.log("Migrated config.json to SQLite");
      } catch (e) {
        console.error("Failed to migrate config.json", e);
      }
    }
  }

  async reloadConfig() {
    await this.migrateIfNeeded();

    const logo = await this.#getSetting("branding_logo");
    const schoolName = await this.#getSetting("branding_schoolName");
    const adminUser = await this.#getSetting("admin_user");
    const setupComplete = await this.#getSetting("setup_complete");

    this.logo = logo || "";
    this.schoolName = schoolName || "";
    this.adminUser = adminUser ? JSON.parse(adminUser) : null;
    this.setupComplete = setupComplete === "true";

    this.config = {
      branding: {
        logo: this.logo,
        schoolName: this.schoolName
      },
      adminUser: this.adminUser,
      setupComplete: this.setupComplete
    };
  }

  async completeSetup() {
    this.setupComplete = true;
    this.config.setupComplete = true;
    await this.#setSetting("setup_complete", "true");
  }

  async uncompleteSetup() {
    this.setupComplete = false;
    this.config.setupComplete = false;
    await this.#setSetting("setup_complete", "false");
  }

  async updateBrandingLogo(pathToLogo) {
    this.logo = pathToLogo;
    this.config.branding.logo = pathToLogo;
    await this.#setSetting("branding_logo", pathToLogo);
  }

  async updateBrandingSchoolName(schoolName) {
    this.schoolName = schoolName;
    this.config.branding.schoolName = schoolName;
    await this.#setSetting("branding_schoolName", schoolName);
  }

  async updateAdminUser(username, password) {
    const user = { username, password };
    this.adminUser = user;
    this.config.adminUser = user;
    await this.#setSetting("admin_user", JSON.stringify(user));
  }

  getBrandingLogo() {
    return this.logo;
  }

  getBrandingSchoolName() {
    return this.schoolName;
  }

  getAdminUser() {
    return this.adminUser;
  }

  getConfig() {
    return this.config;
  }

  isSetupComplete() {
    return this.setupComplete;
  }
}

module.exports = SetupManager;