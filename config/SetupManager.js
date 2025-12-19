//The SetupManager is used to manage the configuration state/variables in the initial setup process of Radar.
const { readFileSync, writeFileSync } = require("fs");

class SetupManager {
  constructor(pathToConfig) {
    this.pathToConfig = pathToConfig;
    this.config = JSON.parse(readFileSync(pathToConfig, "utf-8"));

    this.logo = this.config.branding.logo;
    this.schoolName = this.config.branding.schoolName;
    this.adminUser = this.config.adminUser;
    this.setupComplete = this.config.setupComplete;
  }

  // updates the config file
  #updateConfigFile() {
    try {
      writeFileSync(this.pathToConfig, JSON.stringify({
        setupComplete: this.setupComplete,
        branding: {
          logo: this.logo,
          schoolName: this.schoolName
        },
        adminUser: this.adminUser
      }));
    } catch (error) {
      console.log(error);
    }
  }

  // marks setup as complete and updates the config file
  completeSetup() {
    this.setupComplete = true;
    this.config.setupComplete = true;

    try {
      this.#updateConfigFile();
    } catch (error) {
      console.log(error);
    }
  }

  // updates the branding logo and updates the config file
  updateBrandingLogo(pathToLogo) {
    this.logo = pathToLogo;
    this.config.branding.logo = pathToLogo;

    try {
      this.#updateConfigFile();
    } catch (error) {
      console.log(error);
    }
  }

  // updates the branding school name and updates the config file
  updateBrandingSchoolName(schoolName) {
    this.schoolName = schoolName;
    this.config.branding.schoolName = schoolName;

    try {
      this.#updateConfigFile();
    } catch (error) {
      console.log(error);
    }
  }

  // updates the admin user and updates the config file
  updateAdminUser(username, password) {
    this.adminUser = { username, password };
    this.config.adminUser = { username, password };

    try {
      this.#updateConfigFile();
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = SetupManager;