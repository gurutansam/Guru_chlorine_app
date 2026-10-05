import express from 'express';
import captchaController from '../controllers/captchaController.js';

const router = express.Router();

router.get('/', captchaController.getCaptcha);

export default router;
