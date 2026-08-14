jest.mock('whatsapp-web.js');

const { __simular } = require('whatsapp-web.js');
const messageService = require('../services/message.service');
const whatsappClient = require('../whatsapp/client');

describe('message.service', () => {
  beforeEach(() => {
    __simular.reset();
    whatsappClient._reset();
  });

  describe('validarSolicitud', () => {
    it.each(['23232323', '55555555'])('acepta el teléfono válido %s', (telefono) => {
      expect(validarCon(telefono).valido).toBe(true);
    });

    it.each(['2323232', '232323233', '2323232a', '', null, undefined])(
      'rechaza el teléfono inválido %p',
      (telefono) => {
        expect(validarCon(telefono).valido).toBe(false);
      },
    );

    it('rechaza mensajes vacíos', () => {
      const resultado = messageService.validarSolicitud({ telefono: '23232323', mensaje: '   ' });

      expect(resultado.valido).toBe(false);
      expect(resultado.errores).toContain('El mensaje no puede estar vacío.');
    });

    // La imagen es opcional: la mayoría de los recordatorios van solo con texto.
    it.each([undefined, null, ''])('acepta que no venga imagen (%p)', (imagen) => {
      expect(validarCon('23232323', imagen).valido).toBe(true);
    });

    it.each([
      'data:image/png;base64,iVBORw0KGgo=',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/webp;base64,UklGRhoAAABXRUJQ',
    ])('acepta el formato %p', (imagen) => {
      expect(validarCon('23232323', imagen).valido).toBe(true);
    });

    it.each([
      'https://ejemplo.com/banner.png',
      'data:application/pdf;base64,JVBERi0=',
      'data:image/gif;base64,R0lGODlh',
      'iVBORw0KGgo=',
    ])('rechaza la imagen inválida %p', (imagen) => {
      const resultado = validarCon('23232323', imagen);

      expect(resultado.valido).toBe(false);
      expect(resultado.errores.join(' ')).toContain('data URI');
    });

    function validarCon(telefono, imagen) {
      return messageService.validarSolicitud({
        telefono,
        mensaje: 'Recordatorio de cita',
        imagen,
      });
    }
  });

  describe('enviarMensaje', () => {
    it('no llega a WhatsApp si la solicitud es inválida', async () => {
      whatsappClient.initialize();

      const resultado = await messageService.enviarMensaje({
        telefono: '123',
        mensaje: 'Hola',
      });

      expect(resultado).toMatchObject({ enviado: false, motivo: 'SOLICITUD_INVALIDA' });
      expect(__simular.mensajesEnviados()).toHaveLength(0);
    });

    it('recorta el mensaje antes de enviarlo', async () => {
      whatsappClient.initialize();

      await messageService.enviarMensaje({ telefono: '23232323', mensaje: '  Hola  ' });

      expect(__simular.mensajesEnviados()[0].mensaje).toBe('Hola');
    });

    it('pasa la imagen al cliente de WhatsApp', async () => {
      whatsappClient.initialize();

      await messageService.enviarMensaje({
        telefono: '23232323',
        mensaje: 'Hola',
        imagen: 'data:image/png;base64,iVBORw0KGgo=',
      });

      expect(__simular.mensajesEnviados()[0].media).toMatchObject({ mimetype: 'image/png' });
    });

    it('no envía nada si la imagen no es válida', async () => {
      whatsappClient.initialize();

      const resultado = await messageService.enviarMensaje({
        telefono: '23232323',
        mensaje: 'Hola',
        imagen: 'https://ejemplo.com/banner.png',
      });

      expect(resultado).toMatchObject({ enviado: false, motivo: 'SOLICITUD_INVALIDA' });
      expect(__simular.mensajesEnviados()).toHaveLength(0);
    });
  });
});
