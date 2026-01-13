const DatabaseManager = require("./DatabaseManager");
const bcrypt = require("bcrypt");

class SetupManager {
  constructor() {
    this.dbManager = DatabaseManager;
    this.ready = this.initDefaults();
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

  async initDefaults() {
    const db = await this.dbManager.getDb();
    const row = await db.get("SELECT count(*) as count FROM settings");
    if (row.count > 0) return;

    // Init default settings
    await this.#setSetting("branding_logo", "logo.png");
    await this.#setSetting("branding_schoolName", "Your School Name");
    await this.#setSetting("refresh_interval_minutes", "30");
    bcrypt.genSalt(10, (_err, salt) => {
      bcrypt.hash("password", salt, (_err, hash) => {
        this.#setSetting("admin_user", JSON.stringify({ username: "admin", password: hash }));
      });
    });
    await this.#setSetting("setup_complete", "false");
  }

  async completeSetup() {
    await this.ready;
    await this.#setSetting("setup_complete", "true");
  }

  async uncompleteSetup() {
    await this.ready;
    await this.#setSetting("setup_complete", "false");
  }

  async updateBrandingLogo(pathToLogo) {
    await this.ready;
    await this.#setSetting("branding_logo", pathToLogo);
  }

  async updateBrandingSchoolName(schoolName) {
    await this.ready;
    await this.#setSetting("branding_schoolName", schoolName);
  }

  async updateAdminUser(username, password) {
    await this.ready;
    const user = { username, password };

    bcrypt.genSalt(10, (_err, salt) => {
      bcrypt.hash(password, salt, (_err, hash) => {
        user.password = hash;
        this.#setSetting("admin_user", JSON.stringify(user));
      });
    });
  }

  async getBrandingLogo() {
    await this.ready;
    const val = await this.#getSetting("branding_logo");
    return val || "logo.png";
  }

  async getBrandingSchoolName() {
    await this.ready;
    const val = await this.#getSetting("branding_schoolName");
    return val || "Your School Name";
  }

  async getAdminUser() {
    await this.ready;
    const val = await this.#getSetting("admin_user");
    return val ? JSON.parse(val) : { username: "admin", password: "password" };
  }

  async getRefreshIntervalMinutes() {
    await this.ready;
    const val = await this.#getSetting("refresh_interval_minutes");
    return val ? parseInt(val, 10) : 30;
  }

  async updateRefreshIntervalMinutes(minutes) {
    await this.ready;
    const value = Math.max(1, Math.min(60, parseInt(minutes, 10) || 5)); // Clamp between 1-60 minutes
    await this.#setSetting("refresh_interval_minutes", String(value));
  }

  async getConfig() {
    const logo = await this.getBrandingLogo();
    const schoolName = await this.getBrandingSchoolName();
    const adminUser = await this.getAdminUser();
    const setupComplete = await this.isSetupComplete();
    const refreshIntervalMinutes = await this.getRefreshIntervalMinutes();

    return {
      branding: {
        logo,
        schoolName
      },
      adminUser,
      setupComplete,
      refreshIntervalMinutes
    };
  }

  async isSetupComplete() {
    await this.ready;
    const val = await this.#getSetting("setup_complete");
    return val === "true";
  }
}

module.exports = new SetupManager();