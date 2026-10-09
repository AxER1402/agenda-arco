# El Arco Laboratorios — Sistema de gestión de citas

Sistema web para el Laboratorio Clínico Biológico **El Arco Laboratorios**.
Digitaliza la agenda de pacientes derivados del IGSS, controla la vigencia de
las órdenes (3 meses desde su entrega), respeta un límite diario de pacientes y
automatiza los recordatorios de cita por WhatsApp.

Sustituye el manejo actual con hojas de cálculo de Google y mensajes enviados
uno por uno.

---

## Arquitectura

Cuatro servicios independientes, cada uno en su propio contenedor:

```text
┌─────────────────────────────┐
│          FRONTEND           │
│    React + Vite (SPA)       │  :5173
└──────────────┬──────────────┘
               │ HTTP / REST
               ▼
┌─────────────────────────────┐
│           BACKEND           │
│    Node.js + Express        │  :3000
└──────┬───────────────┬──────┘
       ▼               ▼
┌──────────────┐ ┌──────────────────┐
│   DATABASE   │ │ WHATSAPP SERVICE │
│   MySQL 8    │ │ whatsapp-web.js  │  :3001
│    :3306     │ └────────┬─────────┘
└──────────────┘          ▼
                     WhatsApp Web
```

### Decisiones técnicas

| Decisión | Motivo |
| --- | --- |
| Frontend y backend en contenedores separados | Se despliegan, escalan y reinician por separado; el frontend es estático en producción. |
| WhatsApp como servicio aparte | `whatsapp-web.js` levanta un Chromium real y puede caerse o pedir un QR nuevo. Aislarlo evita que arrastre al backend, y permite sustituirlo por la API oficial reescribiendo un solo archivo (`whatsapp-service/src/whatsapp/client.js`). |
| Comunicación interna con clave compartida | El `whatsapp-service` exige la cabecera `x-api-key`, comparada en tiempo constante. |
| Backend en CommonJS | Evita la configuración experimental de ESM en Jest. El frontend sí usa ESM porque Vite lo requiere. |
| Fechas como cadenas `YYYY-MM-DD` | La vigencia y la agenda se razonan por día calendario. Un objeto `Date` arrastra hora y zona horaria, y desplaza el día. |
| `fecha_vencimiento` almacenada | El cálculo vive **solo** en `orden.service.js`, pero el resultado se persiste para poder indexarlo y consultarlo sin recalcular. |
| Cupo verificado dentro de la transacción | Entre validar y escribir, otro usuario puede tomar el último espacio. Se recuenta con las filas del día bloqueadas (`FOR UPDATE`). |
| `node-cron` dentro del backend | Con 25–40 mensajes al día, una cola externa (Redis, RabbitMQ) complicaría el despliegue sin aportar nada. |
| shadcn/ui + Tailwind | Los componentes son código del propio repositorio (`src/components/ui/`), no una dependencia opaca: se pueden auditar y explicar uno por uno. |
| Reportes generados en el backend | El PDF (`pdfkit`) y el Word (`docx`) salen iguales desde cualquier equipo, sin depender de lo que tenga instalado quien los pide ni del diálogo de impresión del navegador. |
| Un documento neutro y dos generadores | `reporte.service` arma el reporte como título, indicadores y tablas, sin saber de PDF ni de Word; `src/reportes/` lo pinta. Las columnas se deciden una vez, no dos veces mal, y las pruebas leen el contenido sin abrir un binario. |



## Instalación

Requisitos: Docker y Docker Compose. Node.js 20+ solo si se quieren correr las
pruebas fuera de los contenedores.

```bash
cp .env.example .env
```

