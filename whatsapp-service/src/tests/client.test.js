/**
 * Pruebas del cliente de WhatsApp usando el mock manual de la librería.
 * Nunca se abre un navegador ni se contacta WhatsApp real.
 */
jest.mock('whatsapp-web.js');

const { __simular } = require('whatsapp-web.js');
const whatsappClient = require('../whatsapp/client');

/** Espera a que una condición se cumpla, sondeando cada pocos milisegundos. */
async function esperarA(condicion, tiempoLimite = 1000) {
  const limite = Date.now() + tiempoLimite;

  while (Date.now() < limite) {
    if (condicion()) return true;
    await new Promise((resolver) => setTimeout(resolver, 10));
  }

  return false;
}

describe('whatsapp/client', () => {
  beforeEach(() => {
    __simular.reset();
    whatsappClient._reset();
  });

  describe('initialize', () => {
    it('deja el cliente en estado LISTO tras recibir el evento ready', () => {
      whatsappClient.initialize();

      expect(whatsappClient.getEstado()).toMatchObject({
        estado: whatsappClient.ESTADOS.LISTO,
        listo: true,
      });
    });

    it('no crea un segundo cliente si se llama dos veces', () => {
      const primero = whatsappClient.initialize();
      const segundo = whatsappClient.initialize();

      expect(segundo).toBe(primero);
    });
  });

  describe('getQr', () => {
    it('no devuelve nada si todavía no se ha generado un código', () => {
      expect(whatsappClient.getQr()).toBeNull();
    });

    it('devuelve la cadena y una imagen PNG escaneable mientras la sesión no se vincula', async () => {
      __simular.sesionSinVincular();
      whatsappClient.initialize();

      // La imagen se genera de forma asíncrona al recibir el evento 'qr'.
      await esperarA(() => whatsappClient.getQr()?.imagen);

      const qr = whatsappClient.getQr();

      expect(qr.qr).toBe('QR-DE-PRUEBA');
      // Sin la imagen, la interfaz mostraría una cadena que nadie puede escanear.
      expect(qr.imagen).toMatch(/^data:image\/png;base64,/);
    });

    it('deja de ofrecer el código en cuanto la sesión queda vinculada', () => {
      whatsappClient.initialize();

      expect(whatsappClient.getEstado().listo).toBe(true);
      expect(whatsappClient.getQr()).toBeNull();
    });
  });

  describe('construirChatId', () => {
    it('antepone el código de país de Guatemala', () => {
      expect(whatsappClient.construirChatId('23232323')).toBe('50223232323@c.us');
    });
  });

  /**
   * Desvincular tiene que dejar el servicio pidiendo un código nuevo: si se
   * limitara a cerrar la sesión, el laboratorio se quedaría sin QR que escanear
   * hasta reiniciar el contenedor.
   */
  describe('desvincular', () => {
    it('cierra la sesión y vuelve a arrancar para pedir otro código', async () => {
      const instancia = whatsappClient.initialize();

      __simular.sesionSinVincular();
      const resultado = whatsappClient.desvincular();

      expect(resultado).toMatchObject({ desvinculada: true, estabaVinculada: true });

      await whatsappClient._esperarCierre();

      expect(instancia.logout).toHaveBeenCalled();
      expect(instancia.destroy).toHaveBeenCalled();
      expect(await esperarA(() => whatsappClient.getQr() !== null)).toBe(true);
      expect(whatsappClient.getEstado().listo).toBe(false);
    });

    /**
     * Apagar Chromium tarda más de lo que aguanta una petición HTTP: si la
     * respuesta lo esperara, el backend cortaría por tiempo agotado y la
     * pantalla enseñaría un error con la sesión ya cerrada.
     */
    it('responde sin esperar a que el navegador termine de cerrarse', async () => {
      const instancia = whatsappClient.initialize();

      let terminarLogout;
      instancia.logout.mockReturnValue(
        new Promise((resolver) => {
          terminarLogout = resolver;
        }),
      );

      const resultado = whatsappClient.desvincular();

      expect(resultado.desvinculada).toBe(true);
      // Para quien pregunta desde fuera, la cuenta ya no está vinculada.
      expect(whatsappClient.getEstado()).toMatchObject({ listo: false, tieneQr: false });

      terminarLogout();
      await whatsappClient._esperarCierre();
    });

    it('sigue adelante aunque el logout falle', async () => {
      const instancia = whatsappClient.initialize();
      instancia.logout.mockRejectedValue(new Error('la sesión ya no estaba activa'));

      const resultado = whatsappClient.desvincular();
      await whatsappClient._esperarCierre();

      expect(resultado.desvinculada).toBe(true);
      expect(instancia.destroy).toHaveBeenCalled();
    });

    it('no hace nada si no hay ningún cliente en marcha', () => {
      const resultado = whatsappClient.desvincular();

      expect(resultado).toMatchObject({ desvinculada: false, estabaVinculada: false });
    });
  });

  /**
   * La librería deja plantada la instancia caída, e `initialize()` no crea otra
   * mientras haya una. Sin recuperación, cerrar la sesión desde el teléfono o
   * perder la conexión dejaba el servicio muerto hasta reiniciar el contenedor.
   */
  describe('recuperación tras una desconexión', () => {
    it('levanta un cliente nuevo que vuelve a pedir el código', async () => {
      const instancia = whatsappClient.initialize();

      __simular.sesionSinVincular();
      instancia.emit('disconnected', 'LOGOUT');

      expect(whatsappClient.getEstado().listo).toBe(false);

      await whatsappClient._esperarCierre();

      expect(instancia.destroy).toHaveBeenCalled();
      expect(await esperarA(() => whatsappClient.getQr() !== null)).toBe(true);
    });

    it('ignora la caída de un cliente que ya se estaba sustituyendo', async () => {
      const viejo = whatsappClient.initialize();

      whatsappClient.desvincular();
      await whatsappClient._esperarCierre();

      const nuevo = whatsappClient.initialize();
      // Apagar el cliente anterior emite su propia desconexión, a destiempo.
      viejo.emit('disconnected', 'NAVIGATION');

      expect(whatsappClient.initialize()).toBe(nuevo);
      expect(whatsappClient.getEstado().listo).toBe(true);
    });
  });

  describe('enviarMensaje', () => {
    it('envía el mensaje cuando el servicio está listo', async () => {
      whatsappClient.initialize();

      const resultado = await whatsappClient.enviarMensaje('23232323', 'Hola');

      expect(resultado.enviado).toBe(true);
      expect(__simular.mensajesEnviados()).toEqual([
        { chatId: '50223232323@c.us', mensaje: 'Hola', media: null },
      ]);
    });

    /**
     * Con imagen se manda un único mensaje —la foto con el texto como pie—,
     * no una foto suelta seguida de otro mensaje con la explicación.
     */
    it('adjunta la imagen y deja el texto como pie de foto', async () => {
      whatsappClient.initialize();

      const resultado = await whatsappClient.enviarMensaje(
        '23232323',
        'Hola',
        'data:image/png;base64,iVBORw0KGgo=',
      );

      expect(resultado.enviado).toBe(true);

      const [enviado] = __simular.mensajesEnviados();
      expect(__simular.mensajesEnviados()).toHaveLength(1);
      expect(enviado.mensaje).toBe('Hola');
      expect(enviado.media).toMatchObject({
        mimetype: 'image/png',
        data: 'iVBORw0KGgo=',
      });
    });

    it('informa IMAGEN_INVALIDA si el adjunto no es un data URI', async () => {
      whatsappClient.initialize();

      const resultado = await whatsappClient.enviarMensaje('23232323', 'Hola', 'no-es-una-imagen');

      expect(resultado).toMatchObject({ enviado: false, motivo: 'IMAGEN_INVALIDA' });
      expect(__simular.mensajesEnviados()).toHaveLength(0);
    });

    it('informa NUMERO_SIN_WHATSAPP cuando el número no está registrado', async () => {
      __simular.numeroSinWhatsapp('50255555555');
      whatsappClient.initialize();

      const resultado = await whatsappClient.enviarMensaje('55555555', 'Hola');

      expect(resultado).toMatchObject({ enviado: false, motivo: 'NUMERO_SIN_WHATSAPP' });
    });

    it('informa ERROR_ENVIO cuando la librería lanza un error', async () => {
      __simular.errorDeEnvio('conexión perdida');
      whatsappClient.initialize();

      const resultado = await whatsappClient.enviarMensaje('23232323', 'Hola');

      expect(resultado).toMatchObject({ enviado: false, motivo: 'ERROR_ENVIO' });
      expect(resultado.detalle).toContain('conexión perdida');
    });

    it('informa SERVICIO_NO_LISTO si la sesión no está vinculada', async () => {
      const resultado = await whatsappClient.enviarMensaje('23232323', 'Hola');

      expect(resultado).toMatchObject({ enviado: false, motivo: 'SERVICIO_NO_LISTO' });
    });
  });
});
