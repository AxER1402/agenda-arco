-- Agrega a los usuarios el correo de Google con el que pueden entrar.
--
-- Es opcional: un usuario sin correo sigue entrando solo con su nombre de
-- acceso y su contraseña. El índice único impide vincular el mismo correo a
-- dos usuarios; MySQL admite varios NULL en un índice único, así que los que
-- no tienen correo no chocan entre sí.
--
-- Los scripts de `init/` solo corren al crear el volumen, así que este cambio
-- hay que aplicarlo a mano en una base que ya tenga datos:
--
--   docker compose exec -T database mysql -u root -p"$DB_ROOT_PASSWORD" el_arco \
--     < database/migraciones/2026-10-17_correo_usuarios.sql
--
-- El equivalente para bases nuevas ya está en `init/01_schema.sql`.

ALTER TABLE usuarios
  ADD COLUMN correo VARCHAR(254) NULL AFTER usuario,
  ADD UNIQUE KEY uq_usuarios_correo (correo);
