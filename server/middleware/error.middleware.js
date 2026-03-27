const { logger } = require('../utils/logger');
const { fail } = require('../utils/response');

function errorMiddleware(err, req, res, _next) {
  const message = err?.message || 'Erro interno do servidor';

  logger.error({
    msg: 'Erro na requisição',
    message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    stack: err?.stack
  });

  if (message.includes('Apenas')) {
    return fail(res, 400, message);
  }

  if (message.toLowerCase().includes('multer')) {
    return fail(res, 400, 'Erro no upload do arquivo');
  }

  return fail(res, 500, 'Erro interno do servidor');
}

module.exports = { errorMiddleware };