Editar `.env` y generar valores propios para los secretos:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -hex 24      # INTERNAL_API_KEY
```

Levantar todo:

```bash
docker compose up
```

| Servicio | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/api |
| Salud del backend | http://localhost:3000/api/health |
| Salud de la base | http://localhost:3000/api/health/db |
| WhatsApp service | http://localhost:3001/health |
| Estado de la instalación | http://localhost:5173/estado |

> **Al cambiar dependencias:** los `node_modules` viven en un volumen anónimo,
> así que reconstruir la imagen no basta. Hay que recrear el volumen:
> ```bash
> docker compose up -d --build --renew-anon-volumes backend
> ```

---

## Credenciales de prueba

Las crea `database/init/03_usuarios_demo.sql` al inicializar la base.
**Solo para desarrollo y demostración.**

| Usuario | Contraseña | Rol | Puede |
| --- | --- | --- | --- |
| `admin` | `Admin2026Arco` | Administrador | Todo, incluidos usuarios y configuración. |
| `citas` | `Citas2026Arco` | Personal de citas | Pacientes, órdenes, citas y agenda. |

---

## Cómo se usa

1. **Iniciar sesión** con cualquiera de los dos usuarios.
2. **Nueva cita** (desde Citas o Agenda). Es el único camino para crear citas y
   sigue el orden de la conversación en el mostrador:

   1. **Teléfono.** Si ese número ya está fichado, el nombre se rellena solo. Si
      lo comparten varios familiares, se elige cuál es. Si no lo usa nadie, se
      registra al paciente ahí mismo (nombre y, opcionalmente, DPI). Aquí se le
      pregunta también **si ese número tiene WhatsApp**: de eso depende que el
      recordatorio le llegue solo o que haya que llamarle.
   2. **Fecha de recepción** de la orden del IGSS. El sistema muestra hasta qué
      día se puede recibir al paciente.
   3. **Exámenes que trae.** Si alguno no está en el catálogo, se agrega sin
      salir del formulario.
   4. **Fecha y hora.** Viene propuesta la fecha con cupo más cercana al
      vencimiento y la hora de apertura del laboratorio (07:00); las dos se
      pueden cambiar por cualquier otra válida.

   No hay que registrar al paciente ni su orden por adelantado: los tres
   registros nacen de una sola operación, y si algo falla no queda nada a medias.
3. **Panel**: el estado del día, las **citas de mañana** —marcando a quién hay
   que llamar porque su número no tiene WhatsApp o su recordatorio falló— y las
   **citas de ayer**, para cerrar lo que quedó sin marcar. Las tres tablas
   llevan el mismo menú de acciones.
4. **Agenda** en vistas de día, semana y mes. Desde ahí se confirma, se marca
   como atendida o no asistió, se reprograma y se cancela.

   El menú de acciones de cualquier cita abre también la **ficha del paciente**
   —sus datos, sus órdenes del IGSS y su historial de citas— sin salir de la
   pantalla en la que se está trabajando.
5. **Citas**: el mismo listado pero filtrado por estado y periodo, en vez de por
   día. Incluye una columna **WhatsApp** con el estado del recordatorio de cada
   cita —notificado (con la fecha del envío), programado, falló, o sin
   notificar—, para saber de un vistazo a quién falta avisar. Desde aquí también
   se reagenda una cancelada y se elimina una creada por error.
6. **Pacientes**: búsqueda por nombre, teléfono o DPI, ficha con historial y
   edición de datos. El administrador puede además **eliminar** una ficha, que
   se lleva por delante sus citas y sus órdenes; es para el duplicado o el
   registro hecho sobre la persona equivocada, no para dar de baja a nadie.
7. **Exámenes**: catálogo de lo que se puede asignar a una cita. Todo el
   personal puede agregarlos, editarlos, desactivarlos y eliminarlos. Eliminar
   solo se permite con exámenes que ninguna cita ni orden usa; los demás se
   desactivan para que dejen de ofrecerse.
8. **Reportes**: se elige un periodo y se descarga en **PDF** —listo para
   imprimir— o en **Word** —para editarlo antes de entregarlo—. Son dos:
   el **listado de citas** del periodo (fecha, hora, paciente, teléfono,
   exámenes y estado, filtrable por estado y apaisado para que quepan los
   exámenes) y el **resumen de actividad** (cuántas citas hubo y cómo
   terminaron, asistencia, ocupación frente al límite diario, exámenes más
   pedidos y cómo fueron los recordatorios).
9. **Usuarios** (administrador): alta, edición —nombre, acceso, rol y estado—,
   cambio de contraseña, desactivación y borrado definitivo. Desactivar quita el
   acceso y conserva el historial; eliminar borra la fila. Un usuario inactivo se
   vuelve a activar desde el mismo formulario.
10. **Configuración** (administrador): límite diario, días de atención,
    horario, vigencia de las órdenes, hora de los recordatorios, redacción del
    mensaje que se envía y vinculación de WhatsApp.

El logotipo del laboratorio es **`frontend/public/logo.png`**, y de él salen la
marca de la barra lateral, la de la barra superior y la de la pantalla de
acceso. Es de trazo cian sobre fondo transparente, así que sobre el azul marino
de la barra va suelto (6,7:1) y sobre cualquier superficie clara se apoya en una
placa de marino: sobre blanco se queda en 2,3:1 y no se ve.

El icono de la pestaña es **`frontend/public/favicon.png`**: el mismo logotipo
recortado a su contenido y encajado en un cuadrado de 256 px, con el fondo
transparente. Va en un archivo aparte porque `logo.png` es de 3:2 y pesa de más
para un icono. Al cambiar el logotipo hay que regenerarlo.

### Vincular WhatsApp

1. Entrar como administrador a **Configuración → Vincular WhatsApp**. El código
   QR aparece como imagen en la pantalla y se renueva solo cada pocos segundos,
   porque WhatsApp invalida el anterior.
   El mismo código se imprime en la consola del contenedor, por si se prefiere
   escanearlo desde ahí:
   ```bash
   docker compose logs -f whatsapp-service
   ```
2. En el teléfono del laboratorio: WhatsApp → **Dispositivos vinculados** →
   **Vincular un dispositivo** → escanear.
3. El estado pasa a *Vinculado* y el QR desaparece. La sesión se guarda en el
   volumen `wa_session`, así que sobrevive a los reinicios.

Para **cambiar de teléfono** está el botón *Desvincular WhatsApp*, en la misma
pantalla y también solo para el administrador. Cierra la sesión, borra los datos
guardados en el volumen y deja el servicio pidiendo un código nuevo en el acto,
sin reiniciar el contenedor. Mientras no se vincule otra cuenta no salen
recordatorios: los pacientes de esos días hay que llamarlos.

Cuando la sesión no está vinculada, el mismo botón se llama *Olvidar la sesión
guardada* y hace lo propio: borrar lo que haya en el volumen y pedir un QR
nuevo. Aparece siempre que el servicio responda, no solo con la cuenta
vinculada, que es justo cuando hacía falta y no estaba.

La imagen del QR la genera el propio `whatsapp-service` y viaja como data URI:
la interfaz solo la pinta, sin necesitar ninguna librería de códigos QR.

> Si el contenedor se detiene de golpe, Chromium deja bloqueado el perfil y no
> volvería a arrancar. El servicio limpia esos bloqueos al iniciarse
> (`limpiarBloqueosDeSesion`), sin tocar los datos de la sesión vinculada.

Tres cosas más sostienen la sesión entre reinicios:

- **El servicio cierra Chromium al recibir la señal de parada** (`apagar`), y
  docker-compose le da 30 s para hacerlo. Matarlo a medio escribir dejaba el
  perfil dañado: al arrancar de nuevo la sesión parecía vinculada, pero ya no
  respondía al teléfono, y desde ahí ni enviaba mensajes ni se dejaba
  desvincular.
- **Desvincular borra los datos guardados por su cuenta**, sin depender de que
  el aviso al teléfono llegue. Si la sesión ya estaba muerta ese aviso se agota,
  y antes las credenciales sobrevivían: el servicio volvía a entrar con la misma
  sesión inservible en lugar de enseñar un código nuevo.
- **Una desconexión inesperada se recupera sola** (`recuperarDe`): si se cierra
  la sesión desde el teléfono o se cae WhatsApp Web, el servicio levanta un
  cliente nuevo a los pocos segundos y vuelve a pedir el QR. Antes se quedaba
  desconectado hasta reiniciar el contenedor.

### Cuándo se envían los recordatorios

Los de las citas del día siguiente salen solos, **el día anterior a la hora que
fije el laboratorio** en Configuración → *Hora de los recordatorios* (08:00 por
defecto, hora de Guatemala). Al guardarla, el proceso programado se remonta en
caliente: no hace falta reiniciar el backend ni tocar variables de entorno.

Salen **de uno en uno, con un minuto entre paciente y paciente**: el envío va
por un cliente no oficial de WhatsApp, y una ráfaga de mensajes iguales desde el
mismo número es lo que WhatsApp toma por automatizado y castiga bloqueando la
cuenta unas horas. Con 30 citas, la tanda dura una media hora. Nunca corren dos
tandas a la vez, y la pausa se puede cambiar con `RECORDATORIOS_PAUSA_MS`.

Además se pueden lanzar a mano de dos maneras:

- **Todos los de mañana**, desde Configuración. La petición responde en cuanto
  arranca la tanda (`202`) y los avisos siguen saliendo, uno por minuto, en
  segundo plano; el resultado de cada uno queda en el historial.
- **El de una cita concreta**, desde su menú de acciones en Citas o Agenda
  (`POST /api/recordatorios/cita/:citaId`). Sale en el momento, sin esperar a la
  hora programada; sirve cuando se agenda para el día siguiente ya entrada la
  tarde o cuando el envío automático falló. Reenviar uno ya enviado está
  permitido, y queda como un intento más sobre el mismo registro.

### Qué dice el recordatorio

El texto lo redacta el laboratorio en **Configuración → Mensaje del
recordatorio**. Entre llaves se intercalan los datos de cada cita:

| Dato | Se sustituye por |
| --- | --- |
| `{paciente}` | Nombre del paciente. |
| `{laboratorio}` | Nombre del laboratorio. |
| `{fecha}` | Fecha de la cita (DD/MM/AAAA). |
| `{hora}` | Hora de la cita (HH:MM AM/PM). |
| `{examenes}` | Exámenes de la cita, separados por comas. |
| `{etiqueta_examenes}` | «Examen» o «Exámenes», según cuántos haya. |

Una línea que solo existía por sus datos **desaparece si todos quedan vacíos**:
así `{etiqueta_examenes}: {examenes}` no deja unos dos puntos sueltos en la cita
que no lleva exámenes. La vista previa la arma el backend con una cita de
ejemplo, de modo que lo que se ve en pantalla es lo que se va a enviar; guardar
un dato que no existe se rechaza antes de aplicarlo.

También se puede adjuntar una **imagen** (PNG, JPG o WEBP de hasta 1 MB). Va con
el texto como pie de foto, en un solo mensaje, no en dos. Se guarda como data URI
en `configuracion.imagen_recordatorio`, es la misma para todos los avisos y se
adjunta la vigente en el momento del envío; dejarla vacía la quita.

### El recordatorio sigue a su cita

Cuelga de la **cita**, no del paciente: la clave única de `recordatorios` es
`cita_id`. Un paciente con varias citas recibe un aviso por cada una, y haber
avisado de la de un día no calla la del otro.

Dos consecuencias que el sistema resuelve solo:

- **Si la cita se reprograma**, su recordatorio se rehace: vuelve a pendiente, se
  regenera el mensaje con la fecha nueva y su envío se recoloca en la víspera
  correcta. Sin eso, el paciente se quedaría con el día viejo en el teléfono.
- **Si la cita se cancela**, su recordatorio ya no sale, aunque estuviera
  preparado y le tocara ese día. El estado de la cita se comprueba en el momento
  del envío, no solo al prepararlo.

### Confirmar antes de algo que no se deshace

Ninguna acción destructiva usa los cuadros del navegador: todas pasan por
`DialogoConfirmacion`, que explica qué va a ocurrir y se lee con calma. Un
`window.confirm` se cierra con Enter sin haberlo mirado, y en el menú de la cita
«Cancelar» y «Eliminar» son vecinas haciendo cosas muy distintas.

El **borrado definitivo de una cita o de un usuario pide la contraseña de quien
tiene la sesión abierta**. Es lo único del sistema que no se puede deshacer —lo
demás se reactiva—, y en un mostrador la sesión se queda abierta. La
comprobación es del servidor (`auth.service.confirmarIdentidad`), no del
diálogo: un cuadro del navegador se salta con las herramientas de desarrollo.

En usuarios conviven las dos salidas. **Desactivar** quita el acceso y conserva
quién registró cada cita; **Eliminar** borra la fila y no se puede recuperar
—las citas y las órdenes siguen ahí, pero se quedan sin autor—. Ni uno ni otro
se puede aplicar sobre uno mismo, y el sistema nunca se queda sin un
administrador activo.

En pacientes el borrado va más lejos, porque las claves foráneas de `citas` y
`ordenes` son RESTRICT: o se baja todo el historial del paciente en la misma
transacción, o no se puede borrar nada. Por eso el diálogo lo dice sin rodeos y
la respuesta devuelve cuántas citas y cuántas órdenes se llevó por delante. La
baja normal sigue siendo lógica.

Cancelar, en cambio, no pide contraseña: conserva la cita y se puede revertir.
Cerrar sesión también se confirma —el botón está a un palmo de los enlaces de la
barra lateral—, pero sin contraseña: no se pierde nada al volver a entrar.

Entrar lleva **siempre al panel**, sea cual sea la pantalla desde la que saltó la
sesión: el turno empieza por el resumen del día, no en medio de cualquier sitio.

### A quién hay que llamar

El recordatorio automático no sirve para todos. El panel marca **Llamar** en las
citas de mañana cuando el número no tiene WhatsApp (se pregunta al agendar) o
cuando el recordatorio se intentó y falló. Que el aviso siga en cola no cuenta:
todavía puede llegar solo.

---

## Reglas de negocio

### Vencimiento de las órdenes

Se calcula en `backend/src/services/orden.service.js` y en ningún otro sitio, a
partir de la **fecha de recepción** (el día que el IGSS entregó la orden).

```text
Recepción: 11/08/2026  →  Vencimiento: 11/11/2026
```

Si el día no existe en el mes destino se usa el último día de ese mes:
`30/11 + 3 meses = 28/02`, porque el 30 de febrero no existe.

### Vigencia

Una cita es válida si su fecha es **menor o igual** a la de vencimiento. El
propio día del vencimiento es válido; el siguiente ya no.

```text
Recibida el 11/08/2026, vence el 11/11/2026
09/11 ✓    10/11 ✓    11/11 ✓    12/11 ✗    13/11 ✗
```

Al rechazar, la API responde `422` con el motivo y hasta tres fechas sugeridas
que están dentro de la vigencia y tienen cupo. Si no queda ninguna, se avisa de
que el paciente necesita una orden nueva.

### Cita del IGSS

Si el paciente ya tiene cita en el IGSS (campo **Fecha cita IGSS** de la
recepción, opcional), los resultados tienen que estar para ese día. El último
día posible para la cita del laboratorio pasa a ser la **víspera** de la cita
del IGSS, pero solo cuando cae antes del vencimiento:

```text
Recibida el 01/10, vence el 01/01
Cita IGSS 01/12  →  la del laboratorio, a más tardar el 30/11
Cita IGSS 01/02  →  manda el vencimiento: a más tardar el 01/01
```

Las sugerencias, el calendario y la validación usan ese límite. Una fecha
posterior se rechaza con `422` y motivo `DESPUES_DE_CITA_IGSS`.

### Qué fecha se propone

Las sugerencias se cuentan **desde el vencimiento —o la víspera de la cita del
IGSS— hacia atrás**: se ofrece
primero el último día en que la orden todavía vale y que tenga cupo. Así se
aprovecha la vigencia completa en lugar de llenar los días próximos.

Por eso agendar cerca del vencimiento no genera ningún aviso; solo lo hay si la
cita cae justo el último día, porque entonces una inasistencia deja al paciente
sin margen para reprogramar.

### Límite diario

Configurable (40 por defecto). Las citas canceladas no ocupan cupo. Al llegar al
límite, la API responde `409` con fechas alternativas.

### Días de atención

Se marcan en Configuración y de fábrica vienen **los siete**. En un día sin
marcar la agenda responde `422` y propone otras fechas, y el calendario lo
muestra apagado. El laboratorio abre sábados y algunos domingos, así que la
opción por defecto es dejarlos abiertos y que sea el laboratorio quien cierre a
mano el día que no atienda: lo contrario obligaba a tocar la base de datos para
poder agendar un fin de semana.

### Estados de cita

```text
Pendiente ──> Confirmada ──> Atendida
    │  ^           │      └─> No asistió
    └──┼───────────┴────────> Cancelada
       └────────────────────────┘
              (reactivar)
