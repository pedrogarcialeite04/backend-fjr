const router = require('express').Router();
const controller = require('../controllers/postController');
const auth = require('../middleware/auth.middleware');
const { uploadSingle } = require('../config/multer');
const { validatePostCreateUpdate, validatePostId, validatePostSlug, validatePostsQuery } = require('../middleware/validators');
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Limite de uploads atingido. Máximo 20 por hora.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rotas públicas
router.get('/', validatePostsQuery, controller.getAll);

// Rotas protegidas (admin)
router.get('/id/:id', auth, validatePostId, controller.getById);
router.post('/', auth, uploadLimiter, uploadSingle('image'), validatePostCreateUpdate, controller.create);
router.put('/:id', auth, uploadLimiter, uploadSingle('image'), validatePostId, validatePostCreateUpdate, controller.update);
router.patch('/:id', auth, validatePostId, controller.patch);
router.delete('/:id', auth, validatePostId, controller.remove);
router.patch('/:id/order', auth, validatePostId, controller.reorder);

// Por último: slug público
router.get('/:slug', validatePostSlug, controller.getBySlug);

module.exports = router;

