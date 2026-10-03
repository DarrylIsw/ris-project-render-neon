const express = require('express');
const controller = require('../controllers/internalResearchController');
const { requireUser, requireScope } = require('../middlewares/auth');

const router = express.Router();

router.get('/schemes', requireUser, controller.listSchemes);
router.get('/drafts', requireScope('research_management'), controller.listDrafts);

module.exports = router;
