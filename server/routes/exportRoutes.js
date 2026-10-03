const express = require('express');
const controller = require('../controllers/exportController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.get('/templates/:templateId', requireUser, controller.template);
router.post('/csv', requireUser, controller.csv);

module.exports = router;
