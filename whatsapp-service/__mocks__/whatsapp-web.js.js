/**
 * Mock manual de `whatsapp-web.js` (requisito 23).
 *
 * ⚠️ El doble ".js" del nombre no es un error: Jest busca el mock manual de un
 * paquete en `__mocks__/<nombre-del-paquete>.js`, y este paquete ya se llama
 * "whatsapp-web.js". Por estar junto a node_modules, Jest lo aplica de forma
 * automática en todas las pruebas, incluso si alguien olvida jest.mock().
 *
 * Reemplaza la librería real en las pruebas para que nunca se abra un Chromium
 * ni se envíe un mensaje a un número real. Permite simular los tres escenarios
 * que le importan al sistema:
 *   1. mensaje enviado correctamente
 *   2. número no registrado en WhatsApp
 *   3. error durante el envío
 *
 * Uso en una prueba:
 *   jest.mock('whatsapp-web.js');
 *   const { Client, __simular } = require('whatsapp-web.js');
 */

/** Números que el mock considera SIN WhatsApp. */
const numerosSinWhatsapp = new Set();

/** Si se define, sendMessage lanza este error. */
let errorDeEnvio = null;

/** Si es true, initialize() se queda esperando el escaneo del QR. */
let quedarseEnQr = false;

/** Mensajes "enviados" durante la prueba, para poder inspeccionarlos. */
const mensajesEnviados = [];

class MockMessageMedia {
  constructor(mimetype, data, filename) {
    this.mimetype = mimetype;
    this.data = data;
    this.filename = filename;
  }
}

class MockClient {
  constructor(options = {}) {
    this.options = options;
    this.listeners = new Map();
    this.initialize = jest.fn(async () => {
      this.emit('qr', 'QR-DE-PRUEBA');
      if (!quedarseEnQr) this.emit('ready');
    });
    this.destroy = jest.fn(async () => {});
    this.logout = jest.fn(async () => {});

    this.getNumberId = jest.fn(async (numero) => {
      if (numerosSinWhatsapp.has(numero)) return null;
      return { _serialized: `${numero}@c.us` };
    });

    // `contenido` es el texto, o un MessageMedia cuando lleva imagen; en ese
    // caso el texto viaja en opciones.caption.
    this.sendMessage = jest.fn(async (chatId, contenido, opciones = {}) => {
      if (errorDeEnvio) throw new Error(errorDeEnvio);

      const esMedia = contenido instanceof MockMessageMedia;

      mensajesEnviados.push({
        chatId,
        mensaje: esMedia ? (opciones.caption ?? '') : contenido,
        media: esMedia ? contenido : null,
      });

      return { id: { _serialized: `mock-msg-${mensajesEnviados.length}` } };
    });
  }

  on(evento, callback) {
    const actuales = this.listeners.get(evento) ?? [];
    this.listeners.set(evento, [...actuales, callback]);
    return this;
  }

  emit(evento, ...args) {
    (this.listeners.get(evento) ?? []).forEach((callback) => callback(...args));
  }
}

class MockLocalAuth {
  constructor(options = {}) {
    this.options = options;
  }
}

/** Utilidades para preparar escenarios desde las pruebas. */
const __simular = {
  numeroSinWhatsapp(numeroConCodigoPais) {
    numerosSinWhatsapp.add(numeroConCodigoPais);
  },
  errorDeEnvio(mensaje) {
    errorDeEnvio = mensaje;
  },
  /** La sesión no llega a vincularse: se queda mostrando el QR. */
  sesionSinVincular() {
    quedarseEnQr = true;
  },
  mensajesEnviados() {
    return [...mensajesEnviados];
  },
  reset() {
    numerosSinWhatsapp.clear();
    errorDeEnvio = null;
    quedarseEnQr = false;
    mensajesEnviados.length = 0;
  },
};

module.exports = {
  Client: MockClient,
  LocalAuth: MockLocalAuth,
  MessageMedia: MockMessageMedia,
  __simular,
};
