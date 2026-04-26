const router = require('express').Router();
const Joi = require('joi');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/authController');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

router.post('/login',   validate(loginSchema),   authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout',  authenticate,            authController.logout);
router.get('/me',       authenticate,            authController.me);

module.exports = router;
