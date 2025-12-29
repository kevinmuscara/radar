const express = require("express");
const router = express.Router();

const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (_request, _file, cb) {
    cb(null, "public/branding");
  },
  filename: function (_request, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

const configuration = require("../config/SetupManager");

const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

router.post("/", upload.single('logo'), async (request, response) => {
  const isSetupComplete = await configuration.isSetupComplete();

  if (isSetupComplete) {
    return response.status(401).json({ error: "Unauthorized:Setup already complete" });
  } else {
    if (request.file) {
      console.log(`Uploaded branding logo as ${request.file.filename}`);
      await configuration.updateBrandingLogo(request.file.filename);
    }

    await configuration.updateBrandingSchoolName(request.body.schoolName);
    await configuration.updateAdminUser(request.body.username, request.body.password);
    await configuration.completeSetup();

    response.redirect("/");
  }
});

router.post("/update", upload.single('logo'), async (request, response) => {
  if (request.file) {
    console.log(`Uploaded branding logo as ${request.file.filename}`);
    await configuration.updateBrandingLogo(request.file.filename);
  }

  await configuration.updateBrandingSchoolName(request.body.schoolName);
  await configuration.updateAdminUser(request.body.username, request.body.password);

  response.redirect("/admin");
});

module.exports = router;