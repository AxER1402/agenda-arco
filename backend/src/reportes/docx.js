/**
 * Pinta en Word un documento de `reporte.service`.
 *
 * Es un `.docx` de verdad —no un HTML con la extensión cambiada—, así que se
 * abre y se edita en Word, en LibreOffice y en Google Docs sin avisos de
 * formato. Como el de PDF, no sabe qué reporte está dibujando: recorre las
 * secciones y sabe pintar indicadores, tablas y notas.
 */
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} = require('docx');

const { COLORES: COLOR } = require('./estilo');

const SIN_BORDES = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

/**
 * El borde de la interfaz, traducido a lo que entiende Word (octavos de punto).
 * El marco de fuera y las divisiones de dentro van del mismo color y solo se
 * distinguen por el grosor, igual que en pantalla: un trazo pleno en cada fila
 * convertiría una tabla de treinta citas en una reja.
 */
const BORDES_TABLA = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.linea },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.linea },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR.linea },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR.linea },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLOR.linea },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

const anchoTotal = { size: 100, type: WidthType.PERCENTAGE };

function celda(hijos, { fondo, ancho, alineacion } = {}) {
  return new TableCell({
    children: hijos,
    shading: fondo ? { fill: fondo } : undefined,
    width: ancho ? { size: ancho, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    ...(alineacion ? {} : {}),
  });
}

function texto(contenido, opciones = {}) {
  const { negrita, tamano = 18, color = COLOR.texto, alineacion, mayusculas, espaciado } = opciones;

  return new Paragraph({
    alignment: alineacion === 'derecha' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: espaciado,
    children: [
      new TextRun({
        text: String(contenido ?? ''),
        bold: negrita,
        size: tamano, // en medios puntos: 18 = 9 pt
        color,
        allCaps: mayusculas,
        font: 'Calibri',
      }),
    ],
  });
}

/** Cabecera maciza en pizarra, como la del PDF y la barra lateral de la pantalla. */
function encabezado(documento) {
  return new Table({
    width: anchoTotal,
    borders: SIN_BORDES,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: COLOR.armazon },
            margins: { top: 180, bottom: 180, left: 180, right: 180 },
            children: [
              texto(documento.titulo, { negrita: true, tamano: 30, color: COLOR.papel }),
              texto(`${documento.laboratorio} · ${documento.periodo}`, {
                tamano: 18,
                color: COLOR.acento,
                espaciado: { before: 80 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Los indicadores van en una tabla de una fila: es la rejilla que da Word. */
function indicadores(seccion) {
  const datos = seccion.datos ?? [];
  if (datos.length === 0) return [];

  const ancho = 100 / datos.length;

  return [
    new Table({
      width: anchoTotal,
      borders: {
        ...BORDES_TABLA,
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLOR.linea },
      },
      rows: [
        new TableRow({
          children: datos.map((dato) =>
            celda(
              [
                texto(dato.etiqueta, {
                  tamano: 14,
                  color: COLOR.apoyo,
                  mayusculas: true,
                }),
                texto(dato.valor, {
                  negrita: true,
                  tamano: 32,
                  color: COLOR.titular,
                  espaciado: { before: 40 },
                }),
                ...(dato.detalle
                  ? [texto(dato.detalle, { tamano: 13, color: COLOR.apoyo })]
                  : []),
              ],
              { ancho },
            ),
          ),
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { after: 240 } }),
  ];
}

function tabla(seccion) {
  const partes = [];

  if (seccion.titulo) {
    partes.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: seccion.titulo,
            bold: true,
            size: 24,
            color: COLOR.titular,
            font: 'Calibri',
          }),
        ],
      }),
    );
  }

  const filas = seccion.filas ?? [];

  if (filas.length === 0) {
    partes.push(texto(seccion.vacia ?? 'Sin datos.', { tamano: 18, color: COLOR.apoyo }));
    partes.push(new Paragraph({ text: '', spacing: { after: 240 } }));
    return partes;
  }

  const suma = seccion.columnas.reduce((total, columna) => total + columna.ancho, 0) || 1;

  const titulos = new TableRow({
    // Al partirse la tabla entre dos páginas, Word repite esta fila arriba.
    tableHeader: true,
    children: seccion.columnas.map((columna) =>
      celda(
        [
          texto(columna.titulo, {
            negrita: true,
            tamano: 16,
            color: COLOR.titular,
            alineacion: columna.alineacion,
          }),
        ],
        { fondo: COLOR.bruma, ancho: (columna.ancho / suma) * 100 },
      ),
    ),
  });

  const cuerpo = filas.map(
    (fila) =>
      new TableRow({
        children: seccion.columnas.map((columna) =>
          celda([texto(fila[columna.clave], { tamano: 17, alineacion: columna.alineacion })], {
            ancho: (columna.ancho / suma) * 100,
          }),
        ),
      }),
  );

  partes.push(new Table({ width: anchoTotal, borders: BORDES_TABLA, rows: [titulos, ...cuerpo] }));
  partes.push(new Paragraph({ text: '', spacing: { after: 240 } }));

  return partes;
}

/**
 * @param {object} documento El que devuelve `reporte.service`.
 * @returns {Promise<Buffer>}
 */
async function renderizar(documento) {
  const cuerpo = [encabezado(documento), new Paragraph({ text: '', spacing: { after: 240 } })];

  documento.secciones.forEach((seccion) => {
    if (seccion.tipo === 'indicadores') cuerpo.push(...indicadores(seccion));
    else if (seccion.tipo === 'tabla') cuerpo.push(...tabla(seccion));
    else if (seccion.tipo === 'nota') {
      cuerpo.push(texto(seccion.texto, { tamano: 16, color: COLOR.apoyo }));
    }
  });

  const quien = documento.generado.usuario ? ` por ${documento.generado.usuario}` : '';

  const doc = new Document({
    title: `${documento.titulo} — ${documento.periodo}`,
    creator: documento.laboratorio,
    description: documento.periodo,
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation:
                documento.orientacion === 'horizontal'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            // En vigésimos de punto: 720 = 1,27 cm, el margen estrecho de Word.
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              texto(`${documento.laboratorio} · Generado el ${documento.generado.fecha}${quien}`, {
                tamano: 14,
                color: COLOR.apoyo,
              }),
            ],
          }),
        },
        children: cuerpo,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = {
  renderizar,
  extension: 'docx',
  tipoMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
