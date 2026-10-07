#!/usr/bin/env bash
#
# Ejecuta un caso del «Formato de Pruebas Estándar» por su identificador.
#
#   ./caso.sh AUT001     un caso concreto
#   ./caso.sh            la lista de casos disponibles
#   ./caso.sh AUT        todos los casos de un módulo
#
# Cada identificador corresponde a una ficha del documento y se traduce a un
# filtro de Jest (-t), que ejecuta solo las pruebas de esa ficha y salta el
# resto. Sirve para demostrar los casos de uno en uno.

set -u

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -t 1 ]; then
  NEGRITA=$'\033[1m'; APAGADO=$'\033[2m'; CIAN=$'\033[36m'; FIN=$'\033[0m'
else
  NEGRITA=''; APAGADO=''; CIAN=''; FIN=''
fi

# Los casos, en el mismo orden que el documento:
#   id | proyecto | archivo de prueba | filtro de Jest | escenario | técnica
# El filtro puede llevar varios tramos separados por «|»: Jest los entiende
# como alternativas de una expresión regular y ejecuta todas las pruebas de
# la ficha.
datos_crudos() {
  cat <<'DATOS'
AUT001|backend|auth.service|devuelve un token válido con credenciales correctas|registra el último acceso|Inicio de sesión correcto y contenido del token emitido|Caja blanca — unitaria (positiva)
AUT002|backend|auth.service|nunca devuelve el hash de la contraseña|La respuesta del login nunca viaja con el hash de la contraseña|Caja blanca — unitaria (seguridad)
AUT003|backend|auth.service|rechaza una contraseña incorrecta|rechaza a un usuario inactivo|Rechazo de contraseña incorrecta y de usuario inactivo|Caja blanca — unitaria (negativa)
AUT004|backend|auth.service|usa el mismo mensaje para usuario inexistente|no registra acceso si las credenciales fallan|El error del login no revela qué usuarios existen|Caja gris — seguridad (enumeración de usuarios)
AUT005|frontend|LoginPage|envía las credenciales al servicio|lleva al panel|Inicio de sesión desde la pantalla y llegada al Panel|Caja negra — funcional (ruta ideal)
AUT006|frontend|LoginPage|oculta la contraseña mientras se escribe|la muestra y la vuelve a ocultar|no envía el formulario|La contraseña se escribe oculta y el botón de verla no envía el formulario|Caja negra — funcional y de usabilidad
AUT007|backend|auth.service|cambiarContrasenaPropia|Cambio de la contraseña propia: se acepta y se rechaza|Caja blanca — unitaria (positiva y negativa)
PAC001|backend|paciente.service|guarda el teléfono normalizado|recorta los espacios del nombre|Alta de paciente con teléfono y nombre normalizados|Caja blanca — unitaria (positiva)
PAC002|backend|paciente.service|rechaza el teléfono inválido|Rechazo de teléfonos inválidos por valores límite|Caja negra — partición de equivalencia y valores límite
PAC003|backend|paciente.service|avisa si otro paciente ya usa ese teléfono|Teléfono repetido: avisa, pero no bloquea el registro|Caja gris — regla de negocio
PAC004|backend|paciente.service|DPI|Validación del DPI: normalización, opcionalidad y longitud|Caja negra — valores límite
PAC005|backend|paciente.service|WhatsApp|Cambiar el teléfono olvida lo que se sabía del WhatsApp|Caja blanca — unitaria (regla de consistencia)
PAC006|frontend|PacienteFormDialog|valida el teléfono en el cliente|acepta el teléfono válido|exige el nombre completo|El formulario valida antes de llamar al servidor|Caja negra — funcional (validación de entrada)
PAC007|frontend|PacienteFormDialog|precarga los datos al editar|muestra el aviso de teléfono repetido|Precarga al editar y aviso del servidor en pantalla|Caja negra — funcional (integración)
PAC008|backend|paciente.service|búsqueda|Búsqueda de pacientes, con paginación y sin los inactivos|Caja blanca — unitaria (positiva y valores límite)
CIT001|backend|recepcion.service|registra paciente, orden y cita de una sola vez|calcula el vencimiento de la orden|Recepción completa: paciente, orden y cita de una vez|Caja blanca — de integración entre servicios
CIT002|backend|recepcion.service|rechaza una cita posterior al vencimiento|último día de vigencia|no avisa nada raro|No se agenda tras el vencimiento; se sugieren fechas|Caja gris — valores límite sobre regla de negocio
CIT003|backend|recepcion.service|rechaza el día lleno|rechaza una fecha de recepción futura|rechaza si no se indica ningún examen|Día lleno: se rechaza sin escribir nada|Caja blanca — unitaria (orden de validaciones)
CIT004|backend|recepcion.service|Deshacer si la cita falla al final|Si la cita falla al final, se deshace lo creado|Caja blanca — unitaria (compensación ante error)
CIT005|backend|recepcion.service|Confirmación de WhatsApp en el mostrador|Guardar si el número tiene WhatsApp, incluido «sin preguntar»|Caja negra — partición de equivalencia
CIT006|backend|cita.service|Reprogramación de citas|Reagendar una cita cancelada|Reprogramar una cita sin salir de la vigencia ni del cupo|Caja gris — regla de negocio
CIT007|frontend|AccionesCita|Cancelar|Cancelar una cita desde la pantalla, con o sin motivo|Caja negra — funcional (interfaz)
CIT008|backend|cita.service|Estados de la cita|Cambios de estado de la cita: permitidos y prohibidos|Caja negra — transición de estados
CIT009|backend|cita.service|Historial de citas del paciente|Historial de citas de un paciente|Caja blanca — unitaria (positiva y negativa)
USU001|backend|usuario.service|rechaza un rol inexistente|Alta de usuario con un rol inexistente|Caja blanca — unitaria (negativa)
USU002|backend|usuario.service|usuario.service.actualizar|Edición de usuarios sin quedarse sin administrador activo|Caja gris — regla de negocio
USU003|backend|usuario.service|usuario.service.desactivar|Baja lógica de otro usuario, nunca de uno mismo|Caja blanca — unitaria (positiva y negativa)
USU004|backend|usuario.service|usuario.service.eliminar|Borrado definitivo con confirmación de identidad|Caja blanca — unitaria (orden de validaciones)
USU005|backend|usuario.service|crea el usuario con la contraseña cifrada|rechaza un nombre de acceso que ya existe|Alta correcta de un usuario y rechazo de un nombre repetido|Caja blanca — unitaria (positiva y negativa)
AGE001|backend|agenda.service|la vista de mes cubre el mes completo|genera la estructura de todos los días|marca los domingos como no laborables|La agenda mensual se arma sola, con los días no laborables marcados|Caja blanca — unitaria
AGE002|backend|agenda.service|la vista de día cubre un solo día|coloca cada cita en su día|calcula los espacios disponibles de cada día|devuelve capacidad, ocupación y espacios disponibles|Consulta de la agenda del día, con su ocupación|Caja blanca — unitaria
AGE003|backend|api.routes|GET /api/agenda|PATCH /api/agenda/configuracion|Gestión de la agenda por la API: vistas y límite diario según el rol|Caja negra — de integración (rutas HTTP)
AGE004|backend|agenda.service|disponibilidad.horasDisponibles|disponibilidad.sugerirFechas|Disponibilidad: horas libres y fechas con cupo|Caja gris — regla de negocio
REC001|backend|recordatorio.service|generarMensaje|hora de envío configurable|prepararParaFecha|Preparación del recordatorio: mensaje, día y hora de envío|Caja blanca — unitaria
REC002|backend|recordatorio.service|envío de recordatorios|enviarPendientes|enviarParaCita|Envío por WhatsApp y registro de su resultado|Caja gris — regla de negocio
REC003|whatsapp-service|message.service|message.service|Validación y entrega del mensaje en el servicio de WhatsApp|Caja negra — partición de equivalencia y valores límite
DATOS
}

