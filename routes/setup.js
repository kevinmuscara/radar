const express = require("express");
const router = express.Router();

const multer = require("multer");
const bcrypt = require('bcrypt');

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
      await configuration.updateBrandingLogo(request.file.filename);
    }

    await configuration.updateBrandingSchoolName(request.body.schoolName);

    // Update admin user in settings (existing async helper will also run)
    await configuration.updateAdminUser(request.body.username, request.body.password);

    // mark setup complete
    await configuration.completeSetup();

    // Create session for the newly created admin so they are redirected straight to /admin
    try {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(request.body.password, salt);
      const admin_user = { username: request.body.username, password: hashed };

      request.session.regenerate((err) => {
        if (err) {
          console.error('Session regenerate error after setup:', err);
          return response.redirect('/');
        }

        request.session.user = admin_user;
        request.session.save((err) => {
          if (err) {
            console.error('Session save error after setup:', err);
            return response.redirect('/');
          }
          response.redirect('/admin');
        });
      });
    } catch (e) {
      console.error('Failed to create session after setup:', e);
      response.redirect('/');
    }
  }
});

router.post("/update", upload.single('logo'), async (request, response) => {
  if (request.file) {
    await configuration.updateBrandingLogo(request.file.filename);
  }

  await configuration.updateBrandingSchoolName(request.body.schoolName);
  
  // Only update admin credentials if password is provided (not empty)
  if (request.body.password && request.body.password.trim() !== '') {
    await configuration.updateAdminUser(request.body.username, request.body.password);
  } else {
    // Update only username, keep existing password
    await configuration.updateAdminUsername(request.body.username);
  }
  
  // Update refresh interval if provided
  if (request.body.refreshInterval) {
    await configuration.updateRefreshIntervalMinutes(request.body.refreshInterval);
    
    // Update the status checker interval
    const statusChecker = require('../config/StatusChecker');
    const intervalMs = parseInt(request.body.refreshInterval, 10) * 60 * 1000;
    statusChecker.updateInterval(intervalMs);
  }

  response.redirect("/admin");
});

module.exports = router;