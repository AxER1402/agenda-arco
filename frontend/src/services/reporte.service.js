import api from './api';

/**
 * Descarga de los reportes del sistema.
 *
 * El archivo llega como binario y no como JSON, así que estas llamadas piden
 * `responseType: 'blob'`. El nombre lo pone el backend en `Content-Disposition`
 * —es quien sabe de qué periodo es el reporte—, y se usa el que venga.
 */

/** Un mes de citas tarda más que una consulta normal; el timeout general es corto. */
const ESPERA = 60000;

/** Saca el nombre del archivo de la cabecera `Content-Disposition`. */
function nombreDelArchivo(cabecera, respaldo) {
  const encontrado = /filename="?([^";]+)"?/i.exec(cabecera ?? '');
  return encontrado ? encontrado[1] : respaldo;
}

/** Provoca la descarga en el navegador y suelta la URL temporal. */
function guardar(contenido, nombre) {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  URL.revokeObjectURL(url);
}

/**
 * @param {'citas'|'actividad'} reporte
 * @param {{formato: 'pdf'|'docx', desde: string, hasta: string, estado?: string}} opciones
 */
export async function descargarReporte(reporte, { formato, ...filtros }) {
  const { data, headers } = await api.get(`/reportes/${reporte}`, {
    params: { ...filtros, formato },
    responseType: 'blob',
    timeout: ESPERA,
  });

  guardar(data, nombreDelArchivo(headers['content-disposition'], `${reporte}.${formato}`));
}
