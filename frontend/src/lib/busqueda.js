/**
 * Búsqueda de texto libre sobre las citas ya cargadas en pantalla.
 *
 * Sin mayúsculas ni tildes: en el mostrador se teclea rápido, "maria" tiene que
 * encontrar a "María". El teléfono se compara solo por sus dígitos, así que da
 * igual escribirlo con guion o sin él.
 */

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * ¿La cita coincide con lo buscado?
 *
 * Mira el nombre del paciente, su teléfono, el número de orden, los exámenes
 * (nombre o código) y las notas. Cada palabra tiene que aparecer en alguno de
 * esos campos: "ana glucosa" encuentra a Ana López con su glucosa.
 *
 * @param {object} cita
 * @param {string} termino
 */
export function coincideCita(cita, termino) {
  const palabras = normalizar(termino).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;

  const texto = normalizar(
    [
      cita.paciente_nombre,
      cita.numero_orden,
      cita.notas,
      ...(cita.examenes ?? []).flatMap((examen) => [examen.nombre, examen.codigo]),
    ].join(' '),
  );
  const telefono = String(cita.paciente_telefono ?? '').replace(/\D/g, '');

  return palabras.every((palabra) => {
    const digitos = palabra.replace(/\D/g, '');
    const esNumero = digitos.length > 0 && digitos.length === palabra.replace(/-/g, '').length;
    return texto.includes(palabra) || (esNumero && telefono.includes(digitos));
  });
}
