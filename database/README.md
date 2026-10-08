# Base de datos

MySQL 8.0. Los scripts de `init/` se ejecutan **una sola vez**, cuando el volumen
`db_data` se crea por primera vez, en orden alfabético:

| Archivo | Contenido |
| --- | --- |
| `01_schema.sql` | Tablas, claves foráneas, restricciones e índices. |
| `02_seed.sql` | Catálogos (roles, estados de cita), configuración inicial y exámenes de ejemplo. |
| `03_usuarios_demo.sql` | Usuarios de prueba con contraseña hasheada. Se añade en la **fase 2** (autenticación), porque el hash debe generarse con el mismo algoritmo que usa el backend. |

## Migraciones

`init/` no vuelve a ejecutarse nunca en una base que ya existe. Los cambios de
esquema posteriores viven en `migraciones/` y se aplican a mano, además de estar
ya reflejados en `init/01_schema.sql` para las instalaciones nuevas.

```bash
docker compose exec -T database mysql -u root -p"$DB_ROOT_PASSWORD" el_arco \
  < database/migraciones/2026-08-11_dpi_paciente.sql
```

| Migración | Qué cambia |
| --- | --- |
| `2026-08-11_dpi_paciente.sql` | Agrega el DPI (opcional, 13 dígitos) al paciente. |
| `2026-10-07_fecha_cita_igss.sql` | Agrega a la orden la fecha de la cita del paciente en el IGSS. |
| `2026-08-11_hora_recordatorios.sql` | Hora configurable del envío de recordatorios. |
| `2026-08-11_plantilla_recordatorio.sql` | Mensaje del recordatorio editable y con imagen opcional. `configuracion.valor` pasa a `MEDIUMTEXT`. |
| `2026-10-08_indicaciones_feriados.sql` | Indicaciones por examen para el recordatorio, hora predeterminada de la cita y feriados. |

## Volver a aplicar los scripts

Editar un `.sql` no basta: hay que destruir el volumen para que MySQL vuelva a
ejecutar la inicialización.

```bash
docker compose down -v
docker compose up
```

> `-v` borra todos los datos de la base. No usarlo en un entorno con datos reales.

## Conectarse a la base

```bash
docker compose exec database mysql -u arco_app -p el_arco
```

## Diagrama de relaciones

```text
roles ──< usuarios
                │
pacientes ──< ordenes ──< orden_examenes >── examenes
     │            │
     └────────< citas >── estados_cita
                  │
                  ├──< cita_examenes >── examenes
                  └──< recordatorios
```
