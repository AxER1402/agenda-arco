/**
 * Construcción de la aplicación Express.
 * Se exporta la app sin llamar a listen() para que Supertest pueda montarla
 * en las pruebas sin abrir un puerto real.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Solo se confía en X-Forwarded-For si se declara explícitamente. Confiar a
  // ciegas permitiría falsear la IP y saltarse el límite de intentos de login.
  if (env.trustProxy) {
    app.set('trust proxy', env.trustProxy);
  }

  app.use(helmet());
  // `Content-Disposition` se expone a propósito: es donde viaja el nombre del
  // archivo de los reportes, y sin exponerlo el navegador no deja leerlo.
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  // La imagen del recordatorio viaja en base64 y no cabe en los 100 kB que se
  // permiten en el resto de la API. Se amplía solo en esa ruta: el primer
  // parser que actúa es el que manda, y el general la deja pasar ya leída.
  app.use('/api/recordatorios/plantilla', express.json({ limit: '3mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  // Límite general de peticiones. El login tendrá su propio límite más
  // estricto cuando se implemente la autenticación (fase 2).
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      // En pruebas se desactiva: el contador es compartido entre casos y haría
      // que unas pruebas dependieran de otras.
      skip: () => env.isTest,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { mensaje: 'Demasiadas peticiones. Intente más tarde.' } },
    }),
  );

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
