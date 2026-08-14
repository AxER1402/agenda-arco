/**
 * Punto único de lectura de variables de entorno.
 * Ningún otro archivo debe leer process.env directamente: así se puede ver de
 * un vistazo qué necesita el servicio y se falla temprano si falta algo.
 */
require('dotenv').config();

const requiredInProduction = ['DB_PASSWORD', 'JWT_SECRET', 'INTERNAL_API_KEY'];

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'el_arco',
    user: process.env.DB_USER || 'arco_app',
    password: process.env.DB_PASSWORD || '',
    connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-no-usar-en-produccion',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  /**
   * Número de proxies de confianza delante del backend (0 = ninguno).
   * Debe configurarse solo si se despliega detrás de nginx o similar.
   */
  trustProxy: Number.parseInt(process.env.TRUST_PROXY, 10) || 0,

  whatsapp: {
    serviceUrl: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3001',
    apiKey: process.env.INTERNAL_API_KEY || '',
  },
};

env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

if (env.isProduction) {
  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias en producción: ${missing.join(', ')}`,
    );
  }
}

module.exports = env;
