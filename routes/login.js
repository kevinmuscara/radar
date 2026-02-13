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
  const users = await configuration.getUsers();
  const matchedUser = users.find(user => user.username === username);

  if (!matchedUser) {
    response.json({ status: 401, message: "inv_user" });
    return;
  }

  bcrypt.compare(password, matchedUser.password, (_err, isValid) => {
    if (isValid) {
      request.session.regenerate((err) => {
        if (err) {
          console.error(err);
          response.json({ status: 500, message: "server_err" });
          return;
        }

        request.session.user = {
          username: matchedUser.username,
          role: matchedUser.role || 'superadmin'
        };

        request.session.save((saveErr) => {
          if (saveErr) {
            console.error(saveErr);
            response.json({ status: 500, message: "server_err" });
            return;
          }

          response.redirect("/admin");
        });
      });
    } else {
      response.json({ status: 401, message: "inv_pass" });
    }
  });
});

module.exports = router;