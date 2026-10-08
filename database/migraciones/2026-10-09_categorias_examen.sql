-- Categorías de exámenes.
--
-- Una categoría (Sangre, Orina...) lleva una indicación común, como el ayuno
-- de 12 horas. El recordatorio la incluye una sola vez por cita aunque el
-- paciente traiga varios exámenes de esa categoría. Las categorías se crean y
-- se asignan desde la pantalla de Exámenes.
--
-- Solo agrega una tabla y una columna opcional: no cambia ningún dato.
-- Requiere haber aplicado antes 2026-10-08_indicaciones_feriados.sql.
--
--   docker compose exec -T database sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" el_arco' < database/migraciones/2026-10-09_categorias_examen.sql
--
-- El equivalente para bases nuevas ya está en `init/01_schema.sql`.

SET NAMES utf8mb4;

CREATE TABLE categorias_examen (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(80)   NOT NULL,
  indicaciones  VARCHAR(255)  NULL,
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_examen_nombre (nombre)
) ENGINE=InnoDB;

ALTER TABLE examenes
  ADD COLUMN categoria_id INT UNSIGNED NULL AFTER indicaciones,
  ADD KEY idx_examenes_categoria (categoria_id),
  ADD CONSTRAINT fk_examenes_categoria FOREIGN KEY (categoria_id)
    REFERENCES categorias_examen (id) ON UPDATE CASCADE ON DELETE SET NULL;
