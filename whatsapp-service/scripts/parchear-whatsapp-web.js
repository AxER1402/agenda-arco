/**
 * Parche de whatsapp-web.js 1.34.7 para enviar imágenes.
 *
 * Con la versión actual de WhatsApp Web, todo envío con adjunto falla con
 * "Data passed to getter must include an id property (it's how we memoize)":
 * el modelo de la imagen trae un `__x_id` interno que, al copiarse dentro del
 * mensaje, le pisa su identificador. El arreglo oficial es borrar ese campo
 * (wwebjs/whatsapp-web.js#201923, aceptado el 28/09/2026) pero todavía no está
 * publicado en npm, así que se aplica aquí tras cada instalación.
 *
 * Es idempotente. Si una versión nueva de la librería ya trae el arreglo, no
 * hace nada; si el código cambió tanto que no encuentra dónde aplicarlo, falla
 * para que la imagen de Docker no se construya con los envíos rotos.
 */
const fs = require('node:fs');
const path = require('node:path');

const ARCHIVO = path.join(
  __dirname,
  '..',
  'node_modules',
  'whatsapp-web.js',
  'src',
  'util',
  'Injected',
  'Utils.js',
);

const ARREGLO = 'delete message.__x_id;';
const ANCLA = "        // Bot's won't reply if canonicalUrl is set (linking)";

if (!fs.existsSync(ARCHIVO)) {
  console.log('[parche] whatsapp-web.js no está instalado; nada que parchear.');
  process.exit(0);
}

const codigo = fs.readFileSync(ARCHIVO, 'utf8');

if (codigo.includes(ARREGLO)) {
  console.log('[parche] whatsapp-web.js ya trae el arreglo de envío de imágenes.');
  process.exit(0);
}

if (!codigo.includes(ANCLA)) {
  console.error(
    '[parche] No se encontró dónde aplicar el arreglo de envío de imágenes en ' +
      'whatsapp-web.js. Revise scripts/parchear-whatsapp-web.js.',
  );
  process.exit(1);
}

const parcheado = codigo.replace(
  ANCLA,
  `        // Parche El Arco (wwebjs#201923): el __x_id de la imagen pisaba el id del mensaje.\n        ${ARREGLO}\n\n${ANCLA}`,
);

fs.writeFileSync(ARCHIVO, parcheado);
console.log('[parche] whatsapp-web.js parcheado para enviar imágenes.');