```

Atendida y no asistió son definitivas: si un paciente no asistió y quiere
volver, se crea una cita nueva y el historial conserva ambas.

Una cita **cancelada sí se puede reagendar**: al darle fecha u hora nuevas
vuelve a *pendiente*. Como las canceladas no ocupan cupo, al reactivarla se
vuelven a comprobar la vigencia de la orden y el límite del día, y se rechaza
con fechas alternativas si ya no cabe.

---

## API

Todos los endpoints responden JSON. Los errores usan el formato
`{ "error": { "mensaje": "...", "detalles": ... } }`.

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/api/health`, `/api/health/db` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/auth/perfil` | Autenticado |
| PATCH | `/api/auth/contrasena` | Autenticado |
| GET/POST | `/api/usuarios` | Administrador |
| GET | `/api/usuarios/roles` | Administrador |
| GET/PATCH/DELETE | `/api/usuarios/:id` (el `DELETE` es baja lógica) | Administrador |
| DELETE | `/api/usuarios/:id/definitivo` (borrado definitivo; exige `contrasena` en el cuerpo) | Administrador |
| PATCH | `/api/usuarios/:id/contrasena` | Administrador |
| GET/POST | `/api/pacientes` | Autenticado |
| GET/PATCH | `/api/pacientes/:id` | Autenticado |
| GET | `/api/pacientes/telefono/:telefono` | Autenticado |
| DELETE | `/api/pacientes/:id` (baja lógica) | Administrador |
| DELETE | `/api/pacientes/:id/definitivo` (borra también sus citas y órdenes; exige `contrasena` en el cuerpo) | Administrador |
| GET/POST | `/api/examenes` | Autenticado |
| GET | `/api/examenes/:id` | Autenticado |
| PATCH | `/api/examenes/:id` (incluye `activo` para desactivar) | Autenticado |
| DELETE | `/api/examenes/:id` (borrado definitivo; 409 si está en uso) | Autenticado |
| GET/POST | `/api/ordenes` | Autenticado |
| GET | `/api/ordenes/vencimiento?fechaEntrega=&fechaCitaIgss=` (la segunda es opcional) | Autenticado |
| GET | `/api/ordenes/por-vencer?dias=` | Autenticado |
| GET/PATCH | `/api/ordenes/:id` | Autenticado |
| POST | `/api/citas/recepcion` (paciente + orden + cita) | Autenticado |
| POST | `/api/citas` (cita sobre una orden ya existente) | Autenticado |
| GET/PATCH | `/api/citas/:id` | Autenticado |
| DELETE | `/api/citas/:id` (borrado definitivo; exige `contrasena` en el cuerpo) | Autenticado |
| PATCH | `/api/citas/:id/estado` (incluye cancelar) | Autenticado |
| GET | `/api/citas/estados` | Autenticado |
| GET | `/api/citas/disponibilidad?fecha=` | Autenticado |
| GET | `/api/citas/sugerencias?desde=&hasta=` | Autenticado |
| GET | `/api/citas/paciente/:pacienteId` | Autenticado |
| GET | `/api/agenda?vista=dia\|semana\|mes&fecha=` | Autenticado |
| GET | `/api/agenda/resumen` | Autenticado |
| GET | `/api/reportes/citas?desde=&hasta=&estado=&formato=pdf\|docx` | Autenticado |
| GET | `/api/reportes/actividad?desde=&hasta=&formato=pdf\|docx` | Autenticado |
| GET | `/api/agenda/configuracion` | Autenticado |
| PATCH | `/api/agenda/configuracion` | Administrador |
| GET | `/api/recordatorios`, `/api/recordatorios/resumen` | Autenticado |
| POST | `/api/recordatorios/preparar`, `/enviar` | Autenticado |
| POST | `/api/recordatorios/cita/:citaId` (envío inmediato) | Autenticado |
| POST | `/api/recordatorios/:id/reintentar` | Autenticado |
| GET | `/api/recordatorios/plantilla` (texto e imagen) | Autenticado |
| POST | `/api/recordatorios/plantilla/previsualizar` | Autenticado |
| PUT | `/api/recordatorios/plantilla` | Administrador |
| GET | `/api/recordatorios/whatsapp/estado` | Autenticado |
| GET | `/api/recordatorios/whatsapp/qr` | Administrador |
| POST | `/api/recordatorios/whatsapp/desvincular` | Administrador |

Códigos: `200` correcto · `201` creado · `401` sin sesión o credenciales
inválidas · `403` sin permisos · `404` inexistente · `409` conflicto de negocio
(límite diario, transición de estado) · `422` datos inválidos o fuera de
vigencia · `429` demasiadas peticiones.

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usuario":"admin","contrasena":"Admin2026Arco"}'
```

