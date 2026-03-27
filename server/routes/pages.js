const router = require('express').Router();
const controller = require('../controllers/pageController');
const auth = require('../middleware/auth.middleware');
const { body, param } = require('express-validator');
const { fail } = require('../utils/response');

const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(
      res,
      422,
      'Falha de validação',
      errors.array().map(e => ({ field: e.path, message: e.msg }))
    );
  }
  next();
};

router.get('/', auth, controller.getAll);
router.get('/:key', auth, [param('key').isIn(['home', 'sobre', 'servicos', 'projetos', 'contato']), validate], controller.getByKey);
router.put(
  '/:key',
  auth,
  [
    param('key').isIn(['home', 'sobre', 'servicos', 'projetos', 'contato']).withMessage('Key inválida'),
    body('title').optional().isString().isLength({ max: 120 }).withMessage('Título inválido'),
    body('content').optional().isObject().withMessage('Content inválido'),
    validate
  ],
  controller.upsert
);

module.exports = router;

