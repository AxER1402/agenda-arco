/**
 * Reglas de negocio de pacientes.
 */
const pacienteModel = require('../models/paciente.model');
const recordatorioModel = require('../models/recordatorio.model');
const authService = require('./auth.service');
const AppError = require('../utils/AppError');
const { normalizarTelefono, esTelefonoValido } = require('../utils/telefono');
const { normalizarDpi, esDpiValido } = require('../utils/dpi');
const { normalizarNombre } = require('../utils/nombre');

/**
 * Normaliza y valida el teléfono.
 * La validación se repite aquí aunque exista en el validador HTTP: el servicio
 * también se invoca desde otros puntos del backend y no puede confiar en que
 * alguien más ya haya validado.
 */
function prepararTelefono(telefono) {
  const normalizado = normalizarTelefono(telefono);

  if (!esTelefonoValido(normalizado)) {
    throw AppError.badRequest(
      'El teléfono debe ser un número de Guatemala de 8 dígitos.',
    );
  }

  return normalizado;
}

/**
 * El DPI es opcional, pero incompleto no vale: o no se registra, o van los 13
 * dígitos. Devuelve null cuando el paciente llega sin documento.
 */
function prepararDpi(dpi) {
  const normalizado = normalizarDpi(dpi);

  if (normalizado === '') return null;

  if (!esDpiValido(normalizado)) {
    throw AppError.badRequest(
      `El DPI debe tener exactamente 13 dígitos (se recibieron ${normalizado.length}).`,
    );
  }

  return normalizado;
}

/**
 * Avisos de posible duplicado. Nunca bloquean: los familiares comparten
 * teléfono y un DPI mal tecleado no puede impedir atender al paciente.
 */
async function avisosDeDuplicado({ telefono, dpi, excluirId = null }) {
  const avisos = [];

  const porTelefono = await pacienteModel.buscarPorTelefono(telefono, excluirId);
  if (porTelefono.length > 0) {
    avisos.push(
      `Ya existen ${porTelefono.length} paciente(s) registrados con ese teléfono: ` +
        `${porTelefono.map((p) => p.nombre_completo).join(', ')}.`,
    );
  }

  if (dpi) {
    const porDpi = await pacienteModel.buscarPorDpi(dpi, excluirId);
    if (porDpi.length > 0) {
      avisos.push(
        `Ese DPI ya está registrado en: ${porDpi.map((p) => p.nombre_completo).join(', ')}. ` +
          'Compruebe que no sea la misma persona duplicada.',
      );
    }
  }

  return avisos;
}

async function buscar({ termino = '', incluirInactivos = false, pagina = 1, porPagina = 20 } = {}) {
  const paginaActual = Math.max(Number.parseInt(pagina, 10) || 1, 1);
  const limite = Math.min(Math.max(Number.parseInt(porPagina, 10) || 20, 1), 100);

  const { pacientes, total } = await pacienteModel.buscar({
    termino,
    incluirInactivos,
    limite,
    desplazamiento: (paginaActual - 1) * limite,
  });

  return {
    pacientes,
    paginacion: {
      pagina: paginaActual,
      porPagina: limite,
      total,
      totalPaginas: Math.max(Math.ceil(total / limite), 1),
    },
  };
}

async function obtener(id) {
  const paciente = await pacienteModel.buscarPorId(id);
  if (!paciente) throw AppError.notFound('El paciente no existe.');
  return paciente;
}

/** Pacientes registrados con un número. Puede haber varios: familiares. */
async function buscarPorTelefono(telefono) {
  return pacienteModel.buscarPorTelefono(prepararTelefono(telefono));
}

/**
 * Registra un paciente.
 * Dos pacientes pueden compartir teléfono (familiares), así que no se bloquea:
 * se devuelve el aviso para que el personal decida.
 */
/**
 * "¿Este número tiene WhatsApp?" admite tres respuestas, y las tres importan:
 * sí, no, y todavía no se sabe (null). Un "no" es lo que le dice al personal que
 * a ese paciente habrá que llamarlo.
 */
