-- Hora a la que se envían los recordatorios del día anterior a la cita.
--
-- Antes era fija (variable de entorno CRON_RECORDATORIOS); ahora la decide el
-- laboratorio desde Configuración. El backend funciona sin esta fila —usa 08:00
-- por defecto—, pero conviene insertarla para que quede explícita.
--
--   docker compose exec -T database mysql -u root -p"$DB_ROOT_PASSWORD" el_arco \
--     < database/migraciones/2026-08-11_hora_recordatorios.sql

INSERT INTO configuracion (clave, valor, descripcion)
VALUES ('hora_recordatorios', '08:00',
        'Hora a la que se envían los recordatorios del día siguiente.')
ON DUPLICATE KEY UPDATE clave = clave;
