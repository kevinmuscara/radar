const express = require('express');
const server = express();

const SetupManager = require("./config/SetupManager");
const configuration = new SetupManager();

// Import routes
const setup = require("./routes/setup");
const resources = require("./routes/resources");

// Server setup
server.use(express.urlencoded({ extended: true }));
server.use(express.json());
server.set('view engine', 'ejs');
server.use(express.static('public'));

// Routing
server.use("/setup", setup);
server.use("/resources", resources);

server.get("/", async (_request, response) => {
  await configuration.reloadConfig();
  if (configuration.isSetupComplete()) {
    // Proceed to dashboard
    response.json({ status: 200 });
  } else {
    // Setup not complete, render setup page.
    response.render("setup", {
      config: configuration.getConfig()
    });
  }
});

server.listen(80, "0.0.0.0", () => console.log("Radar live."));