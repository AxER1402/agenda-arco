/**
 * Único punto del proyecto que conoce `whatsapp-web.js`.
 *
 * Todo lo demás (rutas, servicios, backend) habla con esta interfaz:
 *   initialize(), getEstado(), enviarMensaje()
 *
 * Gracias a eso, sustituir WhatsApp Web por la API oficial de WhatsApp Business
 * en el futuro significa reescribir solo este archivo.
 */
const fs = require('node:fs');
const path = require('node:path');

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const env = require('../config/env');

/**
 * Archivos con los que Chromium marca que un perfil está en uso.
 * Si el contenedor se detiene de golpe quedan huérfanos y, al arrancar de
 * nuevo, Chromium se niega a abrir el perfil ("The profile appears to be in use
 * by another Chromium process"), con lo que nunca llegaría a generarse el QR.
 * Solo este servicio usa el perfil, así que borrarlos al arrancar es seguro.
 */
const ARCHIVOS_DE_BLOQUEO = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];

/** LocalAuth guarda la sesión en `<sessionPath>/session-<clientId>`. */
const ID_CLIENTE = 'el-arco';

const ESTADOS = {
  DESCONECTADO: 'DESCONECTADO',
  INICIALIZANDO: 'INICIALIZANDO',
  ESPERANDO_QR: 'ESPERANDO_QR',
  AUTENTICADO: 'AUTENTICADO',
  LISTO: 'LISTO',
};

let client = null;
let estado = ESTADOS.DESCONECTADO;
let ultimoQr = null;
/** El mismo QR como imagen PNG en data URI, lista para un <img> del navegador. */
let ultimoQrImagen = null;
let ultimoError = null;
/** Cierre de sesión en marcha. Solo las pruebas necesitan esperarlo. */
let cierreEnCurso = null;

/**
 * Elimina los bloqueos de perfil que hayan quedado de una ejecución anterior.
 * @returns {string[]} rutas eliminadas.
 */
function limpiarBloqueosDeSesion() {
  const raiz = env.sessionPath;

  if (!fs.existsSync(raiz)) return [];

  const perfiles = [
    raiz,
    ...fs
      .readdirSync(raiz, { withFileTypes: true })
      .filter((entrada) => entrada.isDirectory())
      .map((entrada) => path.join(raiz, entrada.name)),
  ];

  const eliminados = [];

  perfiles.forEach((perfil) => {
    ARCHIVOS_DE_BLOQUEO.forEach((nombre) => {
      const archivo = path.join(perfil, nombre);

      // lstat y no existsSync: SingletonLock es un enlace simbólico roto y
      // existsSync lo daría por inexistente.
      try {
        fs.lstatSync(archivo);
      } catch {
        return;
      }

      try {
        fs.rmSync(archivo, { force: true });
        eliminados.push(archivo);
      } catch (error) {
        console.error(`[whatsapp] no se pudo eliminar ${archivo}:`, error.message);
      }
    });
  });

  return eliminados;
}

/** Carpeta donde LocalAuth guarda las credenciales de la cuenta vinculada. */
function carpetaDeSesion() {
  return path.join(env.sessionPath, `session-${ID_CLIENTE}`);
}

/**
 * Borra las credenciales guardadas para que el siguiente arranque pida un QR.
 *
 * Se borra solo la carpeta del perfil, nunca `sessionPath`: ese es el punto de
 * montaje del volumen de Docker y eliminarlo no está permitido.
 *
 * @returns {boolean} si la carpeta quedó fuera.
 */
function borrarSesionGuardada() {
  const carpeta = carpetaDeSesion();

  try {
    // maxRetries: Chromium puede tardar un instante en soltar sus archivos
    // después de cerrarse.
    fs.rmSync(carpeta, { recursive: true, force: true, maxRetries: 4 });
    return true;
  } catch (error) {
    console.error('[whatsapp] no se pudo borrar la sesión guardada:', error.message);
    return false;
  }
}

