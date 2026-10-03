const express = require('express');
const controller = require('../controllers/externalResearchController');
const { requireScope } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireScope('research_management'), controller.listReports);

module.exports = router;
