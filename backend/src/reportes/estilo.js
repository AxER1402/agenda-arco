/**
 * Los colores y las medidas que comparten el PDF y el Word.
 *
 * Son los mismos tokens que usa la interfaz (`frontend/src/index.css`): un
 * reporte impreso que no se parece a la pantalla de la que salió no parece del
 * mismo sistema. Se repiten aquí en crudo porque el backend no puede leer la
 * hoja de estilos del frontend; si cambia la identidad, cambian los dos sitios.
 *
 * El reparto es el de la pantalla: el bloque macizo va en pizarra —el color de
 * la barra lateral—, los titulares en grafito, el texto corrido en pizarra y
 * todos los grises salen de mezclar ese pizarra con blanco. El salvia claro es
 * el acento y solo aparece sobre el bloque macizo, igual que en la barra.
 *
 * Los nombres son los del papel, no los de la marca: quien lea `pdf.js` quiere
 * saber qué papel pinta, no qué tono de verde es.
 */
const COLORES = {
  armazon: '253342', // el bloque macizo de la cabecera; el pizarra de la barra
  titular: '232226', // titulares de sección y cifras; el grafito de la pantalla
  texto: '253342', // el texto corrido de las celdas
  apoyo: '4A5765', // rótulos, notas y pies
  acento: 'A8CCC4', // salvia claro. SOLO sobre el armazón: sobre papel no contrasta
  bruma: 'DAE2E9', // fondo de las cabeceras de tabla
  linea: 'C4D0DA', // bordes y divisiones internas
  papel: 'FFFFFF',
};

/** Con `#` delante, que es como los quiere pdfkit. */
const PDF = Object.fromEntries(
  Object.entries(COLORES).map(([nombre, valor]) => [nombre, `#${valor}`]),
);

module.exports = { COLORES, PDF };
