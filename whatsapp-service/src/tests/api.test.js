jest.mock('whatsapp-web.js');

const request = require('supertest');
const { __simular } = require('whatsapp-web.js');
const createApp = require('../app');
const whatsappClient = require('../whatsapp/client');

const API_KEY = 'clave-interna-solo-para-pruebas';

describe('API del whatsapp-service', () => {
  const app = createApp();

  beforeEach(() => {
    __simular.reset();
    whatsappClient._reset();
  });

  it('GET /health responde sin necesidad de clave', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.estado).toBe('ok');
  });

  it('rechaza peticiones sin la clave interna', async () => {
    const response = await request(app)
      .post('/send-message')
      .send({ telefono: '23232323', mensaje: 'Hola' });

    expect(response.status).toBe(401);
  });

  it('GET /qr devuelve la imagen del código cuando hay uno pendiente', async () => {
    __simular.sesionSinVincular();
    whatsappClient.initialize();

    // La imagen del QR se genera de forma asíncrona.
    while (!whatsappClient.getQr()?.imagen) {
      await new Promise((resolver) => setTimeout(resolver, 10));
    }

    const response = await request(app).get('/qr').set('x-api-key', API_KEY);

    expect(response.status).toBe(200);
    expect(response.body.imagen).toMatch(/^data:image\/png;base64,/);
  });

  it('GET /qr responde 404 cuando la sesión ya está vinculada', async () => {
    whatsappClient.initialize();

    const response = await request(app).get('/qr').set('x-api-key', API_KEY);

    expect(response.status).toBe(404);
    expect(response.body.error.mensaje).toContain('ya está vinculada');
  });

  it('POST /send-message envía el mensaje cuando la sesión está lista', async () => {
    whatsappClient.initialize();

    const response = await request(app)
      .post('/send-message')
      .set('x-api-key', API_KEY)
      .send({ telefono: '23232323', mensaje: 'Recordatorio de cita' });

    expect(response.status).toBe(200);
    expect(response.body.enviado).toBe(true);
  });

  it('POST /send-message responde 200 y enviado=false si el número no tiene WhatsApp', async () => {
    __simular.numeroSinWhatsapp('50255555555');
    whatsappClient.initialize();

    const response = await request(app)
      .post('/send-message')
      .set('x-api-key', API_KEY)
      .send({ telefono: '55555555', mensaje: 'Recordatorio de cita' });

    // No es un error del servicio: el backend debe poder registrarlo como
    // recordatorio FALLIDO y marcar que el paciente necesita otro contacto.
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ enviado: false, motivo: 'NUMERO_SIN_WHATSAPP' });
  });

  it('POST /send-message responde 400 si el teléfono es inválido', async () => {
    whatsappClient.initialize();

    const response = await request(app)
      .post('/send-message')
      .set('x-api-key', API_KEY)
      .send({ telefono: '2323232', mensaje: 'Hola' });

    expect(response.status).toBe(400);
  });

  it('POST /logout desvincula la cuenta y devuelve el estado resultante', async () => {
    whatsappClient.initialize();

    const response = await request(app).post('/logout').set('x-api-key', API_KEY);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ desvinculada: true, estabaVinculada: true });
  });

  it('POST /logout exige la clave interna', async () => {
    const response = await request(app).post('/logout');

    expect(response.status).toBe(401);
  });

  it('POST /send-message responde 503 si la sesión no está vinculada', async () => {
    const response = await request(app)
      .post('/send-message')
      .set('x-api-key', API_KEY)
      .send({ telefono: '23232323', mensaje: 'Hola' });

    expect(response.status).toBe(503);
  });
});
