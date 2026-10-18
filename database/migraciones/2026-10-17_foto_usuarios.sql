-- Agrega a los usuarios la foto de perfil de su cuenta de Google.
--
-- La escribe el backend cada vez que alguien entra con «Continuar con Google»,
-- así que no hace falta rellenarla: aparece en la próxima entrada de cada uno.
-- Es la dirección que entrega Google (lh3.googleusercontent.com), no la imagen.
--
-- Los scripts de `init/` solo corren al crear el volumen, así que este cambio
-- hay que aplicarlo a mano en una base que ya tenga datos:
--
--   docker compose exec -T database sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
--     < database/migraciones/2026-10-17_foto_usuarios.sql
--
-- El equivalente para bases nuevas ya está en `init/01_schema.sql`.

ALTER TABLE usuarios
  ADD COLUMN foto_url VARCHAR(512) NULL AFTER correo;
