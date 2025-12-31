require('dotenv').config();
const express = require('express');
const server = express();
const session = require("express-session");
const MemoryStore = require("memorystore")(session);

const configuration = require("./config/SetupManager");
const resources = require("./config/ResourceManager");

// Import routes
const setupRoute = require("./routes/setup");
const resourcesRoute = require("./routes/resources");
const adminRoute = require("./routes/admin");
const loginRoute = require("./routes/login");
const apiRoute = require("./routes/api");

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
  cookie: { secure: false },
  store: new MemoryStore({
    checkPeriod: 86400000
  })
}));
server.disable("x-powered-by");

// Routing
server.use("/setup", setupRoute);
server.use("/resources", resourcesRoute);
server.use("/admin", adminRoute);
server.use("/login", loginRoute);
server.use("/api", apiRoute);

server.get("/fake-summary.json", (_request, response) => {
  response.json({
    status: {
      indicator: "major",
      description: "Service Outage",
    },
    scheduled_maintenance: [],
    incidents: [],
    components: [
      {
        id: "1",
        name: "Fake Data",
        status: "outage",
        "created_at": "2025-12-22T15:36:22.503-07:00",
        "updated_at": "2025-12-29T15:39:49.276-07:00",
        "position": 1,
        "description": "Fake Data API for testing",
        "showcase": false,
        "start_date": null,
        "group_id": "tq9rr6n61grw",
        "page_id": "mrrn21wjyltb",
        "group": false,
        "only_show_if_degraded": false
      }
    ],
    page: {
      id: "mrrn21wjyltb",
      name: "Fake Data"
    }
  })
})

server.get("/logout", async (request, response) => {
  request.session.destroy();
  response.redirect("/login");
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

const PORT = process.env.PORT || 80;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => console.log(`Radar live on ${HOST}:${PORT}`));