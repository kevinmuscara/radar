const express = require("express");
const router = express.Router();

const configuration = require("../config/SetupManager");
const resources = require("../config/ResourceManager");

router.get("/", async (request, response) => {
  if (!request.session.user) {
    response.redirect("/login");
  } else {
    const isSuperAdmin = (request.session.user.role || 'superadmin') === 'superadmin';
    response.render("admin", {
      config: await configuration.getConfig(),
      resources: await resources.getResources(),
      allCategories: await resources.getCategories(),
      currentUser: request.session.user,
      isSuperAdmin
    });
  }
});

module.exports = router;