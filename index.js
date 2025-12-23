const express = require('express');
const server = express();

const bcrypt = require("bcrypt");
const session = require("express-session");

const configuration = require("./config/SetupManager");

const resources = require("./config/ResourceManager");

// Import routes
const setupRoute = require("./routes/setup");
const resourcesRoute = require("./routes/resources");

// Server setup
server.use(express.urlencoded({ extended: true }));
server.use(express.json());
server.set('view engine', 'ejs');
server.use(express.static('public'));
server.set('trust proxy', 1);
server.use(session({
  secret: "radar",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));

// Routing
server.use("/setup", setupRoute);
server.use("/resources", resourcesRoute);

server.get("/login", async (_request, response) => {
  response.render("login", {
    config: await configuration.getConfig()
  });
});

server.post("/login", async (request, response) => {
  const { username, password } = request.body;
  bcrypt.genSalt(10, (_err, salt) => {
    bcrypt.hash(password, salt, async (_err, hash) => {

      const user = JSON.parse(await configuration.getAdminUser());
      if (user.username !== username) return response.json({ status: 401, message: "inv_user" });
      if (user.password !== hash) return response.json({ status: 401, message: "inv_pass" });

      response.json({
        status: 200,
        username,
        password: hash
      });
    });
  });
});

server.get("/", async (request, response) => {
  if (request.host.split('.')[0] === "admin") {
    if (!request.session.user) {
      console.log("admin account not logged in");
      response.redirect("/login");
    } else {
      console.log("admin account logged in");
    }
  } else {
    if (await configuration.isSetupComplete()) {
      response.render("dashboard", {
        config: await configuration.getConfig(),
        resources: await resources.getResources()
      });
    } else {
      response.render("setup", {
        config: await configuration.getConfig()
      });
    }
  }

});

server.listen(80, "0.0.0.0", () => console.log("Radar live."));