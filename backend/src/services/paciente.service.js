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

/** MySQL devuelve 1/0/null; aquí se trabaja con true/false/null. */
function whatsappGuardado(paciente) {
  return paciente?.tiene_whatsapp === null || paciente?.tiene_whatsapp === undefined
    ? null
    : Boolean(paciente.tiene_whatsapp);
}

/**
 * Titular de un beneficiario: el paciente cuyo número usa.
 *
 * Solo hay un nivel —titular y beneficiarios—, así que el titular tiene que
 * tener número propio. Devuelve `undefined` si no se pidió cambiar el vínculo,
 * `null` si se pidió quitarlo, y el titular si se pidió ponerlo.
 *
 * @param {number|string|null|undefined} titularId
 * @param {object|null} [paciente] El que se edita, si ya existe.
 */
async function prepararTitular(titularId, paciente = null) {
  if (titularId === undefined) return undefined;
  if (titularId === null || titularId === '' || titularId === 0) return null;

  const id = Number.parseInt(titularId, 10);
  if (!Number.isInteger(id) || id < 1) throw AppError.badRequest('El titular no es válido.');

  if (paciente && id === Number(paciente.id)) {
    throw AppError.badRequest('Un paciente no puede ser beneficiario de sí mismo.');
  }

  const titular = await pacienteModel.buscarPorId(id);
  if (!titular) throw AppError.notFound('El titular no existe.');

  if (!titular.activo) {
    throw AppError.badRequest(`${titular.nombre_completo} está inactivo: no puede ser titular.`);
  }

  if (titular.titular_id) {
    throw AppError.badRequest(
      `${titular.nombre_completo} ya es beneficiario de ${titular.titular_nombre}. ` +
        `Elija a ${titular.titular_nombre} como titular.`,
    );
  }

  if (paciente) {
    const suyos = (await pacienteModel.listarBeneficiarios(paciente.id)) ?? [];
    if (suyos.length > 0) {
      throw AppError.badRequest(
        `${paciente.nombre_completo} es titular de ${suyos.length} beneficiario(s): ` +
          'no puede ser a la vez beneficiario de otro paciente.',
      );
    }
  }

  return titular;
}

/**
 * Avisos de posible duplicado. Nunca bloquean: los familiares comparten
 * teléfono y un DPI mal tecleado no puede impedir atender al paciente.
 *
 * Al beneficiario no se le avisa del teléfono: compartirlo es justo lo que se
 * quiere.
 */