function construirCliente() {
  return new Client({
    authStrategy: new LocalAuth({
      clientId: ID_CLIENTE,
      dataPath: env.sessionPath,
    }),
    puppeteer: {
      headless: true,
      executablePath: env.puppeteerExecutablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });
}

function registrarEventos(instancia) {
  instancia.on('qr', (qr) => {
    estado = ESTADOS.ESPERANDO_QR;
    ultimoQr = qr;

    // La cadena cruda no se puede escanear: hay que convertirla en imagen.
    // Se genera aquí, en el servicio, para que la interfaz solo tenga que
    // pintarla y no necesite una librería de QR.
    qrcode
      .toDataURL(qr, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
      .then((imagen) => {
        ultimoQrImagen = imagen;
      })
      .catch((error) => {
        ultimoQrImagen = null;
        console.error('[whatsapp] no se pudo generar la imagen del QR:', error.message);
      });

    if (env.isTest) return;

    // WhatsApp renueva el código cada pocos segundos; por eso se reimprime.
    console.log('\n[whatsapp] Escanee este código QR con el WhatsApp del laboratorio:\n');
    qrcodeTerminal.generate(qr, { small: true });
    console.log('\n[whatsapp] También disponible en la pantalla de Configuración.\n');
  });

  instancia.on('authenticated', () => {
    estado = ESTADOS.AUTENTICADO;
    ultimoQr = null;
    ultimoQrImagen = null;
    console.log('[whatsapp] sesión autenticada');
  });

  instancia.on('auth_failure', (mensaje) => {
    estado = ESTADOS.DESCONECTADO;
    ultimoError = mensaje;
    console.error('[whatsapp] fallo de autenticación:', mensaje);
  });

  instancia.on('ready', () => {
    estado = ESTADOS.LISTO;
    ultimoQr = null;
    ultimoQrImagen = null;
    ultimoError = null;
    if (!env.isTest) console.log('[whatsapp] cliente listo para enviar mensajes');
  });

  instancia.on('disconnected', (razon) => {
    // Si esta ya no es la instancia en uso, la caída es la del cliente que
    // `desvincular()` está apagando por su cuenta: no hay nada que recuperar.
    if (instancia !== client) return;

    estado = ESTADOS.DESCONECTADO;
    ultimoError = razon;
    console.warn('[whatsapp] desconectado:', razon);

    cierreEnCurso = recuperarDe(instancia, razon);
  });
}

/** Arranca WhatsApp Web. Idempotente: llamarlo dos veces no crea dos clientes. */
function initialize() {
  if (client) return client;

  const bloqueos = limpiarBloqueosDeSesion();
  if (bloqueos.length > 0 && !env.isTest) {
    console.log(`[whatsapp] se limpiaron ${bloqueos.length} bloqueo(s) de sesión anteriores`);
  }

  client = construirCliente();
  registrarEventos(client);
  estado = ESTADOS.INICIALIZANDO;

  client.initialize().catch((error) => {
    estado = ESTADOS.DESCONECTADO;
    ultimoError = error.message;
    console.error('[whatsapp] no se pudo inicializar:', error.message);
  });

  return client;
}

function getEstado() {
  return {
    estado,
    listo: estado === ESTADOS.LISTO,
    tieneQr: Boolean(ultimoQr),
    ultimoError,
  };
}

/** Margen para cada paso del cierre antes de darlo por perdido y seguir. */
const TIEMPO_LIMITE_CIERRE_MS = 20000;

/**
 * Corre una promesa con tope de tiempo. Rechaza si se pasa, pero no cancela
 * nada: `logout()` y `destroy()` no se pueden abortar, así que lo único que se
 * consigue —y es lo que hace falta— es dejar de esperarlas.
 */
function conTiempoLimite(promesa, ms, etiqueta) {
  let temporizador;

  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(`${etiqueta} no respondió en ${ms} ms`)), ms);
  });

  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

/**
 * Apaga el cliente anterior y vuelve a levantar el servicio.
 *
 * Los dos pasos se dan por buenos aunque fallen: `logout()` revienta si la
 * sesión ya no estaba activa, y `destroy()` si `logout()` ya cerró el navegador
 * por dentro. Lo que importa es que no quede sesión guardada y que vuelva a
 * salir un código, y de eso se encargan el borrado y el `initialize()` finales.
 */
async function cerrarYReiniciar(instancia) {
  try {
    await conTiempoLimite(
      Promise.resolve(instancia.logout()),
      TIEMPO_LIMITE_CIERRE_MS,
      'el cierre de sesión',
    );
  } catch (error) {
    console.warn('[whatsapp] logout no completó:', error.message);
  }

  try {
    await conTiempoLimite(
      Promise.resolve(instancia.destroy()),
      TIEMPO_LIMITE_CIERRE_MS,
      'el apagado del navegador',
    );
  } catch (error) {
    console.warn('[whatsapp] destroy no completó:', error.message);
  }

  // No se confía en que `logout()` haya borrado las credenciales: si la sesión
  // guardada estaba muerta —lo habitual tras un apagado brusco del contenedor—
  // el mensaje de cierre nunca llega al teléfono, `logout()` se agota y los
  // datos siguen en disco. Sin este borrado el `initialize()` de abajo
  // restauraría la misma sesión inservible y nunca saldría un código nuevo.
  borrarSesionGuardada();

  initialize();
}

