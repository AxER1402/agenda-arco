const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const env = require('../config/env');
const authController = require('../controllers/auth.controller');
const { autenticar } = require('../middleware/auth');
const { reglasLogin, reglasCambioContrasena } = require('../validators/auth.validator');

const router = Router();

/**
 * Límite específico del login: frena los intentos de adivinar contraseñas.
 * Es más estricto que el límite general de la API.
 */
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
  /**
   * El contador es por IP **y** usuario.
   *
   * Todo el personal del laboratorio comparte la misma IP: si el límite fuera
   * solo por IP, que una persona se equivocara diez veces dejaría a toda la
   * recepción sin poder entrar durante quince minutos.
   */
  keyGenerator: (req) => `${req.ip}|${String(req.body?.usuario ?? '').toLowerCase()}`,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { mensaje: 'Demasiados intentos de inicio de sesión. Espere unos minutos.' },
  },
});

router.post('/login', limiteLogin, reglasLogin, authController.login);
router.get('/perfil', autenticar, authController.perfil);
router.patch('/contrasena', autenticar, reglasCambioContrasena, authController.cambiarContrasena);

module.exports = router;
