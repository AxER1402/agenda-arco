-- Nombres de pacientes en mayúsculas y sin tildes.
--
-- Desde esta versión el backend guarda así los nombres nuevos y los que se
-- corrigen ("María José" → "MARIA JOSE"). Esta migración aplica la misma regla
-- a los pacientes que ya estaban registrados, para que la lista no quede
-- mezclada.
--
-- La Ñ se conserva ("PEÑA" no es "PENA"); el resto de acentos y la diéresis
-- se quitan. También se recortan los extremos y los espacios repetidos.
--
-- MODIFICA DATOS: haga un respaldo antes de aplicarla.
--
--   docker compose exec -T database sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" el_arco' < database/migraciones/2026-10-09_nombres_mayusculas.sql

SET NAMES utf8mb4;

UPDATE pacientes
   SET nombre_completo =
       REGEXP_REPLACE(TRIM(
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           UPPER(nombre_completo),
           'Á', 'A'), 'À', 'A'), 'Ä', 'A'), 'Â', 'A'),
           'É', 'E'), 'È', 'E'), 'Ë', 'E'), 'Ê', 'E'),
           'Í', 'I'), 'Ì', 'I'), 'Ï', 'I'), 'Î', 'I'),
           'Ó', 'O'), 'Ò', 'O'), 'Ö', 'O'), 'Ô', 'O'),
           'Ú', 'U'), 'Ù', 'U'), 'Ü', 'U'), 'Û', 'U')
       ), ' {2,}', ' ');
