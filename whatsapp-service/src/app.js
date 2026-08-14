const express = require('express');
const routes = require('./routes');

function createApp() {
  const app = express();

  // Los recordatorios pueden llevar una imagen adjunta en base64, que ocupa
  // bastante más que el texto.
  app.use(express.json({ limit: '3mb' }));
  app.use(routes);

  app.use((req, res) => {
    res.status(404).json({ error: { mensaje: 'Ruta no encontrada.' } });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    console.error('[whatsapp-service] error no controlado:', error);
    res.status(500).json({ error: { mensaje: 'Error interno del servicio de WhatsApp.' } });
  });

  return app;
}

module.exports = createApp;
