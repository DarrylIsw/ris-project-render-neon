const express = require('express');
const healthController = require('../controllers/healthController');
const internalResearchRoutes = require('./internalResearchRoutes');
const letterRoutes = require('./letterRoutes');
const externalResearchRoutes = require('./externalResearchRoutes');
const researcherProfileRoutes = require('./researcherProfileRoutes');
const emailRoutes = require('./emailRoutes');
const authRoutes = require('./authRoutes');
const risStateRoutes = require('./risStateRoutes');
const fileRoutes = require('./fileRoutes');
const exportRoutes = require('./exportRoutes');

const router = express.Router();

router.get('/health', healthController.status);
router.use('/auth', authRoutes);
router.use('/ris/state', risStateRoutes);
router.use('/files', fileRoutes);
router.use('/exports', exportRoutes);
router.use('/research', internalResearchRoutes);
router.use('/letters', letterRoutes);
router.use('/external-research', externalResearchRoutes);
router.use('/researcher-profiles', researcherProfileRoutes);
router.use('/email', emailRoutes);

module.exports = router;
