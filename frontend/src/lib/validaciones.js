/**
 * Validación en el cliente.
 *
 * Es solo para dar respuesta inmediata al usuario: la validación que decide
 * es siempre la del backend (requisito 10). Estas reglas replican las suyas
 * pero nunca las sustituyen.
 */

const OCHO_DIGITOS = /^[0-9]{8}$/;
const TRECE_DIGITOS = /^[0-9]{13}$/;

/** Quita espacios, guiones y el código de país, igual que el backend. */
export function normalizarTelefono(valor) {
  let digitos = String(valor ?? '').replace(/\D/g, '');

  if (digitos.length === 11 && digitos.startsWith('502')) {
    digitos = digitos.slice(3);
  }

  return digitos;
}

export function esTelefonoValido(valor) {
  return OCHO_DIGITOS.test(normalizarTelefono(valor));
}

/** @returns {string|null} mensaje de error, o null si el valor es correcto. */
export function validarTelefono(valor) {
  if (!String(valor ?? '').trim()) return 'El teléfono es obligatorio.';
  return esTelefonoValido(valor)
    ? null
    : 'El teléfono debe ser un número de Guatemala de 8 dígitos.';
}

export function normalizarDpi(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * El DPI es opcional, pero si lo escriben tiene que estar completo: son 13
 * dígitos. 1111111111111 vale; 1111111111 no, porque solo tiene 10.
 *
 * @returns {string|null} mensaje de error, o null si el valor es correcto.
 */
export function validarDpi(valor) {
  const digitos = normalizarDpi(valor);

  if (digitos === '') return null;
  if (TRECE_DIGITOS.test(digitos)) return null;

  return `El DPI debe tener 13 dígitos (lleva ${digitos.length}).`;
}

export function validarNombre(valor) {
  const limpio = String(valor ?? '').trim();
  if (!limpio) return 'El nombre completo es obligatorio.';
  if (limpio.length < 3) return 'El nombre completo es demasiado corto.';
  if (limpio.length > 150) return 'El nombre completo es demasiado largo.';
  return null;
}

export function validarObligatorio(valor, nombreCampo) {
  return String(valor ?? '').trim() ? null : `${nombreCampo} es obligatorio.`;
}

/** Ejecuta un conjunto de validaciones y devuelve solo los campos con error. */
export function validarFormulario(reglas) {
  return Object.fromEntries(
    Object.entries(reglas)
      .map(([campo, resultado]) => [campo, resultado])
      .filter(([, resultado]) => resultado !== null),
  );
}
