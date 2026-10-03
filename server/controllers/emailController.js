const emailDeliveryService = require('../services/emailDeliveryService');

const status = async (req, res, next) => {
  try {
    return res.json(await emailDeliveryService.getStatus(true));
  } catch (error) {
    return next(error);
  }
};

const enqueue = async (req, res, next) => {
  try {
    const result = await emailDeliveryService.enqueue(req.body && req.body.records);
    return res.status(202).json(result);
  } catch (error) {
    return next(error);
  }
};

const developmentQueueTest = async (req, res, next) => {
  try {
    const run = await emailDeliveryService.enqueueDevelopmentTest(req.body && req.body.count);
    return res.status(202).json(run);
  } catch (error) {
    return next(error);
  }
};

const developmentQueueTestStatus = async (req, res, next) => {
  try {
    const run = emailDeliveryService.getDevelopmentTest(req.params.runId);
    if (!run) return res.status(404).json({ message: 'Sesi uji antrean tidak ditemukan.' });
    return res.json(run);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  status,
  enqueue,
  developmentQueueTest,
  developmentQueueTestStatus,
};
