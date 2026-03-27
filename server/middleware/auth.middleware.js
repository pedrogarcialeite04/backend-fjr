const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

module.exports = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    if (process.env.AUTH_BYPASS === 'true' || process.env.SKIP_DB === 'true' || !process.env.MONGODB_URI) {
      req.admin = { _id: 'test-admin' };
      return next();
    }
  }

  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return fail(res, 401, 'Token não fornecido');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded?.type && decoded.type !== 'access') return fail(res, 401, 'Token inválido');
    req.admin = { _id: decoded.id };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return fail(res, 401, 'Token expirado');
    return fail(res, 401, 'Token inválido');
  }
};
