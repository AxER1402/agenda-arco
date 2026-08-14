/**
 * Requisito 23: las pruebas nunca deben abrir WhatsApp Web ni usar una cuenta
 * real. NODE_ENV=test desactiva la inicialización automática del cliente.
 */
process.env.NODE_ENV = 'test';
process.env.TZ = 'America/Guatemala';
process.env.INTERNAL_API_KEY = 'clave-interna-solo-para-pruebas';
process.env.WHATSAPP_SESSION_PATH = './session-de-prueba';