function prepararTieneWhatsapp(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor === 'boolean') return valor;
  if (valor === 'true' || valor === 1 || valor === '1') return true;
  if (valor === 'false' || valor === 0 || valor === '0') return false;

  throw AppError.badRequest('El dato de WhatsApp debe ser sí, no o desconocido.');
}

async function crear({ nombreCompleto, telefono, dpi, notas, tieneWhatsapp }) {
  const telefonoNormalizado = prepararTelefono(telefono);
  const dpiNormalizado = prepararDpi(dpi);

  const avisos = await avisosDeDuplicado({
    telefono: telefonoNormalizado,
    dpi: dpiNormalizado,
  });

  const paciente = await pacienteModel.crear({
    nombreCompleto: normalizarNombre(nombreCompleto),
    telefono: telefonoNormalizado,
    dpi: dpiNormalizado,
    notas: notas?.trim() || null,
    tieneWhatsapp: prepararTieneWhatsapp(tieneWhatsapp),
  });

  return { paciente, avisos };
}

async function actualizar(id, { nombreCompleto, telefono, dpi, notas, activo, tieneWhatsapp }) {
  await obtener(id);

  const cambios = { activo };

  if (nombreCompleto !== undefined) cambios.nombreCompleto = normalizarNombre(nombreCompleto);
  if (notas !== undefined) cambios.notas = notas?.trim() || null;
  if (dpi !== undefined) cambios.dpi = prepararDpi(dpi);
  if (telefono !== undefined) {
    cambios.telefono = prepararTelefono(telefono);
    // Si cambió el número, lo que se sabía sobre su WhatsApp deja de valer.
    cambios.tieneWhatsapp = null;
  }

  // Va después del teléfono a propósito: si en la misma operación cambian el
  // número y confirman que el nuevo sí tiene WhatsApp, manda lo que dijeron.
  if (tieneWhatsapp !== undefined) {
    cambios.tieneWhatsapp = prepararTieneWhatsapp(tieneWhatsapp);
  }

  const paciente = await pacienteModel.actualizar(id, cambios);

  // Los avisos que ya estaban preparados no deben salir hacia alguien que
  // acaba de decir que no tiene WhatsApp.
  if (cambios.tieneWhatsapp === false) {
    await recordatorioModel.descartarPendientesDePaciente(id);
  }

  return paciente;
}

/**
 * Baja lógica. Nunca se borra: las citas y órdenes guardan a qué paciente
 * pertenecen y ese historial debe conservarse.
 */
async function desactivar(id) {
  await obtener(id);
  return pacienteModel.actualizar(id, { activo: false });
}

/**
 * Borrado definitivo del paciente y de su historial.
 *
 * La baja normal es lógica (`desactivar`) y así debe seguir siendo. Esto existe
 * para el paciente que nunca debió registrarse —un teléfono mal tecleado que
 * creó una ficha duplicada, una recepción hecha sobre la persona equivocada—,
 * donde dejar la ficha inactiva solo ensucia las búsquedas.
 *
 * Se lleva por delante sus citas y sus órdenes, así que pide la contraseña de
 * quien lo solicita: no se puede deshacer.
 */
async function eliminar(id, { idUsuarioSolicitante, contrasena } = {}) {
  const paciente = await obtener(id);

  await authService.confirmarIdentidad(idUsuarioSolicitante, contrasena);

  const borrado = await pacienteModel.eliminarConHistorial(paciente.id);

  return { id: paciente.id, eliminado: true, ...borrado };
}

async function reactivar(id) {
  await obtener(id);
  return pacienteModel.actualizar(id, { activo: true });
}

module.exports = {
  buscar,
  obtener,
  buscarPorTelefono,
  crear,
  actualizar,
  desactivar,
  reactivar,
  eliminar,
  prepararTelefono,
  prepararDpi,
  prepararTieneWhatsapp,
  avisosDeDuplicado,
};
