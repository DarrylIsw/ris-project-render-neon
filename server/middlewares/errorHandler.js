const errorTracker = require('../observability/errorTracker');

const apiNotFound = (req, res) => {
  res.status(404).json({
    message: 'Alamat API tidak ditemukan.',
    code: 'API_NOT_FOUND',
    requestId: req.requestId,
  });
};

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);
  const candidate = Number(err.status || err.statusCode);
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
  const eventId = status >= 500 ? errorTracker.captureException(err, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user && req.user.id,
    statusCode: status,
  }) : undefined;
  return res.status(status).json({
    message: status >= 500 ? 'Terjadi gangguan pada server. Coba lagi atau hubungi pengelola dengan ID permintaan ini.' : (err.message || 'Permintaan tidak dapat diproses.'),
    code: status >= 500 ? 'SERVER_ERROR' : (err.code || 'REQUEST_ERROR'),
    requestId: req.requestId,
    eventId,
  });
};

module.exports = {
  apiNotFound,
  errorHandler,
};
