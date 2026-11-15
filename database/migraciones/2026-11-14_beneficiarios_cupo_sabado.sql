-- Beneficiarios y cupo propio del sábado.
--
-- 1. Beneficiarios. Un hijo que llega con su papá no tiene teléfono: usa el del
--    papá. `titular_id` liga al beneficiario con el paciente dueño del número.
--    El beneficiario conserva una copia del teléfono (así las búsquedas, los
--    reportes y los recordatorios siguen leyendo `pacientes.telefono`), y el
--    backend la mantiene igual a la del titular cuando este cambia de número.
--    Si el titular se borra definitivamente, sus beneficiarios se quedan con el
--    número que tenían y dejan de estar ligados (ON DELETE SET NULL).
--
-- 2. Cupo del sábado. No hace falta escribir nada: mientras el laboratorio no
--    lo guarde en Configuración, el sábado usa el límite diario de siempre, así
--    que al aplicar la migración la agenda no cambia.
--
-- No borra ni modifica ningún dato existente. Se aplica a mano en una base que
-- ya tenga datos:
--
--   docker compose exec -T database sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
--     < database/migraciones/2026-11-14_beneficiarios_cupo_sabado.sql
--
-- El equivalente para bases nuevas ya está en `init/01_schema.sql` y
-- `init/02_seed.sql`.

ALTER TABLE pacientes
  ADD COLUMN titular_id INT UNSIGNED NULL AFTER dpi,
  ADD KEY idx_pacientes_titular (titular_id),
  ADD CONSTRAINT fk_pacientes_titular FOREIGN KEY (titular_id) REFERENCES pacientes (id)
    ON DELETE SET NULL;