---

## Seguridad

### Implementado

| Medida | Dónde |
| --- | --- |
| Contraseñas con bcrypt (10 rondas) | `backend/src/utils/password.js` |
| JWT firmado, con id, usuario y rol únicamente | `backend/src/utils/jwt.js` |
| Autenticación y autorización por rol en cada endpoint | `backend/src/middleware/auth.js` |
| Consultas parametrizadas en todo el acceso a datos | `backend/src/models/` |
| Validación de entradas por recurso | `backend/src/validators/` |
| Cabeceras de seguridad (helmet) y CORS restringido | `backend/src/app.js` |
| Límite de peticiones general y de login | `backend/src/app.js`, `auth.routes.js` |
| Clave interna comparada en tiempo constante | `whatsapp-service/src/middleware/apiKey.js` |
| Errores no controlados sin detalles ni stack al cliente | `backend/src/middleware/errorHandler.js` |
| Secretos solo por variables de entorno | `backend/src/config/env.js` |

Detalles que conviene poder explicar:

- **El login no revela qué usuarios existen.** Responde el mismo mensaje ante
  usuario inexistente, contraseña incorrecta o cuenta inactiva, y compara
  contra un hash ficticio cuando el usuario no existe para que el tiempo de
  respuesta tampoco lo delate.
