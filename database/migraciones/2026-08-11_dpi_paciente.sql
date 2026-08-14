-- Agrega el DPI (opcional) al paciente.
--
-- Los scripts de `init/` solo corren al crear el volumen, así que este cambio
-- hay que aplicarlo a mano en una base que ya tenga datos:
--
--   docker compose exec -T database mysql -u root -p"$DB_ROOT_PASSWORD" el_arco \
--     < database/migraciones/2026-08-11_dpi_paciente.sql
--
-- El equivalente para bases nuevas ya está en `init/01_schema.sql`.

ALTER TABLE pacientes
  ADD COLUMN dpi CHAR(13) NULL AFTER telefono,
  ADD KEY idx_pacientes_dpi (dpi),
  -- El DPI puede faltar, pero no puede quedar a medias: 13 dígitos exactos.
  ADD CONSTRAINT chk_pacientes_dpi CHECK (dpi IS NULL OR dpi REGEXP '^[0-9]{13}$');
