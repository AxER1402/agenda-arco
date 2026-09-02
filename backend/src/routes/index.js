/**
 * Registro central de rutas de la API (requisito 21).
 */
const { Router } = require('express');

const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const usuarioRoutes = require('./usuario.routes');
const pacienteRoutes = require('./paciente.routes');
const examenRoutes = require('./examen.routes');
const ordenRoutes = require('./orden.routes');
const citaRoutes = require('./cita.routes');
const agendaRoutes = require('./agenda.routes');
const recordatorioRoutes = require('./recordatorio.routes');
const reporteRoutes = require('./reporte.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/pacientes', pacienteRoutes);
router.use('/examenes', examenRoutes);
router.use('/ordenes', ordenRoutes);
router.use('/citas', citaRoutes);
router.use('/agenda', agendaRoutes);
router.use('/recordatorios', recordatorioRoutes);
router.use('/reportes', reporteRoutes);

module.exports = router;
