const request = require('supertest');
const createApp = require('../app');

describe('GET /api/health', () => {
  const app = createApp();

  it('responde 200 cuando el servicio está arriba', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ estado: 'ok', servicio: 'backend' });
  });

  it('responde 404 con mensaje en español para rutas inexistentes', async () => {
    const response = await request(app).get('/api/ruta-que-no-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.mensaje).toContain('Ruta no encontrada');
  });
});
