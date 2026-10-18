const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const env = require('../config/env');
const authController = require('../controllers/auth.controller');
const { autenticar } = require('../middleware/auth');
const {
  reglasLogin,
  reglasLoginGoogle,
  reglasCambioContrasena,
} = require('../validators/auth.validator');

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

/**
 * Límite del acceso con Google. Aquí no hay contraseña que adivinar —la firma
 * de Google no se falsifica—, así que solo frena a quien insista con cuentas
 * sin vincular. Va por IP porque la petición no trae nombre de usuario.
 */
const limiteGoogle = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { mensaje: 'Demasiados intentos de inicio de sesión. Espere unos minutos.' },
  },
});

router.post('/login', limiteLogin, reglasLogin, authController.login);
router.get('/google', authController.configuracionGoogle);
router.post('/google', limiteGoogle, reglasLoginGoogle, authController.loginGoogle);
router.get('/perfil', autenticar, authController.perfil);
router.patch('/contrasena', autenticar, reglasCambioContrasena, authController.cambiarContrasena);

module.exports = router;
