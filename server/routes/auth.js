const router = require('express').Router();
const controller = require('../controllers/authController');
const auth = require('../middleware/auth.middleware');
const { validateLogin } = require('../middleware/validators');

router.post('/login', validateLogin, controller.login);
router.post('/logout', auth, controller.logout);
router.post('/refresh', controller.refresh);
router.get('/me', auth, controller.getMe);

module.exports = router;