- **El límite de login es por IP _y_ usuario.** Todo el laboratorio comparte una
  IP: si fuera solo por IP, que una persona se equivocara diez veces dejaría a
  toda la recepción bloqueada quince minutos.
- **`X-Forwarded-For` no se confía por defecto.** Hacerlo permitiría falsear la
  IP y saltarse el límite. Se activa con `TRUST_PROXY` solo si hay un proxy real
  delante.
- **Las tres consultas que interpolan valores en SQL** (`LIMIT`/`OFFSET` y las
  listas `IN (...)`) fuerzan los valores a entero antes de interpolarlos, porque
  MySQL no admite parámetros preparados en esas posiciones.
- **La protección de rutas del frontend es comodidad, no seguridad.** Quien
  controla el navegador puede saltársela; el backend revalida token y rol en
  cada petición.

Comprobado contra los contenedores en ejecución: inyección SQL en la búsqueda
(sin efecto), token manipulado y token con `alg: none` (`401`), acceso de
`PERSONAL_CITAS` a rutas de administrador (`403`), `x-api-key` ausente o
incorrecta en el whatsapp-service (`401`), límite de login (`429` al undécimo
intento), cabeceras de helmet presentes y ausencia de `password_hash` en las
respuestas.

### Riesgos conocidos y decisiones asumidas

