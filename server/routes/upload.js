const router = require('express').Router();
const controller = require('../controllers/uploadController');
const auth = require('../middleware/auth.middleware');
const { uploadSingle } = require('../config/multer');
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Limite de uploads atingido. Máximo 20 por hora.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/image', auth, uploadLimiter, uploadSingle('image'), controller.uploadImage);

module.exports = router;

