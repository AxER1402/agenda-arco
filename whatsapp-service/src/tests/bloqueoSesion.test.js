/**
 * Limpieza de los bloqueos de perfil de Chromium.
 *
 * Sin esto, si el contenedor se detiene de golpe, al arrancar de nuevo
 * Chromium se niega a abrir el perfil y el servicio nunca genera el código QR.
 */
jest.mock('whatsapp-web.js');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const whatsappClient = require('../whatsapp/client');
const env = require('../config/env');

let carpeta;

beforeEach(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'arco-sesion-'));
  env.sessionPath = carpeta;
  whatsappClient._reset();
});

afterEach(() => {
  fs.rmSync(carpeta, { recursive: true, force: true });
});

describe('limpiarBloqueosDeSesion', () => {
  it('no falla si la carpeta de sesión todavía no existe', () => {
    env.sessionPath = path.join(carpeta, 'no-existe');

    expect(whatsappClient.limpiarBloqueosDeSesion()).toEqual([]);
  });

  it('elimina los bloqueos que quedaron en el perfil', () => {
    const perfil = path.join(carpeta, 'session-el-arco');
    fs.mkdirSync(perfil);
    fs.writeFileSync(path.join(perfil, 'SingletonCookie'), '');
    fs.writeFileSync(path.join(perfil, 'SingletonSocket'), '');

    const eliminados = whatsappClient.limpiarBloqueosDeSesion();

    expect(eliminados).toHaveLength(2);
    expect(fs.existsSync(path.join(perfil, 'SingletonCookie'))).toBe(false);
  });

  it('elimina SingletonLock aunque sea un enlace simbólico roto', () => {
    const perfil = path.join(carpeta, 'session-el-arco');
    fs.mkdirSync(perfil);
    // Chromium crea SingletonLock como enlace a un destino inexistente.
    fs.symlinkSync('/no/existe/784d2c7c5a4a-32', path.join(perfil, 'SingletonLock'));

    const eliminados = whatsappClient.limpiarBloqueosDeSesion();

    expect(eliminados).toHaveLength(1);
    expect(fs.lstatSync.bind(fs, path.join(perfil, 'SingletonLock'))).toThrow();
  });

  it('no toca los datos de la sesión vinculada', () => {
    const perfil = path.join(carpeta, 'session-el-arco');
    fs.mkdirSync(perfil);
    fs.writeFileSync(path.join(perfil, 'Cookies'), 'datos de la sesión');
    fs.writeFileSync(path.join(perfil, 'SingletonLock'), '');

    whatsappClient.limpiarBloqueosDeSesion();

    // Borrar esto obligaría a volver a escanear el QR en cada reinicio.
    expect(fs.readFileSync(path.join(perfil, 'Cookies'), 'utf8')).toBe('datos de la sesión');
  });

  it('se ejecuta al inicializar el cliente', () => {
    const perfil = path.join(carpeta, 'session-el-arco');
    fs.mkdirSync(perfil);
    fs.writeFileSync(path.join(perfil, 'SingletonLock'), '');

    whatsappClient.initialize();

    expect(fs.existsSync(path.join(perfil, 'SingletonLock'))).toBe(false);
  });
});

/**
 * Tras un apagado brusco del contenedor, la sesión restaurada puede estar viva
 * en disco pero muerta para el teléfono: el `logout()` de la librería se queda
 * esperando una respuesta que no llega. Si desvincular dependiera de él, las
 * credenciales seguirían ahí y el servicio volvería a entrar con la misma sesión
 * inservible, sin enseñar nunca un código nuevo.
 */
describe('desvincular', () => {
  it('borra las credenciales aunque el logout no responda', async () => {
    const perfil = path.join(carpeta, 'session-el-arco');
    fs.mkdirSync(perfil);
    fs.writeFileSync(path.join(perfil, 'Cookies'), 'sesión que ya no sirve');

    const instancia = whatsappClient.initialize();
    instancia.logout.mockRejectedValue(new Error('la sesión ya no estaba activa'));

    whatsappClient.desvincular();
    await whatsappClient._esperarCierre();

    expect(fs.existsSync(perfil)).toBe(false);
  });

  it('no borra el punto de montaje del volumen', async () => {
    whatsappClient.initialize();

    whatsappClient.desvincular();
    await whatsappClient._esperarCierre();

    expect(fs.existsSync(carpeta)).toBe(true);
  });
});