| Riesgo | Estado |
| --- | --- |
| **Usuarios de prueba con contraseñas conocidas** en `03_usuarios_demo.sql`. | Aceptado para el ámbito académico. **Hay que eliminarlos antes de cualquier uso real.** |
| El token se guarda en `localStorage`, expuesto a XSS. | Asumido. La alternativa (cookie `httpOnly`) obliga a proteger contra CSRF; para el alcance del proyecto no compensa. React escapa el contenido por defecto y no se usa `dangerouslySetInnerHTML`. |
| No hay revocación de sesión: un JWT sigue siendo válido hasta que expira (8 h). | Asumido. Desactivar un usuario impide entrar de nuevo, pero no corta su sesión en curso. |
| MySQL (3306) y el whatsapp-service (3001) se publican en el host. | Solo para desarrollo. En producción deben quedar únicamente en la red interna de Docker. |
| La imagen de desarrollo del backend corre como root. | La de producción usa `USER node`. |
| Sin HTTPS. | Debe terminarlo un proxy delante (nginx, Caddy) en el despliegue real. |

### Antes de poner el sistema en uso real

1. Generar `JWT_SECRET` e `INTERNAL_API_KEY` nuevos y no reutilizar los de `.env.example`.
2. Cambiar `DB_PASSWORD` y `DB_ROOT_PASSWORD`.
3. Crear los usuarios reales y **eliminar `admin` y `citas`**.
4. Construir con `target: production` y no publicar los puertos de MySQL ni del whatsapp-service.
5. Poner un proxy con HTTPS delante y configurar `TRUST_PROXY=1`.
6. Programar copias de seguridad del volumen `db_data`.

