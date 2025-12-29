const express = require("express");
const router = express.Router();

const configuration = require("../config/SetupManager");
const bcrypt = require("bcrypt");

router.get("/", async (request, response) => {
  if (!request.session.user) {
    response.render("login", {
      config: await configuration.getConfig()
    });
  } else {
    response.redirect("/admin");
  }
});

router.post("/", async (request, response) => {
  const { username, password } = request.body;
  const admin_user = await configuration.getAdminUser();

  if (admin_user.username == username) {
    bcrypt.compare(password, admin_user.password, (_err, res) => {
      if (res) {
        request.session.regenerate((err) => {
          if (err) {
            console.error(err);
            response.json({ status: 500, message: "server_err" });
          }

          request.session.user = admin_user;

          request.session.save((err) => {
            if (err) {
              console.error(err);
              response.json({ status: 500, message: "server_err" });
            }

            response.redirect("/admin");
          });
        });
      } else {
        response.json({ status: 401, message: "inv_pass" });
      }
    });
  } else {
    response.json({ status: 401, message: "inv_user" });
  }
});

module.exports = router;