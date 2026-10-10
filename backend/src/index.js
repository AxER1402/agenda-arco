/**
 * Punto de arranque del backend.
 */
const createApp = require('./app');
const env = require('./config/env');
const { ping, closePool } = require('./config/database');
const recordatoriosJob = require('./jobs/recordatorios.job');
const citasJob = require('./jobs/citas.job');

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[backend] API escuchando en http://localhost:${env.port}/api`);
  console.log(`[backend] entorno: ${env.nodeEnv}`);

  // Comprobación informativa: si la base aún no está lista, el servicio sigue
  // arriba y responde 503 en /api/health/db hasta que la conexión funcione.
  ping()
    .then(() => console.log('[backend] conexión con MySQL establecida'))
    .catch((error) => console.error('[backend] MySQL no disponible todavía:', error.message));

  recordatoriosJob
    .iniciar()
    .catch((error) => console.error('[recordatorios] no se pudo programar:', error.message));

  citasJob.iniciar();
});

async function shutdown(signal) {
  console.log(`[backend] recibido ${signal}, cerrando...`);
  recordatoriosJob.detener();
  citasJob.detener();

  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
