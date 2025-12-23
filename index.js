const express = require('express');
const server = express();

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

// Routing
server.use("/setup", setupRoute);
server.use("/resources", resourcesRoute);

server.get("/data", async (_request, response) => {
  response.json({
    config: await configuration.getConfig(),
    resources: await resources.getResources()
  });
});

server.get("/", async (_request, response) => {
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
});

server.listen(80, "0.0.0.0", () => console.log("Radar live."));