require("dotenv").config();
const express = require("express");
const server = express();
const session = require("express-session");
const MemoryStore = require("memorystore")(session);

const configuration = require("./config/SetupManager");
const resources = require("./config/ResourceManager");
const statusChecker = require("./config/StatusChecker");
const dbManager = require("./config/DatabaseManager");

const setupRoute = require("./routes/setup");
const resourcesRoute = require("./routes/resources");
const adminRoute = require("./routes/admin");
const loginRoute = require("./routes/login");
const apiRoute = require("./routes/api");

server.use(express.urlencoded({ extended: true }));
server.use(express.json());
server.set("view engine", "ejs");
server.use(express.static("public"));
server.set("trust proxy", 1);
server.use(
  session({
    secret: "radar",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
  }),
);
server.disable("x-powered-by");

server.use("/setup", setupRoute);
server.use("/resources", resourcesRoute);
server.use("/admin", adminRoute);
server.use("/login", loginRoute);
server.use("/api", apiRoute);

server.get("/logout", async (request, response) => {
  request.session.destroy();
  response.redirect("/login");
});

server.get("/", async (request, response) => {
  if (await configuration.isSetupComplete()) {
    const [configData, resourcesData, statuses, issueReports, announcements] =
      await Promise.all([
        configuration.getConfig(),
        resources.getResources(),
        dbManager.getAllResourceStatuses(),
        dbManager.getActiveIssueReports(),
        dbManager.getActiveAnnouncements(),
      ]);

    response.render("dashboard", {
      config: configData,
      resources: resourcesData,
      statuses: statuses,
      issueReports: issueReports,
      announcements: announcements,
      lotrMode: request.query.lotr === "true",
      query: request.query || {},
      currentUrl: request.originalUrl || "/",
    });
  } else {
    response.render("setup", {
      config: await configuration.getConfig(),
    });
  }
});

const PORT = process.env.PORT || 80;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, async () => {
  console.log(`Radar live on ${HOST}:${PORT}`);

  try {
    await dbManager.clearExpiredAnnouncements();
  } catch (cleanupError) {
    console.error(
      "[Server] Failed initial announcement cleanup:",
      cleanupError.message,
    );
  }

  setInterval(
    async () => {
      try {
        await dbManager.clearExpiredAnnouncements();
      } catch (cleanupError) {
        console.error(
          "[Server] Failed to clear expired announcements:",
          cleanupError.message,
        );
      }
    },
    5 * 60 * 1000,
  );

  if (await configuration.isSetupComplete()) {
    const config = await configuration.getConfig();
    const intervalMs = config.refreshIntervalMinutes * 60 * 1000;
    console.log(
      `[Server] Starting status checker with ${config.refreshIntervalMinutes} minute interval...`,
    );
    statusChecker.start(intervalMs);
  }
});
