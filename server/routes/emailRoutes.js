const express = require('express');
const controller = require('../controllers/emailController');
const { requireScope } = require('../middlewares/auth');

const router = express.Router();

router.get('/status', requireScope('researcher_profile_management'), controller.status);
router.post('/outbox', requireScope('researcher_profile_management'), (req, res) => res.status(403).json({ message: 'Antrean email hanya dapat ditulis oleh server.' }));
if (process.env.NODE_ENV !== 'production') {
  router.post('/development/queue-test', requireScope('researcher_profile_management'), controller.developmentQueueTest);
  router.get('/development/queue-test/:runId', requireScope('researcher_profile_management'), controller.developmentQueueTestStatus);
}

module.exports = router;
