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
    if (row.count > 0) {
      await this.#normalizeUsers();
      return;
    }

    // Init default settings
    await this.#setSetting("branding_logo", "logo.png");
    await this.#setSetting("branding_schoolName", "Your School Name");
    await this.#setSetting("refresh_interval_minutes", "30");
    bcrypt.genSalt(10, (_err, salt) => {
      bcrypt.hash("password", salt, (_err, hash) => {
        this.#setSetting("admin_user", JSON.stringify({ username: "admin", password: hash }));
        this.#setSetting("users", JSON.stringify([{ username: "admin", password: hash, role: "superadmin" }]));
      });
    });
    await this.#setSetting("setup_complete", "false");
  }

  async #normalizeUsers() {
    const usersRaw = await this.#getSetting("users");

    if (usersRaw) {
      try {
        const parsed = JSON.parse(usersRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed
            .filter(user => user && user.username && user.password)
            .map(user => ({
              username: user.username,
              password: user.password,
              role: user.role === 'resource_manager' ? 'resource_manager' : 'superadmin'
            }));

          if (normalized.length > 0) {
            await this.#setSetting("users", JSON.stringify(normalized));
            return normalized;
          }
        }
      } catch (_err) {
      }
    }

    const adminRaw = await this.#getSetting("admin_user");
    const parsedAdmin = adminRaw ? JSON.parse(adminRaw) : null;
    const fallback = [{
      username: parsedAdmin && parsedAdmin.username ? parsedAdmin.username : 'admin',
      password: parsedAdmin && parsedAdmin.password ? parsedAdmin.password : 'password',
      role: 'superadmin'
    }];
    await this.#setSetting("users", JSON.stringify(fallback));
    return fallback;
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
        this.#setSetting("users", JSON.stringify([{ username, password: hash, role: 'superadmin' }]));
      });
    });
  }

  async updateAdminUsername(username) {
    await this.ready;
    const currentUser = await this.getAdminUser();
    const user = { username, password: currentUser.password };
    await this.#setSetting("admin_user", JSON.stringify(user));

    const users = await this.#normalizeUsers();
    const updatedUsers = users.map(existing => {
      if (existing.role === 'superadmin') {
        return { ...existing, username };
      }
      return existing;
    });
    await this.#setSetting("users", JSON.stringify(updatedUsers));
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

  async getUsers() {
    await this.ready;
    const users = await this.#normalizeUsers();
    return users;
  }

  async getSafeUsers() {
    const users = await this.getUsers();
    return users.map(user => ({ username: user.username, role: user.role }));
  }

  async findUser(username) {
    const users = await this.getUsers();
    return users.find(user => user.username === username) || null;
  }

  async addResourceManagerUser(username, password) {
    await this.ready;
    const users = await this.getUsers();

    if (users.some(user => user.username === username)) {
      throw new Error('User already exists');
    }

    const hash = await bcrypt.hash(password, 10);
    users.push({ username, password: hash, role: 'resource_manager' });
    await this.#setSetting("users", JSON.stringify(users));
  }

  async removeUser(username) {
    await this.ready;
    const users = await this.getUsers();
    const target = users.find(user => user.username === username);
    if (!target) return;
    if (target.role === 'superadmin') {
      throw new Error('Cannot remove superadmin user');
    }

    const filtered = users.filter(user => user.username !== username);
    await this.#setSetting("users", JSON.stringify(filtered));
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