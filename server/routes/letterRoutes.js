const express = require('express');
const controller = require('../controllers/letterController');
const { requireScope, requireUser } = require('../middlewares/auth');
const documents = require('../controllers/letterDocumentController');
const { pdfLimit } = require('../middlewares/security');

const router = express.Router();

router.get('/', requireScope('letter_management'), controller.listLetters);
router.get('/templates', requireScope('letter_management'), documents.templates);
router.post('/submit', requireUser, controller.submitLetter);
router.post('/preview', requireScope('letter_management'), pdfLimit, documents.preview);
router.post('/:id/generate-pdf', requireScope('letter_management'), pdfLimit, documents.generate);
router.post('/:id/publish-signed', requireScope('letter_management'), documents.publish);
router.get('/:id/pdf', requireUser, documents.download);

module.exports = router;