listar() {
  printf '\n%sCasos disponibles%s  —  ejecútalos con %s./caso.sh AUT001%s\n\n' \
    "$NEGRITA" "$FIN" "$CIAN" "$FIN"
  while IFS= read -r linea; do
    id="${linea%%|*}"
    resto="${linea#*|}"
    # El escenario es el penúltimo campo y la técnica el último.
    tecnica="${resto##*|}"
    sin_tecnica="${resto%|*}"
    escenario="${sin_tecnica##*|}"
    printf '  %s%-8s%s %s\n           %s%s%s\n' \
      "$NEGRITA" "#$id" "$FIN" "$escenario" "$APAGADO" "$tecnica" "$FIN"
  done < <(datos_crudos)
  printf '\n'
}

buscar="${1:-}"

if [ -z "$buscar" ]; then
  listar
  exit 0
fi

# Se acepta con o sin almohadilla, en mayúsculas o minúsculas.
buscar="$(printf '%s' "$buscar" | tr '[:lower:]' '[:upper:]' | tr -d '#')"

encontrados=$(datos_crudos | grep -E "^${buscar}")

if [ -z "$encontrados" ]; then
  printf '\nNo hay ningún caso que empiece por %s#%s%s.\n' "$NEGRITA" "$buscar" "$FIN"
  listar
  exit 1
fi

salida_global=0

while IFS= read -r linea; do
  id="${linea%%|*}"
  resto="${linea#*|}"
  proyecto="${resto%%|*}"
  resto="${resto#*|}"
  archivo="${resto%%|*}"
  resto="${resto#*|}"

  tecnica="${resto##*|}"
  sin_tecnica="${resto%|*}"
  escenario="${sin_tecnica##*|}"
  patron="${sin_tecnica%|*}"

  printf '\n%s' "$CIAN"
  printf '─%.0s' $(seq 1 76)
  printf '%s\n' "$FIN"
  printf ' %sCASO #%s%s\n' "$NEGRITA" "$id" "$FIN"
  printf ' Escenario : %s\n' "$escenario"
  printf ' Técnica   : %s\n' "$tecnica"
  printf ' Archivo   : %s/src/tests/%s.test.%s\n' \
    "$proyecto" "$archivo" "$([ "$proyecto" = frontend ] && echo jsx || echo js)"
  printf '%s' "$CIAN"
  printf '─%.0s' $(seq 1 76)
  printf '%s\n\n' "$FIN"

  if [ "$proyecto" = "frontend" ]; then
    (cd "$RAIZ/frontend" && BABEL_ENV=test npx jest "$archivo" -t "$patron" --verbose)
  else
    (cd "$RAIZ/$proyecto" && npx jest "$archivo" -t "$patron" --verbose)
  fi

  [ $? -ne 0 ] && salida_global=1
done <<< "$encontrados"

exit $salida_global
