const router = require('express').Router();
const controller = require('../controllers/serviceImageController');
const auth = require('../middleware/auth.middleware');
const { uploadSingle } = require('../config/multer');
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'Limite de uploads atingido para serviços.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/', controller.getAll);
router.post('/', auth, uploadLimiter, uploadSingle('image'), controller.add);
router.put('/', auth, uploadLimiter, uploadSingle('image'), controller.update);
router.delete('/', auth, controller.remove);

module.exports = router;
