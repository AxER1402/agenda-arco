/**
 * Formateo para mostrar datos al usuario.
 *
 * Estas funciones NO calculan reglas de negocio: el vencimiento, la vigencia y
 * la disponibilidad los decide el backend. Aquí solo se presenta.
 */

/** '2026-08-10' → '10/08/2026' */
export function fechaLarga(fechaISO) {
  if (typeof fechaISO !== 'string') return '';
  const [anio, mes, dia] = fechaISO.slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '';
}

/** '2026-08-10' → 'lunes 10 de agosto' */
export function fechaConDiaSemana(fechaISO) {
  if (typeof fechaISO !== 'string') return '';

  // Se construye en UTC para que la zona horaria no desplace el día.
  const fecha = new Date(`${fechaISO.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return '';

  return new Intl.DateTimeFormat('es-GT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(fecha);
}

/** '09:00:00' → '09:00 AM' */
export function hora12(hora) {
  if (typeof hora !== 'string') return '';

  const [horasTexto, minutos = '00'] = hora.split(':');
  const horas = Number(horasTexto);
  if (Number.isNaN(horas)) return '';

  const sufijo = horas >= 12 ? 'PM' : 'AM';
  const horas12 = horas % 12 === 0 ? 12 : horas % 12;

  return `${String(horas12).padStart(2, '0')}:${minutos} ${sufijo}`;
}

/** '2026-08-11 19:25:35' → '11/08/2026 07:25 PM' */
export function fechaHora(valor) {
  if (typeof valor !== 'string') return '';

  const [fecha, hora = ''] = valor.replace('T', ' ').split(' ');
  const formateada = fechaLarga(fecha);

  return formateada && hora ? `${formateada} ${hora12(hora)}` : formateada;
}

/** '55555555' → '5555-5555' */
export function telefono(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  return digitos.length === 8 ? `${digitos.slice(0, 4)}-${digitos.slice(4)}` : String(valor ?? '');
}

/** '1111111111111' → '1111 11111 1111' */
export function dpi(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');

  return digitos.length === 13
    ? `${digitos.slice(0, 4)} ${digitos.slice(4, 9)} ${digitos.slice(9)}`
    : String(valor ?? '');
}

/** Fecha de hoy en formato ISO, en la zona horaria de Guatemala. */
export function hoyISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Variante de Badge que corresponde a cada estado de cita. */
export function varianteEstado(estado) {
  return (
    {
      PENDIENTE: 'secondary',
      CONFIRMADA: 'default',
      ATENDIDA: 'success',
      CANCELADA: 'outline',
      NO_ASISTIO: 'destructive',
    }[estado] ?? 'secondary'
  );
}

/** Color del aviso según lo cerca que esté el vencimiento de la orden. */
export function varianteVencimiento(diasParaVencer) {
  if (diasParaVencer === null || diasParaVencer === undefined) return 'secondary';
  if (diasParaVencer < 0) return 'destructive';
  if (diasParaVencer <= 7) return 'warning';
  return 'secondary';
}

/**
 * El nombre en mayúsculas y sin tildes mientras se escribe, para que se vea lo
 * que se va a guardar: 'María Peña' → 'MARIA PEÑA'. La Ñ se conserva porque es
 * otra letra, no una tilde.
 *
 * No recorta espacios: hacerlo a cada tecla impediría escribir el espacio entre
 * nombre y apellido. Eso, y la regla definitiva, lo aplica el backend al
 * guardar (`utils/nombre.js`).
 */
export function nombreEnMayusculas(texto) {
  return String(texto ?? '')
    .toUpperCase()
    .replace(/Ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'Ñ');
}
