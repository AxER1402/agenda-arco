const createApp = require('./app');
const env = require('./config/env');
const whatsappClient = require('./whatsapp/client');

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[whatsapp-service] escuchando en http://localhost:${env.port}`);

  if (env.autoInit) {
    console.log('[whatsapp-service] inicializando WhatsApp Web...');
    whatsappClient.initialize();
  }
});

/**
 * Apagado ordenado.
 *
 * Chromium guarda la sesión vinculada en disco y necesita cerrarse él mismo para
 * dejarla completa. Si el proceso muere de golpe —`docker stop`, `docker compose
 * down`, un reinicio de `node --watch`— el perfil queda a medio escribir: al
 * arrancar de nuevo la sesión parece vinculada, pero su conexión con el teléfono
 * ya no responde, y desde ahí ni se pueden enviar mensajes ni se puede
 * desvincular desde Configuración.
 *
 * Docker concede un margen antes de matar el contenedor (`stop_grace_period` en
 * docker-compose.yml); cerrar aquí es lo que lo aprovecha.
 */
let apagando = false;

async function apagar(senal) {
  if (apagando) return;
  apagando = true;

  console.log(`[whatsapp-service] ${senal} recibido, cerrando WhatsApp Web...`);

  server.close();
  await whatsappClient.apagar();

  console.log('[whatsapp-service] cerrado');
  process.exit(0);
}

['SIGTERM', 'SIGINT'].forEach((senal) => {
  process.on(senal, () => {
    apagar(senal);
  });
});