/**
 * Espera antes de volver a levantar el cliente tras una caída, para no
 * reintentar en bucle cerrado cuando el problema no se arregla solo.
 */
const ESPERA_RECONEXION_MS = env.isTest ? 0 : 5000;

/**
 * Vuelve a dejar el servicio operativo después de una desconexión ajena a la
 * aplicación: la sesión cerrada desde el teléfono, WhatsApp Web caído o la
 * página recargada.
 *
 * Hace falta porque `initialize()` no crea un cliente nuevo si ya hay uno, y la
 * librería deja la instancia caída en su sitio. Sin esto el servicio se queda
 * desconectado para siempre y solo se recupera reiniciando el contenedor.
 */
async function recuperarDe(instancia, razon) {
  client = null;
  ultimoQr = null;
  ultimoQrImagen = null;

  try {
    await conTiempoLimite(
      Promise.resolve(instancia.destroy()),
      TIEMPO_LIMITE_CIERRE_MS,
      'el apagado del navegador',
    );
  } catch (error) {
    console.warn('[whatsapp] destroy no completó tras la desconexión:', error.message);
  }

  // Si la sesión se cerró desde el teléfono, lo guardado ya no vale: reutilizarlo
  // dejaría al servicio intentando entrar con una cuenta desvinculada.
  if (String(razon).toUpperCase().includes('LOGOUT')) borrarSesionGuardada();

  await new Promise((resolver) => setTimeout(resolver, ESPERA_RECONEXION_MS));

  // Alguien pudo levantar un cliente durante la espera (una desvinculación
  // manual, por ejemplo); en ese caso no se le pisa.
  if (client) return;

  console.log('[whatsapp] reconectando tras la desconexión...');
  initialize();
}

/**
 * Apaga el navegador antes de que el proceso termine.
 *
 * Es lo que evita el problema de raíz: si el contenedor se detiene sin cerrar
 * Chromium, el perfil queda escrito a medias y, al arrancar de nuevo, la sesión
 * aparece vinculada pero su conexión con el teléfono ya no responde. A partir de
 * ahí `logout()` se cuelga y no hay manera de desvincular desde la aplicación.
 *
 * Cierra sin cerrar sesión: la cuenta vinculada sigue guardada para el
 * siguiente arranque.
 */
async function apagar() {
  if (!client) return;

  const instancia = client;
  client = null;
  estado = ESTADOS.DESCONECTADO;

  try {
    await conTiempoLimite(
      Promise.resolve(instancia.destroy()),
      TIEMPO_LIMITE_CIERRE_MS,
      'el apagado del navegador',
    );
  } catch (error) {
    console.warn('[whatsapp] destroy no completó al apagar:', error.message);
  }
}

/**
 * Cierra la sesión vinculada y deja el servicio pidiendo un QR nuevo.
 *
 * Sirve para cambiar de teléfono sin entrar al contenedor: se avisa al teléfono
 * con `logout()` y, pase lo que pase con ese aviso, se borran los datos de
 * sesión del disco, así que el siguiente arranque no puede reutilizarlos.
 *
 * **Responde sin esperar a que el navegador termine de cerrarse.** Cerrar la
 * sesión en WhatsApp Web implica navegar la página y apagar Chromium, y eso
 * tarda más de lo que ninguna petición HTTP debería aguantar: esperarlo hacía
 * que el backend cortara por tiempo agotado y que la pantalla acabara enseñando
 * un error aunque la sesión sí se hubiera cerrado. El estado que se consulta
 * desde fuera se limpia aquí, en el acto; el apagado y el arranque nuevo siguen
 * su curso por detrás y se ven en `/status`.
 *
 * @returns {{desvinculada: boolean, estabaVinculada: boolean}}
 */
function desvincular() {
  // Sin cliente en marcha —el arranque falló, o hay una reconexión esperando—
  // sigue habiendo credenciales en disco que hay que quitar de en medio: si no,
  // el siguiente arranque volvería a restaurar la misma sesión.
  if (!client) {
    borrarSesionGuardada();
    initialize();

    return { desvinculada: true, estabaVinculada: false };
  }

  const instancia = client;
  const estabaVinculada = estado === ESTADOS.LISTO || estado === ESTADOS.AUTENTICADO;

  client = null;
  estado = ESTADOS.DESCONECTADO;
  ultimoQr = null;
  ultimoQrImagen = null;
  ultimoError = null;

  cierreEnCurso = cerrarYReiniciar(instancia);

  return { desvinculada: true, estabaVinculada };
}

