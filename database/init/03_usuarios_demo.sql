-- ---------------------------------------------------------------------------
-- Usuarios de prueba. SOLO PARA DESARROLLO Y DEMOSTRACIÓN.
--
-- Antes de poner el sistema en uso real hay que:
--   1. Crear los usuarios reales del laboratorio desde la pantalla de usuarios.
--   2. Eliminar o desactivar estos dos.
--
-- Las contraseñas están hasheadas con bcrypt (10 rondas), el mismo algoritmo
-- que usa el backend. En ningún lugar del sistema se guarda texto plano.
--
--   Usuario  | Contraseña      | Rol
--   ---------+-----------------+------------------
--   admin    | Admin2026Arco   | ADMINISTRADOR
--   citas    | Citas2026Arco   | PERSONAL_CITAS
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

INSERT INTO usuarios (nombre_completo, usuario, password_hash, rol_id)
SELECT 'Administrador del sistema', 'admin',
       '$2b$10$A2StvkskHRqURTMi/RAfzeGIAH8ElBD4C0OD9cJv/9Auqmvi5DleK',
       r.id
  FROM roles r WHERE r.codigo = 'ADMINISTRADOR';

INSERT INTO usuarios (nombre_completo, usuario, password_hash, rol_id)
SELECT 'Personal de citas', 'citas',
       '$2b$10$wuiUk3/VljkBl/zVlKPYJuelkP0207ix2.ZJGN0696nM6HatcFKtS',
       r.id
  FROM roles r WHERE r.codigo = 'PERSONAL_CITAS';
