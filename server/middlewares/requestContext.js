const crypto = require('crypto');

const createRequestId = () => `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
const validIncomingId = value => (value && /^[a-zA-Z0-9._:-]{1,100}$/.test(value) ? value : null);

module.exports = (req, res, next) => {
  req.requestId = validIncomingId(req.get('x-request-id')) || createRequestId();
  res.set('x-request-id', req.requestId);
  next();
};
