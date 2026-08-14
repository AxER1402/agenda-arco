-- Mensaje del recordatorio editable, con imagen opcional.
--
-- Antes el texto estaba escrito dentro del backend. Ahora lo redacta el
-- laboratorio desde Configuración, y puede adjuntar una imagen que viaja con
-- el mensaje de WhatsApp.
--
-- `valor` pasa de VARCHAR(255) a MEDIUMTEXT: la plantilla ocupa varias líneas y
-- la imagen se guarda como data URI en base64, que no cabe en 255 caracteres.
--
--   docker compose exec -T database mysql -u root -p"$DB_ROOT_PASSWORD" el_arco \
--     < database/migraciones/2026-08-11_plantilla_recordatorio.sql

ALTER TABLE configuracion MODIFY valor MEDIUMTEXT NOT NULL;

-- El backend funciona sin estas filas —usa la plantilla por defecto y ninguna
-- imagen—, pero conviene insertarlas para que queden explícitas.
INSERT INTO configuracion (clave, valor, descripcion)
VALUES ('plantilla_recordatorio',
        'Estimado(a) {paciente}:\n\nLe recordamos que tiene una cita programada en {laboratorio}.\n\nFecha: {fecha}\nHora: {hora}\n{etiqueta_examenes}: {examenes}\n\nAgradecemos su puntualidad.',
        'Texto que se envía por WhatsApp como recordatorio de cita.')
ON DUPLICATE KEY UPDATE clave = clave;

INSERT INTO configuracion (clave, valor, descripcion)
VALUES ('imagen_recordatorio', '',
        'Imagen adjunta al recordatorio (data URI en base64). Vacío = sin imagen.')
ON DUPLICATE KEY UPDATE clave = clave;
