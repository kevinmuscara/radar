const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer({ dest: "public/branding" });

const SetupManager = require("../config/SetupManager.js");
const configuration = new SetupManager("./config/config.json");

router.get("/", (_request, response) => response.send({ status: 200 }));

router.post("/", upload.single('logo'), async (request, response) => {
  if (request.file) {
    console.log(`Uploaded branding logo as ${request.file.filename}`);
    configuration.updateBrandingLogo(request.file.filename);
  }

  configuration.updateBrandingSchoolName(request.body.schoolName);
  configuration.updateAdminUser(request.body.username, request.body.password);
  configuration.completeSetup();

  response.send({ status: 200 });
});

module.exports = router;