/**
 * Los colores y las medidas que comparten el PDF y el Word.
 *
 * Son los mismos tokens que usa la interfaz (`frontend/src/index.css`): un
 * reporte impreso que no se parece a la pantalla de la que salió no parece del
 * mismo sistema. Se repiten aquí en crudo porque el backend no puede leer la
 * hoja de estilos del frontend; si cambia la identidad, cambian los dos sitios.
 */
const COLORES = {
  tinta: '0B132B', // trazo, titulares y la cabecera maciza
  marino: '1C2541',
  pizarra: '3A506B', // texto de apoyo
  turquesa: '5BC0BE',
  bruma: 'DDF0EF', // fondo de las cabeceras de tabla
  linea: 'C9D2E0', // divisiones internas, la versión diluida del trazo
  papel: 'FFFFFF',
};

/** Con `#` delante, que es como los quiere pdfkit. */
const PDF = Object.fromEntries(
  Object.entries(COLORES).map(([nombre, valor]) => [nombre, `#${valor}`]),
);

module.exports = { COLORES, PDF };
