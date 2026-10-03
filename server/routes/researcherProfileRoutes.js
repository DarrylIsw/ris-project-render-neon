const express = require('express');
const controller = require('../controllers/researcherProfileController');
const exportController = require('../controllers/researcherProfileExportController');
const { requireScope, requireUser } = require('../middlewares/auth');
const { exportLimit } = require('../middlewares/security');

const router = express.Router();

router.get('/', requireScope('researcher_profile_management'), controller.listProfiles);
router.get('/:profileId/export.docx', requireUser, exportLimit, exportController.downloadProfileDocx);

module.exports = router;