---

## Pruebas

**530 pruebas automatizadas.** Ninguna toca la base de datos real, una cuenta
real de WhatsApp ni datos reales de pacientes.

```bash
cd backend           && npm test    # 370
cd whatsapp-service  && npm test    #  64
cd frontend          && npm test    #  96

# Dentro de Docker (los tres funcionan igual)
docker compose exec backend npm test
docker compose exec frontend npm test
docker compose exec whatsapp-service npm test
```

Cobertura con `npm run test:coverage` en cualquiera de los tres.

| Regla | Archivo |
| --- | --- |
| Vencimiento: antes, el mismo día y después; fin de mes; año bisiesto | `backend/src/tests/vencimiento.test.js` |
| Límite diario: con cupo, en el último espacio, lleno, y sugerencias | `backend/src/tests/cita.service.test.js` |
| Teléfono: `23232323` ✓, `2323232` ✗, `232323233` ✗ | `backend/src/tests/telefono.test.js` |
| DPI: opcional, `1111111111111` ✓ (13), `1111111111` ✗ (10) | `backend/src/tests/dpi.test.js` |
| Recepción: paciente + orden + cita en una operación, y deshacer si falla | `backend/src/tests/recepcion.service.test.js` |
| Citas: creación, reprogramación, cancelación, transiciones de estado | `backend/src/tests/cita.service.test.js` |
| Reagendar una cancelada (vuelve a pendiente y recupera cupo) y borrado definitivo | `backend/src/tests/cita.service.test.js` |
| El borrado exige la contraseña de la sesión, y se comprueba antes de tocar la base | `backend/src/tests/cita.service.test.js`, `api.routes.test.js` |
| Cancelar y eliminar piden confirmación; ninguna se dispara de un clic | `frontend/src/tests/AccionesCita.test.jsx` |
| Cerrar sesión se confirma, y volver atrás mantiene la sesión | `frontend/src/tests/AppLayout.test.jsx` |
| Entrar lleva al panel, venga de donde venga | `frontend/src/tests/LoginPage.test.jsx` |
| Recordatorios: citas de mañana, mensaje, registro y fallo de envío | `backend/src/tests/recordatorio.service.test.js` |
| Recordatorios: hora de envío configurable y envío individual | `backend/src/tests/recordatorio.service.test.js` |
| Un paciente con citas en dos días recibe un aviso por cada una | `backend/src/tests/recordatorio.service.test.js` |
| Mensaje redactado por el laboratorio: datos entre llaves y líneas que se borran | `backend/src/tests/recordatorio.service.test.js` |
| Imagen adjunta: se envía la configurada y se lee una sola vez por tanda | `backend/src/tests/recordatorio.service.test.js` |
| El mensaje con imagen sale en uno solo, con el texto como pie de foto | `whatsapp-service/src/tests/client.test.js` |
| Desvincular cierra la sesión, responde sin esperar a Chromium y vuelve a pedir un QR | `whatsapp-service/src/tests/client.test.js` |
| Desvincular borra las credenciales aunque el teléfono no conteste al cierre | `whatsapp-service/src/tests/bloqueoSesion.test.js` |
| Una desconexión inesperada levanta un cliente nuevo sin reiniciar el contenedor | `whatsapp-service/src/tests/client.test.js` |
| Ficha del paciente desde el menú de acciones de una cita | `frontend/src/tests/AccionesCita.test.jsx` |
| Al reprogramar, el recordatorio se rehace con la fecha nueva | `backend/src/tests/cita.service.test.js` |
| Panel: citas de mañana y de ayer, y a quién hay que llamar | `backend/src/tests/agenda.service.test.js` |
| Agenda día/semana/mes y sugerencia de fechas | `backend/src/tests/agenda.service.test.js` |
| Autenticación, roles y protección de endpoints | `backend/src/tests/auth.*.test.js`, `api.routes.test.js` |
| Usuarios: borrado definitivo con contraseña, ni sobre uno mismo ni sobre el último administrador | `backend/src/tests/usuario.service.test.js` |
| Contraseña nueva: se escribe dos veces, se puede ver y no se guarda si no coinciden | `frontend/src/tests/ContrasenaDialog.test.jsx` |
| Pacientes: el borrado definitivo pide la contraseña y arrastra citas y órdenes | `backend/src/tests/paciente.service.test.js` |
| La recepción propone la hora de apertura sin que haya que teclearla | `frontend/src/tests/RecepcionCitaDialog.test.jsx` |
| Reportes: qué columnas lleva cada uno, asistencia sobre citas cerradas y ocupación sobre días de atención | `backend/src/tests/reporte.service.test.js` |
| Los dos generadores producen un PDF y un `.docx` válidos, con tabla vacía y con listados que pasan de página | `backend/src/tests/reportes.render.test.js` |
| Validación de teléfono y DPI en el formulario | `frontend/src/tests/PacienteFormDialog.test.jsx` |
| Recepción: identificar por teléfono, vigencia, fecha propuesta y rechazos | `frontend/src/tests/RecepcionCitaDialog.test.jsx` |
| Acciones de la cita: menú, eliminar, reagendar, reactivar y recordatorio | `frontend/src/tests/AccionesCita.test.jsx` |
| Reloj del encabezado: hora de Guatemala, sea cual sea la del equipo | `frontend/src/tests/RelojEncabezado.test.jsx` |
| Estado del recordatorio: notificado, programado, falló o sin notificar | `frontend/src/tests/EstadoRecordatorio.test.jsx` |
| Editor del mensaje: insertar datos, vista previa y quitar la imagen | `frontend/src/tests/MensajeRecordatorioCard.test.jsx` |

