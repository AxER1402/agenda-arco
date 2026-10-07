/**
 * Configuración global de las pruebas del backend.
 *
 * Regla del proyecto: las pruebas NUNCA usan credenciales reales, la base de
 * datos de producción ni una cuenta real de WhatsApp.
 */
process.env.NODE_ENV = 'test';
process.env.TZ = 'America/Guatemala';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas';
process.env.INTERNAL_API_KEY = 'clave-interna-solo-para-pruebas';
process.env.DB_PASSWORD = 'password-de-prueba';
// Sin la pausa de un minuto entre recordatorios: las pruebas no esperan.
process.env.RECORDATORIOS_PAUSA_MS = '0';
