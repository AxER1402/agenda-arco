const recordatorioService = require('../services/recordatorio.service');
const whatsappClient = require('../services/whatsapp.client');

/** GET /api/recordatorios */
async function listar(req, res, next) {
  try {
    const { estado, desde, hasta } = req.query;
    res.status(200).json(await recordatorioService.listar({ estado, desde, hasta }));
  } catch (error) {
    next(error);
  }
}

/** GET /api/recordatorios/resumen */
async function resumen(req, res, next) {
  try {
    res.status(200).json(await recordatorioService.obtenerResumen());
  } catch (error) {
    next(error);
  }
}

/** POST /api/recordatorios/preparar — genera los de una fecha sin enviarlos. */
async function preparar(req, res, next) {
  try {
    res.status(200).json(await recordatorioService.prepararParaFecha(req.body?.fecha));
  } catch (error) {
    next(error);
  }
}

/** POST /api/recordatorios/enviar — ejecuta el envío de los pendientes. */
async function enviarPendientes(req, res, next) {
  try {
    res.status(200).json(await recordatorioService.enviarPendientes());
  } catch (error) {
    next(error);
  }
}

/** POST /api/recordatorios/cita/:citaId — envío manual e inmediato. */
async function enviarParaCita(req, res, next) {
  try {
    res.status(200).json(await recordatorioService.enviarParaCita(req.params.citaId));
  } catch (error) {
    next(error);
  }
}

/** POST /api/recordatorios/:id/reintentar */
async function reintentar(req, res, next) {
  try {
    res.status(200).json(await recordatorioService.reintentar(req.params.id));
  } catch (error) {
    next(error);
  }
}

/** GET /api/recordatorios/plantilla — texto e imagen del recordatorio. */
async function obtenerPlantilla(req, res, next) {
  try {
    res.status(200).json(await recordatorioService.obtenerPlantilla());
  } catch (error) {
    next(error);
  }
}

/** PUT /api/recordatorios/plantilla — solo administrador. */
async function guardarPlantilla(req, res, next) {
  try {
    const { plantilla, imagen } = req.body ?? {};

    res
      .status(200)
      .json(await recordatorioService.guardarPlantilla({ plantilla, imagen }, req.usuario.id));
  } catch (error) {
    next(error);
  }
}

/** POST /api/recordatorios/plantilla/previsualizar — no guarda nada. */
async function previsualizarPlantilla(req, res, next) {
  try {
    res.status(200).json(await recordatorioService.previsualizarPlantilla(req.body.plantilla));
  } catch (error) {
    next(error);
  }
}

/** GET /api/recordatorios/whatsapp/estado */
async function estadoWhatsapp(req, res, next) {
  try {
    res.status(200).json(await whatsappClient.obtenerEstado());
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/recordatorios/whatsapp/qr
 * Devuelve el QR para vincular la cuenta del laboratorio. Solo administrador:
 * quien escanee ese código vincula el WhatsApp del laboratorio.
 */
async function qrWhatsapp(req, res, next) {
  try {
    const qr = await whatsappClient.obtenerQr();

    if (!qr) {
      return res.status(404).json({
        error: { mensaje: 'No hay un código QR pendiente. La sesión puede estar ya vinculada.' },
      });
    }

    return res.status(200).json(qr);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/recordatorios/whatsapp/desvincular
 *
 * Cierra la sesión y deja el servicio pidiendo un código nuevo. Solo
 * administrador, por lo mismo que el QR: quien desvincula deja al laboratorio
 * sin recordatorios automáticos hasta que alguien vuelva a escanear.
 */
async function desvincularWhatsapp(req, res, next) {
  try {
    const resultado = await whatsappClient.desvincular();

    return res.status(200).json({
      ...resultado,
      mensaje: resultado.estabaVinculada
        ? 'La cuenta quedó desvinculada. Escanee un código QR nuevo para volver a enviar recordatorios.'
        : 'No había ninguna cuenta vinculada. El servicio ya está pidiendo un código QR.',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listar,
  resumen,
  preparar,
  enviarPendientes,
  enviarParaCita,
  reintentar,
  obtenerPlantilla,
  guardarPlantilla,
  previsualizarPlantilla,
  estadoWhatsapp,
  desvincularWhatsapp,
  qrWhatsapp,
};
