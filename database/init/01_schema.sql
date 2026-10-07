-- ---------------------------------------------------------------------------
-- El Arco Laboratorios - esquema de base de datos
-- MySQL 8.0 / InnoDB / utf8mb4
--
-- Notas de diseño:
--  * Las fechas de cita y de orden son DATE (sin hora) porque la vigencia del
--    IGSS se evalúa por día calendario. La hora de la cita vive aparte (TIME).
--  * fecha_vencimiento se ALMACENA aunque sea derivable de fecha_entrega: el
--    cálculo lo hace el backend (regla de negocio única) y aquí se persiste
--    para poder indexarla y consultarla sin recalcular.
--  * estados_cita es tabla catálogo (el negocio puede consultarlos y se
--    referencian por FK). El estado del recordatorio es ENUM porque es un
--    detalle técnico del envío, no un catálogo administrable.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET time_zone = '-06:00';

-- --- Seguridad -------------------------------------------------------------

CREATE TABLE roles (
  id            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  codigo        VARCHAR(30)    NOT NULL,
  nombre        VARCHAR(60)    NOT NULL,
  descripcion   VARCHAR(255)   NULL,
  creado_en     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_codigo (codigo)
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre_completo VARCHAR(120)  NOT NULL,
  usuario         VARCHAR(50)   NOT NULL,
  password_hash   VARCHAR(255)  NOT NULL,
  rol_id          INT UNSIGNED  NOT NULL,
  activo          BOOLEAN       NOT NULL DEFAULT TRUE,
  ultimo_acceso   DATETIME      NULL,
  creado_en       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_usuario (usuario),
  KEY idx_usuarios_rol (rol_id),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- --- Pacientes y exámenes --------------------------------------------------

CREATE TABLE pacientes (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre_completo VARCHAR(150)  NOT NULL,
  telefono        CHAR(8)       NOT NULL,
  -- Opcional: mucha gente llega sin el documento. Si se registra, va completo.
  dpi             CHAR(13)      NULL,
  -- NULL = todavía no se sabe si el número tiene WhatsApp. Se actualiza con el
  -- resultado real de los intentos de envío (requisito 19).
  tiene_whatsapp  BOOLEAN       NULL DEFAULT NULL,
  notas           VARCHAR(255)  NULL,
  activo          BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pacientes_nombre (nombre_completo),
  KEY idx_pacientes_telefono (telefono),
  KEY idx_pacientes_dpi (dpi),
  -- Regla del requisito 10: teléfono de Guatemala = exactamente 8 dígitos.
  -- La validación principal vive en el backend; esta restricción es la última
  -- línea de defensa para que no entre basura por otra vía.
  CONSTRAINT chk_pacientes_telefono CHECK (telefono REGEXP '^[0-9]{8}$'),
  -- El DPI puede faltar, pero no puede quedar a medias: 13 dígitos exactos.
  CONSTRAINT chk_pacientes_dpi CHECK (dpi IS NULL OR dpi REGEXP '^[0-9]{13}$')
) ENGINE=InnoDB;

CREATE TABLE examenes (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo        VARCHAR(30)   NOT NULL,
  nombre        VARCHAR(150)  NOT NULL,
  descripcion   VARCHAR(255)  NULL,
  activo        BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_examenes_codigo (codigo),
  KEY idx_examenes_nombre (nombre)
) ENGINE=InnoDB;

-- --- Órdenes del IGSS ------------------------------------------------------

CREATE TABLE ordenes (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  paciente_id       INT UNSIGNED  NOT NULL,
  numero_orden      VARCHAR(50)   NULL,
  fecha_entrega     DATE          NOT NULL,
  fecha_vencimiento DATE          NOT NULL,
  -- Cita del paciente en el IGSS: la del laboratorio tiene que ser antes.
  fecha_cita_igss   DATE          NULL,
  observaciones     VARCHAR(255)  NULL,
  creado_por        INT UNSIGNED  NULL,
  creado_en         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ordenes_paciente (paciente_id),
  KEY idx_ordenes_vencimiento (fecha_vencimiento),
  CONSTRAINT fk_ordenes_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ordenes_usuario FOREIGN KEY (creado_por) REFERENCES usuarios (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_ordenes_fechas CHECK (fecha_vencimiento >= fecha_entrega)
) ENGINE=InnoDB;

CREATE TABLE orden_examenes (
  orden_id   INT UNSIGNED NOT NULL,
  examen_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (orden_id, examen_id),
  KEY idx_orden_examenes_examen (examen_id),
  CONSTRAINT fk_orden_examenes_orden FOREIGN KEY (orden_id) REFERENCES ordenes (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_orden_examenes_examen FOREIGN KEY (examen_id) REFERENCES examenes (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- --- Agenda ----------------------------------------------------------------

CREATE TABLE estados_cita (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo  VARCHAR(20)  NOT NULL,
  nombre  VARCHAR(40)  NOT NULL,
  -- Un estado final ya no cuenta como espacio ocupado reprogramable.
  es_final BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Si ocupa cupo del límite diario (CANCELADA no ocupa).
  ocupa_cupo BOOLEAN   NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_estados_cita_codigo (codigo)
) ENGINE=InnoDB;

CREATE TABLE citas (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  paciente_id   INT UNSIGNED NOT NULL,
  orden_id      INT UNSIGNED NOT NULL,
  estado_id     INT UNSIGNED NOT NULL,
  fecha         DATE         NOT NULL,
  hora          TIME         NOT NULL,
  notas         VARCHAR(255) NULL,
  creado_por    INT UNSIGNED NULL,
  creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_citas_fecha (fecha),
  KEY idx_citas_fecha_estado (fecha, estado_id),
  KEY idx_citas_paciente (paciente_id),
  KEY idx_citas_orden (orden_id),
  CONSTRAINT fk_citas_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_citas_orden FOREIGN KEY (orden_id) REFERENCES ordenes (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_citas_estado FOREIGN KEY (estado_id) REFERENCES estados_cita (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_citas_usuario FOREIGN KEY (creado_por) REFERENCES usuarios (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- Exámenes que efectivamente se realizarán en la cita. Puede ser un
-- subconjunto de los exámenes de la orden.
CREATE TABLE cita_examenes (
  cita_id    INT UNSIGNED NOT NULL,
  examen_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (cita_id, examen_id),
  KEY idx_cita_examenes_examen (examen_id),
  CONSTRAINT fk_cita_examenes_cita FOREIGN KEY (cita_id) REFERENCES citas (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cita_examenes_examen FOREIGN KEY (examen_id) REFERENCES examenes (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- --- Recordatorios ---------------------------------------------------------

CREATE TABLE recordatorios (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cita_id           INT UNSIGNED NOT NULL,
  -- Se guarda el teléfono usado en el intento: el del paciente puede cambiar
  -- después y el historial del envío debe seguir siendo fiel.
  telefono          CHAR(8)      NOT NULL,
  mensaje           TEXT         NOT NULL,
  estado            ENUM('PENDIENTE','ENVIADO','FALLIDO') NOT NULL DEFAULT 'PENDIENTE',
  intentos          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  error_mensaje     VARCHAR(255) NULL,
  programado_para   DATETIME     NOT NULL,
  enviado_en        DATETIME     NULL,
  creado_en         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Un recordatorio por cita: evita envíos duplicados si el job corre dos veces.
  UNIQUE KEY uq_recordatorios_cita (cita_id),
  KEY idx_recordatorios_estado (estado, programado_para),
  CONSTRAINT fk_recordatorios_cita FOREIGN KEY (cita_id) REFERENCES citas (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- --- Configuración del laboratorio ----------------------------------------

CREATE TABLE configuracion (
  clave          VARCHAR(60)  NOT NULL,
  -- MEDIUMTEXT y no VARCHAR: aquí caben la plantilla del recordatorio (varias
  -- líneas) y la imagen que se adjunta, guardada como data URI en base64.
  valor          MEDIUMTEXT   NOT NULL,
  descripcion    VARCHAR(255) NULL,
  actualizado_por INT UNSIGNED NULL,
  actualizado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clave),
  CONSTRAINT fk_configuracion_usuario FOREIGN KEY (actualizado_por) REFERENCES usuarios (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
