const citaService = require('../services/cita.service');
const disponibilidadService = require('../services/disponibilidad.service');
const recepcionService = require('../services/recepcion.service');

/** GET /api/citas/estados */
async function listarEstados(req, res, next) {
  try {
    res.status(200).json(await citaService.listarEstados());
  } catch (error) {
    next(error);
  }
}

/** GET /api/citas/:id */
async function obtener(req, res, next) {
  try {
    res.status(200).json(await citaService.obtener(req.params.id));
  } catch (error) {
    next(error);
  }
}

/** POST /api/citas */
async function crear(req, res, next) {
  try {
    res.status(201).json(await citaService.crear(req.body, req.usuario.id));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/citas/recepcion
 * Paciente (nuevo o existente) + orden del IGSS + cita, en una sola operación.
 */
async function recibir(req, res, next) {
  try {
    res.status(201).json(await recepcionService.recibir(req.body, req.usuario.id));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/citas/:id — reprogramación. */
async function actualizar(req, res, next) {
  try {
    res.status(200).json(await citaService.actualizar(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/citas/:id/estado */
async function cambiarEstado(req, res, next) {
  try {
    const { estado, motivo } = req.body;
    res.status(200).json(await citaService.cambiarEstado(req.params.id, estado, { motivo }));
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/citas/:id — borrado definitivo.
 * Para cancelar conservando el historial está PATCH /api/citas/:id/estado.
 */
async function eliminar(req, res, next) {
  try {
    res.status(200).json(
      await citaService.eliminar(req.params.id, {
        usuarioId: req.usuario.id,
        contrasena: req.body?.contrasena,
      }),
    );
  } catch (error) {
    next(error);
  }
}

/** GET /api/citas/disponibilidad?fecha=YYYY-MM-DD */
async function disponibilidad(req, res, next) {
  try {
    const { fecha } = req.query;

    res.status(200).json({
      ...(await disponibilidadService.evaluarDia(fecha)),
      horas: await disponibilidadService.horasDisponibles(fecha),
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/citas/sugerencias?desde=&hasta=&cantidad= */
async function sugerencias(req, res, next) {
  try {
    const { desde, hasta, cantidad } = req.query;

    res.status(200).json({
      fechas_sugeridas: await disponibilidadService.sugerirFechas({
        desde,
        hasta,
        cantidad: Number(cantidad) || 3,
      }),
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/citas/paciente/:pacienteId — historial. */
async function historial(req, res, next) {
  try {
    res.status(200).json(await citaService.historialDePaciente(req.params.pacienteId));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listarEstados,
  obtener,
  crear,
  recibir,
  actualizar,
  cambiarEstado,
  eliminar,
  disponibilidad,
  sugerencias,
  historial,
};
