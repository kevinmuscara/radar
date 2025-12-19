const express = require('express');
const server = express();

// const SetupManager = require("./config/SetupManager");
// const configuration = new SetupManager("./config/config.json");

// routes
const setup = require("./routes/setup");

server.use(express.urlencoded({ extended: true }));
server.use(express.json());

server.use("/setup", setup);

server.listen(80, "0.0.0.0", () => console.log("Radar live."));