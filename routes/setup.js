const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer({ dest: "public/branding" });

const SetupManager = require("../config/SetupManager.js");
const configuration = new SetupManager();

router.post("/", upload.single('logo'), async (request, response) => {
  if (request.file) {
    console.log(`Uploaded branding logo as ${request.file.filename}`);
    await configuration.updateBrandingLogo(request.file.filename);
  }

  await configuration.updateBrandingSchoolName(request.body.schoolName);
  await configuration.updateAdminUser(request.body.username, request.body.password);
  await configuration.completeSetup();

  response.send({ status: 200 });
});

router.post("/uncomplete", async (_request, response) => {
  await configuration.uncompleteSetup();
  response.send({ status: 200 });
});

module.exports = router;