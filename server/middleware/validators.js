const { body, param, query, validationResult } = require('express-validator');
const { fail } = require('../utils/response');

const validate = (req, res, next) => {
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

const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Informe usuário ou e-mail')
    .isLength({ min: 1, max: 200 })
    .withMessage('Login inválido'),
  body('password').isString().isLength({ min: 1, max: 200 }).withMessage('Senha inválida'),
  validate
];

const validatePostCreateUpdate = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Título deve ter entre 3 e 200 caracteres')
    .custom(value => {
      if (/<script|onerror|onclick|onload/gi.test(value)) throw new Error('Título contém conteúdo malicioso');
      return true;
    }),
  body('caption').optional().trim().isLength({ max: 500 }).withMessage('Legenda não pode exceder 500 caracteres'),
  body('body').optional().trim().isLength({ max: 5000 }).withMessage('Corpo não pode exceder 5000 caracteres'),
  body('page').isIn(['home', 'sobre', 'servicos', 'projetos']).withMessage('Página inválida'),
  body('status').optional().isIn(['published', 'draft', 'archived']).withMessage('Status inválido'),
  validate
];

const validatePostId = [param('id').isMongoId().withMessage('ID inválido'), validate];
const validatePostSlug = [param('slug').isString().isLength({ min: 3, max: 240 }).withMessage('Slug inválido'), validate];

const validatePostsQuery = [
  query('status').optional().isIn(['published', 'draft', 'archived']).withMessage('Status inválido'),
  query('page').optional().isIn(['home', 'sobre', 'servicos', 'projetos']).withMessage('Página inválida'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit inválido'),
  validate
];

module.exports = {
  validateLogin,
  validatePostCreateUpdate,
  validatePostId,
  validatePostSlug,
  validatePostsQuery
};

