/**
 * Pinta en PDF un documento de `reporte.service`.
 *
 * No sabe qué reporte está dibujando: recorre las secciones y sabe pintar tres
 * cosas —indicadores, tabla y nota—. Añadir un reporte nuevo no toca este
 * archivo.
 *
 * El diseño es el mismo de la pantalla: cabecera maciza en el pizarra de la
 * barra lateral, tablas de canto vivo con marco fino, la fila de títulos en
 * bruma y divisiones aún más finas. Sin sombras ni degradados, que además en
 * papel no se imprimen bien.
 */
const PDFDocument = require('pdfkit');

const { PDF: COLOR } = require('./estilo');

const MARGEN = 36;
const ALTO_FILA_MINIMO = 18;
const AIRE_CELDA = 5;

/** Helvetica lleva las tildes y la ñ en su codificación; no hay que incrustar nada. */
const NORMAL = 'Helvetica';
const FUERTE = 'Helvetica-Bold';

function anchoUtil(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function limiteInferior(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

/** Cabecera maciza: de quién es el reporte, cuál es y de qué periodo. */
function dibujarEncabezado(doc, documento) {
  const ancho = anchoUtil(doc);
  const alto = 62;
  const x = doc.page.margins.left;
  const y = doc.y;

  doc.rect(x, y, ancho, alto).fill(COLOR.armazon);

  doc
    .font(FUERTE)
    .fontSize(15)
    .fillColor(COLOR.papel)
    .text(documento.titulo, x + 14, y + 12, { width: ancho - 28 });

  doc
    .font(NORMAL)
    .fontSize(9)
    .fillColor(COLOR.acento)
    .text(`${documento.laboratorio} · ${documento.periodo}`, x + 14, y + 34, {
      width: ancho - 28,
    });

  doc.fillColor(COLOR.texto);
  doc.y = y + alto + 16;
}

/** Fila de cifras grandes, cada una en su recuadro. */
function dibujarIndicadores(doc, seccion) {
  const datos = seccion.datos ?? [];
  if (datos.length === 0) return;

  const x = doc.page.margins.left;
  const ancho = anchoUtil(doc);
  const separacion = 8;
  const anchoCaja = (ancho - separacion * (datos.length - 1)) / datos.length;
  const alto = 52;
  const y = doc.y;

  datos.forEach((dato, indice) => {
    const cajaX = x + indice * (anchoCaja + separacion);

    doc.rect(cajaX, y, anchoCaja, alto).lineWidth(0.75).fillAndStroke(COLOR.papel, COLOR.linea);

    doc
      .font(NORMAL)
      .fontSize(7)
      .fillColor(COLOR.apoyo)
      .text(dato.etiqueta.toUpperCase(), cajaX + 8, y + 8, {
        width: anchoCaja - 16,
        characterSpacing: 0.6,
        lineBreak: false,
        ellipsis: true,
      });

    doc
      .font(FUERTE)
      .fontSize(17)
      .fillColor(COLOR.titular)
      .text(dato.valor, cajaX + 8, y + 20, { width: anchoCaja - 16, lineBreak: false });

    if (dato.detalle) {
      doc
        .font(NORMAL)
        .fontSize(6.5)
        .fillColor(COLOR.apoyo)
        .text(dato.detalle, cajaX + 8, y + 40, {
          width: anchoCaja - 16,
          lineBreak: false,
          ellipsis: true,
        });
    }
  });

  doc.y = y + alto + 18;
}

/** Reparte el ancho de la página entre las columnas, que vienen en porcentaje. */
function calcularColumnas(doc, columnas) {
  const disponible = anchoUtil(doc);
  const suma = columnas.reduce((total, columna) => total + columna.ancho, 0) || 1;

  let x = doc.page.margins.left;
  return columnas.map((columna) => {
    const ancho = (columna.ancho / suma) * disponible;
    const posicion = { ...columna, x, ancho };
    x += ancho;
    return posicion;
  });
}

function dibujarFilaDeTitulos(doc, columnas) {
  const y = doc.y;
  const alto = ALTO_FILA_MINIMO + 4;

  doc.rect(doc.page.margins.left, y, anchoUtil(doc), alto).fill(COLOR.bruma);
  doc.font(FUERTE).fontSize(8).fillColor(COLOR.titular);

  columnas.forEach((columna) => {
    doc.text(columna.titulo, columna.x + AIRE_CELDA, y + 7, {
      width: columna.ancho - AIRE_CELDA * 2,
      align: columna.alineacion === 'derecha' ? 'right' : 'left',
      lineBreak: false,
      ellipsis: true,
    });
  });

  doc.y = y + alto;
}

/**
 * Marco de la tabla, del canto de arriba al de abajo de lo que se lleve pintado
 * en esta hoja. En pantalla la tabla va dentro de un contenedor con borde, y
 * aquí hace el mismo papel: sin él, las filas quedan flotando sobre el papel.
 *
 * Se cierra una vez por hoja —antes de saltar de página y al terminar—, porque
 * una tabla partida necesita un marco por trozo y no uno solo imposible.
 */
function cerrarMarco(doc, yInicio) {
  if (doc.y <= yInicio) return;

  doc
    .rect(doc.page.margins.left, yInicio, anchoUtil(doc), doc.y - yInicio)
    .lineWidth(0.75)
    .stroke(COLOR.linea);
}

function dibujarTabla(doc, seccion) {
  if (seccion.titulo) {
    doc
      .font(FUERTE)
      .fontSize(11)
      .fillColor(COLOR.titular)
      .text(seccion.titulo, doc.page.margins.left, doc.y);
    doc.y += 6;
  }

  const filas = seccion.filas ?? [];

  if (filas.length === 0) {
    doc
      .font(NORMAL)
      .fontSize(9)
      .fillColor(COLOR.apoyo)
      .text(seccion.vacia ?? 'Sin datos.', doc.page.margins.left, doc.y);
    doc.y += 18;
    return;
  }

  let columnas = calcularColumnas(doc, seccion.columnas);
  let yMarco = doc.y;
  dibujarFilaDeTitulos(doc, columnas);

  doc.font(NORMAL).fontSize(8.5);

  filas.forEach((fila) => {
    const alturas = columnas.map((columna) =>
      doc.heightOfString(String(fila[columna.clave] ?? ''), {
        width: columna.ancho - AIRE_CELDA * 2,
      }),
    );
    const alto = Math.max(ALTO_FILA_MINIMO, Math.max(...alturas) + AIRE_CELDA * 2);

    // La fila no se parte entre dos páginas: se lleva entera a la siguiente y
    // allí se repiten los títulos, para que la hoja suelta se siga entendiendo.
    if (doc.y + alto > limiteInferior(doc)) {
      cerrarMarco(doc, yMarco);
      doc.addPage();
      columnas = calcularColumnas(doc, seccion.columnas);
      yMarco = doc.y;
      dibujarFilaDeTitulos(doc, columnas);
      doc.font(NORMAL).fontSize(8.5);
    }

    const y = doc.y;

    columnas.forEach((columna) => {
      doc.fillColor(COLOR.texto).text(String(fila[columna.clave] ?? ''), columna.x + AIRE_CELDA, y + AIRE_CELDA, {
        width: columna.ancho - AIRE_CELDA * 2,
        align: columna.alineacion === 'derecha' ? 'right' : 'left',
      });
    });

    doc
      .moveTo(doc.page.margins.left, y + alto)
      .lineTo(doc.page.width - doc.page.margins.right, y + alto)
      .lineWidth(0.5)
      .stroke(COLOR.linea);

    doc.y = y + alto;
  });

  cerrarMarco(doc, yMarco);
  doc.y += 16;
}

function dibujarNota(doc, seccion) {
  doc
    .font(NORMAL)
    .fontSize(8)
    .fillColor(COLOR.apoyo)
    .text(seccion.texto, doc.page.margins.left, doc.y, { width: anchoUtil(doc) });
  doc.y += 12;
}

/** Quién lo sacó, cuándo y en qué página. Se pinta al final, sobre cada hoja. */
function dibujarPies(doc, documento) {
  const rango = doc.bufferedPageRange();

  for (let indice = 0; indice < rango.count; indice += 1) {
    doc.switchToPage(rango.start + indice);

    const y = doc.page.height - doc.page.margins.bottom + 10;
    const ancho = anchoUtil(doc);

    // El pie cae por debajo del margen inferior y pdfkit, al escribir ahí,
    // abriría una hoja nueva por cada pie. Se baja el margen mientras dura el
    // pie y se devuelve después.
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .moveTo(doc.page.margins.left, y - 6)
      .lineTo(doc.page.width - doc.page.margins.right, y - 6)
      .lineWidth(0.5)
      .stroke(COLOR.linea);

    const quien = documento.generado.usuario ? ` por ${documento.generado.usuario}` : '';

    doc
      .font(NORMAL)
      .fontSize(7)
      .fillColor(COLOR.apoyo)
      .text(`${documento.laboratorio} · Generado el ${documento.generado.fecha}${quien}`,
        doc.page.margins.left, y, { width: ancho, lineBreak: false })
      .text(`Página ${indice + 1} de ${rango.count}`, doc.page.margins.left, y, {
        width: ancho,
        align: 'right',
        lineBreak: false,
      });

    doc.page.margins.bottom = margenInferior;
  }
}

/**
 * @param {object} documento El que devuelve `reporte.service`.
 * @returns {Promise<Buffer>}
 */
function renderizar(documento) {
  return new Promise((resolver, rechazar) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: documento.orientacion === 'horizontal' ? 'landscape' : 'portrait',
      margin: MARGEN,
      // Hace falta para poder volver sobre cada hoja y numerarlas al final,
      // cuando ya se sabe cuántas hay.
      bufferPages: true,
      info: {
        Title: `${documento.titulo} — ${documento.periodo}`,
        Author: documento.laboratorio,
        Creator: documento.laboratorio,
      },
    });

    const trozos = [];
    doc.on('data', (trozo) => trozos.push(trozo));
    doc.on('end', () => resolver(Buffer.concat(trozos)));
    doc.on('error', rechazar);

    try {
      dibujarEncabezado(doc, documento);

      documento.secciones.forEach((seccion) => {
        if (seccion.tipo === 'indicadores') dibujarIndicadores(doc, seccion);
        else if (seccion.tipo === 'tabla') dibujarTabla(doc, seccion);
        else if (seccion.tipo === 'nota') dibujarNota(doc, seccion);
      });

      dibujarPies(doc, documento);
      doc.end();
    } catch (error) {
      rechazar(error);
    }
  });
}

module.exports = { renderizar, extension: 'pdf', tipoMime: 'application/pdf' };
