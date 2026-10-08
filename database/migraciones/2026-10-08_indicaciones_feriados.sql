-- Indicaciones por examen, hora predeterminada de la cita y días feriados.
--
-- * `examenes.indicaciones`: lo que el paciente debe saber antes de venir
--   (p. ej. que la muestra de orina no pase más de 1 hora en el frasco). Se
--   agrega al recordatorio solo si la cita incluye ese examen.
-- * `hora_cita_predeterminada`: la hora con la que llega el formulario de
--   nueva cita. Antes estaba fija a las 07:00 en el frontend.
-- * `dias_feriados`: fechas en que no se agenda, en JSON. Las marcadas como
--   anuales se repiten cada año.
--
-- El backend funciona sin las filas de configuración (usa 07:00 y ninguna
-- fecha feriada), pero la columna sí es necesaria:
--
--   docker compose exec -T database mysql -u root -p"$DB_ROOT_PASSWORD" el_arco \
--     < database/migraciones/2026-10-08_indicaciones_feriados.sql
--
-- El equivalente para bases nuevas ya está en `init/`.

SET NAMES utf8mb4;

ALTER TABLE examenes
  ADD COLUMN indicaciones VARCHAR(255) NULL AFTER descripcion;

-- Los exámenes de orina y heces del catálogo inicial. Si en esta base tienen
-- otro código, la indicación se escribe desde la pantalla de Exámenes.
UPDATE examenes
   SET indicaciones = 'La muestra de orina no debe pasar más de 1 hora dentro del frasco antes de entregarla.'
 WHERE codigo = 'ORI-001' AND indicaciones IS NULL;

UPDATE examenes
   SET indicaciones = 'La muestra de heces no debe pasar más de 1 hora dentro del frasco antes de entregarla.'
 WHERE codigo = 'HEC-001' AND indicaciones IS NULL;

INSERT INTO configuracion (clave, valor, descripcion)
VALUES ('hora_cita_predeterminada', '07:00',
        'Hora con la que llega el formulario de nueva cita.')
ON DUPLICATE KEY UPDATE clave = clave;

INSERT INTO configuracion (clave, valor, descripcion)
VALUES ('dias_feriados', '[]',
        'Feriados en JSON: [{fecha, descripcion, anual}]. Esos días no se agenda.')
ON DUPLICATE KEY UPDATE clave = clave;
