require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3001,
  apiKey: process.env.INTERNAL_API_KEY || '',
  sessionPath: process.env.WHATSAPP_SESSION_PATH || './session',
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  /** Código de país de Guatemala. Los teléfonos se guardan sin él. */
  codigoPais: process.env.CODIGO_PAIS || '502',
  /** En pruebas nunca se inicializa WhatsApp Web. */
  get autoInit() {
    return this.nodeEnv !== 'test';
  },
};

env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

module.exports = env;
