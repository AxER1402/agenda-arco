/**
 * Que el documento neutro se convierta de verdad en un PDF y en un Word.
 *
 * Lo que se comprueba aquí es que los dos generadores producen un archivo
 * válido de su formato y que no se atragantan con los casos que rompen a un
 * generador de tablas: una tabla vacía, celdas largas que hay que envolver, y
 * suficientes filas como para pasar de página. El contenido —qué columnas y qué
 * cuentas— lo cubre `reporte.service.test.js`.
 */
const pdf = require('../reportes/pdf');
const docx = require('../reportes/docx');

/** Los primeros bytes que identifican cada formato. */
const FIRMA_PDF = '%PDF-';
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // un .docx es un ZIP

function documento({ filas = [], orientacion = 'vertical', columnas = null } = {}) {
  return {
    laboratorio: 'El Arco Laboratorios',
    titulo: 'Listado de citas',
    periodo: 'Del 01/09/2026 al 30/09/2026',
    generado: { fecha: '02/09/2026', usuario: 'Ana Administradora' },
    archivo: 'citas-2026-09-01-a-2026-09-30',
    orientacion,
    secciones: [
      {
        tipo: 'indicadores',
        datos: [
          { etiqueta: 'Citas', valor: String(filas.length) },
          { etiqueta: 'Asistencia', valor: '84 %', detalle: 'Sobre 37 cerradas' },
        ],
      },
      {
        tipo: 'tabla',
        titulo: 'Citas del periodo',
        columnas: columnas ?? [
          { clave: 'fecha', titulo: 'Fecha', ancho: 20 },
          { clave: 'paciente', titulo: 'Paciente', ancho: 40 },
          { clave: 'examenes', titulo: 'Exámenes', ancho: 25 },
          { clave: 'citas', titulo: 'Citas', ancho: 15, alineacion: 'derecha' },
        ],
        filas,
        vacia: 'No hay ninguna cita en el periodo.',
      },
      { tipo: 'nota', texto: 'Filtrado por estado: Atendida.' },
    ],
  };
}

function filaDePrueba(indice) {
  return {
    fecha: '03/09/2026',
    // Con tildes y ñ: Helvetica las lleva, pero si algún día se cambia de
    // fuente esto es lo primero que se rompe.
    paciente: `María José Hernández Ramírez de López ${indice}`,
    examenes: 'Hematología completa, Glucosa en ayunas, Perfil lipídico, Examen general de orina',
    citas: String(indice),
  };
}

/** Las hojas de un PDF de pdfkit no van comprimidas: se pueden contar. */
function paginasDelPdf(contenido) {
  return contenido.toString('latin1').match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;
}

describe('generador de PDF', () => {
  it('produce un PDF válido', async () => {
    const contenido = await pdf.renderizar(documento({ filas: [filaDePrueba(1)] }));

    expect(contenido).toBeInstanceOf(Buffer);
    expect(contenido.subarray(0, 5).toString()).toBe(FIRMA_PDF);
    expect(paginasDelPdf(contenido)).toBe(1);
  });

  it('no abre hojas de más al numerar el pie', async () => {
    const contenido = await pdf.renderizar(documento({ filas: [filaDePrueba(1)] }));

    // El pie va por debajo del margen inferior; escribirlo sin cuidado hacía
    // que pdfkit abriera una hoja nueva por cada pie que pintaba.
    expect(paginasDelPdf(contenido)).toBe(1);
  });

  it('reparte en varias hojas un listado largo', async () => {
    const filas = Array.from({ length: 120 }, (_, indice) => filaDePrueba(indice));
    const contenido = await pdf.renderizar(documento({ filas, orientacion: 'horizontal' }));

    expect(paginasDelPdf(contenido)).toBeGreaterThan(1);
  });

  it('sale con una tabla sin ninguna fila', async () => {
    const contenido = await pdf.renderizar(documento({ filas: [] }));

    expect(contenido.subarray(0, 5).toString()).toBe(FIRMA_PDF);
    expect(contenido.length).toBeGreaterThan(500);
  });
});

describe('generador de Word', () => {
  it('produce un .docx válido, que es un ZIP', async () => {
    const contenido = await docx.renderizar(documento({ filas: [filaDePrueba(1)] }));

    expect(contenido).toBeInstanceOf(Buffer);
    expect(contenido.subarray(0, 4)).toEqual(FIRMA_ZIP);
  });

  it('sale con una tabla sin ninguna fila', async () => {
    const contenido = await docx.renderizar(documento({ filas: [] }));

    expect(contenido.subarray(0, 4)).toEqual(FIRMA_ZIP);
  });

  it('aguanta un listado largo', async () => {
    const filas = Array.from({ length: 300 }, (_, indice) => filaDePrueba(indice));
    const contenido = await docx.renderizar(documento({ filas, orientacion: 'horizontal' }));

    expect(contenido.subarray(0, 4)).toEqual(FIRMA_ZIP);
    expect(contenido.length).toBeGreaterThan(5000);
  });
});

describe('los dos generadores', () => {
  it('anuncian su extensión y su tipo MIME', () => {
    expect(pdf.extension).toBe('pdf');
    expect(pdf.tipoMime).toBe('application/pdf');
    expect(docx.extension).toBe('docx');
    expect(docx.tipoMime).toContain('wordprocessingml.document');
  });
});