/**
 * Código QR pendiente de escanear.
 * @returns {{qr: string, imagen: string|null}|null} `imagen` es un data URI PNG.
 */
function getQr() {
  if (!ultimoQr) return null;
  return { qr: ultimoQr, imagen: ultimoQrImagen };
}

/**
 * Convierte un teléfono de 8 dígitos de Guatemala al identificador de WhatsApp.
 * 23232323 -> 50223232323@c.us
 */
function construirChatId(telefono) {
  return `${env.codigoPais}${telefono}@c.us`;
}

/**
 * Separa un data URI en el tipo de archivo y sus datos.
 * @param {string} dataUri
 * @returns {{mimetype: string, base64: string}|null}
 */
function partirDataUri(dataUri) {
  const partes = /^data:([^;,]+);base64,(.+)$/.exec(String(dataUri));
  if (!partes) return null;

  return { mimetype: partes[1], base64: partes[2] };
}

/**
 * Envía un mensaje, con una imagen adjunta si se indica.
 *
 * Con imagen se manda un solo mensaje —la foto con el texto como pie— y no dos:
 * al paciente le llega un aviso, no una foto suelta seguida de una explicación.
 *
 * @param {string} telefono
 * @param {string} mensaje
 * @param {string|null} [imagen] Data URI en base64.
 * @returns {Promise<{enviado: boolean, motivo?: string, idMensaje?: string}>}
 */
async function enviarMensaje(telefono, mensaje, imagen = null) {
  if (!client || estado !== ESTADOS.LISTO) {
    return {
      enviado: false,
      motivo: 'SERVICIO_NO_LISTO',
      detalle: 'El servicio de WhatsApp no está vinculado. Escanee el código QR.',
    };
  }

  const numeroConPais = `${env.codigoPais}${telefono}`;

  try {
    // No todos los pacientes tienen WhatsApp (requisito 19): se comprueba antes
    // de enviar para poder informarlo como un resultado esperado y no un error.
    const numeroId = await client.getNumberId(numeroConPais);

    if (!numeroId) {
      return {
        enviado: false,
        motivo: 'NUMERO_SIN_WHATSAPP',
        detalle: 'El número no está registrado en WhatsApp.',
      };
    }

    const adjunto = imagen ? partirDataUri(imagen) : null;

    if (imagen && !adjunto) {
      return {
        enviado: false,
        motivo: 'IMAGEN_INVALIDA',
        detalle: 'La imagen adjunta no tiene un formato reconocible.',
      };
    }

    // sendSeen: false porque marcar el chat como leído antes de enviar —lo que
    // la librería hace por defecto— revienta con las versiones actuales de
    // WhatsApp Web ("Data passed to getter must include an id property") y
    // tumba el envío entero. Al laboratorio no le hace falta marcar nada leído.
    const opciones = { sendSeen: false };

    const resultado = adjunto
      ? await client.sendMessage(
          numeroId._serialized,
          new MessageMedia(adjunto.mimetype, adjunto.base64, 'recordatorio'),
          { ...opciones, caption: mensaje },
        )
      : await client.sendMessage(numeroId._serialized, mensaje, opciones);

    return {
      enviado: true,
      idMensaje: resultado?.id?._serialized ?? null,
    };
  } catch (error) {
    return {
      enviado: false,
      motivo: 'ERROR_ENVIO',
      detalle: error.message,
    };
  }
}

/** Solo para pruebas: reinicia el estado del módulo. */
function _reset() {
  client = null;
  estado = ESTADOS.DESCONECTADO;
  ultimoQr = null;
  ultimoQrImagen = null;
  ultimoError = null;
  cierreEnCurso = null;
}

/** Solo para pruebas: espera al cierre o a la reconexión que quedó en marcha. */
function _esperarCierre() {
  return cierreEnCurso ?? Promise.resolve();
}

/** Solo para pruebas: fuerza un cliente y un estado. */
function _setClienteDePrueba(instancia, nuevoEstado = ESTADOS.LISTO) {
  client = instancia;
  estado = nuevoEstado;
}

module.exports = {
  ESTADOS,
  limpiarBloqueosDeSesion,
  borrarSesionGuardada,
  initialize,
  apagar,
  desvincular,
  getEstado,
  getQr,
  construirChatId,
  enviarMensaje,
  _reset,
  _esperarCierre,
  _setClienteDePrueba,
};
