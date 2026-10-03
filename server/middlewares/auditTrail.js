const auditTrail = require('../services/auditTrailService');

const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

module.exports = (req, res, next) => {
  if (!mutatingMethods.includes(req.method)) return next();

  res.on('finish', () => {
    const pathParts = req.path.split('/').filter(Boolean);
    auditTrail.record({
      requestId: req.requestId,
      userId: req.user && req.user.id,
      action: `${req.method.toLowerCase()}_${pathParts[0] || 'api_resource'}`,
      entityType: pathParts[0] || 'api_resource',
      entityId: pathParts[pathParts.length - 1],
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
    }).catch(() => {});
  });

  return next();
};