async function avisosDeDuplicado({ telefono, dpi, excluirId = null, esBeneficiario = false }) {
  const avisos = [];

  const porTelefono = esBeneficiario
    ? []
    : await pacienteModel.buscarPorTelefono(telefono, excluirId);
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

/**
 * Si el número tiene WhatsApp es un dato del número: cuando lo confirman (o lo
 * desmienten) para uno de la familia, vale para el titular y para todos sus
 * beneficiarios.
 */
async function compartirWhatsappConLaFamilia(titular, tieneWhatsapp) {
  if (whatsappGuardado(titular) !== tieneWhatsapp) {
    await pacienteModel.actualizar(titular.id, { tieneWhatsapp });
  }
  await pacienteModel.sincronizarBeneficiarios(titular.id, { tieneWhatsapp });
}

/**
 * @param {object} datos
 * @param {number} [datos.titularId] Si viene, el paciente es beneficiario de
 *   ese titular y usa su número: el teléfono que se escriba no cuenta.
 */
async function crear({ nombreCompleto, telefono, dpi, notas, tieneWhatsapp, titularId }) {
  const titular = await prepararTitular(titularId);
  const telefonoNormalizado = titular ? titular.telefono : prepararTelefono(telefono);
  const dpiNormalizado = prepararDpi(dpi);

  const avisos = await avisosDeDuplicado({
    telefono: telefonoNormalizado,
    dpi: dpiNormalizado,
    esBeneficiario: Boolean(titular),
  });

  // El beneficiario hereda lo que ya se sabía del número, salvo que en el
  // mostrador acaben de responder otra cosa.
  const respuesta = prepararTieneWhatsapp(tieneWhatsapp);
  const whatsapp = titular && respuesta === null ? whatsappGuardado(titular) : respuesta;

  const paciente = await pacienteModel.crear({
    nombreCompleto: normalizarNombre(nombreCompleto),
    telefono: telefonoNormalizado,
    dpi: dpiNormalizado,
    notas: notas?.trim() || null,
    tieneWhatsapp: whatsapp,
    titularId: titular ? titular.id : null,
  });

  if (titular && whatsapp !== whatsappGuardado(titular)) {
    await compartirWhatsappConLaFamilia(titular, whatsapp);
    if (whatsapp === false) await recordatorioModel.descartarPendientesDePaciente(titular.id);
  }

  return { paciente, avisos };
}

async function actualizar(
  id,
  { nombreCompleto, telefono, dpi, notas, activo, tieneWhatsapp, titularId },
) {
  const actual = await obtener(id);

  const cambios = { activo };

  if (nombreCompleto !== undefined) cambios.nombreCompleto = normalizarNombre(nombreCompleto);
  if (notas !== undefined) cambios.notas = notas?.trim() || null;
  if (dpi !== undefined) cambios.dpi = prepararDpi(dpi);

  // Con quién comparte el número: el que piden ahora o, si no lo tocan, el
  // que ya tenía.
  const pedido = await prepararTitular(titularId, actual);
  const titular =
    pedido !== undefined
      ? pedido
      : actual.titular_id
        ? await pacienteModel.buscarPorId(actual.titular_id)
        : null;

  if (pedido !== undefined) cambios.titularId = pedido ? pedido.id : null;

  if (titular) {
    // El beneficiario no tiene número propio: siempre es el de su titular.
    if (
      pedido === undefined &&
      telefono !== undefined &&
      prepararTelefono(telefono) !== titular.telefono
    ) {
      throw AppError.badRequest(
        `${actual.nombre_completo} usa el número de su titular, ${titular.nombre_completo}. ` +
          'Para darle un número propio, quite primero el vínculo.',
      );
    }

    cambios.telefono = titular.telefono;
    if (titular.telefono !== actual.telefono || pedido) {
      cambios.tieneWhatsapp = whatsappGuardado(titular);
    }
  } else if (telefono !== undefined) {
    cambios.telefono = prepararTelefono(telefono);
    // Si cambió el número, lo que se sabía sobre su WhatsApp deja de valer.
    if (cambios.telefono !== actual.telefono) cambios.tieneWhatsapp = null;
  }

  // Va después del teléfono a propósito: si en la misma operación cambian el
  // número y confirman que el nuevo sí tiene WhatsApp, manda lo que dijeron.
  if (tieneWhatsapp !== undefined) {
    cambios.tieneWhatsapp = prepararTieneWhatsapp(tieneWhatsapp);
  }

  const paciente = await pacienteModel.actualizar(id, cambios);

  // Lo que es del número llega a toda la familia que lo comparte.
  if (titular) {
    if (cambios.tieneWhatsapp !== undefined && cambios.tieneWhatsapp !== whatsappGuardado(titular)) {
      await compartirWhatsappConLaFamilia(titular, cambios.tieneWhatsapp);
    }
  } else if (cambios.telefono !== undefined || cambios.tieneWhatsapp !== undefined) {
    await pacienteModel.sincronizarBeneficiarios(id, {
      telefono: cambios.telefono,
      tieneWhatsapp: cambios.tieneWhatsapp,
    });
  }

  // Los avisos que ya estaban preparados no deben salir hacia alguien que
  // acaba de decir que no tiene WhatsApp (ni hacia su familia: es el mismo
  // número).
  if (cambios.tieneWhatsapp === false) {
    await recordatorioModel.descartarPendientesDePaciente(id);
  }

  return paciente;
}

/** Beneficiarios de un paciente: los que usan su número. */
async function beneficiarios(id) {
  await obtener(id);
  return pacienteModel.listarBeneficiarios(id);
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
  beneficiarios,
  desactivar,
  reactivar,
  eliminar,
  prepararTelefono,
  prepararDpi,
  prepararTieneWhatsapp,
  avisosDeDuplicado,
};