### Mock de WhatsApp

`whatsapp-service/__mocks__/whatsapp-web.js.js` sustituye a la librería real y
simula los escenarios que importan: mensaje enviado (con imagen o sin ella),
número sin WhatsApp y error de envío.

> El doble `.js` es intencional: Jest busca el mock de un paquete en
> `__mocks__/<paquete>.js`, y el paquete ya se llama `whatsapp-web.js`. Al estar
> junto a `node_modules`, Jest lo aplica automáticamente aunque una prueba
> olvide llamar a `jest.mock()`.

---

## Base de datos

Nueve tablas con claves foráneas, restricciones e índices. El esquema y los
datos iniciales están en `database/init/` y se ejecutan solos la primera vez que
se crea el volumen. Ver [`database/README.md`](database/README.md).

```text
roles ──< usuarios
                │
pacientes ──< ordenes ──< orden_examenes >── examenes
     │            │
     └────────< citas >── estados_cita
                  │
                  ├──< cita_examenes >── examenes
                  └──< recordatorios

configuracion  (límite diario, horario, vigencia)
```

Pacientes, usuarios y exámenes nunca se borran: se desactivan. Lo normal en una
cita también es cancelarla, que conserva el historial; el borrado definitivo
(`DELETE /api/citas/:id`) existe solo para las citas creadas por error y arrastra
en cascada sus exámenes y su recordatorio.

**Cancelar no borra.** La cita cancelada sigue en la agenda con su estado a la
vista, libera su espacio del día y se puede reactivar o reagendar. Es la única
forma correcta de decir «este paciente no vendrá».

---

## Estructura del proyecto

```text
.
├── frontend/            React + Vite (SPA)
│   └── src/
│       ├── components/  ui/ (shadcn) + componentes por dominio
│       ├── pages/       Login, Panel, Pacientes, Citas, Agenda, Exámenes, Usuarios, Configuración
│       ├── services/    Llamadas HTTP al backend
│       ├── context/     Sesión (AuthContext)
│       ├── hooks/       Estado y efectos reutilizables
│       ├── lib/         Formato, validaciones de UX, cn()
│       └── tests/
│
├── backend/             API REST
│   └── src/
│       ├── routes/      Endpoints por recurso
│       ├── controllers/ Traducen HTTP ↔ servicios
│       ├── services/    Reglas de negocio
│       ├── models/      Acceso a datos (SQL)
│       ├── validators/  Validación de entradas
│       ├── middleware/  Autenticación, autorización, errores
│       ├── jobs/        Proceso diario de recordatorios
│       ├── config/      Entorno y pool de MySQL
│       ├── utils/       Fechas, teléfono, DPI, contraseñas, JWT, AppError
│       └── tests/
│
├── whatsapp-service/    Envío por WhatsApp Web
│   └── src/
│       ├── whatsapp/    Único punto que conoce whatsapp-web.js
│       ├── services/    Reglas del envío
│       ├── routes/      /status /qr /send-message
│       └── tests/
│
├── database/init/       Esquema y datos iniciales (solo al crear el volumen)
├── database/migraciones/ Cambios de esquema para bases que ya tienen datos
├── docker-compose.yml
└── .env                 (no versionado)
```

Regla de capas: los componentes React no contienen lógica de negocio, y los
controladores del backend no contienen reglas — delegan en `services/`.

---

## Fuera del alcance

Gestión interna del IGSS, Guatecompras, adjudicaciones, facturación,
contabilidad, inventario, diagnóstico médico, resultados de laboratorio y
administración de contratos. Las llamadas telefónicas automáticas quedan como
ampliación futura: el sistema ya registra qué números no tienen WhatsApp, que es
la información que esa ampliación necesitaría.
