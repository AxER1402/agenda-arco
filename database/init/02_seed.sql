-- ---------------------------------------------------------------------------
-- Datos iniciales: catálogos y configuración por defecto.
-- Los usuarios de prueba se crean en 03_usuarios_demo.sql (solo desarrollo).
-- ---------------------------------------------------------------------------

-- Imprescindible: sin esto el cliente de MySQL interpreta el archivo como
-- latin1 y las tildes se guardan corruptas ("Ácido" → "Ãcido").
SET NAMES utf8mb4;

INSERT INTO roles (codigo, nombre, descripcion) VALUES
  ('ADMINISTRADOR', 'Administrador', 'Gestiona usuarios, roles, configuración y toda la operación.'),
  ('PERSONAL_CITAS', 'Personal de citas', 'Gestiona pacientes, órdenes, citas y agenda.');

INSERT INTO estados_cita (codigo, nombre, es_final, ocupa_cupo) VALUES
  ('PENDIENTE',  'Pendiente',   FALSE, TRUE),
  ('CONFIRMADA', 'Confirmada',  FALSE, TRUE),
  ('ATENDIDA',   'Atendida',    TRUE,  TRUE),
  -- Cancelada no es final: se puede reagendar y vuelve a pendiente.
  ('CANCELADA',  'Cancelada',   FALSE, FALSE),
  ('NO_ASISTIO', 'No asistió',  TRUE,  TRUE);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('limite_diario_pacientes', '40', 'Cantidad máxima de pacientes que se pueden agendar por día.'),
  ('vigencia_orden_meses',    '3',  'Meses de vigencia de una orden del IGSS desde su fecha de entrega.'),
  ('dias_laborables',         '1,2,3,4,5,6,7', 'Días laborables (1=lunes ... 7=domingo).'),
  ('hora_apertura',           '07:00', 'Hora de inicio de atención.'),
  ('hora_cierre',             '17:00', 'Hora de fin de atención.'),
  ('intervalo_citas_minutos', '15', 'Duración del espacio asignado a cada cita.'),
  ('hora_recordatorios',      '08:00', 'Hora a la que se envían los recordatorios del día siguiente.'),
  ('hora_cita_predeterminada', '07:00', 'Hora con la que llega el formulario de nueva cita.'),
  ('dias_feriados',           '[]', 'Feriados en JSON: [{fecha, descripcion, anual}]. Esos días no se agenda.'),
  ('nombre_laboratorio',      'El Arco Laboratorios', 'Nombre mostrado en los recordatorios.'),
  -- Texto del recordatorio. Entre llaves van los datos de cada cita; el
  -- laboratorio puede reescribirlo desde Configuración.
  ('plantilla_recordatorio',
   'Estimado(a) {paciente}:\n\nLe recordamos que tiene una cita programada en {laboratorio}.\n\nFecha: {fecha}\nHora: {hora}\n{etiqueta_examenes}: {examenes}\n\n{indicaciones}\n\nAgradecemos su puntualidad.',
   'Texto que se envía por WhatsApp como recordatorio de cita.'),
  ('imagen_recordatorio', '', 'Imagen adjunta al recordatorio (data URI en base64). Vacío = sin imagen.');

INSERT INTO examenes (codigo, nombre, descripcion, indicaciones) VALUES
  ('HEM-001', 'Hematología completa', 'Hemograma completo.', NULL),
  ('QUI-001', 'Glucosa', 'Glucosa en ayunas.', NULL),
  ('QUI-002', 'Perfil lipídico', 'Colesterol total, HDL, LDL y triglicéridos.', NULL),
  ('QUI-003', 'Creatinina', 'Creatinina sérica.', NULL),
  ('QUI-004', 'Ácido úrico', 'Ácido úrico en sangre.', NULL),
  ('ORI-001', 'Orina completa', 'Examen general de orina.',
   'La muestra de orina no debe pasar más de 1 hora dentro del frasco antes de entregarla.'),
  ('HEC-001', 'Heces completa', 'Examen general de heces.',
   'La muestra de heces no debe pasar más de 1 hora dentro del frasco antes de entregarla.'),
  ('HOR-001', 'Perfil tiroideo', 'TSH, T3 y T4.', NULL);
