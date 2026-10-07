-- Agrega a la orden la fecha de la cita que el paciente tiene en el IGSS.
--
-- Los resultados tienen que estar antes de esa cita, así que la cita del
-- laboratorio se busca hasta el día anterior a ella cuando cae antes del
-- vencimiento de la orden. Es opcional: no todos los pacientes la saben.
--
-- Los scripts de `init/` solo corren al crear el volumen, así que este cambio
-- hay que aplicarlo a mano en una base que ya tenga datos:
--
--   docker compose exec -T database mysql -u root -p"$DB_ROOT_PASSWORD" el_arco \
--     < database/migraciones/2026-10-07_fecha_cita_igss.sql
--
-- El equivalente para bases nuevas ya está en `init/01_schema.sql`.

ALTER TABLE ordenes
  ADD COLUMN fecha_cita_igss DATE NULL AFTER fecha_vencimiento;
